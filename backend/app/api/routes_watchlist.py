from fastapi import APIRouter, HTTPException

from app.models.watchlist import Watchlist, WatchlistItem

router = APIRouter()

# In-memory watchlist for hackathon
_watchlist = Watchlist(items=[
    WatchlistItem(ticker="NVDA", company_name="NVIDIA Corporation"),
    WatchlistItem(ticker="AAPL", company_name="Apple Inc."),
    WatchlistItem(ticker="MSFT", company_name="Microsoft Corporation"),
])


@router.get("")
async def get_watchlist() -> dict:
    return {"watchlist": _watchlist.model_dump(mode="json")}


@router.post("")
async def add_to_watchlist(ticker: str, company_name: str = "") -> dict:
    global _watchlist
    ticker = ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")
    if len(_watchlist.items) >= 20:
        raise HTTPException(status_code=400, detail="Watchlist limit reached (20)")

    item = WatchlistItem(ticker=ticker, company_name=company_name)
    _watchlist = _watchlist.add(item)
    return {"watchlist": _watchlist.model_dump(mode="json")}


@router.delete("/{ticker}")
async def remove_from_watchlist(ticker: str) -> dict:
    global _watchlist
    _watchlist = _watchlist.remove(ticker.upper())
    return {"watchlist": _watchlist.model_dump(mode="json")}
