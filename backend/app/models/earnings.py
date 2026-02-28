from pydantic import BaseModel, Field
from datetime import datetime


class QAHighlight(BaseModel):
    question: str
    answer: str
    topic: str = ""


class EarningsCallAnalysis(BaseModel):
    ticker: str
    transcript: str = ""
    key_topics: list[str] = Field(default_factory=list)
    financial_highlights: list[dict[str, str]] = Field(default_factory=list)
    forward_guidance: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    qa_highlights: list[QAHighlight] = Field(default_factory=list)
    summary: str = ""
    sentiment: str = "neutral"
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.5)
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
