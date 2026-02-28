import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.orchestrator import PipelineOrchestrator
from app.api.ws_realtime import broadcast_progress
from app.models.brief import IntelligenceBrief

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateBriefRequest(BaseModel):
    tickers: list[str] | None = None
    language: str = "en"
    generate_audio: bool = True


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
        return {"brief": brief.model_dump(mode="json")}
    except Exception as e:
        logger.error("Brief generation failed: %s", e)
        raise HTTPException(status_code=500, detail="Brief generation failed")
    finally:
        _generating = False


@router.get("/history")
async def get_brief_history(limit: int = 10) -> dict:
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
