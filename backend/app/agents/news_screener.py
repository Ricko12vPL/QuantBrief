import json
import logging
import time
from pathlib import Path

from mistralai import Mistral

from app.config import get_settings
from app.models.signal import MarketSignal, Sentiment, SignalType
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "news_screening.md"


BATCH_SIZE = 30


class NewsScreenerAgent:
    """Screens news articles using Ministral 3B for relevance and sentiment."""

    def __init__(self):
        settings = get_settings()
        self.client = Mistral(api_key=settings.mistral_api_key)
        self.model = settings.model_screening
        self._prompt = PROMPT_PATH.read_text() if PROMPT_PATH.exists() else ""

    async def screen_batch(
        self, signals: list[MarketSignal]
    ) -> list[MarketSignal]:
        """Screen a batch of signals, updating relevance and sentiment.

        Splits into sub-batches of BATCH_SIZE (~30) to avoid overloading
        the model context and to keep latency predictable.
        """
        if not signals:
            return []

        if len(signals) <= BATCH_SIZE:
            return await self._screen_chunk(signals)

        results: list[MarketSignal] = []
        for i in range(0, len(signals), BATCH_SIZE):
            chunk = signals[i : i + BATCH_SIZE]
            screened = await self._screen_chunk(chunk)
            results.extend(screened)
        return results

    async def _screen_chunk(
        self, signals: list[MarketSignal]
    ) -> list[MarketSignal]:
        """Screen a single chunk of up to BATCH_SIZE signals."""
        articles = [
            {
                "index": i,
                "title": s.title,
                "summary": s.summary[:300],
                "source": s.source,
                "url": s.url,
            }
            for i, s in enumerate(signals)
        ]

        start = time.time()
        try:
            response = await self.client.chat.complete_async(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._prompt},
                    {
                        "role": "user",
                        "content": f"Screen these articles:\n{json.dumps(articles)}",
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            latency = (time.time() - start) * 1000
            result_text = response.choices[0].message.content or ""
            usage = response.usage

            log_agent_call(
                agent_name="news_screener",
                model=self.model,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
                latency_ms=latency,
            )

            parsed = json.loads(result_text)
            screened = parsed.get("screened_signals", [])

            updated_signals = []
            for item in screened:
                idx = item.get("original_index", 0)
                if idx < len(signals):
                    original = signals[idx]
                    try:
                        sentiment = Sentiment(item.get("sentiment", "neutral"))
                    except ValueError:
                        sentiment = Sentiment.NEUTRAL

                    try:
                        signal_type = SignalType(item.get("signal_type", "news"))
                    except ValueError:
                        signal_type = SignalType.NEWS

                    updated = MarketSignal(
                        ticker=item.get("matched_tickers", [original.ticker])[0]
                        if item.get("matched_tickers")
                        else original.ticker,
                        title=original.title,
                        summary=item.get("one_line_summary", original.summary),
                        relevance_score=item.get("relevance_score", 0.5),
                        sentiment=sentiment,
                        source=original.source,
                        signal_type=signal_type,
                        url=original.url,
                        published_at=original.published_at,
                        raw_data=original.raw_data,
                    )
                    updated_signals.append(updated)

            return updated_signals

        except Exception as e:
            logger.error("News screening failed: %s", e)
            log_agent_call(
                agent_name="news_screener",
                model=self.model,
                latency_ms=(time.time() - start) * 1000,
                success=False,
            )
            return signals
