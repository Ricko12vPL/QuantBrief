from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PositionCreate(BaseModel):
    ticker: str
    shares: float
    avg_price: float
    company_name: str = ""


# In-memory portfolio for hackathon
_portfolio: list[dict] = []


@router.get("")
async def get_portfolio():
    return {"positions": _portfolio}


@router.post("")
async def add_position(position: PositionCreate):
    global _portfolio
    ticker = position.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")
    _portfolio = [p for p in _portfolio if p["ticker"] != ticker]
    _portfolio = [*_portfolio, {
        "ticker": ticker,
        "shares": position.shares,
        "avg_price": position.avg_price,
        "company_name": position.company_name,
    }]
    return {"positions": _portfolio}


@router.delete("/{ticker}")
async def remove_position(ticker: str):
    global _portfolio
    _portfolio = [p for p in _portfolio if p["ticker"] != ticker.upper()]
    return {"positions": _portfolio}
