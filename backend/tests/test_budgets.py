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


def _add_months(month: int, year: int, n: int) -> tuple[int, int]:
    period = year * 12 + month + n
    y, m0 = divmod(period - 1, 12)
    return m0 + 1, y


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


async def test_create_recurring_budget(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    resp = await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": 40000.0,
        "month": MONTH,
        "year": YEAR,
        "is_recurring": True,
    })
    assert resp.status_code == 201, resp.text
    budget = resp.json()
    assert budget["is_recurring"] is True
    assert budget["series_id"] == budget["id"]


async def test_recurring_budget_auto_generates_future_months(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    created = await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": 40000.0,
        "month": MONTH,
        "year": YEAR,
        "is_recurring": True,
    })
    series_id = created.json()["series_id"]

    target_month, target_year = _add_months(MONTH, YEAR, 3)
    resp = await auth_client.get(f"/budgets?month={target_month}&year={target_year}")
    assert resp.status_code == 200
    matching = [b for b in resp.json() if b["category_id"] == cat_id]
    assert matching
    assert matching[0]["is_recurring"] is True
    assert matching[0]["series_id"] == series_id
    assert matching[0]["limit_amount"] == 40000.0

    # the in-between month should also have been backfilled
    mid_month, mid_year = _add_months(MONTH, YEAR, 1)
    resp = await auth_client.get(f"/budgets?month={mid_month}&year={mid_year}")
    matching = [b for b in resp.json() if b["category_id"] == cat_id]
    assert matching
    assert matching[0]["series_id"] == series_id


async def test_stop_recurring_removes_future_generated_rows(auth_client: AsyncClient):
    cat_id = await _expense_cat_id(auth_client)
    created = await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": 40000.0,
        "month": MONTH,
        "year": YEAR,
        "is_recurring": True,
    })
    origin_id = created.json()["id"]

    # jump ahead to auto-generate a far-future row before deciding to stop
    far_month, far_year = _add_months(MONTH, YEAR, 5)
    await auth_client.get(f"/budgets?month={far_month}&year={far_year}")

    # stop recurring from the very first (earliest) row, not the latest generated one
    stop_resp = await auth_client.put(f"/budgets/{origin_id}", json={
        "limit_amount": 40000.0,
        "is_recurring": False,
    })
    assert stop_resp.status_code == 200
    assert stop_resp.json()["is_recurring"] is False

    # the already-generated future row should be gone, and nothing new generates beyond it
    resp = await auth_client.get(f"/budgets?month={far_month}&year={far_year}")
    matching = [b for b in resp.json() if b["category_id"] == cat_id]
    assert matching == []
