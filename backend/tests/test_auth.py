"""
Integration tests for /auth/* endpoints.
"""

import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


def _email():
    return f"auth_{uuid.uuid4().hex[:8]}@nairaai-test.com"


async def test_register_success(async_client: AsyncClient):
    resp = await async_client.post("/auth/register", json={
        "email": _email(),
        "password": "ValidPass99!",
        "full_name": "Chioma Okafor",
        "monthly_income": 350000.0,
        "consent_given": True,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"].endswith("@nairaai-test.com")
    assert data["full_name"] == "Chioma Okafor"
    assert data["monthly_income"] == 350000.0
    assert data["consent_given"] is True
    assert "id" in data


async def test_register_duplicate_email(async_client: AsyncClient):
    email = _email()
    payload = {
        "email": email,
        "password": "ValidPass99!",
        "full_name": "Duplicate User",
        "monthly_income": 0.0,
        "consent_given": True,
    }
    r1 = await async_client.post("/auth/register", json=payload)
    assert r1.status_code == 200

    r2 = await async_client.post("/auth/register", json=payload)
    # The endpoint returns 400 for duplicate email
    assert r2.status_code == 400


async def test_register_password_too_short(async_client: AsyncClient):
    resp = await async_client.post("/auth/register", json={
        "email": _email(),
        "password": "short",
        "full_name": "Bad Pass",
        "monthly_income": 0.0,
        "consent_given": True,
    })
    assert resp.status_code == 422


async def test_login_success(async_client: AsyncClient):
    email = _email()
    await async_client.post("/auth/register", json={
        "email": email,
        "password": "MySecure123",
        "full_name": "Login User",
        "monthly_income": 100000.0,
        "consent_given": True,
    })

    resp = await async_client.post("/auth/login", json={
        "email": email,
        "password": "MySecure123",
    })
    assert resp.status_code == 200
    assert "set-cookie" in resp.headers


async def test_login_wrong_password(async_client: AsyncClient):
    email = _email()
    await async_client.post("/auth/register", json={
        "email": email,
        "password": "Correct123!",
        "full_name": "Wrong Pass",
        "monthly_income": 0.0,
        "consent_given": True,
    })

    resp = await async_client.post("/auth/login", json={
        "email": email,
        "password": "WrongPassword!",
    })
    # Endpoint returns 400 for wrong credentials
    assert resp.status_code == 400


async def test_login_nonexistent_user(async_client: AsyncClient):
    resp = await async_client.post("/auth/login", json={
        "email": "ghost_nobody@nairaai-test.com",
        "password": "Whatever123!",
    })
    # Endpoint returns 400 for non-existent user
    assert resp.status_code == 400


async def test_me_authenticated(auth_client: AsyncClient):
    resp = await auth_client.get("/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data
    assert "full_name" in data


async def test_me_unauthenticated(async_client: AsyncClient):
    resp = await async_client.get("/auth/me")
    assert resp.status_code == 401


async def test_logout(auth_client: AsyncClient):
    resp = await auth_client.post("/auth/logout")
    assert resp.status_code == 200
