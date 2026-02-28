import logging

from app.data_sources.finnhub_client import get_earnings_calendar

logger = logging.getLogger(__name__)


async def get_earnings_surprises(ticker: str | None = None) -> list[dict]:
    """Get earnings surprise data from Finnhub calendar."""
    earnings = await get_earnings_calendar()
    if not earnings:
        return []

    results = []
    for entry in earnings:
        if ticker and entry.get("symbol", "").upper() != ticker.upper():
            continue

        actual = entry.get("epsActual")
        estimate = entry.get("epsEstimate")

        if actual is not None and estimate is not None and estimate != 0:
            surprise_pct = ((actual - estimate) / abs(estimate)) * 100
        else:
            surprise_pct = None

        results.append({
            "ticker": entry.get("symbol", ""),
            "date": entry.get("date", ""),
            "eps_actual": actual,
            "eps_estimate": estimate,
            "surprise_pct": round(surprise_pct, 2) if surprise_pct is not None else None,
            "surprise_direction": (
                "beat" if surprise_pct is not None and surprise_pct > 0
                else "miss" if surprise_pct is not None and surprise_pct < 0
                else "inline" if surprise_pct is not None
                else "unknown"
            ),
            "revenue_actual": entry.get("revenueActual"),
            "revenue_estimate": entry.get("revenueEstimate"),
        })

    return results
