import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import PipelineOrchestrator
from app.api.ws_realtime import broadcast_progress
from app.auth.dependencies import get_current_user
from app.auth.usage import log_usage
from app.config import get_settings
from app.db.engine import get_db
from app.utils.http_rate_limiter import limiter
from app.db.models import BriefRow, UserRow
from app.models.brief import IntelligenceBrief
from app.services.scheduler import get_scheduler_service
from app.utils.validation import TICKER_RE, DEFAULT_TICKERS

logger = logging.getLogger(__name__)
router = APIRouter()


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
            if not TICKER_RE.match(upper):
                raise ValueError(
                    f"Invalid ticker '{t}': must be 1-10 uppercase alphanumeric characters or dots"
                )
            validated.append(upper)
        return validated


def _brief_to_row(brief: IntelligenceBrief, user_id: str) -> BriefRow:
    return BriefRow(
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


@router.get("/latest")
async def get_latest_brief(
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(BriefRow)
        .where(BriefRow.user_id == user.id)
        .order_by(desc(BriefRow.generated_at))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return {"brief": None, "message": "No briefs generated yet"}
    return {"brief": row.data}


@router.post("/generate")
@limiter.limit("5/minute")
async def generate_brief(
    request: Request,
    body: GenerateBriefRequest,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    settings = get_settings()
    if not settings.mistral_api_key:
        raise HTTPException(status_code=503, detail="Mistral API key not configured")

    svc = get_scheduler_service()
    if svc.is_pipeline_running():
        raise HTTPException(status_code=429, detail="Pipeline already running")

    tickers = body.tickers or list(DEFAULT_TICKERS)
    async with svc.pipeline_lock():
        try:
            orchestrator = PipelineOrchestrator()
            orchestrator.on_progress(broadcast_progress)
            brief = await orchestrator.run(
                tickers=tickers,
                language=body.language,
                generate_audio=body.generate_audio,
            )
            row = _brief_to_row(brief, user.id)
            db.add(row)
            await log_usage(db, user.id, "brief_generate", {"tickers": tickers})
            return {"brief": brief.model_dump(mode="json")}
        except Exception as e:
            logger.error("Brief generation failed: %s", e)
            raise HTTPException(status_code=500, detail="Brief generation failed") from e


@router.get("/history")
async def get_brief_history(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    total_result = await db.execute(
        select(func.count()).select_from(BriefRow).where(BriefRow.user_id == user.id)
    )
    total = total_result.scalar() or 0

    result = await db.execute(
        select(BriefRow)
        .where(BriefRow.user_id == user.id)
        .order_by(desc(BriefRow.generated_at))
        .offset(offset)
        .limit(limit)
    )
    rows = result.scalars().all()

    return {
        "briefs": [
            {
                "id": r.id,
                "executive_summary": r.executive_summary[:200],
                "generated_at": r.generated_at.isoformat(),
                "language": r.language,
                "tickers": r.watchlist_tickers,
                "overall_sentiment": r.overall_sentiment,
            }
            for r in rows
        ],
        "total": total,
    }
