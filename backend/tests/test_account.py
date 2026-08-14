"""
Integration tests for the account self-service endpoints on /auth/*:
PATCH /auth/me, POST /auth/me/password, DELETE /auth/me.
"""

import uuid
import pytest
from datetime import date
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import Budget, Insight, Transaction, User

pytestmark = pytest.mark.asyncio


async def _expense_cat_id(auth_client: AsyncClient) -> str:
    resp = await auth_client.get("/transactions/categories")
    cats = [c for c in resp.json() if c["type"] == "expense"]
    return cats[0]["id"]


async def _row_counts_for_user(user_id: str) -> dict:
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        counts = {
            "users": len((await session.execute(select(User).where(User.id == user_id))).scalars().all()),
            "transactions": len((await session.execute(select(Transaction).where(Transaction.user_id == user_id))).scalars().all()),
            "budgets": len((await session.execute(select(Budget).where(Budget.user_id == user_id))).scalars().all()),
            "insights": len((await session.execute(select(Insight).where(Insight.user_id == user_id))).scalars().all()),
        }
    await engine.dispose()
    return counts


# ── PATCH /auth/me ───────────────────────────────────────────────────────────

async def test_patch_me_updates_full_name_and_income(auth_client: AsyncClient):
    resp = await auth_client.patch("/auth/me", json={
        "full_name": "Updated Name",
        "monthly_income": 500000.0,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Updated Name"
    assert data["monthly_income"] == 500000.0


async def test_patch_me_ignores_email_and_password(auth_client: AsyncClient):
    me_before = (await auth_client.get("/auth/me")).json()

    resp = await auth_client.patch("/auth/me", json={
        "full_name": "Still Me",
        "email": "hacked@example.com",
        "password_hash": "not-a-real-hash",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == me_before["email"]
    assert data["full_name"] == "Still Me"


# ── POST /auth/me/password ──────────────────────────────────────────────────

async def test_change_password_success(async_client: AsyncClient):
    email = f"pwchange_{uuid.uuid4().hex[:8]}@nairaai-test.com"
    old_password = "OldPass123!"
    new_password = "NewPass456!"

    await async_client.post("/auth/register", json={
        "email": email, "password": old_password, "full_name": "PW Change",
        "monthly_income": 0.0, "consent_given": True,
    })
    login_resp = await async_client.post("/auth/login", json={"email": email, "password": old_password})
    set_cookie = login_resp.headers.get("set-cookie", "")
    async_client.headers.update({"Cookie": set_cookie.split(";")[0] if set_cookie else ""})

    resp = await async_client.post("/auth/me/password", json={
        "current_password": old_password,
        "new_password": new_password,
    })
    assert resp.status_code == 200

    async_client.headers.pop("Cookie", None)
    relogin = await async_client.post("/auth/login", json={"email": email, "password": new_password})
    assert relogin.status_code == 200


async def test_change_password_wrong_current_password_rejected(auth_client: AsyncClient):
    resp = await auth_client.post("/auth/me/password", json={
        "current_password": "TotallyWrongPassword!",
        "new_password": "WhateverNew123!",
    })
    assert resp.status_code == 400


# ── DELETE /auth/me ──────────────────────────────────────────────────────────

async def test_delete_me_removes_account(async_client: AsyncClient):
    email = f"delete_{uuid.uuid4().hex[:8]}@nairaai-test.com"
    password = "DeleteMe123!"

    await async_client.post("/auth/register", json={
        "email": email, "password": password, "full_name": "Delete Me",
        "monthly_income": 0.0, "consent_given": True,
    })
    login_resp = await async_client.post("/auth/login", json={"email": email, "password": password})
    set_cookie = login_resp.headers.get("set-cookie", "")
    async_client.headers.update({"Cookie": set_cookie.split(";")[0] if set_cookie else ""})

    resp = await async_client.delete("/auth/me")
    assert resp.status_code == 200

    async_client.headers.pop("Cookie", None)
    relogin = await async_client.post("/auth/login", json={"email": email, "password": password})
    assert relogin.status_code == 400


async def test_delete_me_cascades_to_transactions_budgets_and_insights(auth_client: AsyncClient):
    """Creates a transaction, a breached budget (which produces an insight), then
    deletes the account and asserts all four tables end up empty for that user_id."""
    me = (await auth_client.get("/auth/me")).json()
    user_id = me["id"]

    cat_id = await _expense_cat_id(auth_client)
    today = date.today().isoformat()

    await auth_client.post("/transactions", json={
        "description": "Cascade delete test expense",
        "amount": 20000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": cat_id,
    })
    await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": 5000.0,
        "month": date.today().month,
        "year": date.today().year,
    })
    # Trigger the insights engine so a budget-breach alert gets persisted.
    await auth_client.get("/insights")

    before = await _row_counts_for_user(user_id)
    assert before["transactions"] >= 1
    assert before["budgets"] >= 1

    resp = await auth_client.delete("/auth/me")
    assert resp.status_code == 200

    after = await _row_counts_for_user(user_id)
    assert after["users"] == 0
    assert after["transactions"] == 0
    assert after["budgets"] == 0
    assert after["insights"] == 0
