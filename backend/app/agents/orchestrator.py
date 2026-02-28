import asyncio
import logging
import time

from app.agents.news_screener import NewsScreenerAgent
from app.agents.filing_analyst import FilingAnalystAgent
from app.agents.reasoning_engine import ReasoningAgent
from app.agents.synthesizer import SynthesisAgent
from app.agents.voice_agent import VoiceAgent
from app.data_sources.news_rss import fetch_feeds
from app.data_sources.fred_client import get_macro_snapshot
from app.models.brief import IntelligenceBrief
from app.utils.wandb_logger import log_metrics

logger = logging.getLogger(__name__)

# Pipeline stage names for progress tracking
STAGES = [
    "screening",
    "analyzing",
    "reasoning",
    "synthesizing",
    "voice",
    "done",
]


class PipelineOrchestrator:
    """Coordinates the 3-stage multi-agent pipeline."""

    def __init__(self):
        self.news_screener = NewsScreenerAgent()
        self.filing_analyst = FilingAnalystAgent()
        self.reasoning_engine = ReasoningAgent()
        self.synthesizer = SynthesisAgent()
        self.voice_agent = VoiceAgent()
        self._progress_callback = None

    def on_progress(self, callback):
        """Register a callback for pipeline stage updates: callback(stage, pct)."""
        self._progress_callback = callback

    async def _emit(self, stage: str, pct: int):
        if self._progress_callback:
            try:
                await self._progress_callback(stage, pct)
            except Exception:
                pass

    async def run(
        self,
        tickers: list[str],
        language: str = "en",
        generate_audio: bool = True,
    ) -> IntelligenceBrief:
        """Execute the full intelligence pipeline."""
        pipeline_start = time.time()
        logger.info("Pipeline started for tickers=%s, lang=%s", tickers, language)

        # ── Stage 1: Parallel screening + filing detection ──
        await self._emit("screening", 0)
        try:
            raw_signals, filings, macro = await asyncio.gather(
                self._safe(fetch_feeds(tickers=tickers), []),
                self._safe(
                    self.filing_analyst.detect_new_filings(tickers), []
                ),
                self._safe(get_macro_snapshot(), {}),
            )
        except Exception as e:
            logger.error("Stage 1 gather failed: %s", e)
            raw_signals, filings, macro = [], [], {}

        screened_signals = await self._safe(
            self.news_screener.screen_batch(raw_signals), raw_signals
        )
        material_signals = [
            s for s in screened_signals if s.relevance_score >= 0.7
        ]

        logger.info(
            "Stage 1 complete: %d signals (%d material), %d filings",
            len(screened_signals),
            len(material_signals),
            len(filings),
        )
        await self._emit("screening", 100)

        # ── Stage 2: Sequential filing analysis + reasoning ──
        await self._emit("analyzing", 0)

        # Distribute filings evenly across tickers (round-robin, max 2 per ticker)
        distributed = self._distribute_filings(filings, tickers, max_per_ticker=2, total_max=6)

        filing_analyses = []
        for i, filing in enumerate(distributed):
            analysis = await self._safe(
                self.filing_analyst.analyze_filing(filing, language=language), None
            )
            if analysis:
                filing_analyses.append(analysis)
            await self._emit("analyzing", int((i + 1) / max(len(distributed), 1) * 100))

        await self._emit("reasoning", 0)
        reasoning_result = await self._safe(
            self.reasoning_engine.assess_impact(
                signals=material_signals,
                filing_analyses=filing_analyses,
                watchlist_tickers=tickers,
                macro_snapshot=macro,
                language=language,
            ),
            {
                "reasoning_steps": [],
                "material_events": [],
                "action_items": [],
                "risk_alerts": [],
                "overall_sentiment": "neutral",
                "confidence_score": 0.3,
            },
        )
        await self._emit("reasoning", 100)

        # ── Stage 3: Synthesis + voice ──
        await self._emit("synthesizing", 0)
        brief = await self._safe(
            self.synthesizer.generate_brief(
                signals=material_signals,
                filing_analyses=filing_analyses,
                reasoning_result=reasoning_result,
                watchlist_tickers=tickers,
                language=language,
            ),
            IntelligenceBrief(
                executive_summary="Brief generation encountered errors.",
                watchlist_tickers=tickers,
                language=language,
            ),
        )
        await self._emit("synthesizing", 100)

        if generate_audio and brief.audio_script:
            await self._emit("voice", 0)
            audio_url = await self._safe(
                self.voice_agent.generate_audio(
                    script=brief.audio_script, language=language
                ),
                "",
            )
            brief = brief.model_copy(update={"audio_url": audio_url})
            await self._emit("voice", 100)

        await self._emit("done", 100)

        total_ms = (time.time() - pipeline_start) * 1000
        log_metrics({
            "pipeline/total_ms": total_ms,
            "pipeline/signals_screened": len(screened_signals),
            "pipeline/material_signals": len(material_signals),
            "pipeline/filings_analyzed": len(filing_analyses),
            "pipeline/language": language,
        })
        logger.info("Pipeline completed in %.1fs", total_ms / 1000)
        return brief

    @staticmethod
    def _distribute_filings(filings, tickers, max_per_ticker=2, total_max=6):
        """Round-robin: ensure every ticker gets at least 1 filing before any gets 2."""
        by_ticker: dict[str, list] = {t: [] for t in tickers}
        for f in filings:
            tk = f.ticker.upper() if hasattr(f, "ticker") else ""
            if tk in by_ticker:
                by_ticker[tk].append(f)

        # Also include filings for tickers not in the original list
        for f in filings:
            tk = f.ticker.upper() if hasattr(f, "ticker") else ""
            if tk not in by_ticker:
                by_ticker[tk] = [f]

        result = []
        # Round 1: 1 filing per ticker (most recent = first in list)
        for tk in tickers:
            if by_ticker.get(tk):
                result.append(by_ticker[tk][0])
                if len(result) >= total_max:
                    return result

        # Round 2: second filing per ticker if slots remain
        for tk in tickers:
            bucket = by_ticker.get(tk, [])
            if len(bucket) > 1:
                result.append(bucket[1])
                if len(result) >= total_max:
                    return result

        return result

    @staticmethod
    async def _safe(coro, fallback):
        """Execute coroutine with graceful fallback on failure."""
        try:
            return await coro
        except Exception as e:
            logger.error("Pipeline step failed: %s", e)
            return fallback
