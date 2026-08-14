"""
Integration tests for /admin/* endpoints.
"""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import User

pytestmark = pytest.mark.asyncio


async def _promote_to_admin(email: str) -> None:
    """Directly flip is_admin=True for a user; there's no API to self-promote."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        await session.execute(update(User).where(User.email == email).values(is_admin=True))
        await session.commit()
    await engine.dispose()


@pytest_asyncio.fixture
async def admin_client(async_client: AsyncClient):
    """Register a fresh user, promote to admin directly in the DB, and log in."""
    email = f"admin_{uuid.uuid4().hex[:8]}@nairaai-test.com"
    password = "AdminPass123!"

    reg_resp = await async_client.post("/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Admin User",
        "monthly_income": 0.0,
        "consent_given": True,
    })
    assert reg_resp.status_code == 200

    await _promote_to_admin(email)

    login_resp = await async_client.post("/auth/login", json={"email": email, "password": password})
    assert login_resp.status_code == 200
    set_cookie = login_resp.headers.get("set-cookie", "")
    async_client.headers.update({"Cookie": set_cookie.split(";")[0] if set_cookie else ""})
    yield async_client


# ── Access control ──────────────────────────────────────────────────────────

async def test_admin_endpoint_rejects_regular_user(auth_client: AsyncClient):
    resp = await auth_client.get("/admin/users")
    assert resp.status_code == 403


async def test_admin_endpoint_rejects_unauthenticated(async_client: AsyncClient):
    resp = await async_client.get("/admin/users")
    assert resp.status_code == 401


# ── Users ────────────────────────────────────────────────────────────────────

async def test_admin_list_users(admin_client: AsyncClient):
    resp = await admin_client.get("/admin/users")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "users" in data
    assert data["total"] >= 1
    user = data["users"][0]
    assert "email" in user
    assert "transaction_count" in user
    assert "status" in user


async def test_admin_list_users_pagination(admin_client: AsyncClient):
    resp = await admin_client.get("/admin/users?skip=0&limit=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["limit"] == 1
    assert len(data["users"]) <= 1


async def test_admin_users_transaction_count_reflects_transactions(admin_client: AsyncClient):
    cats_resp = await admin_client.get("/transactions/categories")
    cat_id = [c for c in cats_resp.json() if c["type"] == "expense"][0]["id"]

    await admin_client.post("/transactions", json={
        "description": "Admin test transaction",
        "amount": 1000.0,
        "type": "expense",
        "category_id": cat_id,
    })

    resp = await admin_client.get("/admin/users?limit=200")
    assert resp.status_code == 200
    users = resp.json()["users"]
    me_resp = await admin_client.get("/auth/me")
    me_id = me_resp.json()["id"]
    matching = [u for u in users if u["id"] == me_id]
    assert matching
    assert matching[0]["transaction_count"] >= 1


# ── Categories ───────────────────────────────────────────────────────────────

async def test_admin_list_categories(admin_client: AsyncClient):
    resp = await admin_client.get("/admin/categories")
    assert resp.status_code == 200
    names = {c["name"] for c in resp.json()}
    assert "Food & Groceries" in names


async def test_admin_create_category(admin_client: AsyncClient):
    unique_name = f"Test Category {uuid.uuid4().hex[:6]}"
    resp = await admin_client.post("/admin/categories", json={
        "name": unique_name,
        "type": "expense",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == unique_name
    assert data["type"] == "expense"
    assert data["is_default"] is False


async def test_admin_create_duplicate_category_rejected(admin_client: AsyncClient):
    resp = await admin_client.post("/admin/categories", json={
        "name": "Food & Groceries",
        "type": "expense",
    })
    assert resp.status_code == 409


# ── ML metrics ───────────────────────────────────────────────────────────────

async def test_admin_ml_metrics(admin_client: AsyncClient):
    resp = await admin_client.get("/admin/ml/metrics")
    assert resp.status_code == 200
    data = resp.json()
    # metrics.json may or may not exist depending on whether train_baseline_model
    # has been run in this environment; the endpoint should not fail either way.
    assert "model_file_timestamp" in data
