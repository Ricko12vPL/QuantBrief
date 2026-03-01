import json
import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from mistralai import Mistral

from app.auth.dependencies import get_current_user
from app.auth.usage import log_usage
from app.db.engine import get_db
from app.db.models import UserRow

from app.config import get_settings
from app.data_sources.yfinance_client import get_candles, get_news, get_quotes_batch
from app.analytics.technical_signals import get_technical_summary
from app.analytics.financial_ratios import compute_ratios
from app.utils.cache import get_cache
from app.utils.validation import TICKER_RE
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)
router = APIRouter()

TECHNICAL_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "technical_analysis.md"

_mistral_client: Mistral | None = None


def _get_mistral_client() -> Mistral:
    global _mistral_client
    if _mistral_client is None:
        settings = get_settings()
        _mistral_client = Mistral(api_key=settings.mistral_api_key)
    return _mistral_client


class TechnicalAnalysisRequest(BaseModel):
    question: str = ""


@router.get("/quotes")
async def get_batch_quotes(tickers: str = ""):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:20]
    if not ticker_list:
        return {"quotes": []}
    quotes = await get_quotes_batch(ticker_list)
    return {"quotes": quotes}


@router.get("/{ticker}/candles")
async def get_candle_data(ticker: str, resolution: str = "D", days: int = 90):
    candles = await get_candles(ticker.upper(), resolution, days)
    error_msg = None
    if not candles:
        error_msg = f"No candle data for {ticker.upper()} (resolution={resolution})"
    return {"ticker": ticker.upper(), "resolution": resolution, "candles": candles, "error": error_msg}


@router.get("/{ticker}/technical")
async def get_technical(ticker: str):
    summary = await get_technical_summary(ticker.upper())
    return summary


@router.post("/{ticker}/analyze-technical")
async def ai_technical_analysis(
    ticker: str,
    body: TechnicalAnalysisRequest,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    summary = await get_technical_summary(ticker.upper())

    prompt_text = ""
    if TECHNICAL_PROMPT_PATH.exists():
        prompt_text = TECHNICAL_PROMPT_PATH.read_text()

    user_content = (
        f"Ticker: {ticker.upper()}\n"
        f"Price: ${summary.get('price')}\n"
        f"RSI(14): {summary.get('rsi')} ({summary.get('rsi_signal')})\n"
        f"MACD: line={summary.get('macd_line')}, signal={summary.get('macd_signal_line')}, "
        f"hist={summary.get('macd_histogram')} ({summary.get('macd_signal')})\n"
        f"Bollinger Bands: upper={summary.get('bb_upper')}, middle={summary.get('bb_middle')}, "
        f"lower={summary.get('bb_lower')} ({summary.get('bb_position')})\n"
        f"SMA: 20={summary.get('sma_20')}, 50={summary.get('sma_50')}, "
        f"200={summary.get('sma_200')} (price vs SMA200: {summary.get('price_vs_sma200')})\n"
        f"Volume: latest={summary.get('volume_latest')}, avg20={summary.get('volume_avg_20')} "
        f"({summary.get('volume_signal')})\n"
    )
    if body.question:
        user_content += f"\nUser question: {body.question}\n"

    start = time.time()
    try:
        client = _get_mistral_client()
        response = await client.chat.complete_async(
            model=settings.model_analysis,
            messages=[
                {"role": "system", "content": prompt_text},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        latency = (time.time() - start) * 1000
        result_text = response.choices[0].message.content or "{}"
        usage = response.usage
        log_agent_call(
            agent_name="technical_analyst",
            model=settings.model_analysis,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            latency_ms=latency,
        )
        parsed = json.loads(result_text)
        await log_usage(db, user.id, "technical_analyze", {"ticker": ticker.upper()})
        return {"ticker": ticker.upper(), "indicators": summary, "ai_analysis": parsed}
    except Exception as e:
        logger.error("AI technical analysis failed: %s", e)
        return {"ticker": ticker.upper(), "indicators": summary, "ai_analysis": {"error": "Analysis failed"}}


def _enrich_article(article: dict, ai: dict | None = None) -> dict:
    """Build enriched article dict from raw news + optional AI analysis."""
    ai = ai or {}
    return {
        "title": article["title"],
        "publisher": article["publisher"],
        "link": article["link"],
        "published_at": article["published_at"],
        "thumbnail": article.get("thumbnail", ""),
        "sentiment": ai.get("sentiment", "neutral"),
        "relevance_score": ai.get("relevance_score", 0.5),
        "summary": ai.get("summary", article.get("summary", "")),
    }


@router.get("/{ticker}/news")
async def get_ticker_news(ticker: str):
    """Fetch news for a ticker and run Ministral 3B sentiment analysis."""
    ticker_upper = ticker.upper()
    if not TICKER_RE.match(ticker_upper):
        return {"ticker": ticker_upper, "news": [], "error": "Invalid ticker format"}

    # Check enriched cache first to avoid redundant LLM calls
    settings = get_settings()
    cache = get_cache(settings.redis_url)
    cache_key = f"sentiment:news:{ticker_upper}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    articles = await get_news(ticker_upper)
    if not articles:
        return {"ticker": ticker_upper, "news": []}

    # Build compact article list for the LLM
    article_inputs = [
        {"index": i, "title": a["title"], "summary": a.get("summary", "")[:300]}
        for i, a in enumerate(articles)
    ]

    start = time.time()
    try:
        client = _get_mistral_client()
        response = await client.chat.complete_async(
            model=settings.model_screening,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a financial news sentiment analyst. For each article, return JSON with:\n"
                        '{"articles": [{"index": 0, "sentiment": "bullish"|"bearish"|"neutral", '
                        '"relevance_score": 0.0-1.0, "summary": "one-line summary"}]}\n'
                        "relevance_score reflects market impact (>0.7 = critical). Be precise and factual."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Analyze sentiment for {ticker_upper} news:\n{json.dumps(article_inputs)}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )

        latency = (time.time() - start) * 1000
        result_text = response.choices[0].message.content or "{}"
        usage = response.usage
        log_agent_call(
            agent_name="news_sentiment",
            model=settings.model_screening,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            latency_ms=latency,
        )

        parsed = json.loads(result_text)
        ai_articles = parsed.get("articles", [])

        # Merge AI results with raw news data (defensive index access)
        ai_by_index = {
            a.get("index"): a
            for a in ai_articles
            if isinstance(a, dict) and "index" in a
        }
        enriched = [
            _enrich_article(article, ai_by_index.get(i))
            for i, article in enumerate(articles)
        ]

        result = {"ticker": ticker_upper, "news": enriched}
        await cache.set(cache_key, result, ttl=300)
        return result

    except Exception as e:
        logger.error("News sentiment analysis failed for %s: %s", ticker_upper, e)
        # Return raw news without AI enrichment on failure
        fallback = [_enrich_article(a) for a in articles]
        return {"ticker": ticker_upper, "news": fallback}


@router.get("/{ticker}/ratios")
async def get_financial_ratios(ticker: str):
    ratios = await compute_ratios(ticker.upper())
    return ratios
