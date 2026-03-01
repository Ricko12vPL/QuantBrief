import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_empty_portfolio(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/portfolio", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["positions"] == []


@pytest.mark.asyncio
async def test_add_position(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/portfolio",
        json={"ticker": "AAPL", "shares": 10, "avg_price": 150.0, "company_name": "Apple"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    positions = resp.json()["positions"]
    assert len(positions) == 1
    assert positions[0]["ticker"] == "AAPL"
    assert positions[0]["shares"] == 10


@pytest.mark.asyncio
async def test_upsert_position(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/portfolio",
        json={"ticker": "MSFT", "shares": 5, "avg_price": 300.0},
        headers=auth_headers,
    )
    resp = await client.post(
        "/api/portfolio",
        json={"ticker": "MSFT", "shares": 15, "avg_price": 310.0},
        headers=auth_headers,
    )
    positions = resp.json()["positions"]
    msft = [p for p in positions if p["ticker"] == "MSFT"]
    assert len(msft) == 1
    assert msft[0]["shares"] == 15


@pytest.mark.asyncio
async def test_remove_position(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/portfolio",
        json={"ticker": "GOOG", "shares": 3, "avg_price": 140.0},
        headers=auth_headers,
    )
    resp = await client.delete("/api/portfolio/GOOG", headers=auth_headers)
    assert resp.status_code == 200
    goog = [p for p in resp.json()["positions"] if p["ticker"] == "GOOG"]
    assert len(goog) == 0


@pytest.mark.asyncio
async def test_user_isolation(client: AsyncClient):
    r1 = await client.post(
        "/api/auth/register",
        json={"email": "user1@port.com", "password": "password123"},
    )
    h1 = {"Authorization": f"Bearer {r1.json()['access_token']}"}

    r2 = await client.post(
        "/api/auth/register",
        json={"email": "user2@port.com", "password": "password123"},
    )
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}

    await client.post(
        "/api/portfolio",
        json={"ticker": "NVDA", "shares": 20, "avg_price": 800.0},
        headers=h1,
    )

    resp = await client.get("/api/portfolio", headers=h2)
    assert resp.json()["positions"] == []


@pytest.mark.asyncio
async def test_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/portfolio")
    assert resp.status_code == 401
