import os
import re
import joblib
from typing import Tuple

_pipeline = None

# ── Narration normalisation ──────────────────────────────────────────────
#
# Bank-exported narrations (PDF/CSV statement imports) carry card-processor
# noise that plain hand-typed descriptions never do: masked PANs, STAN/RRN/
# Term IDs, and raw phone/account numbers. These tokens are unique per
# transaction, so they add no categorisation signal and only dilute the
# TF-IDF vocabulary. Each pattern below is scoped to a specific noise shape
# rather than stripping digits generally, so plain descriptions like
# "Paid ₦45000 deposit" or "Term 2 school fees" pass through untouched.
_PAN_RE = re.compile(r"\b(?:PAN\s+)?\d{4,6}[xX]{4,}\d{2,6}\b", re.IGNORECASE)
_STAN_RE = re.compile(r"\bSTAN\s+\d{4,}\b", re.IGNORECASE)
_RRN_RE = re.compile(r"\bRRN\s+[A-Za-z0-9-]{6,}\b", re.IGNORECASE)
_TERM_ID_RE = re.compile(r"\bTerm\s+[A-Za-z0-9]{4,}\b", re.IGNORECASE)
# Phone numbers and account numbers are both long runs of consecutive
# digits (10+); matching the run itself (not \b-delimited) also catches
# digits fused onto a name with no separating space, e.g. "IBEH7085103640".
_LONG_DIGIT_RUN_RE = re.compile(r"\d{10,}")
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_narration(text: str) -> str:
    """Strip bank-specific noise tokens (masked PANs, STAN/RRN/Term IDs,
    raw phone/account numbers) from a transaction narration.

    Conservative by design: only removes text matching these specific
    shapes. If none match, the input is returned completely unchanged
    (no whitespace normalisation either), so plain manual/CSV descriptions
    are never touched.
    """
    if not text:
        return text

    cleaned = _PAN_RE.sub(" ", text)
    cleaned = _STAN_RE.sub(" ", cleaned)
    cleaned = _RRN_RE.sub(" ", cleaned)
    cleaned = _TERM_ID_RE.sub(" ", cleaned)
    cleaned = _LONG_DIGIT_RUN_RE.sub(" ", cleaned)

    if cleaned == text:
        return text

    return _WHITESPACE_RE.sub(" ", cleaned).strip()


def load_model():
    global _pipeline
    if _pipeline is None:
        # Resolve absolute path relative to this file
        current_dir = os.path.dirname(os.path.dirname(__file__))
        model_path = os.path.join(current_dir, "ml", "artifacts", "model.joblib")
        if os.path.exists(model_path):
            try:
                _pipeline = joblib.load(model_path)
                print(f"Successfully loaded ML model pipeline from: {model_path}")
            except Exception as e:
                print(f"Error loading ML model: {e}")
        else:
            print(f"Warning: ML model not found at {model_path}. Falling back to rule-based mapping.")

# Rule-based fallback keyword mapping
FALLBACK_RULES = [
    # Transport
    (["danfo", "uber", "bolt", "taxify", "keke", "fare", "brt", "transport", "ride", "fuel", "total filling", "filling station", "conoil", "mobil", "eko bridge"], "Transport (Danfo, Uber, Keke)"),
    # Airtime & Data
    (["airtime", "data", "mtn", "glo", "airtel", "9mobile", "recharge", "vtu", "topup", "credit transfer", "spectranet", "smile wifi", "palmpay airtime"], "Airtime & Data"),
    # Food & Groceries
    (["spar", "shoprite", "groceries", "supermarket", "restaurant", "jevinik", "chicken republic", "chowdeck", "kilimanjaro", "pastry", "market", "mallam", "bread", "milk", "eggs", "food", "eat"], "Food & Groceries"),
    # Utilities
    (["electricity", "prepaid", "dstv", "gotv", "showmax", "netflix", "water bill", "lawma", "waste", "utility", "utility bill", "ikeja electric", "eko electric"], "Utilities"),
    # Rent
    (["rent", "landlord", "flat", "apartment", "service charge", "lease", "office rent", "caution deposit"], "Rent"),
    # Salary
    (["salary", "wage", "employer", "basic pay", "net salary", "net pay", "payout", "bonus"], "Salary"),
    # Business Income
    (["freelance", "contract", "consulting", "sales", "revenue", "pos transfer", "product sale", "software project", "dividends", "business account"], "Business Income"),
    # School Fees
    (["school fees", "school fee", "tuition", "waec", "jamb", "pta levy", "nursery school", "creche", "exam registration", "school uniform"], "School Fees"),
    # Medical
    (["hospital", "pharmacy", "clinic", "nhis", "health insurance", "dental", "diagnostic center", "medplus", "malaria drug", "consultation fee", "lab test", "optical checkup", "maternity"], "Medical"),
    # Entertainment
    (["cinema", "filmhouse", "concert ticket", "amusement park", "bowling", "karaoke", "nightclub", "club entry", "viewing center"], "Entertainment"),
    # Personal Care
    (["barbershop", "barbing", "salon", "manicure", "pedicure", "spa treatment", "gym membership", "skincare", "makeup", "massage therapy", "cosmetics"], "Personal Care"),
    # Clothing
    (["boutique", "tailor", "ankara", "shoe repair", "designer wear", "traditional attire", "shopping complex"], "Clothing"),
    # Business Expenses
    (["business registration", "cac registration", "office supplies", "stationery purchase", "wholesale goods", "pos terminal", "warehouse storage", "raw materials", "inventory stock", "business marketing"], "Business Expenses"),
    # Bank Charges & Fees
    (["stamp duty", "sms alert fee", "sms alert charge", "transfer commission", "vat on fee", "maintenance fee", "card maintenance", "account maintenance", "cot charge", "bank charge", "service fee deduction", "commission on turnover"], "Bank Charges & Fees"),
    # Loan / Debt Repayment
    (["loan repayment", "loan installment", "loan instalment", "debt repayment", "credit facility repayment", "overdraft repayment", "loan payment to", "paylater repayment"], "Loan / Debt Repayment"),
    # Internal Transfer / Savings
    (["cowrywise", "piggyvest", "fixed deposit booking", "fixed deposit pre-liquidation", "savings plan funding", "self transfer", "transfer to own account", "target savings", "investment wallet funding"], "Internal Transfer / Savings"),
    # Religious Giving / Donations
    (["tithe", "offering payment", "church payment", "church donation", "mosque donation", "zakat", "sadaqah", "harvest donation", "building fund donation"], "Religious Giving / Donations"),
]

def check_rules(description: str) -> Tuple[str, float]:
    desc_lower = description.lower()
    for keywords, category in FALLBACK_RULES:
        for kw in keywords:
            # Word-boundary match avoids substring false positives, e.g. the
            # Transport keyword "mobil" incorrectly matching inside "9mobile"/"mobile".
            if re.search(r"\b" + re.escape(kw) + r"\b", desc_lower):
                return category, 1.00  # Rule matches have 100% confidence
    return "", 0.0

def predict_category(description: str) -> Tuple[str, float, bool]:
    # Normalise once, up front, so the rule-based check and the ML model see
    # the exact same text — this must match what the model was trained on.
    description = normalize_narration(description)

    # 1. First check high confidence rule match
    rule_category, rule_conf = check_rules(description)
    if rule_category:
        return rule_category, rule_conf, False

    # 2. Try ML model prediction
    global _pipeline
    if _pipeline is None:
        load_model()

    if _pipeline is not None:
        try:
            probs = _pipeline.predict_proba([description])[0]
            classes = _pipeline.classes_
            max_idx = probs.argmax()
            predicted_class = classes[max_idx]
            confidence = float(probs[max_idx])
            if confidence < 0.60:
                # Below this threshold the model's "best guess" isn't a
                # reliable signal — surface it as Uncategorised rather than
                # a specific-but-likely-wrong category.
                return "Uncategorised", confidence, True
            return predicted_class, confidence, False
        except Exception as e:
            print(f"ML Model prediction error: {e}")
            pass

    # 3. No rule match and no (usable) ML model: rather than guessing a
    # concrete category, route to the explicit placeholder category so the
    # user resolves it manually instead of silently defaulting to
    # "Food & Groceries".
    return "Uncategorised", 0.0, True

def retrain_model(user_labeled_data: list) -> Tuple[int, int]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from app.scripts.seed import MOCK_TRANSACTIONS_DATA

    # Extract descriptions and categories from mock data and user data
    descriptions = [item[0] for item in MOCK_TRANSACTIONS_DATA] + [item[0] for item in user_labeled_data]
    categories = [item[1] for item in MOCK_TRANSACTIONS_DATA] + [item[1] for item in user_labeled_data]

    # Normalise with the exact same function used at inference time
    # (predict_category), so training and prediction see identical text.
    descriptions = [normalize_narration(d) for d in descriptions]

    # Create the text classification pipeline
    pipeline = Pipeline([
        ('vectorizer', TfidfVectorizer(lowercase=True, ngram_range=(1, 2))),
        ('classifier', LogisticRegression(C=1.0, max_iter=1000))
    ])

    # Train model
    pipeline.fit(descriptions, categories)

    # Resolve absolute path relative to this file
    current_dir = os.path.dirname(os.path.dirname(__file__))
    model_path = os.path.join(current_dir, "ml", "artifacts", "model.joblib")

    # Ensure directory exists
    os.makedirs(os.path.dirname(model_path), exist_ok=True)

    # Persist model pipeline
    joblib.dump(pipeline, model_path)
    print(f"Successfully retrained and saved model pipeline to: {model_path}")

    # Reload the model in-memory
    global _pipeline
    _pipeline = pipeline

    return len(MOCK_TRANSACTIONS_DATA), len(user_labeled_data)

