import asyncio
import base64
import json
import logging
import time
from pathlib import Path

from mistralai import Mistral

from app.config import get_settings
from app.models.earnings import EarningsCallAnalysis, QAHighlight
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)

PROMPT_PATH = (
    Path(__file__).parent.parent.parent / "prompts" / "earnings_transcription.md"
)

SUPPORTED_AUDIO_TYPES = {
    ".mp3": "audio/mp3",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
}


class EarningsTranscriberAgent:
    """Transcribes and analyzes earnings calls using Voxtral + Mistral Large 3.

    Two-step process:
        1. Voxtral (mistral-large-latest multimodal) transcribes audio to text
        2. Mistral Large 3 analyzes the transcript for structured intelligence
    """

    def __init__(self):
        settings = get_settings()
        self.client = Mistral(api_key=settings.mistral_api_key)
        self.model_transcription = settings.model_transcription
        self.model_analysis = settings.model_analysis
        self._prompt = PROMPT_PATH.read_text() if PROMPT_PATH.exists() else ""

    async def transcribe_audio(self, audio_path: str) -> str:
        """Step 1: Transcribe audio file using Voxtral multimodal endpoint."""
        path = Path(audio_path)
        suffix = path.suffix.lower()
        mime_type = SUPPORTED_AUDIO_TYPES.get(suffix, "audio/mp3")

        def _read_audio():
            with open(audio_path, "rb") as f:
                return base64.b64encode(f.read()).decode()

        audio_b64 = await asyncio.to_thread(_read_audio)

        start = time.time()
        try:
            response = await self.client.chat.complete_async(
                model=self.model_transcription,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "Transcribe this earnings call audio. "
                                    "Provide a complete, detailed transcript "
                                    "preserving speaker distinctions where possible. "
                                    "Label speakers as 'Speaker 1', 'Speaker 2', etc. "
                                    "or by name/role if identifiable."
                                ),
                            },
                            {
                                "type": "audio_url",
                                "audio_url": f"data:{mime_type};base64,{audio_b64}",
                            },
                        ],
                    }
                ],
                temperature=0.1,
            )

            latency = (time.time() - start) * 1000
            transcript = response.choices[0].message.content or ""
            usage = response.usage

            log_agent_call(
                agent_name="earnings_transcriber_stt",
                model=self.model_transcription,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                latency_ms=latency,
            )

            return transcript or ""

        except Exception as e:
            logger.error("Audio transcription failed: %s", e)
            log_agent_call(
                agent_name="earnings_transcriber_stt",
                model=self.model_transcription,
                latency_ms=(time.time() - start) * 1000,
                success=False,
            )
            raise

    async def analyze_transcript(
        self, transcript: str, ticker: str
    ) -> EarningsCallAnalysis:
        """Step 2: Analyze transcript using Mistral Large 3 for structured output."""
        start = time.time()
        try:
            response = await self.client.chat.complete_async(
                model=self.model_analysis,
                messages=[
                    {"role": "system", "content": self._prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Analyze this earnings call transcript for {ticker}:\n\n"
                            f"{transcript}"
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            latency = (time.time() - start) * 1000
            result_text = response.choices[0].message.content or ""
            usage = response.usage

            log_agent_call(
                agent_name="earnings_transcriber_analysis",
                model=self.model_analysis,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                latency_ms=latency,
            )

            parsed = json.loads(result_text)

            qa_highlights = [
                QAHighlight(**qa) for qa in parsed.get("qa_highlights", [])
            ]

            return EarningsCallAnalysis(
                ticker=ticker.upper(),
                transcript=transcript,
                key_topics=parsed.get("key_topics", []),
                financial_highlights=parsed.get("financial_highlights", []),
                forward_guidance=parsed.get("forward_guidance", []),
                risk_factors=parsed.get("risk_factors", []),
                qa_highlights=qa_highlights,
                summary=parsed.get("summary", ""),
                sentiment=parsed.get("sentiment", "neutral"),
                confidence_score=parsed.get("confidence_score", 0.5),
            )

        except Exception as e:
            logger.error("Transcript analysis failed: %s", e)
            log_agent_call(
                agent_name="earnings_transcriber_analysis",
                model=self.model_analysis,
                latency_ms=(time.time() - start) * 1000,
                success=False,
            )
            return EarningsCallAnalysis(
                ticker=ticker.upper(),
                transcript=transcript,
                summary="Analysis could not be completed",
            )

    async def transcribe_and_analyze(
        self, audio_path: str, ticker: str
    ) -> EarningsCallAnalysis:
        """Full pipeline: transcribe audio then analyze the transcript."""
        transcript = await self.transcribe_audio(audio_path)
        return await self.analyze_transcript(transcript, ticker)

    async def analyze_from_text(
        self, transcript_text: str, ticker: str
    ) -> EarningsCallAnalysis:
        """Analyze a pre-transcribed earnings call (text input fallback)."""
        return await self.analyze_transcript(transcript_text, ticker)
