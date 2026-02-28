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

LANG_NAMES = {
    "en": "English",
    "fr": "French",
    "de": "German",
    "pl": "Polish",
    "es": "Spanish",
}


class FilingAnalystAgent:
    """Analyzes SEC filings using Mistral Large 3 with 256K context."""

    def __init__(self):
        settings = get_settings()
        self.client = Mistral(api_key=settings.mistral_api_key)
        self.model = settings.model_analysis
        self._base_prompt = PROMPT_PATH.read_text() if PROMPT_PATH.exists() else ""

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

        lang_name = LANG_NAMES.get(language, language)
        start = time.time()
        try:
            # Step 1: Analyze filing (always produces English-ish output for large filings)
            response = await self.client.chat.complete_async(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"CRITICAL: ALL text output MUST be in {lang_name} ({language}). "
                            f"Every field value must be written in {lang_name}.\n\n"
                            + self._base_prompt
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"TARGET LANGUAGE: {lang_name} ({language})\n\n"
                            f"Analyze this {filing.form_type} filing for "
                            f"{filing.ticker} ({filing.company_name}), "
                            f"filed on {filing.filing_date.strftime('%Y-%m-%d')}:\n\n"
                            f"{filing_text}\n\n"
                            f"REMINDER: Write ALL text in {lang_name}."
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

            # Step 2: Force-translate if non-English (large English filings overwhelm language instructions)
            if language != "en":
                parsed = await self._force_translate(parsed, language)

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

    async def _force_translate(self, parsed: dict, language: str) -> dict:
        """Post-process: translate all text fields to the target language.

        This runs on the small JSON output (not the 200K filing), so the
        language instruction is never overwhelmed by English context.
        """
        lang_name = LANG_NAMES.get(language, language)

        # Extract only text fields that need translation
        to_translate = {
            "executive_summary": parsed.get("executive_summary", ""),
            "risk_factors": parsed.get("risk_factors", []),
            "management_outlook": parsed.get("management_outlook", ""),
            "notable_changes": parsed.get("notable_changes", []),
            "financial_highlights_commentary": [
                h.get("commentary", "") for h in parsed.get("financial_highlights", [])
            ],
        }

        try:
            response = await self.client.chat.complete_async(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You are a professional financial translator. "
                            f"Translate ALL text to {lang_name}. "
                            f"Keep ticker symbols, metric names, numbers, and currencies unchanged. "
                            f"Return valid JSON with the same structure."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Translate every text value to {lang_name} ({language}). "
                            f"Return JSON with same keys:\n\n"
                            f"{json.dumps(to_translate, ensure_ascii=False)}"
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            translated = json.loads(response.choices[0].message.content or "{}")

            # Merge translated fields back
            if translated.get("executive_summary"):
                parsed["executive_summary"] = translated["executive_summary"]
            if translated.get("risk_factors"):
                parsed["risk_factors"] = translated["risk_factors"]
            if translated.get("management_outlook"):
                parsed["management_outlook"] = translated["management_outlook"]
            if translated.get("notable_changes"):
                parsed["notable_changes"] = translated["notable_changes"]

            # Merge commentary back into financial_highlights
            commentaries = translated.get("financial_highlights_commentary", [])
            highlights = parsed.get("financial_highlights", [])
            for i, commentary in enumerate(commentaries):
                if i < len(highlights) and commentary:
                    highlights[i]["commentary"] = commentary

            log_agent_call(
                agent_name="filing_analyst_translate",
                model=self.model,
                input_tokens=response.usage.prompt_tokens if response.usage else 0,
                output_tokens=response.usage.completion_tokens if response.usage else 0,
                latency_ms=0,
            )

        except Exception as e:
            logger.warning("Translation post-processing failed: %s", e)
            # Return original parsed data if translation fails

        return parsed
