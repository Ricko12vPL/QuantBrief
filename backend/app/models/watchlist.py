from pydantic import BaseModel, Field
from datetime import datetime


class WatchlistItem(BaseModel):
    ticker: str
    company_name: str = ""
    added_at: datetime = Field(default_factory=datetime.utcnow)
    notes: str = ""


class Watchlist(BaseModel):
    items: list[WatchlistItem] = Field(default_factory=list)

    def add(self, item: WatchlistItem) -> "Watchlist":
        if item.ticker not in [i.ticker for i in self.items]:
            return Watchlist(items=[*self.items, item])
        return self

    def remove(self, ticker: str) -> "Watchlist":
        return Watchlist(items=[i for i in self.items if i.ticker != ticker])

    @property
    def tickers(self) -> list[str]:
        return [i.ticker for i in self.items]
