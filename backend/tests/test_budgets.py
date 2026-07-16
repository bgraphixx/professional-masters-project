"""
Integration tests for /budgets/* endpoints.
"""

import pytest
from datetime import date
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MONTH = date.today().month
YEAR = date.today().year


async def _expense_cat_id(auth_client: AsyncClient) -> str:
    resp = await auth_client.get("/transactions/categories")
    cats = [c for c in resp.json() if c["type"] == "expense"]
    return cats[0]["id"]


async def _create_budget(auth_client: AsyncClient, cat_id: str, limit: float = 50000.0) -> dict:
    resp = await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": limit,
        "month": MONTH,
        "year": YEAR,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_list_budgets_empty(auth_client: AsyncClient):
    resp = await auth_client.get(f"/budgets?month={MONTH}&year={YEAR}")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_create_budget(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    budget = await _create_budget(auth_client, cat_id, limit=100000.0)

    assert budget["limit_amount"] == 100000.0
    assert budget["category_id"] == cat_id
    assert budget["month"] == MONTH
    assert budget["year"] == YEAR
    assert "spent_amount" in budget
    assert "percent_used" in budget
    assert "is_breached" in budget
    assert budget["spent_amount"] >= 0.0
    assert budget["is_breached"] is False


async def test_create_budget_duplicate_rejected(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    await _create_budget(auth_client, cat_id)

    resp = await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": 99999.0,
        "month": MONTH,
        "year": YEAR,
    })
    assert resp.status_code == 409


async def test_budget_spent_amount_computed(auth_client: AsyncClient):
    """After adding an expense, spent_amount should reflect it."""
    cat_id = await _expense_cat_id(auth_client)
    await _create_budget(auth_client, cat_id, limit=50000.0)

    today = date.today().isoformat()
    await auth_client.post("/transactions", json={
        "description": "Budget spend test",
        "amount": 20000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": cat_id,
    })

    resp = await auth_client.get(f"/budgets?month={MONTH}&year={YEAR}")
    assert resp.status_code == 200
    matching = [b for b in resp.json() if b["category_id"] == cat_id]
    assert matching
    b = matching[0]
    assert b["spent_amount"] >= 20000.0
    assert b["percent_used"] >= 40.0


async def test_budget_breached_flag(auth_client: AsyncClient):
    """Spending over the limit should set is_breached=True."""
    cat_id = await _expense_cat_id(auth_client)
    await _create_budget(auth_client, cat_id, limit=5000.0)

    today = date.today().isoformat()
    await auth_client.post("/transactions", json={
        "description": "Over limit spend",
        "amount": 10000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": cat_id,
    })

    resp = await auth_client.get(f"/budgets?month={MONTH}&year={YEAR}")
    matching = [b for b in resp.json() if b["category_id"] == cat_id]
    assert matching[0]["is_breached"] is True


async def test_update_budget_limit(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    budget = await _create_budget(auth_client, cat_id, limit=30000.0)

    update_resp = await auth_client.put(f"/budgets/{budget['id']}", json={
        "limit_amount": 75000.0
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["limit_amount"] == 75000.0


async def test_update_budget_invalid_limit(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    budget = await _create_budget(auth_client, cat_id)

    resp = await auth_client.put(f"/budgets/{budget['id']}", json={
        "limit_amount": -1000.0
    })
    assert resp.status_code == 422


async def test_delete_budget(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    budget = await _create_budget(auth_client, cat_id)
    budget_id = budget["id"]

    del_resp = await auth_client.delete(f"/budgets/{budget_id}")
    assert del_resp.status_code == 200

    list_resp = await auth_client.get(f"/budgets?month={MONTH}&year={YEAR}")
    ids = [b["id"] for b in list_resp.json()]
    assert budget_id not in ids


async def test_delete_nonexistent_budget(auth_client: AsyncClient):
    import uuid
    fake_id = str(uuid.uuid4())
    resp = await auth_client.delete(f"/budgets/{fake_id}")
    assert resp.status_code == 404
