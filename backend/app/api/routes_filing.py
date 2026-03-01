import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.usage import log_usage
from app.data_sources.sec_edgar import get_recent_filings, get_filing_text
from app.agents.filing_analyst import FilingAnalystAgent
from app.agents.earnings_transcriber import EarningsTranscriberAgent
from app.db.engine import get_db
from app.db.models import UserRow
from app.utils.http_rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{ticker}")
async def get_filings(
    ticker: str, form_types: str = "10-K,10-Q,8-K", limit: int = 5
) -> dict:
    forms = [f.strip() for f in form_types.split(",")]
    filings = await get_recent_filings(ticker.upper(), form_types=forms, limit=limit)
    return {
        "ticker": ticker.upper(),
        "filings": [f.model_dump(mode="json") for f in filings],
    }


@router.get("/{ticker}/analyze")
async def analyze_latest_filing(
    ticker: str,
    form_type: str = "10-K",
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
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
    await log_usage(db, user.id, "filing_analyze", {"ticker": ticker.upper()})
    return {"analysis": analysis.model_dump(mode="json")}


@router.get("/{ticker}/raw")
async def get_raw_filing(ticker: str, form_type: str = "10-K") -> dict:
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
@limiter.limit("3/minute")
async def analyze_earnings_call(
    request: Request,
    file: UploadFile = File(...),
    ticker: str = Form(...),
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
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

        await log_usage(db, user.id, "earnings_call_analyze", {"ticker": ticker.strip()})
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
@limiter.limit("3/minute")
async def analyze_earnings_call_text(
    request: Request,
    transcript: str = Form(...),
    ticker: str = Form(...),
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not ticker or not ticker.strip():
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not transcript or not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript text is required")

    try:
        agent = EarningsTranscriberAgent()
        analysis = await agent.analyze_from_text(transcript.strip(), ticker.strip())
        await log_usage(db, user.id, "earnings_call_text", {"ticker": ticker.strip()})
        return {"analysis": analysis.model_dump(mode="json")}

    except Exception as e:
        logger.error("Earnings call text analysis failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Earnings call text analysis failed",
        ) from e
