"""
Integration tests for /insights/* endpoints.
"""

import uuid
import pytest
from datetime import date
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _expense_cat_id(auth_client: AsyncClient) -> str:
    resp = await auth_client.get("/transactions/categories")
    cats = [c for c in resp.json() if c["type"] == "expense"]
    return cats[0]["id"]


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_insights_fresh_user_no_crash(auth_client: AsyncClient):
    """A new user with no data should get an empty list without errors."""
    resp = await auth_client.get("/insights")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_insights_returns_list(auth_client: AsyncClient):
    # Add some transactions to give the engine something to analyse
    today = date.today().isoformat()
    for i in range(3):
        await auth_client.post("/transactions", json={
            "description": f"Test expense {i}",
            "amount": 5000.0,
            "type": "expense",
            "transaction_date": today,
        })

    resp = await auth_client.get("/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # Each insight should have required fields
    for insight in data:
        assert "id" in insight
        assert "insight_type" in insight
        assert "message" in insight
        assert "is_read" in insight
        assert insight["insight_type"] in ("alert", "trend", "recommendation")


async def test_budget_alert_generated(auth_client: AsyncClient):
    """
    Creating a budget and spending over it should trigger a budget alert.
    """
    cat_id = await _expense_cat_id(auth_client)
    today = date.today().isoformat()
    month = date.today().month
    year = date.today().year

    # Create a small budget
    await auth_client.post("/budgets", json={
        "category_id": cat_id,
        "limit_amount": 1000.0,
        "month": month,
        "year": year,
    })

    # Spend well over the limit
    await auth_client.post("/transactions", json={
        "description": "Massive overspend",
        "amount": 5000.0,
        "type": "expense",
        "transaction_date": today,
        "category_id": cat_id,
    })

    # Run the insights engine
    resp = await auth_client.get("/insights")
    assert resp.status_code == 200
    insights = resp.json()

    alert_types = [i["insight_type"] for i in insights]
    assert "alert" in alert_types, f"Expected budget alert, got: {insights}"


async def test_insights_deduplication(auth_client: AsyncClient):
    """Calling GET /insights twice should not double-insert the same messages."""
    today = date.today().isoformat()
    await auth_client.post("/transactions", json={
        "description": "Dedup test expense",
        "amount": 1000.0,
        "type": "expense",
        "transaction_date": today,
    })

    resp1 = await auth_client.get("/insights")
    count1 = len(resp1.json())

    resp2 = await auth_client.get("/insights")
    count2 = len(resp2.json())

    # Second call must not add duplicates
    assert count2 == count1


async def test_mark_insight_read(auth_client: AsyncClient):
    # Ensure there's at least one insight
    today = date.today().isoformat()
    await auth_client.post("/transactions", json={
        "description": "Read test expense",
        "amount": 2000.0,
        "type": "expense",
        "transaction_date": today,
    })
    insights_resp = await auth_client.get("/insights")
    insights = insights_resp.json()

    if not insights:
        pytest.skip("No insights generated for this user state")

    insight_id = insights[0]["id"]

    patch_resp = await auth_client.patch(f"/insights/{insight_id}/read")
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_read"] is True


async def test_mark_nonexistent_insight_read(auth_client: AsyncClient):
    fake_id = str(uuid.uuid4())
    resp = await auth_client.patch(f"/insights/{fake_id}/read")
    assert resp.status_code == 404


async def test_dismiss_insight(auth_client: AsyncClient):
    today = date.today().isoformat()
    await auth_client.post("/transactions", json={
        "description": "Dismiss test expense",
        "amount": 3000.0,
        "type": "expense",
        "transaction_date": today,
    })
    insights = (await auth_client.get("/insights")).json()

    if not insights:
        pytest.skip("No insights to dismiss")

    insight_id = insights[0]["id"]
    del_resp = await auth_client.delete(f"/insights/{insight_id}")
    assert del_resp.status_code == 200

    # Confirm it's gone from the feed
    remaining_ids = [i["id"] for i in (await auth_client.get("/insights")).json()]
    assert insight_id not in remaining_ids


async def test_insights_unauthenticated(async_client: AsyncClient):
    resp = await async_client.get("/insights")
    assert resp.status_code == 401
