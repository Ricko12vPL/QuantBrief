import json
import logging
import time
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from mistralai import Mistral

from app.config import get_settings
from app.data_sources.finnhub_client import get_candles
from app.analytics.technical_signals import get_technical_summary
from app.analytics.financial_ratios import compute_ratios
from app.utils.wandb_logger import log_agent_call

logger = logging.getLogger(__name__)
router = APIRouter()

TECHNICAL_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "technical_analysis.md"


class TechnicalAnalysisRequest(BaseModel):
    question: str = ""


@router.get("/quotes")
async def get_batch_quotes(tickers: str = ""):
    from app.data_sources.finnhub_client import get_quotes_batch
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
        settings = get_settings()
        if not settings.finnhub_api_key:
            error_msg = "Finnhub API key not configured"
        else:
            error_msg = f"No candle data for {ticker.upper()} (resolution={resolution})"
    return {"ticker": ticker.upper(), "resolution": resolution, "candles": candles, "error": error_msg}


@router.get("/{ticker}/technical")
async def get_technical(ticker: str):
    summary = await get_technical_summary(ticker.upper())
    return summary


@router.post("/{ticker}/analyze-technical")
async def ai_technical_analysis(ticker: str, body: TechnicalAnalysisRequest):
    settings = get_settings()
    summary = await get_technical_summary(ticker.upper())

    prompt_text = ""
    if TECHNICAL_PROMPT_PATH.exists():
        prompt_text = TECHNICAL_PROMPT_PATH.read_text()

    user_content = (
        f"Ticker: {ticker.upper()}\n"
        f"RSI: {summary.get('rsi', 'N/A')} ({summary.get('rsi_signal', 'N/A')})\n"
        f"MACD Signal: {summary.get('macd_signal', 'N/A')}\n"
        f"MACD Histogram: {summary.get('macd_histogram', 'N/A')}\n"
    )
    if body.question:
        user_content += f"\nUser question: {body.question}\n"

    start = time.time()
    try:
        client = Mistral(api_key=settings.mistral_api_key)
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
        return {"ticker": ticker.upper(), "indicators": summary, "ai_analysis": parsed}
    except Exception as e:
        logger.error("AI technical analysis failed: %s", e)
        return {"ticker": ticker.upper(), "indicators": summary, "ai_analysis": {"error": str(e)}}


@router.get("/{ticker}/ratios")
async def get_financial_ratios(ticker: str):
    ratios = await compute_ratios(ticker.upper())
    return ratios
