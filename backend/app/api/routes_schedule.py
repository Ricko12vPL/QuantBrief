import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.models.schedule import ScheduleFrequency, TickerSource
from app.services.scheduler import get_scheduler_service

router = APIRouter()

_TICKER_RE = re.compile(r"^[A-Z0-9.]{1,10}$")


class CreateScheduleRequest(BaseModel):
    name: str = Field(default="", max_length=100)
    ticker_source: TickerSource = TickerSource.WATCHLIST
    tickers: list[str] | None = Field(default=None, max_length=20)
    frequency: ScheduleFrequency = ScheduleFrequency.DAILY
    hour: int = Field(default=9, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    day_of_week: int = Field(default=0, ge=0, le=6)
    language: str = Field(default="en", pattern=r"^[a-z]{2}$")
    generate_audio: bool = True

    @field_validator("tickers", mode="before")
    @classmethod
    def validate_tickers(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        validated = []
        for t in v:
            upper = t.strip().upper()
            if not _TICKER_RE.match(upper):
                raise ValueError(f"Invalid ticker '{t}'")
            validated.append(upper)
        return validated


class UpdateScheduleRequest(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    ticker_source: TickerSource | None = None
    tickers: list[str] | None = None
    frequency: ScheduleFrequency | None = None
    hour: int | None = Field(default=None, ge=0, le=23)
    minute: int | None = Field(default=None, ge=0, le=59)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    language: str | None = Field(default=None, pattern=r"^[a-z]{2}$")
    generate_audio: bool | None = None


@router.get("")
async def list_schedules() -> dict:
    svc = get_scheduler_service()
    return {
        "schedules": [s.model_dump(mode="json") for s in svc.list_schedules()]
    }


@router.post("")
async def create_schedule(body: CreateScheduleRequest) -> dict:
    svc = get_scheduler_service()
    try:
        schedule = svc.create_schedule(
            name=body.name,
            ticker_source=body.ticker_source,
            frequency=body.frequency,
            tickers=body.tickers,
            hour=body.hour,
            minute=body.minute,
            day_of_week=body.day_of_week,
            language=body.language,
            generate_audio=body.generate_audio,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"schedule": schedule.model_dump(mode="json")}


@router.patch("/{schedule_id}")
async def update_schedule(schedule_id: str, body: UpdateScheduleRequest) -> dict:
    svc = get_scheduler_service()
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        schedule = svc.update_schedule(schedule_id, **fields)
    except KeyError:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"schedule": schedule.model_dump(mode="json")}


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str) -> dict:
    svc = get_scheduler_service()
    try:
        svc.delete_schedule(schedule_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"deleted": True}


@router.post("/{schedule_id}/pause")
async def pause_schedule(schedule_id: str) -> dict:
    svc = get_scheduler_service()
    try:
        schedule = svc.pause_schedule(schedule_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"schedule": schedule.model_dump(mode="json")}


@router.post("/{schedule_id}/resume")
async def resume_schedule(schedule_id: str) -> dict:
    svc = get_scheduler_service()
    try:
        schedule = svc.resume_schedule(schedule_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"schedule": schedule.model_dump(mode="json")}
