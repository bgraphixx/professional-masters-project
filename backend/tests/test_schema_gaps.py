"""
Tests for the schema additions in app/db/models.py:
- updated_at on users/transactions/budgets
- DB-level unique constraint on budgets(user_id, category_id, month, year)
"""

import uuid
import pytest
from datetime import date
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.models import Budget, User

pytestmark = pytest.mark.asyncio

MONTH = date.today().month
YEAR = date.today().year


async def _expense_cat_id(auth_client: AsyncClient) -> str:
    resp = await auth_client.get("/transactions/categories")
    cats = [c for c in resp.json() if c["type"] == "expense"]
    return cats[0]["id"]


async def test_users_updated_at_changes_on_update(auth_client: AsyncClient):
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    me = (await auth_client.get("/auth/me")).json()

    async with factory() as session:
        before = (await session.execute(select(User).where(User.id == me["id"]))).scalar_one()
        created_at, updated_before = before.created_at, before.updated_at

    resp = await auth_client.patch("/auth/me", json={"full_name": "Updated At Test"})
    assert resp.status_code == 200

    async with factory() as session:
        after = (await session.execute(select(User).where(User.id == me["id"]))).scalar_one()
        assert after.updated_at > updated_before
        assert after.created_at == created_at

    await engine.dispose()


async def test_budgets_unique_constraint_enforced_at_db_level(auth_client: AsyncClient):
    """The application-level 409 check in budgets.py should stop duplicates first,
    but the DB constraint must also reject them if that check is ever bypassed."""
    cat_id = await _expense_cat_id(auth_client)
    me = (await auth_client.get("/auth/me")).json()

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        b1 = Budget(user_id=uuid.UUID(me["id"]), category_id=uuid.UUID(cat_id), limit_amount=1000.0, month=MONTH, year=YEAR)
        session.add(b1)
        await session.commit()

        b2 = Budget(user_id=uuid.UUID(me["id"]), category_id=uuid.UUID(cat_id), limit_amount=2000.0, month=MONTH, year=YEAR)
        session.add(b2)
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()

    await engine.dispose()


async def test_budget_duplicate_still_returns_409_via_api(auth_client: AsyncClient):
    """The friendlier application-level check still fires before the DB constraint would."""
    cat_id = await _expense_cat_id(auth_client)
    resp1 = await auth_client.post("/budgets", json={
        "category_id": cat_id, "limit_amount": 10000.0, "month": MONTH, "year": YEAR,
    })
    assert resp1.status_code == 201

    resp2 = await auth_client.post("/budgets", json={
        "category_id": cat_id, "limit_amount": 20000.0, "month": MONTH, "year": YEAR,
    })
    assert resp2.status_code == 409
