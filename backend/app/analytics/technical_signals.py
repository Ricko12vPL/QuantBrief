import logging

import pandas as pd

from app.data_sources.yfinance_client import get_candles

logger = logging.getLogger(__name__)


def _compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def _compute_macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _compute_bollinger(
    close: pd.Series, period: int = 20, num_std: float = 2.0
) -> tuple[pd.Series, pd.Series, pd.Series]:
    sma = close.rolling(period).mean()
    std = close.rolling(period).std()
    upper = sma + num_std * std
    lower = sma - num_std * std
    return upper, sma, lower


async def get_technical_summary(ticker: str) -> dict:
    """Compute all technical indicators from raw OHLCV data."""
    candles = await get_candles(ticker, "D", 365)

    if not candles or len(candles) < 30:
        return {
            "ticker": ticker,
            "rsi": 50.0,
            "rsi_signal": "neutral",
            "macd_line": 0,
            "macd_signal_line": 0,
            "macd_histogram": 0,
            "macd_signal": "neutral",
            "bb_upper": 0,
            "bb_middle": 0,
            "bb_lower": 0,
            "bb_position": "middle",
            "sma_20": 0,
            "sma_50": 0,
            "sma_200": 0,
            "price": 0,
            "price_vs_sma200": "neutral",
            "volume_avg_20": 0,
            "volume_latest": 0,
            "volume_signal": "normal",
        }

    df = pd.DataFrame(candles)
    close = df["close"].astype(float)
    volume = df["volume"].astype(float)

    # RSI
    rsi_series = _compute_rsi(close)
    latest_rsi = round(float(rsi_series.iloc[-1]), 2) if not rsi_series.empty else 50.0

    rsi_signal = "neutral"
    if latest_rsi > 70:
        rsi_signal = "overbought"
    elif latest_rsi < 30:
        rsi_signal = "oversold"

    # MACD
    macd_line, signal_line, histogram = _compute_macd(close)
    latest_macd = round(float(macd_line.iloc[-1]), 4) if not macd_line.empty else 0
    latest_signal = round(float(signal_line.iloc[-1]), 4) if not signal_line.empty else 0
    latest_hist = round(float(histogram.iloc[-1]), 4) if not histogram.empty else 0

    macd_signal = "neutral"
    if latest_hist > 0:
        macd_signal = "bullish"
    elif latest_hist < 0:
        macd_signal = "bearish"

    # Bollinger Bands
    bb_upper, bb_middle, bb_lower = _compute_bollinger(close)
    latest_bb_upper = round(float(bb_upper.iloc[-1]), 2)
    latest_bb_middle = round(float(bb_middle.iloc[-1]), 2)
    latest_bb_lower = round(float(bb_lower.iloc[-1]), 2)

    latest_price = round(float(close.iloc[-1]), 2)

    bb_position = "middle"
    if latest_price > latest_bb_upper:
        bb_position = "above_upper"
    elif latest_price > latest_bb_middle + 0.6 * (latest_bb_upper - latest_bb_middle):
        bb_position = "near_upper"
    elif latest_price < latest_bb_lower:
        bb_position = "below_lower"
    elif latest_price < latest_bb_middle - 0.6 * (latest_bb_middle - latest_bb_lower):
        bb_position = "near_lower"

    # SMAs
    sma_20 = round(float(close.rolling(20).mean().iloc[-1]), 2)
    sma_50 = round(float(close.rolling(50).mean().iloc[-1]), 2) if len(close) >= 50 else 0
    sma_200 = round(float(close.rolling(200).mean().iloc[-1]), 2) if len(close) >= 200 else 0

    price_vs_sma200 = "neutral"
    if sma_200 > 0:
        price_vs_sma200 = "above" if latest_price > sma_200 else "below"

    # Volume
    vol_avg_20 = round(float(volume.rolling(20).mean().iloc[-1]), 0)
    vol_latest = round(float(volume.iloc[-1]), 0)

    volume_signal = "normal"
    if vol_avg_20 > 0:
        vol_ratio = vol_latest / vol_avg_20
        if vol_ratio > 1.5:
            volume_signal = "high"
        elif vol_ratio < 0.5:
            volume_signal = "low"

    return {
        "ticker": ticker,
        "rsi": latest_rsi,
        "rsi_signal": rsi_signal,
        "macd_line": latest_macd,
        "macd_signal_line": latest_signal,
        "macd_histogram": latest_hist,
        "macd_signal": macd_signal,
        "bb_upper": latest_bb_upper,
        "bb_middle": latest_bb_middle,
        "bb_lower": latest_bb_lower,
        "bb_position": bb_position,
        "sma_20": sma_20,
        "sma_50": sma_50,
        "sma_200": sma_200,
        "price": latest_price,
        "price_vs_sma200": price_vs_sma200,
        "volume_avg_20": vol_avg_20,
        "volume_latest": vol_latest,
        "volume_signal": volume_signal,
    }
