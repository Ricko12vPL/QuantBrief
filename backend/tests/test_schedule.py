import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_empty_schedules(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/schedule", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["schedules"] == []


@pytest.mark.asyncio
async def test_create_schedule(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/schedule",
        json={"name": "Morning Brief", "frequency": "daily", "hour": 9},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    schedule = resp.json()["schedule"]
    assert schedule["name"] == "Morning Brief"
    assert schedule["frequency"] == "daily"
    assert schedule["paused"] is False


@pytest.mark.asyncio
async def test_delete_schedule(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post(
        "/api/schedule",
        json={"name": "To Delete"},
        headers=auth_headers,
    )
    schedule_id = create_resp.json()["schedule"]["id"]

    resp = await client.delete(f"/api/schedule/{schedule_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    list_resp = await client.get("/api/schedule", headers=auth_headers)
    assert len(list_resp.json()["schedules"]) == 0


@pytest.mark.asyncio
async def test_pause_resume_schedule(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post(
        "/api/schedule",
        json={"name": "Pausable"},
        headers=auth_headers,
    )
    schedule_id = create_resp.json()["schedule"]["id"]

    pause_resp = await client.post(f"/api/schedule/{schedule_id}/pause", headers=auth_headers)
    assert pause_resp.status_code == 200
    assert pause_resp.json()["schedule"]["paused"] is True

    resume_resp = await client.post(f"/api/schedule/{schedule_id}/resume", headers=auth_headers)
    assert resume_resp.status_code == 200
    assert resume_resp.json()["schedule"]["paused"] is False


@pytest.mark.asyncio
async def test_schedule_user_isolation(client: AsyncClient):
    """User 1's schedules must not be visible to User 2 (IDOR fix verification)."""
    r1 = await client.post(
        "/api/auth/register",
        json={"email": "sched_u1@test.com", "password": "password123"},
    )
    h1 = {"Authorization": f"Bearer {r1.json()['access_token']}"}

    r2 = await client.post(
        "/api/auth/register",
        json={"email": "sched_u2@test.com", "password": "password123"},
    )
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}

    await client.post(
        "/api/schedule",
        json={"name": "User1 Schedule"},
        headers=h1,
    )

    resp = await client.get("/api/schedule", headers=h2)
    assert resp.json()["schedules"] == []


@pytest.mark.asyncio
async def test_schedule_cross_user_delete_forbidden(client: AsyncClient):
    """User 2 must not be able to delete User 1's schedule (IDOR fix verification)."""
    r1 = await client.post(
        "/api/auth/register",
        json={"email": "sched_del1@test.com", "password": "password123"},
    )
    h1 = {"Authorization": f"Bearer {r1.json()['access_token']}"}

    r2 = await client.post(
        "/api/auth/register",
        json={"email": "sched_del2@test.com", "password": "password123"},
    )
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}

    create_resp = await client.post(
        "/api/schedule",
        json={"name": "Private Schedule"},
        headers=h1,
    )
    schedule_id = create_resp.json()["schedule"]["id"]

    resp = await client.delete(f"/api/schedule/{schedule_id}", headers=h2)
    assert resp.status_code == 404

    list_resp = await client.get("/api/schedule", headers=h1)
    assert len(list_resp.json()["schedules"]) == 1


@pytest.mark.asyncio
async def test_schedule_cross_user_pause_forbidden(client: AsyncClient):
    """User 2 must not be able to pause User 1's schedule."""
    r1 = await client.post(
        "/api/auth/register",
        json={"email": "sched_pause1@test.com", "password": "password123"},
    )
    h1 = {"Authorization": f"Bearer {r1.json()['access_token']}"}

    r2 = await client.post(
        "/api/auth/register",
        json={"email": "sched_pause2@test.com", "password": "password123"},
    )
    h2 = {"Authorization": f"Bearer {r2.json()['access_token']}"}

    create_resp = await client.post(
        "/api/schedule",
        json={"name": "Should Stay Running"},
        headers=h1,
    )
    schedule_id = create_resp.json()["schedule"]["id"]

    resp = await client.post(f"/api/schedule/{schedule_id}/pause", headers=h2)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_schedule_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete("/api/schedule/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_schedule_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/schedule")
    assert resp.status_code == 401
