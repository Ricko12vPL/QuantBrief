from pydantic import BaseModel, Field
from datetime import datetime, timezone
from enum import Enum

class SignalType(str, Enum):
    EARNINGS = "earnings"
    FILING = "filing"
    NEWS = "news"
    MACRO = "macro"
    TECHNICAL = "technical"

class Sentiment(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"

class MarketSignal(BaseModel):
    ticker: str
    title: str
    summary: str
    relevance_score: float = Field(ge=0.0, le=1.0)
    sentiment: Sentiment
    source: str
    signal_type: SignalType
    url: str = ""
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_data: dict = Field(default_factory=dict)
