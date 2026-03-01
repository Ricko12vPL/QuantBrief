import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.voice_agent import VoiceAgent
from app.auth.dependencies import get_current_user
from app.auth.usage import log_usage
from app.db.engine import get_db
from app.db.models import BriefRow, UserRow
from app.utils.http_rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateAudioRequest(BaseModel):
    language: str = "en"
    script: str = ""


@router.get("/latest")
async def get_latest_audio(
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
        return {"audio_url": "", "script": "", "language": ""}

    brief_data = row.data
    return {
        "audio_url": row.audio_url,
        "script": brief_data.get("audio_script", ""),
        "language": row.language,
    }


@router.post("/generate")
@limiter.limit("5/minute")
async def generate_audio(
    request: Request,
    body: GenerateAudioRequest,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    script = body.script.strip() if body.script.strip() else None

    if not script:
        result = await db.execute(
            select(BriefRow)
            .where(BriefRow.user_id == user.id)
            .order_by(desc(BriefRow.generated_at))
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="No brief available")
        script = row.data.get("audio_script", "")

    if not script:
        raise HTTPException(status_code=400, detail="No script provided")

    voice = VoiceAgent()
    audio_url = await voice.generate_audio(script=script, language=body.language)
    if not audio_url:
        raise HTTPException(status_code=500, detail="Audio generation failed")

    await log_usage(db, user.id, "audio_generate", {"language": body.language})
    return {"audio_url": audio_url, "language": body.language}
