import httpx
import logging

from app.utils.rate_limiter import ALPHA_VANTAGE_LIMITER
from app.utils.cache import get_cache
from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alphavantage.co/query"


async def _fetch(params: dict, cache_ttl: int = 3600) -> dict:
    """Fetch from Alpha Vantage with caching (25 req/day limit!)."""
    settings = get_settings()
    if not settings.alpha_vantage_api_key:
        logger.warning("Alpha Vantage API key not set")
        return {}

    request_params = {**params, "apikey": settings.alpha_vantage_api_key}
    cache_key = f"av:{params.get('function')}:{params.get('symbol', params.get('tickers', ''))}"
    cache = get_cache(settings.redis_url)

    cached = await cache.get(cache_key)
    if cached:
        return cached

    async with ALPHA_VANTAGE_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(BASE_URL, params=request_params, timeout=15)
            if resp.status_code != 200:
                logger.error("Alpha Vantage fetch failed: %d", resp.status_code)
                return {}
            data = resp.json()
            if "Error Message" in data or "Note" in data:
                logger.warning("Alpha Vantage error: %s", data)
                return {}
            await cache.set(cache_key, data, cache_ttl)
            return data


async def get_quote(ticker: str) -> dict:
    """Get current quote for a ticker."""
    data = await _fetch({
        "function": "GLOBAL_QUOTE",
        "symbol": ticker,
    })
    quote = data.get("Global Quote", {})
    if not quote:
        return {}
    return {
        "ticker": ticker,
        "price": float(quote.get("05. price", 0)),
        "change": float(quote.get("09. change", 0)),
        "change_pct": quote.get("10. change percent", "0%"),
        "volume": int(quote.get("06. volume", 0)),
        "previous_close": float(quote.get("08. previous close", 0)),
    }


async def get_daily_prices(ticker: str, outputsize: str = "compact") -> list[dict]:
    """Get daily price history."""
    data = await _fetch({
        "function": "TIME_SERIES_DAILY",
        "symbol": ticker,
        "outputsize": outputsize,
    })
    ts = data.get("Time Series (Daily)", {})
    return [
        {
            "date": date,
            "open": float(vals["1. open"]),
            "high": float(vals["2. high"]),
            "low": float(vals["3. low"]),
            "close": float(vals["4. close"]),
            "volume": int(vals["5. volume"]),
        }
        for date, vals in sorted(ts.items(), reverse=True)
    ]


async def get_company_overview(ticker: str) -> dict:
    """Get company fundamentals."""
    return await _fetch({
        "function": "OVERVIEW",
        "symbol": ticker,
    }, cache_ttl=86400)


async def get_news_sentiment(ticker: str) -> list[dict]:
    """Get news sentiment from Alpha Vantage."""
    data = await _fetch({
        "function": "NEWS_SENTIMENT",
        "tickers": ticker,
        "limit": "10",
    })
    return data.get("feed", [])
