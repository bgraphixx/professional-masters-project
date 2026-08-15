"""
Integration tests for GET /transactions/report.
"""

import pytest
from datetime import date
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

MONTH = date.today().month
YEAR = date.today().year


async def _category_id(auth_client: AsyncClient, cat_type: str) -> str:
    resp = await auth_client.get("/transactions/categories")
    cats = [c for c in resp.json() if c["type"] == cat_type]
    return cats[0]["id"]


async def test_report_empty_period(auth_client: AsyncClient):
    resp = await auth_client.get(f"/transactions/report?month={MONTH}&year={YEAR}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["month"] == MONTH
    assert data["year"] == YEAR
    assert data["total_income"] == 0.0
    assert data["total_expense"] == 0.0
    assert data["net_savings"] == 0.0
    assert data["category_breakdown"] == {}
    assert data["budget_utilisation"] == []


async def test_report_totals_and_breakdown(auth_client: AsyncClient):
    expense_cat = await _category_id(auth_client, "expense")
    income_cat = await _category_id(auth_client, "income")
    today = date.today().isoformat()

    await auth_client.post("/transactions", json={
        "description": "Report test expense",
        "amount": 15000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": expense_cat,
    })
    await auth_client.post("/transactions", json={
        "description": "Report test income",
        "amount": 100000.0,
        "type": "income",
        "transaction_date": today,
        "category_id": income_cat,
    })

    resp = await auth_client.get(f"/transactions/report?month={MONTH}&year={YEAR}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_income"] == 100000.0
    assert data["total_expense"] == 15000.0
    assert data["net_savings"] == 85000.0
    assert sum(data["category_breakdown"].values()) == pytest.approx(115000.0)


async def test_report_excludes_internal_transfers_from_totals(auth_client: AsyncClient):
    """Self-transfers (savings apps, fixed deposits) move money between the
    user's own accounts and must not inflate income/expense totals, even
    though they still show up in the category breakdown."""
    transfer_cat = await _category_id(auth_client, "transfer")
    today = date.today().isoformat()

    await auth_client.post("/transactions", json={
        "description": "Cowrywise savings plan funding",
        "amount": 20000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": transfer_cat,
    })

    resp = await auth_client.get(f"/transactions/report?month={MONTH}&year={YEAR}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_income"] == 0.0
    assert data["total_expense"] == 0.0
    assert data["category_breakdown"]["Internal Transfer / Savings"] == 20000.0


async def test_report_includes_budget_utilisation(auth_client: AsyncClient):
    expense_cat = await _category_id(auth_client, "expense")
    today = date.today().isoformat()

    await auth_client.post("/budgets", json={
        "category_id": expense_cat,
        "limit_amount": 10000.0,
        "month": MONTH,
        "year": YEAR,
    })
    await auth_client.post("/transactions", json={
        "description": "Budget-linked expense",
        "amount": 12000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": expense_cat,
    })

    resp = await auth_client.get(f"/transactions/report?month={MONTH}&year={YEAR}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["budget_utilisation"]) == 1
    budget = data["budget_utilisation"][0]
    assert budget["category_id"] == expense_cat
    assert budget["is_breached"] is True


async def test_report_requires_valid_month(auth_client: AsyncClient):
    resp = await auth_client.get(f"/transactions/report?month=13&year={YEAR}")
    assert resp.status_code == 422


async def test_report_unauthenticated(async_client: AsyncClient):
    resp = await async_client.get(f"/transactions/report?month={MONTH}&year={YEAR}")
    assert resp.status_code == 401
