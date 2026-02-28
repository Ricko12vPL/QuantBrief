from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone


class FinancialHighlight(BaseModel):
    metric: str
    current_value: str
    previous_value: str = ""
    change_pct: float | None = None
    commentary: str = ""


class SECFiling(BaseModel):
    ticker: str
    company_name: str
    form_type: str  # 10-K, 10-Q, 8-K
    filing_date: datetime
    accession_number: str
    filing_url: str
    description: str = ""


class FilingAnalysis(BaseModel):
    filing: SECFiling
    executive_summary: str
    financial_highlights: list[FinancialHighlight] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    key_metrics: dict[str, str] = Field(default_factory=dict)

    @field_validator("key_metrics", mode="before")
    @classmethod
    def coerce_metrics_to_str(cls, v: dict) -> dict[str, str]:
        if isinstance(v, dict):
            return {k: str(val) for k, val in v.items()}
        return v

    management_outlook: str = ""
    notable_changes: list[str] = Field(default_factory=list)
    sentiment: str = "neutral"
    relevance_score: float = Field(ge=0.0, le=1.0, default=0.5)
    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
