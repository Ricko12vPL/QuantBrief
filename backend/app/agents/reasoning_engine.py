import json
import logging
import time
from pathlib import Path

from mistralai import Mistral

from app.config import get_settings
from app.models.signal import MarketSignal
from app.models.filing import FilingAnalysis
from app.models.brief import (
    MaterialEvent,
    ActionItem,
    RiskAlert,
    ReasoningStep,
)
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "reasoning_assessment.md"


class ReasoningAgent:
    """Chain-of-thought portfolio impact assessment using Magistral."""

    def __init__(self):
        settings = get_settings()
        self.client = Mistral(api_key=settings.mistral_api_key)
        self.model = settings.model_reasoning
        self._fallback_model = settings.model_analysis
        self._prompt = PROMPT_PATH.read_text() if PROMPT_PATH.exists() else ""

    async def assess_impact(
        self,
        signals: list[MarketSignal],
        filing_analyses: list[FilingAnalysis],
        watchlist_tickers: list[str],
        macro_snapshot: dict | None = None,
    ) -> dict:
        """Perform chain-of-thought reasoning on all available data."""
        input_data = {
            "signals": [
                {
                    "ticker": s.ticker,
                    "title": s.title,
                    "summary": s.summary,
                    "relevance_score": s.relevance_score,
                    "sentiment": s.sentiment.value,
                    "signal_type": s.signal_type.value,
                }
                for s in signals
                if s.relevance_score >= 0.3
            ],
            "filing_analyses": [
                {
                    "ticker": fa.filing.ticker,
                    "form_type": fa.filing.form_type,
                    "executive_summary": fa.executive_summary[:500],
                    "sentiment": fa.sentiment,
                    "relevance_score": fa.relevance_score,
                    "key_metrics": fa.key_metrics,
                }
                for fa in filing_analyses
            ],
            "watchlist_tickers": watchlist_tickers,
            "macro_snapshot": macro_snapshot or {},
        }

        model = self.model
        start = time.time()
        try:
            response = await self.client.chat.complete_async(
                model=model,
                messages=[
                    {"role": "system", "content": self._prompt},
                    {
                        "role": "user",
                        "content": f"Assess portfolio impact:\n{json.dumps(input_data)}",
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
        except Exception as e:
            logger.warning(
                "Magistral unavailable (%s), falling back to %s",
                e,
                self._fallback_model,
            )
            model = self._fallback_model
            cot_prompt = (
                self._prompt
                + "\n\nIMPORTANT: Think step-by-step through each stage of the reasoning framework."
            )
            try:
                response = await self.client.chat.complete_async(
                    model=model,
                    messages=[
                        {"role": "system", "content": cot_prompt},
                        {
                            "role": "user",
                            "content": f"Assess portfolio impact:\n{json.dumps(input_data)}",
                        },
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
            except Exception as fallback_err:
                fallback_latency = (time.time() - start) * 1000
                logger.error(
                    "Fallback model %s also failed: %s",
                    self._fallback_model,
                    fallback_err,
                )
                log_agent_call(
                    agent_name="reasoning_engine",
                    model=model,
                    latency_ms=fallback_latency,
                    success=False,
                )
                raise RuntimeError(
                    f"Reasoning failed: both {self.model} and {self._fallback_model} unavailable"
                ) from fallback_err

        latency = (time.time() - start) * 1000
        result_text = response.choices[0].message.content
        usage = response.usage

        log_agent_call(
            agent_name="reasoning_engine",
            model=model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            latency_ms=latency,
        )

        try:
            parsed = json.loads(result_text)
        except json.JSONDecodeError:
            logger.error("Failed to parse reasoning output")
            return {
                "reasoning_steps": [],
                "material_events": [],
                "action_items": [],
                "risk_alerts": [],
                "overall_sentiment": "neutral",
                "confidence_score": 0.3,
            }

        return {
            "reasoning_steps": [
                ReasoningStep(**step)
                for step in parsed.get("reasoning_steps", [])
            ],
            "material_events": [
                MaterialEvent(**evt)
                for evt in parsed.get("material_events", [])
            ],
            "action_items": [
                ActionItem(**item)
                for item in parsed.get("action_items", [])
            ],
            "risk_alerts": [
                RiskAlert(**alert)
                for alert in parsed.get("risk_alerts", [])
            ],
            "overall_sentiment": parsed.get("overall_sentiment", "neutral"),
            "confidence_score": parsed.get("confidence_score", 0.5),
        }
