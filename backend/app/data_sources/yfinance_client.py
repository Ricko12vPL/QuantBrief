import asyncio
import logging
from datetime import datetime, timezone

import yfinance as yf

from app.utils.cache import get_cache
from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_cache():
    settings = get_settings()
    return get_cache(settings.redis_url)


async def get_quote(ticker: str) -> dict:
    """Get current quote for a ticker via yfinance."""
    cache = _get_cache()
    cache_key = f"yf:quote:{ticker}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        info = await asyncio.to_thread(_fetch_quote_sync, ticker)
        await cache.set(cache_key, info, ttl=600)
        return info
    except Exception as e:
        logger.error("yfinance quote failed for %s: %s", ticker, e)
        return {"ticker": ticker, "price": 0, "change": 0, "change_pct": 0}


def _fetch_quote_sync(ticker: str) -> dict:
    t = yf.Ticker(ticker)
    fi = t.fast_info
    price = float(fi.get("lastPrice", 0) or fi.get("last_price", 0) or 0)
    prev_close = float(fi.get("previousClose", 0) or fi.get("previous_close", 0) or 0)
    change = price - prev_close if prev_close else 0
    change_pct = (change / prev_close * 100) if prev_close else 0
    return {
        "ticker": ticker,
        "price": round(price, 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "high": round(float(fi.get("dayHigh", 0) or fi.get("day_high", 0) or 0), 2),
        "low": round(float(fi.get("dayLow", 0) or fi.get("day_low", 0) or 0), 2),
        "open": round(float(fi.get("open", 0) or 0), 2),
        "previous_close": round(prev_close, 2),
        "volume": int(fi.get("lastVolume", 0) or fi.get("last_volume", 0) or 0),
    }


async def get_quotes_batch(tickers: list[str]) -> list[dict]:
    """Get quotes for multiple tickers in parallel."""
    results = await asyncio.gather(
        *(get_quote(t) for t in tickers), return_exceptions=True
    )
    quotes: list[dict] = []
    for t, result in zip(tickers, results):
        if isinstance(result, dict) and "ticker" in result:
            quotes.append(result)
        else:
            quotes.append({"ticker": t, "price": 0, "change": 0, "change_pct": 0})
    return quotes


async def get_candles(ticker: str, resolution: str = "D", days: int = 90) -> list[dict]:
    """Get OHLCV candle data via yfinance."""
    cache = _get_cache()
    cache_key = f"yf:candles:{ticker}:{resolution}:{days}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        candles = await asyncio.to_thread(_fetch_candles_sync, ticker, resolution, days)
        await cache.set(cache_key, candles, ttl=300)
        return candles
    except Exception as e:
        logger.error("yfinance candles failed for %s: %s", ticker, e)
        return []


def _resolution_to_interval(resolution: str) -> str:
    mapping = {
        "1": "1m",
        "5": "5m",
        "15": "15m",
        "30": "30m",
        "60": "1h",
        "D": "1d",
        "W": "1wk",
        "M": "1mo",
    }
    return mapping.get(resolution, "1d")


def _days_to_period(days: int) -> str:
    if days <= 1:
        return "1d"
    if days <= 5:
        return "5d"
    if days <= 30:
        return "1mo"
    if days <= 90:
        return "3mo"
    if days <= 180:
        return "6mo"
    if days <= 365:
        return "1y"
    if days <= 730:
        return "2y"
    return "5y"


def _fetch_candles_sync(ticker: str, resolution: str, days: int) -> list[dict]:
    interval = _resolution_to_interval(resolution)
    period = _days_to_period(days)
    t = yf.Ticker(ticker)
    df = t.history(period=period, interval=interval)

    if df.empty:
        return []

    candles = []
    for idx, row in df.iterrows():
        ts = int(idx.timestamp()) if hasattr(idx, 'timestamp') else int(
            datetime.strptime(str(idx), "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
        )
        candles.append({
            "date": ts,
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })
    return candles


async def get_news(ticker: str) -> list[dict]:
    """Get recent news for a ticker via yfinance."""
    cache = _get_cache()
    cache_key = f"yf:news:{ticker}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        news = await asyncio.to_thread(_fetch_news_sync, ticker)
        await cache.set(cache_key, news, ttl=300)
        return news
    except Exception as e:
        logger.error("yfinance news failed for %s: %s", ticker, e)
        return []


def _fetch_news_sync(ticker: str) -> list[dict]:
    t = yf.Ticker(ticker)
    raw_news = t.news or []
    articles = []
    for item in raw_news:
        content = item.get("content", {})
        thumbnail_url = ""
        thumbnail = content.get("thumbnail")
        if thumbnail and isinstance(thumbnail, dict):
            resolutions = thumbnail.get("resolutions", [])
            if resolutions:
                thumbnail_url = resolutions[0].get("url", "")

        pub_date = content.get("pubDate", "")
        articles.append({
            "title": content.get("title", item.get("title", "")),
            "publisher": content.get("provider", {}).get("displayName", ""),
            "link": content.get("canonicalUrl", {}).get("url", item.get("link", "")),
            "published_at": pub_date,
            "summary": content.get("summary", ""),
            "related_tickers": [
                tk.get("symbol", "")
                for tk in content.get("finance", {}).get("stockTickers", [])
            ],
            "thumbnail": thumbnail_url,
        })
    return articles


async def get_company_overview(ticker: str) -> dict:
    """Get company fundamentals mapped to Alpha Vantage field names for backward compatibility."""
    cache = _get_cache()
    cache_key = f"yf:overview:{ticker}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        overview = await asyncio.to_thread(_fetch_overview_sync, ticker)
        await cache.set(cache_key, overview, ttl=86400)
        return overview
    except Exception as e:
        logger.error("yfinance overview failed for %s: %s", ticker, e)
        return {}


def _safe_str(val) -> str:
    """Convert a value to string for backward compatibility with safe_float()."""
    if val is None:
        return "None"
    return str(val)


def _fetch_overview_sync(ticker: str) -> dict:
    t = yf.Ticker(ticker)
    info = t.info

    if not info or info.get("quoteType") is None:
        return {}

    return {
        "Name": info.get("longName", info.get("shortName", ticker)),
        "Sector": info.get("sector", ""),
        "Industry": info.get("industry", ""),
        "PERatio": _safe_str(info.get("trailingPE")),
        "PriceToBookRatio": _safe_str(info.get("priceToBook")),
        "DebtToEquityRatio": _safe_str(info.get("debtToEquity")),
        "ReturnOnEquityTTM": _safe_str(info.get("returnOnEquity")),
        "EVToEBITDA": _safe_str(info.get("enterpriseToEbitda")),
        "ProfitMargin": _safe_str(info.get("profitMargins")),
        "OperatingMarginTTM": _safe_str(info.get("operatingMargins")),
        "GrossProfitTTM": _safe_str(info.get("grossProfits")),
        "RevenueTTM": _safe_str(info.get("totalRevenue")),
        "QuarterlyRevenueGrowthYOY": _safe_str(info.get("revenueGrowth")),
        "EPS": _safe_str(info.get("trailingEps")),
        "DividendYield": _safe_str(info.get("dividendYield")),
        "Beta": _safe_str(info.get("beta")),
        "MarketCapitalization": _safe_str(info.get("marketCap")),
        "BookValue": _safe_str(info.get("bookValue")),
        "SharesOutstanding": _safe_str(info.get("sharesOutstanding")),
        "OperatingCashflowTTM": _safe_str(info.get("operatingCashflow")),
        "CapitalExpenditures": _safe_str(info.get("capitalExpenditures", 0)),
        "LongTermDebt": _safe_str(info.get("longTermDebt")),
        "OperatingIncomeTTM": _safe_str(info.get("operatingIncome")),
        "EffectiveTaxRate": _safe_str(info.get("effectiveTaxRate", 0.21)),
    }
