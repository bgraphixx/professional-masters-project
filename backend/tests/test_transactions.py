"""
Integration tests for /transactions/* endpoints.
"""

import io
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# ── Helpers ──────────────────────────────────────────────────────────────────

async def _first_category_id(auth_client: AsyncClient) -> str:
    """Return the ID of the first available expense category."""
    resp = await auth_client.get("/transactions/categories")
    assert resp.status_code == 200
    cats = resp.json()
    expense_cats = [c for c in cats if c["type"] == "expense"]
    assert expense_cats, "No expense categories seeded"
    return expense_cats[0]["id"]


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_list_transactions_empty(auth_client: AsyncClient):
    resp = await auth_client.get("/transactions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_create_transaction_manual_category(auth_client: AsyncClient):
    cat_id = await _first_category_id(auth_client)
    resp = await auth_client.post("/transactions", json={
        "description": "Shoprite groceries",
        "amount": 15000.0,
        "type": "expense",
        "transaction_date": "2026-07-01",
        "category_id": cat_id,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 15000.0
    assert data["category_id"] == cat_id
    assert data["confidence_score"] == 1.0
    assert data["is_flagged"] is False


async def test_create_transaction_ml_autocategorise(auth_client: AsyncClient):
    """When no category_id is supplied, ML should fill it in."""
    resp = await auth_client.post("/transactions", json={
        "description": "Uber ride to Victoria Island",
        "amount": 3200.0,
        "type": "expense",
        "transaction_date": "2026-07-02",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 3200.0
    # ML may or may not assign a category, but should not crash
    assert data["confidence_score"] >= 0.0


async def test_create_transaction_invalid_amount(auth_client: AsyncClient):
    resp = await auth_client.post("/transactions", json={
        "description": "Negative amount",
        "amount": -500.0,
        "type": "expense",
        "transaction_date": "2026-07-01",
    })
    assert resp.status_code == 422


async def test_create_income_transaction(auth_client: AsyncClient):
    resp = await auth_client.post("/transactions", json={
        "description": "Monthly salary",
        "amount": 250000.0,
        "type": "income",
        "transaction_date": "2026-07-01",
    })
    assert resp.status_code == 200
    assert resp.json()["type"] == "income"


async def test_filter_by_type(auth_client: AsyncClient):
    # Create one of each type
    await auth_client.post("/transactions", json={
        "description": "Test expense",
        "amount": 1000.0,
        "type": "expense",
        "transaction_date": "2026-07-01",
    })
    await auth_client.post("/transactions", json={
        "description": "Test income",
        "amount": 5000.0,
        "type": "income",
        "transaction_date": "2026-07-01",
    })

    expense_resp = await auth_client.get("/transactions?type=expense")
    assert expense_resp.status_code == 200
    assert all(t["type"] == "expense" for t in expense_resp.json())

    income_resp = await auth_client.get("/transactions?type=income")
    assert income_resp.status_code == 200
    assert all(t["type"] == "income" for t in income_resp.json())


async def test_update_transaction_category(auth_client: AsyncClient):
    # Create a transaction without a category
    create_resp = await auth_client.post("/transactions", json={
        "description": "Mystery expense",
        "amount": 5000.0,
        "type": "expense",
        "transaction_date": "2026-07-01",
    })
    tx_id = create_resp.json()["id"]
    cat_id = await _first_category_id(auth_client)

    update_resp = await auth_client.put(f"/transactions/{tx_id}", json={
        "category_id": cat_id,
    })
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["category_id"] == cat_id
    assert updated["confidence_score"] == 1.0
    assert updated["is_flagged"] is False


async def test_delete_transaction(auth_client: AsyncClient):
    create_resp = await auth_client.post("/transactions", json={
        "description": "To be deleted",
        "amount": 999.0,
        "type": "expense",
        "transaction_date": "2026-07-01",
    })
    tx_id = create_resp.json()["id"]

    del_resp = await auth_client.delete(f"/transactions/{tx_id}")
    assert del_resp.status_code == 200

    # Confirm gone
    list_resp = await auth_client.get("/transactions")
    ids = [t["id"] for t in list_resp.json()]
    assert tx_id not in ids


async def test_delete_other_user_transaction_denied(
    async_client: AsyncClient,
    auth_client: AsyncClient,
):
    """Unauthenticated DELETE of any transaction should return 401."""
    # Create a transaction as the authenticated user
    create_resp = await auth_client.post("/transactions", json={
        "description": "Private transaction",
        "amount": 1234.0,
        "type": "expense",
        "transaction_date": "2026-07-01",
    })
    tx_id = create_resp.json()["id"]

    # Create a fresh, entirely unauthenticated client to guarantee no cookies are sent
    from httpx import ASGITransport
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as unauth_client:
        del_resp = await unauth_client.delete(f"/transactions/{tx_id}")
    
    assert del_resp.status_code == 401


async def test_csv_import(auth_client: AsyncClient):
    csv_content = (
        "Date,Description,Amount\n"
        "2026-07-01,Shoprite groceries,-12000\n"
        "2026-07-02,Salary payment,250000\n"
        "2026-07-03,Uber ride,-3500\n"
    )
    files = {"file": ("statement.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    resp = await auth_client.post("/transactions/import-csv", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_parsed"] >= 3
    assert data["total_imported"] >= 2  # at least the valid rows


async def test_csv_import_invalid_file(auth_client: AsyncClient):
    """Uploading a file with no Description column should fail gracefully."""
    csv_content = "Col1,Col2\nfoo,bar\n"
    files = {"file": ("bad.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    resp = await auth_client.post("/transactions/import-csv", files=files)
    assert resp.status_code == 400


async def test_get_categories(auth_client: AsyncClient):
    resp = await auth_client.get("/transactions/categories")
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) > 0
    assert all("name" in c and "type" in c for c in cats)
