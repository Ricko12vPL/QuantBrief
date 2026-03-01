import re

TICKER_RE = re.compile(r"^[A-Z0-9.]{1,10}$")

DEFAULT_TICKERS = ["NVDA", "AAPL", "MSFT"]
