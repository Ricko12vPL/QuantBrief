import asyncio
import httpx
import logging

from app.utils.rate_limiter import FRED_LIMITER
from app.utils.cache import get_cache
from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.stlouisfed.org/fred"

MACRO_SERIES = {
    "GDP": "GDP",
    "UNRATE": "UNRATE",
    "CPIAUCSL": "CPIAUCSL",
    "FEDFUNDS": "FEDFUNDS",
    "T10Y2Y": "T10Y2Y",
    "VIXCLS": "VIXCLS",
}


async def get_series(
    series_id: str, limit: int = 30, cache_ttl: int = 3600
) -> list[dict]:
    """Get FRED time series data."""
    settings = get_settings()
    if not settings.fred_api_key:
        logger.warning("FRED API key not set")
        return []

    cache = get_cache(settings.redis_url)
    cache_key = f"fred:{series_id}:{limit}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    async with FRED_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/series/observations",
                params={
                    "series_id": series_id,
                    "api_key": settings.fred_api_key,
                    "file_type": "json",
                    "sort_order": "desc",
                    "limit": limit,
                },
                timeout=10,
            )
            if resp.status_code != 200:
                logger.error("FRED fetch failed: %d", resp.status_code)
                return []
            data = resp.json().get("observations", [])
            result = [
                {"date": obs["date"], "value": obs["value"]}
                for obs in data
                if obs["value"] != "."
            ]
            await cache.set(cache_key, result, cache_ttl)
            return result


async def get_macro_snapshot() -> dict:
    """Get latest values for key macro indicators in parallel."""

    async def _fetch(name: str, series_id: str) -> tuple[str, dict | None]:
        data = await get_series(series_id, limit=1)
        if data:
            return name, {"value": data[0]["value"], "date": data[0]["date"]}
        return name, None

    results = await asyncio.gather(
        *[_fetch(name, sid) for name, sid in MACRO_SERIES.items()]
    )
    return {name: val for name, val in results if val is not None}
