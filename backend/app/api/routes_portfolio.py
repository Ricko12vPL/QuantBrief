from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.engine import get_db
from app.db.models import PortfolioPositionRow, UserRow
from app.utils.validation import TICKER_RE

router = APIRouter()


class PositionCreate(BaseModel):
    ticker: str
    shares: float = Field(ge=0)
    avg_price: float = Field(ge=0)
    company_name: str = ""


def _row_to_dict(row: PortfolioPositionRow) -> dict:
    return {
        "ticker": row.ticker,
        "shares": row.shares,
        "avg_price": row.avg_price,
        "company_name": row.company_name,
    }


@router.get("")
async def get_portfolio(
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioPositionRow).where(PortfolioPositionRow.user_id == user.id)
    )
    rows = result.scalars().all()
    return {"positions": [_row_to_dict(r) for r in rows]}


@router.post("")
async def add_position(
    position: PositionCreate,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticker = position.ticker.upper().strip()
    if not ticker or not TICKER_RE.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker format")

    await db.execute(
        delete(PortfolioPositionRow).where(
            PortfolioPositionRow.user_id == user.id,
            PortfolioPositionRow.ticker == ticker,
        )
    )
    row = PortfolioPositionRow(
        user_id=user.id,
        ticker=ticker,
        shares=position.shares,
        avg_price=position.avg_price,
        company_name=position.company_name,
    )
    db.add(row)
    await db.flush()

    result = await db.execute(
        select(PortfolioPositionRow).where(PortfolioPositionRow.user_id == user.id)
    )
    rows = result.scalars().all()
    return {"positions": [_row_to_dict(r) for r in rows]}


@router.delete("/{ticker}")
async def remove_position(
    ticker: str,
    user: UserRow = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(PortfolioPositionRow).where(
            PortfolioPositionRow.user_id == user.id,
            PortfolioPositionRow.ticker == ticker.upper(),
        )
    )

    result = await db.execute(
        select(PortfolioPositionRow).where(PortfolioPositionRow.user_id == user.id)
    )
    rows = result.scalars().all()
    return {"positions": [_row_to_dict(r) for r in rows]}
