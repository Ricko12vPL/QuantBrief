from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.data_sources.finnhub_client import search_symbols
from app.db.engine import get_db
from app.db.models import WatchlistItemRow, UserRow
from app.utils.validation import TICKER_RE

router = APIRouter()


def _row_to_dict(row: WatchlistItemRow) -> dict:
    return {
        "ticker": row.ticker,
        "company_name": row.company_name,
        "notes": row.notes,
        "added_at": row.added_at.isoformat(),
    }


@router.get("/search")
async def search_tickers(q: str = Query(min_length=1, max_length=50)):
    results = await search_symbols(q)
    return {"results": results}


@router.get("")
async def get_watchlist(
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(WatchlistItemRow).where(WatchlistItemRow.user_id == user.id)
    )
    rows = result.scalars().all()
    return {"watchlist": {"items": [_row_to_dict(r) for r in rows]}}


@router.post("")
async def add_to_watchlist(
    ticker: str,
    company_name: str = "",
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ticker = ticker.upper().strip()
    if not ticker or not TICKER_RE.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker format")

    count_result = await db.execute(
        select(func.count()).select_from(WatchlistItemRow).where(WatchlistItemRow.user_id == user.id)
    )
    count = count_result.scalar() or 0
    if count >= 20:
        raise HTTPException(status_code=400, detail="Watchlist limit reached (20)")

    existing = await db.execute(
        select(WatchlistItemRow).where(
            WatchlistItemRow.user_id == user.id,
            WatchlistItemRow.ticker == ticker,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Ticker already in watchlist")

    row = WatchlistItemRow(user_id=user.id, ticker=ticker, company_name=company_name)
    db.add(row)
    await db.flush()

    result = await db.execute(
        select(WatchlistItemRow).where(WatchlistItemRow.user_id == user.id)
    )
    rows = result.scalars().all()
    return {"watchlist": {"items": [_row_to_dict(r) for r in rows]}}


@router.delete("/{ticker}")
async def remove_from_watchlist(
    ticker: str,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        delete(WatchlistItemRow).where(
            WatchlistItemRow.user_id == user.id,
            WatchlistItemRow.ticker == ticker.upper(),
        )
    )

    result = await db.execute(
        select(WatchlistItemRow).where(WatchlistItemRow.user_id == user.id)
    )
    rows = result.scalars().all()
    return {"watchlist": {"items": [_row_to_dict(r) for r in rows]}}
