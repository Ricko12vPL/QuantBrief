import asyncio
import logging

from app.data_sources.alpha_vantage import fetch

logger = logging.getLogger(__name__)


async def get_rsi(ticker: str, interval: str = "daily", period: int = 14) -> list[dict]:
    """Get RSI (Relative Strength Index) from Alpha Vantage."""
    data = await fetch({
        "function": "RSI",
        "symbol": ticker,
        "interval": interval,
        "time_period": str(period),
        "series_type": "close",
    })
    series_key = "Technical Analysis: RSI"
    series = data.get(series_key, {})
    return [
        {"date": date, "rsi": float(vals.get("RSI", 0))}
        for date, vals in sorted(series.items(), reverse=True)[:30]
    ]


async def get_macd(ticker: str, interval: str = "daily") -> list[dict]:
    """Get MACD from Alpha Vantage."""
    data = await fetch({
        "function": "MACD",
        "symbol": ticker,
        "interval": interval,
        "series_type": "close",
    })
    series_key = "Technical Analysis: MACD"
    series = data.get(series_key, {})
    return [
        {
            "date": date,
            "macd": float(vals.get("MACD", 0)),
            "signal": float(vals.get("MACD_Signal", 0)),
            "histogram": float(vals.get("MACD_Hist", 0)),
        }
        for date, vals in sorted(series.items(), reverse=True)[:30]
    ]


async def get_bollinger_bands(ticker: str, interval: str = "daily") -> list[dict]:
    """Get Bollinger Bands from Alpha Vantage."""
    data = await fetch({
        "function": "BBANDS",
        "symbol": ticker,
        "interval": interval,
        "series_type": "close",
        "time_period": "20",
    })
    series_key = "Technical Analysis: BBANDS"
    series = data.get(series_key, {})
    return [
        {
            "date": date,
            "upper": float(vals.get("Real Upper Band", 0)),
            "middle": float(vals.get("Real Middle Band", 0)),
            "lower": float(vals.get("Real Lower Band", 0)),
        }
        for date, vals in sorted(series.items(), reverse=True)[:30]
    ]


async def get_technical_summary(ticker: str) -> dict:
    """Get a summary of key technical indicators."""
    rsi_data, macd_data = await asyncio.gather(
        get_rsi(ticker),
        get_macd(ticker),
    )
    latest_rsi = rsi_data[0]["rsi"] if rsi_data else 50.0

    rsi_signal = "neutral"
    if latest_rsi > 70:
        rsi_signal = "overbought"
    elif latest_rsi < 30:
        rsi_signal = "oversold"
    macd_signal = "neutral"
    if macd_data:
        hist = macd_data[0]["histogram"]
        if hist > 0:
            macd_signal = "bullish"
        elif hist < 0:
            macd_signal = "bearish"

    return {
        "ticker": ticker,
        "rsi": latest_rsi,
        "rsi_signal": rsi_signal,
        "macd_signal": macd_signal,
        "macd_histogram": macd_data[0]["histogram"] if macd_data else 0,
    }
