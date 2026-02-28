import uuid

from pydantic import BaseModel, Field
from datetime import datetime
from app.models.signal import MarketSignal
from app.models.filing import FilingAnalysis


class MaterialEvent(BaseModel):
    ticker: str
    event_type: str
    headline: str
    impact_assessment: str
    confidence: float = Field(ge=0.0, le=1.0)
    sentiment: str = "neutral"


class ActionItem(BaseModel):
    action: str
    ticker: str
    urgency: str = "medium"  # low, medium, high
    rationale: str = ""


class RiskAlert(BaseModel):
    ticker: str
    risk_type: str
    description: str
    severity: str = "medium"  # low, medium, high


class ReasoningStep(BaseModel):
    stage: str  # DATA, CONTEXT, CROSS_SIGNALS, RISK, CONFIDENCE, RECOMMENDATION
    content: str


class IntelligenceBrief(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    executive_summary: str
    material_events: list[MaterialEvent] = Field(default_factory=list)
    filing_analyses: list[FilingAnalysis] = Field(default_factory=list)
    signals: list[MarketSignal] = Field(default_factory=list)
    action_items: list[ActionItem] = Field(default_factory=list)
    risk_alerts: list[RiskAlert] = Field(default_factory=list)
    reasoning_chain: list[ReasoningStep] = Field(default_factory=list)
    audio_script: str = ""
    audio_url: str = ""
    language: str = "en"
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    watchlist_tickers: list[str] = Field(default_factory=list)
    overall_sentiment: str = "neutral"
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.5)
