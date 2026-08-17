"""
Tests for the expanded category taxonomy, the fallback rule-based categoriser,
and the ML train/validation/test split reporting in app/scripts/seed.py.
"""

import pytest
from httpx import AsyncClient

from app.core.ml import check_rules, normalize_narration, predict_category
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
    "Bank Charges & Fees",
    "Loan / Debt Repayment",
    "Religious Giving / Donations",
}
EXPECTED_INCOME_CATEGORIES = {"Salary", "Business Income", "Other Income"}
EXPECTED_TRANSFER_CATEGORIES = {"Internal Transfer / Savings"}
EXPECTED_UNCATEGORISED_CATEGORIES = {"Uncategorised"}


# ── Category taxonomy ──────────────────────────────────────────────────────

def test_default_categories_taxonomy():
    names_by_type = {"expense": set(), "income": set(), "transfer": set(), "uncategorised": set()}
    for cat in DEFAULT_CATEGORIES:
        names_by_type[cat["type"]].add(cat["name"])

    assert names_by_type["expense"] == EXPECTED_EXPENSE_CATEGORIES
    assert names_by_type["income"] == EXPECTED_INCOME_CATEGORIES
    assert names_by_type["transfer"] == EXPECTED_TRANSFER_CATEGORIES
    assert names_by_type["uncategorised"] == EXPECTED_UNCATEGORISED_CATEGORIES
    assert len(DEFAULT_CATEGORIES) == 20


def test_predict_category_routes_no_signal_narrations_to_uncategorised():
    """Descriptions with no extractable merchant signal must be routed to
    the explicit 'Uncategorised' category, flagged for manual review —
    never silently defaulted to a real category like Food & Groceries."""
    for junk in ["test", "chips", "payment", "gift", "xyzzy quux flibbertigibbet"]:
        category, confidence, is_flagged = predict_category(junk)
        assert category == "Uncategorised", f"{junk!r} -> {category!r} (confidence={confidence})"
        assert is_flagged is True


def test_internal_transfer_is_not_income_or_expense():
    """Internal Transfer / Savings must not be typed as income/expense —
    the /transactions/report endpoint relies on category.type == 'transfer'
    to exclude self-transfers from income/expense totals."""
    transfer_cats = [c for c in DEFAULT_CATEGORIES if c["name"] == "Internal Transfer / Savings"]
    assert len(transfer_cats) == 1
    assert transfer_cats[0]["type"] == "transfer"


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


@pytest.mark.parametrize("description,expected_category", [
    ("SMS Alert fee deduction for the month", "Bank Charges & Fees"),
    ("Stamp duty charge on account", "Bank Charges & Fees"),
    ("Loan repayment for personal loan", "Loan / Debt Repayment"),
    ("Cowrywise savings plan funding", "Internal Transfer / Savings"),
    ("Fixed deposit booking for 90 days", "Internal Transfer / Savings"),
    ("Tithe payment to church", "Religious Giving / Donations"),
    ("Sunday offering payment", "Religious Giving / Donations"),
])
def test_new_taxonomy_fallback_rules(description, expected_category):
    category, confidence = check_rules(description)
    assert category == expected_category
    assert confidence == 1.00


@pytest.mark.parametrize("description,expected_category", [
    ("CIBN MEMBERSHIP FEES", "Business Expenses"),
    ("Annual membership dues payment", "Business Expenses"),
    ("MOBILE TRF TO PAY/ Medication refill /CHIDI OKONKWO", "Medical"),
    ("Wellcare Pharmaceutical Care Ltd payment", "Medical"),
])
def test_membership_and_pharmaceutical_fallback_rules(description, expected_category):
    """Regression test for two confirmed rule-keyword gaps: 'CIBN MEMBERSHIP
    FEES' and bare 'medication'/'pharmaceutical' narrations (without the
    word 'pharmacy') previously fell through to Uncategorised."""
    category, confidence = check_rules(description)
    assert category == expected_category
    assert confidence == 1.00


def test_new_keywords_do_not_match_inside_unrelated_words():
    """Regression test in the spirit of the 'mobil' inside '9mobile' bug:
    the new membership/medication/pharmaceutical keywords must only match
    as whole words/phrases, never as a substring of an unrelated token."""
    # "medication" must not fire when it's a substring of a larger token
    # with no word boundary around it.
    category, _ = check_rules("Premedications review before travel")
    assert category != "Medical"
    # "pharmaceutical" must not fire as a substring of a larger token.
    category, _ = check_rules("Nonpharmaceuticals inventory audit")
    assert category != "Medical"
    # "membership fee"/"membership dues" require the literal two-word
    # phrase; bare "membership" alone (e.g. a club/gym context already
    # covered by Personal Care's "gym membership monthly fee" example)
    # must not falsely trigger Business Expenses.
    category, _ = check_rules("Gym membership renewal for the month")
    assert category != "Business Expenses"


def test_no_cross_category_collision_in_fallback_rules():
    """No two category keyword lists should share a keyword that could cause
    the wrong category to win purely based on FALLBACK_RULES ordering."""
    from app.core.ml import FALLBACK_RULES

    seen = {}
    for keywords, category in FALLBACK_RULES:
        for kw in keywords:
            assert kw not in seen, f"Keyword '{kw}' used by both {seen.get(kw)} and {category}"
            seen[kw] = category


# ── Narration normalisation ─────────────────────────────────────────────────
#
# These use synthetic, structurally-realistic stand-ins for the noisy tokens
# seen in real Access Bank / FewChore Finance statements — never real account
# numbers, phone numbers, or third-party names.

@pytest.mark.parametrize("noisy,description", [
    (
        "Card Ttx Amount 917500 PAN 506146xxxxxxxxx0806 STAN 017313 "
        "RRN fip-640aacc06ad741b3ef7e6ff6 Term 2ISW351A",
        "masked PAN + STAN + RRN + Term ID all stripped",
    ),
    (
        "FT Out:EBUBECHUKWU DAVID IBEH7085103640 OPY Fuel",
        "phone/account number fused onto a name is stripped",
    ),
])
def test_normalize_narration_cleans_noisy_bank_text(noisy, description):
    cleaned = normalize_narration(noisy)
    assert cleaned != noisy, description
    # None of the stripped noise shapes should survive.
    assert "PAN" not in cleaned
    assert "506146xxxxxxxxx0806" not in cleaned
    assert "STAN" not in cleaned
    assert "017313" not in cleaned
    assert "RRN" not in cleaned
    assert "fip-640aacc06ad741b3ef7e6ff6" not in cleaned
    assert "Term" not in cleaned
    assert "2ISW351A" not in cleaned
    assert "7085103640" not in cleaned
    # No double spaces / stray whitespace left behind.
    assert "  " not in cleaned
    assert cleaned == cleaned.strip()


def test_normalize_narration_extracts_fuel_signal_from_ft_out():
    cleaned = normalize_narration("FT Out:EBUBECHUKWU DAVID IBEH7085103640 OPY Fuel")
    assert "Fuel" in cleaned
    category, confidence = check_rules(cleaned)
    assert category == "Transport (Danfo, Uber, Keke)"


@pytest.mark.parametrize("plain", [
    "Lunch with Sarah",
    "Paid ₦45000 deposit",
    "Uber to work",
    "Term 2 school fees payment for daughter",
    "Monthly Salary payment from Tech Corp",
    "",
])
def test_normalize_narration_leaves_plain_descriptions_untouched(plain):
    assert normalize_narration(plain) == plain


def test_normalize_narration_does_not_strip_short_digit_amounts():
    """Amounts like '917500' (6 digits) are not phone/account numbers and
    must survive — only 10+ digit runs and the specific PAN/STAN/RRN/Term
    shapes are noise."""
    cleaned = normalize_narration("Card Ttx Amount 917500 successful")
    assert "917500" in cleaned
    assert cleaned == "Card Ttx Amount 917500 successful"


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
