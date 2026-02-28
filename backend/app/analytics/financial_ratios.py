import logging

from app.data_sources.yfinance_client import get_company_overview

logger = logging.getLogger(__name__)


def safe_float(val: str | None, default: float = 0.0) -> float:
    if not val or val in ("None", "-", "N/A"):
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


async def compute_ratios(ticker: str) -> dict:
    """Compute key financial ratios from Alpha Vantage overview data."""
    overview = await get_company_overview(ticker)
    if not overview:
        return {"ticker": ticker, "error": "No data available"}

    pe = safe_float(overview.get("PERatio"))
    pb = safe_float(overview.get("PriceToBookRatio"))
    de = safe_float(overview.get("DebtToEquityRatio"))
    roe = safe_float(overview.get("ReturnOnEquityTTM"))
    ev_ebitda = safe_float(overview.get("EVToEBITDA"))
    profit_margin = safe_float(overview.get("ProfitMargin"))
    operating_margin = safe_float(overview.get("OperatingMarginTTM"))
    gross_profit = safe_float(overview.get("GrossProfitTTM"))
    revenue = safe_float(overview.get("RevenueTTM"))
    gross_margin = gross_profit / revenue if revenue > 0 else 0.0
    rev_growth = safe_float(overview.get("QuarterlyRevenueGrowthYOY"))
    eps = safe_float(overview.get("EPS"))
    div_yield = safe_float(overview.get("DividendYield"))
    beta = safe_float(overview.get("Beta"))
    market_cap = safe_float(overview.get("MarketCapitalization"))

    fcf_yield = 0.0
    if market_cap > 0:
        operating_cf = safe_float(overview.get("OperatingCashflowTTM"))
        capex = safe_float(overview.get("CapitalExpenditures"))
        fcf = operating_cf - abs(capex)
        fcf_yield = fcf / market_cap

    # ROIC = NOPAT / Invested Capital
    # NOPAT = operating_income * (1 - tax_rate)
    # Invested Capital = total_equity + long_term_debt
    roic = 0.0
    total_equity = safe_float(overview.get("BookValue")) * safe_float(
        overview.get("SharesOutstanding")
    )
    long_term_debt = safe_float(overview.get("LongTermDebt"))
    invested_capital = total_equity + long_term_debt
    if invested_capital > 0:
        operating_income = safe_float(overview.get("OperatingIncomeTTM"))
        tax_rate = safe_float(overview.get("EffectiveTaxRate"), default=0.21)
        nopat = operating_income * (1 - tax_rate)
        roic = nopat / invested_capital

    return {
        "ticker": ticker,
        "company_name": overview.get("Name", ticker),
        "sector": overview.get("Sector", ""),
        "industry": overview.get("Industry", ""),
        "pe_ratio": pe,
        "pb_ratio": pb,
        "debt_to_equity": de,
        "roe": roe,
        "roic": roic,
        "ev_ebitda": ev_ebitda,
        "profit_margin": profit_margin,
        "operating_margin": operating_margin,
        "gross_margin": gross_margin,
        "revenue_ttm": revenue,
        "revenue_growth_yoy": rev_growth,
        "eps": eps,
        "fcf_yield": fcf_yield,
        "dividend_yield": div_yield,
        "beta": beta,
        "market_cap": market_cap,
    }
