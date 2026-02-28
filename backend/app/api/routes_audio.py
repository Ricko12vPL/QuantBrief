import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.voice_agent import VoiceAgent

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateAudioRequest(BaseModel):
    language: str = "en"
    script: str = ""


@router.get("/latest")
async def get_latest_audio() -> dict:
    """Get the audio URL from the latest brief."""
    from app.api.routes_brief import _briefs
    if not _briefs:
        return {"audio_url": "", "message": "No briefs generated yet"}
    latest = _briefs[-1]
    return {
        "audio_url": latest.audio_url,
        "script": latest.audio_script,
        "language": latest.language,
    }


@router.post("/generate")
async def generate_audio(body: GenerateAudioRequest) -> dict:
    """Generate audio from the latest brief's script."""
    from app.api.routes_brief import _briefs
    script = body.script.strip() if body.script.strip() else None

    if not script:
        if not _briefs:
            raise HTTPException(status_code=404, detail="No brief available")
        script = _briefs[-1].audio_script

    if not script:
        raise HTTPException(status_code=400, detail="No script provided")

    voice = VoiceAgent()
    audio_url = await voice.generate_audio(script=script, language=body.language)
    if not audio_url:
        raise HTTPException(status_code=500, detail="Audio generation failed")

    return {"audio_url": audio_url, "language": body.language}
