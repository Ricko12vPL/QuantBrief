import json
import logging
import time
from pathlib import Path

from mistralai import Mistral

from app.config import get_settings
from app.models.signal import MarketSignal
from app.models.filing import FilingAnalysis
from app.models.brief import (
    IntelligenceBrief,
    MaterialEvent,
    ActionItem,
    RiskAlert,
    ReasoningStep,
)
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "synthesis_brief.md"
AUDIO_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "audio_script.md"


class SynthesisAgent:
    """Generates the final intelligence brief using Mistral Large 3."""

    def __init__(self):
        settings = get_settings()
        self.client = Mistral(api_key=settings.mistral_api_key)
        self.model = settings.model_synthesis
        base_prompt = PROMPT_PATH.read_text() if PROMPT_PATH.exists() else ""
        audio_guidelines = (
            AUDIO_PROMPT_PATH.read_text() if AUDIO_PROMPT_PATH.exists() else ""
        )
        if audio_guidelines:
            self._prompt = (
                f"{base_prompt}\n\n## Audio Script Formatting Guidelines\n\n"
                f"{audio_guidelines}"
            )
        else:
            self._prompt = base_prompt

    async def generate_brief(
        self,
        signals: list[MarketSignal],
        filing_analyses: list[FilingAnalysis],
        reasoning_result: dict,
        watchlist_tickers: list[str],
        language: str = "en",
    ) -> IntelligenceBrief:
        """Synthesize all data into a final intelligence brief."""
        input_data = {
            "signals": [
                {
                    "ticker": s.ticker,
                    "title": s.title,
                    "summary": s.summary,
                    "relevance_score": s.relevance_score,
                    "sentiment": s.sentiment.value,
                }
                for s in signals[:20]
            ],
            "filing_analyses": [
                {
                    "ticker": fa.filing.ticker,
                    "form_type": fa.filing.form_type,
                    "executive_summary": fa.executive_summary[:300],
                    "sentiment": fa.sentiment,
                    "key_metrics": fa.key_metrics,
                }
                for fa in filing_analyses
            ],
            "reasoning": {
                "overall_sentiment": reasoning_result.get("overall_sentiment", "neutral"),
                "confidence_score": reasoning_result.get("confidence_score", 0.5),
                "material_events": [
                    e.model_dump() if hasattr(e, "model_dump") else e
                    for e in reasoning_result.get("material_events", [])
                ],
                "action_items": [
                    a.model_dump() if hasattr(a, "model_dump") else a
                    for a in reasoning_result.get("action_items", [])
                ],
                "risk_alerts": [
                    r.model_dump() if hasattr(r, "model_dump") else r
                    for r in reasoning_result.get("risk_alerts", [])
                ],
            },
            "watchlist_tickers": watchlist_tickers,
            "language": language,
        }

        start = time.time()
        try:
            lang_names = {"en": "English", "fr": "French", "de": "German", "pl": "Polish", "es": "Spanish"}
            lang_name = lang_names.get(language, language)
            lang_enforce = (
                f"CRITICAL: ALL text output MUST be in {lang_name} ({language}). "
                f"executive_summary, audio_script — every sentence in {lang_name}. "
                f"Do NOT mix languages. Keep only ticker symbols and numbers in original format.\n\n"
            )
            response = await self.client.chat.complete_async(
                model=self.model,
                messages=[
                    {"role": "system", "content": lang_enforce + self._prompt},
                    {
                        "role": "user",
                        "content": (
                            f"LANGUAGE: {lang_name} ({language}) — write ALL text in {lang_name}.\n\n"
                            f"Generate intelligence brief:\n"
                            f"{json.dumps(input_data, default=str)}\n\n"
                            f"REMINDER: Every sentence must be in {lang_name}."
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            latency = (time.time() - start) * 1000
            result_text = response.choices[0].message.content or ""
            usage = response.usage

            log_agent_call(
                agent_name="synthesizer",
                model=self.model,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                latency_ms=latency,
            )

            parsed = json.loads(result_text)

            return IntelligenceBrief(
                executive_summary=parsed.get("executive_summary", ""),
                material_events=reasoning_result.get("material_events", []),
                filing_analyses=filing_analyses,
                signals=signals,
                action_items=reasoning_result.get("action_items", []),
                risk_alerts=reasoning_result.get("risk_alerts", []),
                reasoning_chain=reasoning_result.get("reasoning_steps", []),
                audio_script=parsed.get("audio_script", ""),
                language=language,
                watchlist_tickers=watchlist_tickers,
                overall_sentiment=parsed.get("overall_sentiment", "neutral"),
                confidence_score=parsed.get("confidence_score", 0.5),
            )

        except Exception as e:
            logger.error("Synthesis failed: %s", e)
            log_agent_call(
                agent_name="synthesizer",
                model=self.model,
                latency_ms=(time.time() - start) * 1000,
                success=False,
            )
            return IntelligenceBrief(
                executive_summary="Analysis could not be completed",
                signals=signals,
                filing_analyses=filing_analyses,
                watchlist_tickers=watchlist_tickers,
                language=language,
            )
