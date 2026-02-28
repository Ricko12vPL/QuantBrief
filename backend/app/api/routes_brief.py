import logging
import re
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.agents.orchestrator import PipelineOrchestrator
from app.api.ws_realtime import broadcast_progress
from app.config import get_settings
from app.models.brief import IntelligenceBrief

logger = logging.getLogger(__name__)
router = APIRouter()

_TICKER_RE = re.compile(r"^[A-Z0-9.]{1,10}$")


class GenerateBriefRequest(BaseModel):
    tickers: list[str] | None = Field(default=None, max_length=20)
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
                raise ValueError(
                    f"Invalid ticker '{t}': must be 1-10 uppercase alphanumeric characters or dots"
                )
            validated.append(upper)
        return validated


# In-memory store for hackathon
_briefs: list[IntelligenceBrief] = []
_generating = False


@router.get("/latest")
async def get_latest_brief() -> dict:
    """Get the most recent intelligence brief."""
    if not _briefs:
        return {"brief": None, "message": "No briefs generated yet"}
    return {"brief": _briefs[-1].model_dump(mode="json")}


@router.post("/generate")
async def generate_brief(body: GenerateBriefRequest) -> dict:
    """Generate a new intelligence brief."""
    settings = get_settings()
    if not settings.mistral_api_key:
        raise HTTPException(status_code=503, detail="Mistral API key not configured")

    global _generating
    if _generating:
        raise HTTPException(status_code=429, detail="Pipeline already running")

    tickers = body.tickers or ["NVDA", "AAPL", "MSFT"]
    _generating = True
    try:
        orchestrator = PipelineOrchestrator()
        orchestrator.on_progress(broadcast_progress)
        brief = await orchestrator.run(
            tickers=tickers,
            language=body.language,
            generate_audio=body.generate_audio,
        )
        _briefs.append(brief)
        if len(_briefs) > 100:
            _briefs[:] = _briefs[-100:]
        return {"brief": brief.model_dump(mode="json")}
    except Exception as e:
        logger.error("Brief generation failed: %s", e)
        raise HTTPException(status_code=500, detail="Brief generation failed")
    finally:
        _generating = False


@router.get("/history")
async def get_brief_history(limit: int = Query(default=10, ge=1, le=100)) -> dict:
    """Get brief generation history."""
    recent = _briefs[-limit:][::-1]
    return {
        "briefs": [
            {
                "id": b.id,
                "executive_summary": b.executive_summary[:200],
                "generated_at": b.generated_at.isoformat(),
                "language": b.language,
                "tickers": b.watchlist_tickers,
                "overall_sentiment": b.overall_sentiment,
            }
            for b in recent
        ],
        "total": len(_briefs),
    }
