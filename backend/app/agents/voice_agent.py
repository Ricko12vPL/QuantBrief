import asyncio
import logging
import time
import uuid
from pathlib import Path

from app.config import get_settings
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)

VOICE_MAP = {
    "en": "21m00Tcm4TlvDq8ikWAM",  # Rachel
    "fr": "XB0fDUnXU5powFXDhCwa",  # Charlotte
    "de": "EXAVITQu4vr4xnSDxMaL",  # Sarah (good for German)
    "pl": "ThT5KcBeYPX3keUQqHPh",  # Dorothy
    "es": "AZnzlk1XvdvUeBnXmlld",  # Domi
}


class VoiceAgent:
    """Generates audio briefings using ElevenLabs TTS."""

    def __init__(self):
        self.settings = get_settings()
        self._client = None

    def _get_client(self):
        if self._client is None:
            from elevenlabs import ElevenLabs
            self._client = ElevenLabs(api_key=self.settings.elevenlabs_api_key)
        return self._client

    async def generate_audio(
        self,
        script: str,
        language: str = "en",
        output_dir: str | None = None,
    ) -> str:
        """Generate TTS audio from script. Returns path to audio file."""
        if not self.settings.elevenlabs_api_key:
            logger.warning("ElevenLabs API key not set, skipping audio")
            return ""

        if not script.strip():
            logger.warning("Empty audio script, skipping")
            return ""

        voice_id = VOICE_MAP.get(language, "21m00Tcm4TlvDq8ikWAM")  # default: Rachel
        out_dir = Path(output_dir or self.settings.audio_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        filename = f"brief_{uuid.uuid4().hex[:8]}.mp3"
        filepath = out_dir / filename

        start = time.time()
        try:
            client = self._get_client()

            def _generate():
                audio = client.text_to_speech.convert(
                    text=script,
                    voice_id=voice_id,
                    model_id="eleven_multilingual_v2",
                    output_format="mp3_44100_128",
                )
                with open(filepath, "wb") as f:
                    for chunk in audio:
                        f.write(chunk)

            await asyncio.to_thread(_generate)

            latency = (time.time() - start) * 1000
            log_agent_call(
                agent_name="voice_agent",
                model="eleven_multilingual_v2",
                latency_ms=latency,
            )

            logger.info("Audio generated: %s (%.1fs)", filepath, latency / 1000)
            return f"/static/audio/{filename}"

        except Exception as e:
            logger.error("Audio generation failed: %s", e)
            log_agent_call(
                agent_name="voice_agent",
                model="eleven_multilingual_v2",
                latency_ms=(time.time() - start) * 1000,
                success=False,
            )
            return ""
