import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from enum import Enum

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schedule import Schedule, ScheduleFrequency, TickerSource
from app.utils.validation import DEFAULT_TICKERS

logger = logging.getLogger(__name__)

MAX_SCHEDULES_PER_USER = 10


def _job_next_run(job: object) -> datetime | None:
    return getattr(job, "next_run_time", None) if job else None


class SchedulerService:
    def __init__(self) -> None:
        self._scheduler = AsyncIOScheduler()
        self._schedules: dict[str, Schedule] = {}
        self._lock = asyncio.Lock()

    def start(self) -> None:
        self._scheduler.start()
        logger.info("Scheduler started")

    def shutdown(self) -> None:
        self._scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")

    def is_pipeline_running(self) -> bool:
        return self._lock.locked()

    @asynccontextmanager
    async def pipeline_lock(self) -> AsyncGenerator[None, None]:
        async with self._lock:
            yield

    async def load_schedules_from_db(self) -> None:
        from app.db.engine import get_session_factory
        from app.db.models import ScheduleRow

        factory = get_session_factory()
        async with factory() as session:
            result = await session.execute(select(ScheduleRow))
            rows = result.scalars().all()

            for row in rows:
                schedule = Schedule(
                    id=row.id,
                    user_id=row.user_id,
                    name=row.name,
                    ticker_source=TickerSource(row.ticker_source),
                    tickers=row.tickers or [],
                    frequency=ScheduleFrequency(row.frequency),
                    hour=row.hour,
                    minute=row.minute,
                    day_of_week=row.day_of_week,
                    language=row.language,
                    generate_audio=row.generate_audio,
                    paused=row.paused,
                    created_at=row.created_at,
                    last_run_at=row.last_run_at,
                    next_run_at=row.next_run_at,
                    last_brief_id=row.last_brief_id,
                )
                self._schedules[row.id] = schedule

                if not row.paused:
                    trigger = self._build_trigger(schedule)
                    self._scheduler.add_job(
                        self._execute_schedule,
                        trigger=trigger,
                        id=row.id,
                        args=[row.id, row.user_id],
                        replace_existing=True,
                    )

            logger.info("Loaded %d schedules from DB", len(rows))

    def list_schedules_for_user(self, user_id: str) -> list[Schedule]:
        return [s for s in self._schedules.values() if s.user_id == user_id]

    def _get_user_schedule(self, schedule_id: str, user_id: str) -> Schedule:
        schedule = self._schedules.get(schedule_id)
        if schedule is None:
            raise KeyError(f"Schedule {schedule_id} not found")
        if schedule.user_id != user_id:
            raise KeyError(f"Schedule {schedule_id} not found")
        return schedule

    async def create_schedule(
        self,
        user_id: str,
        db: AsyncSession,
        name: str = "",
        ticker_source: TickerSource = TickerSource.WATCHLIST,
        frequency: ScheduleFrequency = ScheduleFrequency.DAILY,
        tickers: list[str] | None = None,
        hour: int = 9,
        minute: int = 0,
        day_of_week: int = 0,
        language: str = "en",
        generate_audio: bool = True,
    ) -> Schedule:
        from app.db.models import ScheduleRow

        user_count = sum(1 for s in self._schedules.values() if s.user_id == user_id)
        if user_count >= MAX_SCHEDULES_PER_USER:
            raise ValueError("Maximum number of schedules reached")

        schedule_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc)

        schedule = Schedule(
            id=schedule_id,
            user_id=user_id,
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
            args=[schedule_id, user_id],
            replace_existing=True,
        )

        next_run = _job_next_run(self._scheduler.get_job(schedule_id))
        if next_run:
            schedule = schedule.model_copy(update={"next_run_at": next_run})

        self._schedules[schedule_id] = schedule

        row = ScheduleRow(
            id=schedule_id,
            user_id=user_id,
            name=schedule.name,
            ticker_source=ticker_source.value,
            tickers=tickers or [],
            frequency=frequency.value,
            hour=hour,
            minute=minute,
            day_of_week=day_of_week,
            language=language,
            generate_audio=generate_audio,
            paused=False,
            created_at=now,
            next_run_at=schedule.next_run_at,
        )
        db.add(row)

        return schedule

    async def update_schedule(
        self, schedule_id: str, user_id: str, db: AsyncSession, **fields: object
    ) -> Schedule:
        from app.db.models import ScheduleRow

        schedule = self._get_user_schedule(schedule_id, user_id)
        schedule = schedule.model_copy(update=fields)
        self._schedules[schedule_id] = schedule

        if not schedule.paused:
            trigger = self._build_trigger(schedule)
            self._scheduler.reschedule_job(schedule_id, trigger=trigger)
            next_run = _job_next_run(self._scheduler.get_job(schedule_id))
            if next_run:
                schedule = schedule.model_copy(update={"next_run_at": next_run})
                self._schedules[schedule_id] = schedule

        result = await db.execute(select(ScheduleRow).where(ScheduleRow.id == schedule_id))
        row = result.scalar_one_or_none()
        if row:
            for key, val in fields.items():
                if isinstance(val, Enum):
                    val = val.value
                setattr(row, key, val)
            row.next_run_at = schedule.next_run_at

        return schedule

    async def delete_schedule(self, schedule_id: str, user_id: str, db: AsyncSession) -> None:
        from app.db.models import ScheduleRow

        self._get_user_schedule(schedule_id, user_id)

        try:
            self._scheduler.remove_job(schedule_id)
        except Exception:
            pass
        del self._schedules[schedule_id]

        result = await db.execute(select(ScheduleRow).where(ScheduleRow.id == schedule_id))
        row = result.scalar_one_or_none()
        if row:
            await db.delete(row)

    async def pause_schedule(
        self, schedule_id: str, user_id: str, db: AsyncSession
    ) -> Schedule:
        from app.db.models import ScheduleRow

        schedule = self._get_user_schedule(schedule_id, user_id)
        self._scheduler.pause_job(schedule_id)
        schedule = schedule.model_copy(update={"paused": True, "next_run_at": None})
        self._schedules[schedule_id] = schedule

        result = await db.execute(select(ScheduleRow).where(ScheduleRow.id == schedule_id))
        row = result.scalar_one_or_none()
        if row:
            row.paused = True
            row.next_run_at = None

        return schedule

    async def resume_schedule(
        self, schedule_id: str, user_id: str, db: AsyncSession
    ) -> Schedule:
        from app.db.models import ScheduleRow

        schedule = self._get_user_schedule(schedule_id, user_id)
        self._scheduler.resume_job(schedule_id)
        next_run = _job_next_run(self._scheduler.get_job(schedule_id))
        schedule = schedule.model_copy(update={"paused": False, "next_run_at": next_run})
        self._schedules[schedule_id] = schedule

        result = await db.execute(select(ScheduleRow).where(ScheduleRow.id == schedule_id))
        row = result.scalar_one_or_none()
        if row:
            row.paused = False
            row.next_run_at = next_run

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

    async def _resolve_tickers_from_db(self, schedule: Schedule, user_id: str) -> list[str]:
        from app.db.engine import get_session_factory
        from app.db.models import PortfolioPositionRow, WatchlistItemRow

        if schedule.ticker_source == TickerSource.CUSTOM:
            return schedule.tickers

        factory = get_session_factory()
        tickers: set[str] = set()

        async with factory() as session:
            if schedule.ticker_source in (TickerSource.PORTFOLIO, TickerSource.ALL):
                result = await session.execute(
                    select(PortfolioPositionRow.ticker).where(
                        PortfolioPositionRow.user_id == user_id
                    )
                )
                tickers.update(r[0] for r in result.all())

            if schedule.ticker_source in (TickerSource.WATCHLIST, TickerSource.ALL):
                result = await session.execute(
                    select(WatchlistItemRow.ticker).where(
                        WatchlistItemRow.user_id == user_id
                    )
                )
                tickers.update(r[0] for r in result.all())

        return list(tickers) if tickers else list(DEFAULT_TICKERS)

    async def _execute_schedule(self, schedule_id: str, user_id: str) -> None:
        from app.db.engine import get_session_factory
        from app.db.models import BriefRow, ScheduleRow

        schedule = self._schedules.get(schedule_id)
        if schedule is None:
            return

        if self._lock.locked():
            logger.info("Pipeline busy, skipping scheduled run %s", schedule_id)
            return

        async with self._lock:
            try:
                tickers = await self._resolve_tickers_from_db(schedule, user_id)
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

                now = datetime.now(timezone.utc)
                factory = get_session_factory()
                async with factory() as session:
                    brief_row = BriefRow(
                        id=brief.id,
                        user_id=user_id,
                        executive_summary=brief.executive_summary,
                        data=brief.model_dump(mode="json"),
                        language=brief.language,
                        watchlist_tickers=brief.watchlist_tickers,
                        overall_sentiment=brief.overall_sentiment,
                        confidence_score=brief.confidence_score,
                        audio_url=brief.audio_url,
                        generated_at=brief.generated_at,
                    )
                    session.add(brief_row)

                    result = await session.execute(
                        select(ScheduleRow).where(ScheduleRow.id == schedule_id)
                    )
                    sched_row = result.scalar_one_or_none()
                    if sched_row:
                        sched_row.last_run_at = now
                        sched_row.last_brief_id = brief.id
                        sched_row.next_run_at = _job_next_run(self._scheduler.get_job(schedule_id))

                    await session.commit()

                next_run = _job_next_run(self._scheduler.get_job(schedule_id))

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


def reset_scheduler_service() -> None:
    global _service
    if _service is not None:
        try:
            _service.shutdown()
        except Exception:
            pass
    _service = None
