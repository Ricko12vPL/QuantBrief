from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class ScheduleFrequency(str, Enum):
    EVERY_4H = "every_4h"
    DAILY = "daily"
    WEEKLY = "weekly"


class TickerSource(str, Enum):
    CUSTOM = "custom"
    PORTFOLIO = "portfolio"
    WATCHLIST = "watchlist"
    ALL = "all"


class Schedule(BaseModel):
    id: str
    name: str
    ticker_source: TickerSource
    tickers: list[str] = []
    frequency: ScheduleFrequency
    hour: int = 9
    minute: int = 0
    day_of_week: int = 0
    language: str = "en"
    generate_audio: bool = True
    paused: bool = False
    created_at: datetime
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    last_brief_id: str | None = None
