import asyncio
import json
import logging
import time
from pathlib import Path

from mistralai import Mistral

from app.config import get_settings
from app.models.filing import SECFiling, FilingAnalysis, FinancialHighlight
from app.data_sources.sec_edgar import get_recent_filings, get_filing_text
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "filing_analysis.md"


class FilingAnalystAgent:
    """Analyzes SEC filings using Mistral Large 3 with 256K context."""

    def __init__(self):
        settings = get_settings()
        self.client = Mistral(api_key=settings.mistral_api_key)
        self.model = settings.model_analysis
        self._prompt = PROMPT_PATH.read_text() if PROMPT_PATH.exists() else ""

    async def detect_new_filings(
        self, tickers: list[str], form_types: list[str] | None = None
    ) -> list[SECFiling]:
        """Detect recent filings for watchlist tickers in parallel."""

        async def _fetch_for_ticker(ticker: str) -> list[SECFiling]:
            try:
                return await get_recent_filings(
                    ticker, form_types=form_types, limit=3
                )
            except Exception as e:
                logger.error("Filing detection failed for %s: %s", ticker, e)
                return []

        results = await asyncio.gather(
            *[_fetch_for_ticker(t) for t in tickers]
        )
        return [filing for batch in results for filing in batch]

    async def analyze_filing(self, filing: SECFiling, language: str = "en") -> FilingAnalysis:
        """Download and analyze a full SEC filing."""
        filing_text = await get_filing_text(filing.filing_url)
        if not filing_text:
            logger.warning("Empty filing text for %s", filing.accession_number)
            return FilingAnalysis(
                filing=filing,
                executive_summary="Filing text could not be retrieved.",
                relevance_score=0.3,
            )

        start = time.time()
        try:
            response = await self.client.chat.complete_async(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Language: {language}\n\n"
                            f"Analyze this {filing.form_type} filing for "
                            f"{filing.ticker} ({filing.company_name}), "
                            f"filed on {filing.filing_date.strftime('%Y-%m-%d')}:\n\n"
                            f"{filing_text}"
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
                agent_name="filing_analyst",
                model=self.model,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                latency_ms=latency,
            )

            parsed = json.loads(result_text)
            highlights = [
                FinancialHighlight(**h)
                for h in parsed.get("financial_highlights", [])
            ]

            return FilingAnalysis(
                filing=filing,
                executive_summary=parsed.get("executive_summary", ""),
                financial_highlights=highlights,
                risk_factors=parsed.get("risk_factors", []),
                key_metrics=parsed.get("key_metrics", {}),
                management_outlook=parsed.get("management_outlook", ""),
                notable_changes=parsed.get("notable_changes", []),
                sentiment=parsed.get("sentiment", "neutral"),
                relevance_score=parsed.get("relevance_score", 0.5),
            )

        except Exception as e:
            logger.error("Filing analysis failed: %s", e)
            log_agent_call(
                agent_name="filing_analyst",
                model=self.model,
                latency_ms=(time.time() - start) * 1000,
                success=False,
            )
            return FilingAnalysis(
                filing=filing,
                executive_summary="Analysis could not be completed",
                relevance_score=0.3,
            )
