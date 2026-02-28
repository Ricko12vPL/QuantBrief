from app.models.signal import MarketSignal


def aggregate_sentiment(signals: list[MarketSignal]) -> dict:
    """Aggregate per-ticker sentiment from screened signals."""
    ticker_scores: dict[str, list[float]] = {}

    for signal in signals:
        if signal.ticker not in ticker_scores:
            ticker_scores[signal.ticker] = []

        score = 0.0
        if signal.sentiment.value == "bullish":
            score = signal.relevance_score
        elif signal.sentiment.value == "bearish":
            score = -signal.relevance_score
        ticker_scores[signal.ticker].append(score)

    result = {}
    for ticker, scores in ticker_scores.items():
        avg = sum(scores) / len(scores) if scores else 0.0
        bullish = sum(1 for s in scores if s > 0)
        bearish = sum(1 for s in scores if s < 0)
        neutral = sum(1 for s in scores if s == 0)

        result[ticker] = {
            "score": round(avg, 3),
            "label": "bullish" if avg > 0.1 else "bearish" if avg < -0.1 else "neutral",
            "signal_count": len(scores),
            "bullish_count": bullish,
            "bearish_count": bearish,
            "neutral_count": neutral,
        }

    return result
