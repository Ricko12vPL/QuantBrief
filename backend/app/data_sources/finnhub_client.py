import httpx
import logging
from datetime import datetime, timedelta, timezone

from app.utils.rate_limiter import FINNHUB_LIMITER
from app.utils.cache import get_cache
from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://finnhub.io/api/v1"


async def _fetch(endpoint: str, params: dict, cache_ttl: int = 600) -> dict | list:
    settings = get_settings()
    if not settings.finnhub_api_key:
        logger.warning("Finnhub API key not set")
        return {}

    cache_key = f"finnhub:{endpoint}:{sorted(params.items())}"
    request_params = {**params, "token": settings.finnhub_api_key}
    cache = get_cache(settings.redis_url)

    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    async with FINNHUB_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BASE_URL}/{endpoint}", params=request_params, timeout=10)
            if resp.status_code != 200:
                logger.error("Finnhub fetch failed: %d", resp.status_code)
                return {}
            data = resp.json()
            await cache.set(cache_key, data, cache_ttl)
            return data


async def get_quote(ticker: str) -> dict:
    """Get real-time quote."""
    data = await _fetch("quote", {"symbol": ticker})
    if not data or not isinstance(data, dict):
        return {}
    return {
        "ticker": ticker,
        "price": data.get("c", 0),
        "change": data.get("d", 0),
        "change_pct": data.get("dp", 0),
        "high": data.get("h", 0),
        "low": data.get("l", 0),
        "open": data.get("o", 0),
        "previous_close": data.get("pc", 0),
    }


async def get_earnings_calendar(
    from_date: str | None = None, to_date: str | None = None
) -> list[dict]:
    """Get upcoming earnings."""
    if not from_date:
        from_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not to_date:
        to_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")

    data = await _fetch("calendar/earnings", {
        "from": from_date,
        "to": to_date,
    })
    if isinstance(data, dict):
        return data.get("earningsCalendar", [])
    return []


async def get_company_news(
    ticker: str, days_back: int = 7
) -> list[dict]:
    """Get recent company news."""
    to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    from_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")

    data = await _fetch("company-news", {
        "symbol": ticker,
        "from": from_date,
        "to": to_date,
    }, cache_ttl=300)
    if isinstance(data, list):
        return data[:20]
    return []


async def search_symbols(query: str) -> list[dict]:
    """Search for stock symbols by name or ticker."""
    data = await _fetch("search", {"q": query}, cache_ttl=300)
    results = data.get("result", []) if isinstance(data, dict) else []
    return [
        {"symbol": r["symbol"], "description": r["description"], "type": r.get("type", "")}
        for r in results if r.get("type") == "Common Stock"
    ][:8]


async def get_candles(ticker: str, resolution: str = "D", days: int = 90) -> list[dict]:
    """Get OHLCV candle data from Finnhub."""
    to_ts = int(datetime.now(timezone.utc).timestamp())
    from_ts = to_ts - (days * 86400)
    data = await _fetch(
        "stock/candle",
        {"symbol": ticker, "resolution": resolution, "from": from_ts, "to": to_ts},
        cache_ttl=300,
    )
    if not isinstance(data, dict) or data.get("s") != "ok":
        return []
    return [
        {"date": ts, "open": o, "high": h, "low": l, "close": c, "volume": v}
        for ts, o, h, l, c, v in zip(data["t"], data["o"], data["h"], data["l"], data["c"], data["v"])
    ]
