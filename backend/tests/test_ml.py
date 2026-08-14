"""
Tests for the expanded category taxonomy, the fallback rule-based categoriser,
and the ML train/validation/test split reporting in app/scripts/seed.py.
"""

import pytest
from httpx import AsyncClient

from app.core.ml import check_rules
from app.scripts.seed import DEFAULT_CATEGORIES, MOCK_TRANSACTIONS_DATA, train_baseline_model


EXPECTED_EXPENSE_CATEGORIES = {
    "Food & Groceries",
    "Transport (Danfo, Uber, Keke)",
    "Airtime & Data",
    "Utilities",
    "Rent",
    "School Fees",
    "Medical",
    "Entertainment",
    "Personal Care",
    "Clothing",
    "Business Expenses",
    "Other Expense",
}
EXPECTED_INCOME_CATEGORIES = {"Salary", "Business Income", "Other Income"}


# ── Category taxonomy ──────────────────────────────────────────────────────

def test_default_categories_taxonomy():
    names_by_type = {"expense": set(), "income": set()}
    for cat in DEFAULT_CATEGORIES:
        names_by_type[cat["type"]].add(cat["name"])

    assert names_by_type["expense"] == EXPECTED_EXPENSE_CATEGORIES
    assert names_by_type["income"] == EXPECTED_INCOME_CATEGORIES
    assert len(DEFAULT_CATEGORIES) == 15


def test_mock_transactions_cover_every_category():
    default_names = {cat["name"] for cat in DEFAULT_CATEGORIES}
    covered = {category for _, category in MOCK_TRANSACTIONS_DATA}
    assert covered == default_names


@pytest.mark.asyncio
async def test_categories_endpoint_returns_full_taxonomy(auth_client: AsyncClient):
    resp = await auth_client.get("/transactions/categories")
    assert resp.status_code == 200
    cats = resp.json()
    names = {c["name"] for c in cats}
    assert EXPECTED_EXPENSE_CATEGORIES | EXPECTED_INCOME_CATEGORIES <= names


# ── Fallback rule word-boundary fix ────────────────────────────────────────

def test_mobil_keyword_does_not_match_9mobile():
    """Regression test: 'mobil' (Mobil filling stations) must not substring-match
    inside '9mobile' or 'mobile' network descriptions."""
    category, confidence = check_rules("9mobile recharge card 1000")
    assert category == "Airtime & Data"

    category, confidence = check_rules("Smile wifi mobile data subscription")
    assert category != "Transport (Danfo, Uber, Keke)"


def test_mobil_keyword_matches_whole_word():
    category, confidence = check_rules("Fuel top-up at Mobil filling station")
    assert category == "Transport (Danfo, Uber, Keke)"
    assert confidence == 1.00


@pytest.mark.parametrize("description,expected_category", [
    ("Term 2 school fees payment for daughter", "School Fees"),
    ("Consultation fee at Reddington Hospital", "Medical"),
    ("Cinema ticket at Filmhouse Cinemas", "Entertainment"),
    ("Haircut at the barbershop", "Personal Care"),
    ("Ankara fabric purchase from tailor", "Clothing"),
    ("Office supplies and stationery purchase", "Business Expenses"),
])
def test_new_category_fallback_rules(description, expected_category):
    category, confidence = check_rules(description)
    assert category == expected_category
    assert confidence == 1.00


def test_no_cross_category_collision_in_fallback_rules():
    """No two category keyword lists should share a keyword that could cause
    the wrong category to win purely based on FALLBACK_RULES ordering."""
    from app.core.ml import FALLBACK_RULES

    seen = {}
    for keywords, category in FALLBACK_RULES:
        for kw in keywords:
            assert kw not in seen, f"Keyword '{kw}' used by both {seen.get(kw)} and {category}"
            seen[kw] = category


# ── Train/validation/test split ────────────────────────────────────────────

def test_train_baseline_model_reports_split_metrics():
    metrics = train_baseline_model()

    total = len(MOCK_TRANSACTIONS_DATA)
    assert metrics["train_samples"] + metrics["validation_samples"] + metrics["test_samples"] == total
    assert metrics["total_training_corpus_size"] == total

    # Roughly a 70/15/15 split
    assert metrics["train_samples"] / total == pytest.approx(0.70, abs=0.05)
    assert metrics["validation_samples"] / total == pytest.approx(0.15, abs=0.05)
    assert metrics["test_samples"] / total == pytest.approx(0.15, abs=0.05)

    for key in ("train_accuracy", "validation_accuracy", "test_accuracy"):
        assert 0.0 <= metrics[key] <= 1.0

    assert "trained_at" in metrics
