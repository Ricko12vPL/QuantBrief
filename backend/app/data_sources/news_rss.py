import asyncio
import logging
import re
from datetime import datetime, timezone

import feedparser

from app.models.signal import MarketSignal, Sentiment, SignalType

logger = logging.getLogger(__name__)

DEFAULT_FEEDS = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA,GOOGL,AMZN&region=US&lang=en-US",
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=20&search_text=&start=0&output=atom",
]


async def fetch_feeds(
    feeds: list[str] | None = None, tickers: list[str] | None = None
) -> list[MarketSignal]:
    """Fetch and parse RSS feeds into MarketSignal objects."""
    feeds = feeds or DEFAULT_FEEDS
    tickers_upper = {t.upper() for t in (tickers or [])}
    signals = []

    for feed_url in feeds:
        try:
            parsed = await asyncio.to_thread(feedparser.parse, feed_url)
            for entry in parsed.entries[:30]:
                title = entry.get("title", "")
                summary = entry.get("summary", entry.get("description", ""))
                link = entry.get("link", "")
                published = entry.get("published_parsed")
                pub_dt = (
                    datetime(*published[:6]) if published else datetime.now(timezone.utc)
                )

                # Try to match tickers
                matched_ticker = ""
                if tickers_upper:
                    text = f"{title} {summary}".upper()
                    for t in tickers_upper:
                        if re.search(rf'\b{re.escape(t)}\b', text):
                            matched_ticker = t
                            break

                signal = MarketSignal(
                    ticker=matched_ticker or "MARKET",
                    title=title[:200],
                    summary=summary[:500],
                    relevance_score=0.5,
                    sentiment=Sentiment.NEUTRAL,
                    source=parsed.feed.get("title", feed_url[:50]),
                    signal_type=SignalType.NEWS,
                    url=link,
                    published_at=pub_dt,
                )
                signals.append(signal)

        except Exception as e:
            logger.error("RSS feed error (%s): %s", feed_url, e)

    return signals
