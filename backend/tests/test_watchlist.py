import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_empty_watchlist(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/watchlist", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["watchlist"]["items"] == []


@pytest.mark.asyncio
async def test_add_to_watchlist(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/watchlist?ticker=AAPL&company_name=Apple",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["watchlist"]["items"]
    assert len(items) == 1
    assert items[0]["ticker"] == "AAPL"


@pytest.mark.asyncio
async def test_duplicate_ticker(client: AsyncClient, auth_headers: dict):
    await client.post("/api/watchlist?ticker=MSFT", headers=auth_headers)
    resp = await client.post("/api/watchlist?ticker=MSFT", headers=auth_headers)
    assert resp.status_code == 400
    assert "already" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_remove_from_watchlist(client: AsyncClient, auth_headers: dict):
    await client.post("/api/watchlist?ticker=GOOG", headers=auth_headers)
    resp = await client.delete("/api/watchlist/GOOG", headers=auth_headers)
    assert resp.status_code == 200
    goog = [i for i in resp.json()["watchlist"]["items"] if i["ticker"] == "GOOG"]
    assert len(goog) == 0


@pytest.mark.asyncio
async def test_watchlist_limit(client: AsyncClient, auth_headers: dict):
    for i in range(20):
        ticker = f"T{i:02d}"
        await client.post(f"/api/watchlist?ticker={ticker}", headers=auth_headers)
    resp = await client.post("/api/watchlist?ticker=EXTRA", headers=auth_headers)
    assert resp.status_code == 400
    assert "limit" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_user_isolation(client: AsyncClient):
    r1 = await client.post(
        "/api/auth/register",
        json={"email": "wl_u1@test.com", "password": "password123"},
    )
    h1 = {"Authorization": f"Bearer {r1.json()['access_token']}"}

    r2 = await client.post(
        "/api/auth/register",
        json={"email": "wl_u2@test.com", "password": "password123"},
    )
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}

    await client.post("/api/watchlist?ticker=NVDA", headers=h1)
    resp = await client.get("/api/watchlist", headers=h2)
    assert resp.json()["watchlist"]["items"] == []


@pytest.mark.asyncio
async def test_search_public(client: AsyncClient):
    resp = await client.get("/api/watchlist/search?q=AAPL")
    # Search should work without auth (may return empty if Finnhub key isn't set)
    assert resp.status_code == 200
