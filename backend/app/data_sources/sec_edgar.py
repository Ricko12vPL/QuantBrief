import httpx
import logging
from datetime import datetime

from app.models.filing import SECFiling
from app.utils.rate_limiter import SEC_LIMITER
from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://data.sec.gov"
EFTS_URL = "https://efts.sec.gov/LATEST"
SUBMISSIONS_URL = "https://data.sec.gov/submissions"


def _headers() -> dict:
    return {
        "User-Agent": get_settings().sec_user_agent,
        "Accept": "application/json",
    }


async def lookup_cik(ticker: str) -> str | None:
    """Look up CIK number for a ticker symbol."""
    async with SEC_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{EFTS_URL}/search-index?q=%22{ticker}%22&dateRange=custom&startdt=2024-01-01",
                headers=_headers(),
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                hits = data.get("hits", {}).get("hits", [])
                if hits:
                    cik = hits[0].get("_source", {}).get("cik")
                    if cik:
                        return str(cik).zfill(10)

            # Fallback: try the company tickers JSON
            resp2 = await client.get(
                "https://www.sec.gov/files/company_tickers.json",
                headers=_headers(),
                timeout=10,
            )
            if resp2.status_code == 200:
                data = resp2.json()
                for entry in data.values():
                    if entry.get("ticker", "").upper() == ticker.upper():
                        return str(entry["cik_str"]).zfill(10)
            return None


async def get_recent_filings(
    ticker: str, form_types: list[str] | None = None, limit: int = 10
) -> list[SECFiling]:
    """Get recent SEC filings for a ticker."""
    form_types = form_types or ["10-K", "10-Q", "8-K"]
    cik = await lookup_cik(ticker)
    if not cik:
        logger.warning("CIK not found for %s", ticker)
        return []

    async with SEC_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUBMISSIONS_URL}/CIK{cik}.json",
                headers=_headers(),
                timeout=15,
            )
            if resp.status_code != 200:
                logger.error("SEC submissions fetch failed: %d", resp.status_code)
                return []

    data = resp.json()
    company_name = data.get("name", ticker)
    recent = data.get("filings", {}).get("recent", {})

    filings = []
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    docs = recent.get("primaryDocument", [])
    descs = recent.get("primaryDocDescription", [])

    for i in range(min(len(forms), 100)):
        if forms[i] not in form_types:
            continue
        acc = accessions[i].replace("-", "")
        filing = SECFiling(
            ticker=ticker.upper(),
            company_name=company_name,
            form_type=forms[i],
            filing_date=datetime.strptime(dates[i], "%Y-%m-%d"),
            accession_number=accessions[i],
            filing_url=f"https://www.sec.gov/Archives/edgar/data/{cik.lstrip('0')}/{acc}/{docs[i]}",
            description=descs[i] if i < len(descs) else "",
        )
        filings.append(filing)
        if len(filings) >= limit:
            break

    return filings


async def get_filing_text(filing_url: str, max_chars: int = 200000) -> str:
    """Download and return the text content of a filing."""
    async with SEC_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                filing_url,
                headers=_headers(),
                timeout=30,
                follow_redirects=True,
            )
            if resp.status_code != 200:
                return ""
            text = resp.text
            # Strip HTML tags for plain text
            import re
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text[:max_chars]


async def get_financial_facts(ticker: str) -> dict:
    """Get XBRL financial facts from SEC."""
    cik = await lookup_cik(ticker)
    if not cik:
        return {}
    async with SEC_LIMITER:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/api/xbrl/companyfacts/CIK{cik}.json",
                headers=_headers(),
                timeout=15,
            )
            if resp.status_code != 200:
                return {}
            return resp.json()
