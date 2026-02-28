import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.data_sources.sec_edgar import get_recent_filings, get_filing_text
from app.agents.filing_analyst import FilingAnalystAgent
from app.agents.earnings_transcriber import EarningsTranscriberAgent

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
async def get_filings(
    ticker: str, form_types: str = "10-K,10-Q,8-K", limit: int = 5
) -> dict:
    """Get recent SEC filings for a ticker."""
    forms = [f.strip() for f in form_types.split(",")]
    filings = await get_recent_filings(ticker.upper(), form_types=forms, limit=limit)
    return {
        "ticker": ticker.upper(),
        "filings": [f.model_dump(mode="json") for f in filings],
    }


@router.get("/{ticker}/analyze")
async def analyze_latest_filing(ticker: str, form_type: str = "10-K") -> dict:
    """Analyze the most recent filing of a given type."""
    filings = await get_recent_filings(
        ticker.upper(), form_types=[form_type], limit=1
    )
    if not filings:
        raise HTTPException(
            status_code=404,
            detail=f"No {form_type} filings found for {ticker}",
        )

    analyst = FilingAnalystAgent()
    analysis = await analyst.analyze_filing(filings[0])
    return {"analysis": analysis.model_dump(mode="json")}


@router.get("/{ticker}/raw")
async def get_raw_filing(ticker: str, form_type: str = "10-K") -> dict:
    """Get raw text of the most recent filing."""
    filings = await get_recent_filings(
        ticker.upper(), form_types=[form_type], limit=1
    )
    if not filings:
        raise HTTPException(
            status_code=404,
            detail=f"No {form_type} filings found for {ticker}",
        )

    text = await get_filing_text(filings[0].filing_url)
    return {
        "ticker": ticker.upper(),
        "filing": filings[0].model_dump(mode="json"),
        "text": text[:50000],
    }


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac"}


@router.post("/earnings-call")
async def analyze_earnings_call(
    file: UploadFile = File(...),
    ticker: str = Form(...),
) -> dict:
    """Transcribe and analyze an earnings call audio file.

    Accepts MP3, WAV, M4A, OGG, or FLAC audio files.
    Uses Voxtral for transcription and Mistral Large 3 for analysis.
    """
    if not ticker or not ticker.strip():
        raise HTTPException(status_code=400, detail="Ticker is required")

    filename = file.filename or "upload.mp3"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {suffix}. Allowed: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}",
        )

    tmp_path: str | None = None
    try:
        chunks, total = [], 0
        async for chunk in file:
            total += len(chunk)
            if total > 100 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large (max 100MB)")
            chunks.append(chunk)
        content = b"".join(chunks)

        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        agent = EarningsTranscriberAgent()
        analysis = await agent.transcribe_and_analyze(tmp_path, ticker.strip())

        return {"analysis": analysis.model_dump(mode="json")}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Earnings call analysis failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Earnings call analysis failed",
        ) from e
    finally:
        if tmp_path:
            tmp_file = Path(tmp_path)
            if tmp_file.exists():
                tmp_file.unlink()


@router.post("/earnings-call/text")
async def analyze_earnings_call_text(
    transcript: str = Form(...),
    ticker: str = Form(...),
) -> dict:
    """Analyze a pre-transcribed earnings call (text input fallback).

    Use this endpoint when you already have the transcript text.
    """
    if not ticker or not ticker.strip():
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not transcript or not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript text is required")

    try:
        agent = EarningsTranscriberAgent()
        analysis = await agent.analyze_from_text(transcript.strip(), ticker.strip())
        return {"analysis": analysis.model_dump(mode="json")}

    except Exception as e:
        logger.error("Earnings call text analysis failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Earnings call text analysis failed",
        ) from e
