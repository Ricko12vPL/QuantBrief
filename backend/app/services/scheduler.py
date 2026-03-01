import asyncio
import logging
import uuid
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.models.schedule import Schedule, ScheduleFrequency, TickerSource

logger = logging.getLogger(__name__)

MAX_SCHEDULES = 10


class SchedulerService:
    def __init__(self) -> None:
        self._scheduler = AsyncIOScheduler()
        self._schedules: dict[str, Schedule] = {}
        self._lock = asyncio.Lock()
        self._briefs: list | None = None

    def start(self) -> None:
        self._scheduler.start()
        logger.info("Scheduler started")

    def shutdown(self) -> None:
        self._scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")

    def list_schedules(self) -> list[Schedule]:
        return list(self._schedules.values())

    def get_schedule(self, schedule_id: str) -> Schedule | None:
        return self._schedules.get(schedule_id)

    def create_schedule(
        self,
        name: str,
        ticker_source: TickerSource,
        frequency: ScheduleFrequency,
        tickers: list[str] | None = None,
        hour: int = 9,
        minute: int = 0,
        day_of_week: int = 0,
        language: str = "en",
        generate_audio: bool = True,
    ) -> Schedule:
        if len(self._schedules) >= MAX_SCHEDULES:
            raise ValueError("Maximum number of schedules reached")

        schedule_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc)

        schedule = Schedule(
            id=schedule_id,
            name=name or "Unnamed Schedule",
            ticker_source=ticker_source,
            tickers=tickers or [],
            frequency=frequency,
            hour=hour,
            minute=minute,
            day_of_week=day_of_week,
            language=language,
            generate_audio=generate_audio,
            paused=False,
            created_at=now,
        )

        trigger = self._build_trigger(schedule)
        self._scheduler.add_job(
            self._execute_schedule,
            trigger=trigger,
            id=schedule_id,
            args=[schedule_id],
            replace_existing=True,
        )

        job = self._scheduler.get_job(schedule_id)
        if job and job.next_run_time:
            schedule = schedule.model_copy(
                update={"next_run_at": job.next_run_time}
            )

        self._schedules[schedule_id] = schedule
        return schedule

    def update_schedule(self, schedule_id: str, **fields: object) -> Schedule:
        schedule = self._schedules.get(schedule_id)
        if schedule is None:
            raise KeyError(f"Schedule {schedule_id} not found")

        schedule = schedule.model_copy(update=fields)
        self._schedules[schedule_id] = schedule

        if not schedule.paused:
            trigger = self._build_trigger(schedule)
            self._scheduler.reschedule_job(schedule_id, trigger=trigger)
            job = self._scheduler.get_job(schedule_id)
            if job and job.next_run_time:
                schedule = schedule.model_copy(
                    update={"next_run_at": job.next_run_time}
                )
                self._schedules[schedule_id] = schedule

        return schedule

    def delete_schedule(self, schedule_id: str) -> None:
        if schedule_id not in self._schedules:
            raise KeyError(f"Schedule {schedule_id} not found")
        try:
            self._scheduler.remove_job(schedule_id)
        except Exception:
            pass
        del self._schedules[schedule_id]

    def pause_schedule(self, schedule_id: str) -> Schedule:
        schedule = self._schedules.get(schedule_id)
        if schedule is None:
            raise KeyError(f"Schedule {schedule_id} not found")
        self._scheduler.pause_job(schedule_id)
        schedule = schedule.model_copy(
            update={"paused": True, "next_run_at": None}
        )
        self._schedules[schedule_id] = schedule
        return schedule

    def resume_schedule(self, schedule_id: str) -> Schedule:
        schedule = self._schedules.get(schedule_id)
        if schedule is None:
            raise KeyError(f"Schedule {schedule_id} not found")
        self._scheduler.resume_job(schedule_id)
        job = self._scheduler.get_job(schedule_id)
        next_run = job.next_run_time if job else None
        schedule = schedule.model_copy(
            update={"paused": False, "next_run_at": next_run}
        )
        self._schedules[schedule_id] = schedule
        return schedule

    def _build_trigger(self, schedule: Schedule) -> IntervalTrigger | CronTrigger:
        if schedule.frequency == ScheduleFrequency.EVERY_4H:
            return IntervalTrigger(hours=4)
        if schedule.frequency == ScheduleFrequency.DAILY:
            return CronTrigger(hour=schedule.hour, minute=schedule.minute, timezone="UTC")
        return CronTrigger(
            day_of_week=schedule.day_of_week,
            hour=schedule.hour,
            minute=schedule.minute,
            timezone="UTC",
        )

    def _resolve_tickers(self, schedule: Schedule) -> list[str]:
        from app.api.routes_portfolio import _portfolio
        from app.api.routes_watchlist import _watchlist

        if schedule.ticker_source == TickerSource.CUSTOM:
            return schedule.tickers

        tickers: set[str] = set()
        if schedule.ticker_source in (TickerSource.PORTFOLIO, TickerSource.ALL):
            tickers.update(p["ticker"] for p in _portfolio)
        if schedule.ticker_source in (TickerSource.WATCHLIST, TickerSource.ALL):
            tickers.update(item.ticker for item in _watchlist.items)

        return list(tickers) if tickers else ["NVDA", "AAPL", "MSFT"]

    async def _execute_schedule(self, schedule_id: str) -> None:
        schedule = self._schedules.get(schedule_id)
        if schedule is None:
            return

        if self._lock.locked():
            logger.info("Pipeline busy, skipping scheduled run %s", schedule_id)
            return

        async with self._lock:
            try:
                tickers = self._resolve_tickers(schedule)
                logger.info(
                    "Scheduled run %s (%s) with tickers %s",
                    schedule.name,
                    schedule_id,
                    tickers,
                )

                from app.agents.orchestrator import PipelineOrchestrator
                from app.api.ws_realtime import broadcast_progress

                orchestrator = PipelineOrchestrator()
                orchestrator.on_progress(broadcast_progress)
                brief = await orchestrator.run(
                    tickers=tickers,
                    language=schedule.language,
                    generate_audio=schedule.generate_audio,
                )

                if self._briefs is not None:
                    self._briefs.append(brief)
                    if len(self._briefs) > 100:
                        self._briefs[:] = self._briefs[-100:]

                now = datetime.now(timezone.utc)
                job = self._scheduler.get_job(schedule_id)
                next_run = job.next_run_time if job else None

                schedule = schedule.model_copy(
                    update={
                        "last_run_at": now,
                        "next_run_at": next_run,
                        "last_brief_id": brief.id,
                    }
                )
                self._schedules[schedule_id] = schedule
                logger.info("Scheduled run %s completed, brief %s", schedule_id, brief.id)
            except Exception:
                logger.exception("Scheduled run %s failed", schedule_id)


_service: SchedulerService | None = None


def get_scheduler_service() -> SchedulerService:
    global _service
    if _service is None:
        _service = SchedulerService()
    return _service
