import asyncio
import os
import json
import argparse
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.ml import normalize_narration
from app.db.session import Base
from app.db.models import Category
from app.db.session import engine

# Make sure joblib and scikit-learn imports are correct
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

# Default categories list with types
DEFAULT_CATEGORIES = [
    {"name": "Food & Groceries", "type": "expense", "is_default": True},
    {"name": "Transport (Danfo, Uber, Keke)", "type": "expense", "is_default": True},
    {"name": "Airtime & Data", "type": "expense", "is_default": True},
    {"name": "Utilities", "type": "expense", "is_default": True},
    {"name": "Rent", "type": "expense", "is_default": True},
    {"name": "School Fees", "type": "expense", "is_default": True},
    {"name": "Medical", "type": "expense", "is_default": True},
    {"name": "Entertainment", "type": "expense", "is_default": True},
    {"name": "Personal Care", "type": "expense", "is_default": True},
    {"name": "Clothing", "type": "expense", "is_default": True},
    {"name": "Business Expenses", "type": "expense", "is_default": True},
    {"name": "Other Expense", "type": "expense", "is_default": True},
    {"name": "Bank Charges & Fees", "type": "expense", "is_default": True},
    {"name": "Loan / Debt Repayment", "type": "expense", "is_default": True},
    {"name": "Religious Giving / Donations", "type": "expense", "is_default": True},
    {"name": "Salary", "type": "income", "is_default": True},
    {"name": "Business Income", "type": "income", "is_default": True},
    {"name": "Other Income", "type": "income", "is_default": True},
    # Not income or expense: self-transfers (savings apps, fixed deposits)
    # move money between the user's own accounts and are excluded from
    # income/expense totals in the /transactions/report endpoint.
    {"name": "Internal Transfer / Savings", "type": "transfer", "is_default": True},
    # Catch-all for narrations with no extractable merchant signal (pure
    # card metadata, single-word entries like "test"/"gift"/"payment").
    # predict_category() routes these here at 0.0 confidence + is_flagged
    # instead of guessing a real category.
    {"name": "Uncategorised", "type": "uncategorised", "is_default": True},
]

# High quality mock Nigerian transactions training data
MOCK_TRANSACTIONS_DATA = [
    # Transport
    ("Uber trip to Victoria Island", "Transport (Danfo, Uber, Keke)"),
    ("Danfo fare from Yaba to Obalende", "Transport (Danfo, Uber, Keke)"),
    ("Keke ride to Ikeja Along", "Transport (Danfo, Uber, Keke)"),
    ("Bolt trip from Lekki Phase 1", "Transport (Danfo, Uber, Keke)"),
    ("BRT bus ride to CMS", "Transport (Danfo, Uber, Keke)"),
    ("Uber ride to airport", "Transport (Danfo, Uber, Keke)"),
    ("Fuel for the car at Total filling station", "Transport (Danfo, Uber, Keke)"),
    ("Bolt ride back home", "Transport (Danfo, Uber, Keke)"),
    ("Keke ride from bus stop", "Transport (Danfo, Uber, Keke)"),
    ("Danfo to Maryland", "Transport (Danfo, Uber, Keke)"),
    ("MOBILE TRF TO PAY/ Uber trip /TOLUWANI BAKARE", "Transport (Danfo, Uber, Keke)"),
    ("FT Out:DAMILARE ADEBAYO8134567209 OPY InDrive", "Transport (Danfo, Uber, Keke)"),

    # Airtime & Data
    ("MTN Airtime topup via Opay", "Airtime & Data"),
    ("Glo 10GB data bundle subscription", "Airtime & Data"),
    ("Airtel airtime purchase from GTBank app", "Airtime & Data"),
    ("9mobile recharge card 1000", "Airtime & Data"),
    ("Smile wifi data subscription renewal", "Airtime & Data"),
    ("Spectranet unlimited data purchase", "Airtime & Data"),
    ("MTN VTU 500 naira airtime", "Airtime & Data"),
    ("Airtel data bundle recharge", "Airtime & Data"),
    ("Glo credit transfer", "Airtime & Data"),
    ("9mobile data recharge via PalmPay", "Airtime & Data"),
    ("Airtime: MTN NIGERIA - 08123456789", "Airtime & Data"),
    ("Data: AIRTEL NIGERIA - 08167294031", "Airtime & Data"),
    ("MOBILE BILLS PYMT/ MTN DATA/08123456789", "Airtime & Data"),

    # Food & Groceries
    ("Purchase at Spar Supermarket Lekki", "Food & Groceries"),
    ("Lunch at Jevinik Restaurant Ikeja", "Food & Groceries"),
    ("Groceries shopping at Shoprite Mall", "Food & Groceries"),
    ("Buy bread, milk, and eggs from Mallam", "Food & Groceries"),
    ("Dinner at Chicken Republic Yaba", "Food & Groceries"),
    ("Order food from Chowdeck - Place Restaurant", "Food & Groceries"),
    ("Groceries at Market Square", "Food & Groceries"),
    ("Bought beef and fish from local market", "Food & Groceries"),
    ("Sweet Sensation pastry purchase", "Food & Groceries"),
    ("Chowdeck delivery Kilimanjaro", "Food & Groceries"),
    ("MOBILE TRF TO MMF/ Groceries /PRIME MART SUPERMARKET ENTERPRISES", "Food & Groceries"),
    ("OPay Card Payment | MONIE POINT | FRESH BITES KITCHEN 004821 LANG", "Food & Groceries"),
    ("FT Out:Kaycee Kitchen And Grill9021456783 MONIEPT Lunch", "Food & Groceries"),

    # Utilities
    ("Eko Electricity prepaid meter token purchase", "Utilities"),
    ("DSTV Premium subscription payment", "Utilities"),
    ("Water bill payment to estate association", "Utilities"),
    ("LAWMA waste disposal monthly fee", "Utilities"),
    ("GOTV Max subscription renewal", "Utilities"),
    ("Ikeja Electric prepaid payment", "Utilities"),
    ("Showmax subscription mobile plan", "Utilities"),
    ("Netflix monthly premium subscription", "Utilities"),
    ("Waste collection fee payment", "Utilities"),
    ("Prepaid power token 10000", "Utilities"),
    ("MOBILE BILLS PYMT/ EKEDC/0208112233445", "Utilities"),

    # Rent
    ("Monthly rent for 3 bedroom flat Yaba", "Rent"),
    ("Service charge for Lekki apartment", "Rent"),
    ("Annual shop space lease renewal", "Rent"),
    ("Rent payment for shared workspace", "Rent"),
    ("Landlord monthly service fee", "Rent"),
    ("Caution deposit for new flat", "Rent"),
    ("House rent payment 2026", "Rent"),
    ("Apartment lease renewal", "Rent"),
    ("Two year rent payment for duplex", "Rent"),
    ("Agent fee for new apartment rental", "Rent"),
    ("Rent renewal for office space", "Rent"),
    ("Estate service charge annual payment", "Rent"),
    ("Landlord rent alert for the year", "Rent"),

    # Salary
    ("Monthly Salary payment from Tech Corp", "Salary"),
    ("Net Salary credit for June", "Salary"),
    ("Salary payment from employer", "Salary"),
    ("Monthly basic pay credit", "Salary"),
    ("Bonus payout from company", "Salary"),
    ("Payment of Salary July 2026", "Salary"),
    ("IBRAHIM OLUWASEUN MARTINS (XXXXXXXXX - Access Bank) with reference Salary/Jul 2026/Employee Name", "Salary"),
    ("Payment of Salary August 2026", "Salary"),
    ("Net salary alert for the month", "Salary"),
    ("13th month salary bonus credit", "Salary"),
    ("Half salary advance payment", "Salary"),
    ("IBRAHIM OLUWASEUN MARTINS (XXXXXXXXX - Access Bank) with reference Salary/Aug 2026/Staff Payroll", "Salary"),

    # Business Income
    ("Freelance writing contract payment received", "Business Income"),
    ("Customer transfer for POS sales transaction", "Business Income"),
    ("Consulting services fee payment received", "Business Income"),
    ("Opay business account sales revenue", "Business Income"),
    ("E-commerce product sale payment", "Business Income"),
    ("Payment received for software project development", "Business Income"),
    ("Dividends payment received", "Business Income"),
    ("Freelance UI design work payout", "Business Income"),
    ("A Billion Laughs Limited (XXXXXXXXXX - Titan Paystack) with reference Website Maintenance", "Business Income"),
    ("QUALISERVE TECHNOLOGIES LIMITED (XXXXXXXXXX - Fidelity Bank) with reference Inward transfer", "Business Income"),

    # School Fees
    ("Term 2 school fees payment for daughter", "School Fees"),
    ("WAEC exam registration fee payment", "School Fees"),
    ("JAMB UTME registration payment", "School Fees"),
    ("University tuition fee payment", "School Fees"),
    ("Nursery school fees for son", "School Fees"),
    ("PTA levy payment to school", "School Fees"),
    ("School uniform and textbook fee", "School Fees"),
    ("Private lesson tutor payment", "School Fees"),
    ("Exam fee payment to school", "School Fees"),
    ("Creche fees for the month", "School Fees"),

    # Medical
    ("Consultation fee at Reddington Hospital", "Medical"),
    ("Pharmacy purchase of malaria drugs", "Medical"),
    ("NHIS health insurance premium payment", "Medical"),
    ("Dental checkup and treatment fee", "Medical"),
    ("Hospital bill for minor surgery", "Medical"),
    ("Lab test at diagnostic center", "Medical"),
    ("Drugs purchase at MedPlus pharmacy", "Medical"),
    ("Optical checkup and glasses purchase", "Medical"),
    ("Maternity care hospital payment", "Medical"),
    ("Health insurance premium renewal", "Medical"),
    ("FT Out:Wellcare Pharmaceutical Care Ltd - Wellcare Pharmacy Ikeja5041293876 MONIEPT Medication", "Medical"),

    # Entertainment
    ("Cinema ticket at Filmhouse Cinemas", "Entertainment"),
    ("Concert ticket purchase", "Entertainment"),
    ("Weekend outing at Nike Art Gallery", "Entertainment"),
    ("Club entry fee at Landmark Beach", "Entertainment"),
    ("Amusement park ticket at Whitesands", "Entertainment"),
    ("Bowling night out with friends", "Entertainment"),
    ("Show ticket at Eko Hotel", "Entertainment"),
    ("Games center visit with friends", "Entertainment"),
    ("Football viewing center payment", "Entertainment"),
    ("Karaoke night payment", "Entertainment"),

    # Personal Care
    ("Haircut at the barbershop", "Personal Care"),
    ("Salon visit for hair styling", "Personal Care"),
    ("Manicure and pedicure session", "Personal Care"),
    ("Spa treatment payment", "Personal Care"),
    ("Gym membership monthly fee", "Personal Care"),
    ("Skincare products purchase", "Personal Care"),
    ("Makeup purchase at beauty store", "Personal Care"),
    ("Massage therapy session", "Personal Care"),
    ("Barbing saloon payment", "Personal Care"),
    ("Cosmetics shopping at Justrite", "Personal Care"),
    ("MOBILE TRF TO MMF/ Haircut /SUNSHINE BARBERSHOP - SUNSHINE BARBERSHOP 2", "Personal Care"),

    # Clothing
    ("New outfit purchase at a Lagos boutique", "Clothing"),
    ("Shoes purchase at Yaba shopping complex", "Clothing"),
    ("Ankara fabric purchase from tailor", "Clothing"),
    ("Designer wear purchase online", "Clothing"),
    ("Children clothes shopping trip", "Clothing"),
    ("Tailor fee for made to measure suit", "Clothing"),
    ("Shoe repair and polish service", "Clothing"),
    ("Bag purchase at Ikeja City Mall", "Clothing"),
    ("Traditional attire for wedding ceremony", "Clothing"),
    ("Jeans and shirts shopping at the boutique", "Clothing"),
    ("MOBILE TRF TO PAT/ Purchase of shoes /PAYSTACK CHECKOUT", "Clothing"),

    # Business Expenses
    ("Purchase of inventory stock for shop", "Business Expenses"),
    ("Office supplies and stationery purchase", "Business Expenses"),
    ("Payment for business marketing ads", "Business Expenses"),
    ("CAC business registration fee payment", "Business Expenses"),
    ("Staff stipend payment for shop attendant", "Business Expenses"),
    ("Generator diesel purchase for business", "Business Expenses"),
    ("Wholesale goods purchase for resale", "Business Expenses"),
    ("POS terminal maintenance fee", "Business Expenses"),
    ("Warehouse storage fee payment", "Business Expenses"),
    ("Raw materials purchase for production", "Business Expenses"),
    ("PERFECT PRINT TECH (XXXXXXXXXX - Moniepoint Microfinance Bank) with reference Dock Accessory", "Business Expenses"),
    ("PAYSTACK CHECKOUT (XXXXXXXXXX - Titan Paystack) with reference Zoho Books", "Business Expenses"),

    # Other Expense
    ("ATM withdrawal for personal use", "Other Expense"),
    ("Cash withdrawal at the bank", "Other Expense"),
    ("Miscellaneous expense payment", "Other Expense"),
    ("Unspecified POS payment", "Other Expense"),
    ("Charity donation to local NGO", "Other Expense"),
    ("Cash gift given to family member", "Other Expense"),
    ("Random purchase at a roadside stall", "Other Expense"),
    ("Bank service charge deduction", "Other Expense"),
    ("Payment for an unspecified service", "Other Expense"),
    ("Sundry expense payment", "Other Expense"),

    # Other Income
    ("Cash gift received from relative", "Other Income"),
    ("Refund from online purchase", "Other Income"),
    ("Betting winnings payout received", "Other Income"),
    ("Rental income from property tenant", "Other Income"),
    ("Interest income from savings account", "Other Income"),
    ("Reimbursement from employer for expenses", "Other Income"),
    ("Inheritance payment received", "Other Income"),
    ("Loan repayment received from friend", "Other Income"),
    ("Grant payment received from NGO", "Other Income"),
    ("Miscellaneous credit alert to account", "Other Income"),
    ("Interest paid on - TOLUWANI BAKARE/10000045821", "Other Income"),
    ("OWealth Interest Earned", "Other Income"),
    ("NFT//BO/OKOMU OIL PLC DIV 12 NEFT/OKOMUOIL 30411 DIV 12", "Other Income"),

    # Bank Charges & Fees
    ("SMS alert fee deducted for the month", "Bank Charges & Fees"),
    ("Stamp duty charge on account", "Bank Charges & Fees"),
    ("Card maintenance fee deduction", "Bank Charges & Fees"),
    ("VAT charge on account maintenance fee", "Bank Charges & Fees"),
    ("Transfer commission fee for outward payment", "Bank Charges & Fees"),
    ("SMS Alert Charge NIP", "Bank Charges & Fees"),
    ("Stamp Duty COT Chg", "Bank Charges & Fees"),
    ("Acct Maint Fee Q3", "Bank Charges & Fees"),
    ("Electronic Outward Transfer Stamp Duty", "Bank Charges & Fees"),
    ("FGN Stamp Duty for 6 txns 12/07--18/07/26", "Bank Charges & Fees"),
    ("SMS Alert Fee-29/06-28/07/2026 + VAT", "Bank Charges & Fees"),
    ("COMMISSION MOBILE TRF TO PAY/ Fuel /TOLUWANI BAKARE", "Bank Charges & Fees"),
    ("VAT MOBILE TRF TO PAY/ Fuel /TOLUWANI BAKARE", "Bank Charges & Fees"),
    ("USSD Charge", "Bank Charges & Fees"),
    ("VAT on Transfer Fee", "Bank Charges & Fees"),
    ("Copper Brass - Rev/COT with reference Jul 2026 service charge for NGN outflows", "Bank Charges & Fees"),
    ("COMMISSION e-Statement Request", "Bank Charges & Fees"),

    # Loan / Debt Repayment
    ("Loan repayment for personal loan", "Loan / Debt Repayment"),
    ("Monthly loan installment payment", "Loan / Debt Repayment"),
    ("Overdraft repayment to bank", "Loan / Debt Repayment"),
    ("Debt repayment to credit union", "Loan / Debt Repayment"),
    ("Paylater repayment for purchase", "Loan / Debt Repayment"),
    ("Loan Repymt Trf", "Loan / Debt Repayment"),
    ("Debt Repayment NIP", "Loan / Debt Repayment"),
    ("Credit Facility Repayment", "Loan / Debt Repayment"),
    ("Loan Interest Repayment - TOLUWANI BAKARE - 04051034040009821", "Loan / Debt Repayment"),
    ("Loan Principal Repayment - TOLUWANI BAKARE - 04051034040009821", "Loan / Debt Repayment"),
    ("Loan Interest Deduction - TOLUWANI BAKARE - 04051034040009821", "Loan / Debt Repayment"),
    ("Loan Principal Deduction - TOLUWANI BAKARE - 04051034040009821", "Loan / Debt Repayment"),
    ("MOBILE TRF TO IMF/ Final loan repayment /TOLUWANI BAKARE", "Loan / Debt Repayment"),

    # Internal Transfer / Savings
    ("Cowrywise savings plan funding", "Internal Transfer / Savings"),
    ("PiggyVest target savings deposit", "Internal Transfer / Savings"),
    ("Fixed deposit booking for 90 days", "Internal Transfer / Savings"),
    ("Fixed deposit pre-liquidation withdrawal", "Internal Transfer / Savings"),
    ("Self transfer to savings account", "Internal Transfer / Savings"),
    ("Transfer to own account for safekeeping", "Internal Transfer / Savings"),
    ("Investment wallet funding via app", "Internal Transfer / Savings"),
    ("Savings Plan Funding NIP", "Internal Transfer / Savings"),
    ("Cowrywise Financial Technology/Cowrywise/AT5_MFDS9123456789012345", "Internal Transfer / Savings"),
    ("Fixed Dep. Booking - 2026/07/09 -TOLUWANI BAKARE/10000045821", "Internal Transfer / Savings"),
    ("Fixed Deposit Pre-liquidation - TOLUWANI BAKARE/1200099821", "Internal Transfer / Savings"),
    ("MFY / Cowrywise-Cowrywise/TOLUWANI BAKARE (XXXXXXXXX - Sterling Bank) with reference Mutual Funds", "Internal Transfer / Savings"),
    ("MOBILE TRF TO AMB/ /Cowrywise/TOLUWANI BAKARE", "Internal Transfer / Savings"),

    # Religious Giving / Donations
    ("Tithe payment to church", "Religious Giving / Donations"),
    ("Sunday offering payment", "Religious Giving / Donations"),
    ("Church building fund donation", "Religious Giving / Donations"),
    ("Mosque donation for Ramadan", "Religious Giving / Donations"),
    ("Zakat payment for the year", "Religious Giving / Donations"),
    ("Sadaqah given to charity", "Religious Giving / Donations"),
    ("Church Payment NIP", "Religious Giving / Donations"),
    ("Harvest Donation Trf", "Religious Giving / Donations"),
    ("FT Out:GRACE CHAPEL INTERNATIONAL0028999521 ABP Offering", "Religious Giving / Donations"),
    ("MOBILE TRF TO ACCESS/Offering/GRACE CHAPEL INTERNATIONAL", "Religious Giving / Donations"),
    ("MOBILE TRF TO ACCESS/Building project/GRACE CHAPEL INTERNATIONAL", "Religious Giving / Donations"),
    ("FT Out:TOLUWANI BAKARE1538299521 ABP For tithe", "Religious Giving / Donations"),
    ("MOBILE TRF TO SIB/ Offering and Seed /REDEMPTION CITY CHURCH", "Religious Giving / Donations"),
    ("MOBILE TRF TO FBN/ Offering /REDEMPTION CITY CHURCH,IKEJA", "Religious Giving / Donations"),

    # Uncategorised — narrations with no extractable merchant signal, either
    # because they're pure card-processor metadata with the noise tokens
    # already stripped by normalize_narration(), or because the raw text
    # itself is a one-word placeholder a user typed with no real detail.
    ("test", "Uncategorised"),
    ("chips", "Uncategorised"),
    ("payment", "Uncategorised"),
    ("gift", "Uncategorised"),
    ("investment", "Uncategorised"),
    ("Debt", "Uncategorised"),
    ("website", "Uncategorised"),
    ("Refund", "Uncategorised"),
    ("Reversal of transaction", "Uncategorised"),
    ("Card Ttx Amount successful", "Uncategorised"),
    ("TRANSFER", "Uncategorised"),
    ("Tbr", "Uncategorised"),
    ("Reversal of Card Ttx Amount 350000 PAN 419927xxxxxxxxx1123 STAN 552310 RRN fip-a12e9f6c5b3d8a12ff01c223 Term 2ISPT441", "Uncategorised"),
]

def _new_pipeline() -> Pipeline:
    # word(1,2) + char_wb(3,5) feature union: char n-grams generalise across
    # the misspellings/abbreviations common in bank narrations ("Vreakfast",
    # "Dinnr", "Tbr") in a way pure word n-grams can't. Confirmed by
    # app/scripts/ml_experiment.py across two corpus-expansion rounds (see
    # experiment_log in app/ml/artifacts/metrics.json) to beat the plain
    # word(1,2) vectorizer by ~9-11 points of validation accuracy, with no
    # change to LogisticRegression, so predict_category()'s confidence-based
    # flagging (which relies on predict_proba) is unaffected.
    vectorizer = FeatureUnion([
        ('word', TfidfVectorizer(lowercase=True, ngram_range=(1, 2))),
        ('char', TfidfVectorizer(lowercase=True, analyzer='char_wb', ngram_range=(3, 5))),
    ])
    return Pipeline([
        ('vectorizer', vectorizer),
        ('classifier', LogisticRegression(C=1.0, max_iter=1000))
    ])


def train_baseline_model():
    print("Training baseline ML categorization model...")
    # Normalise with the exact same function used at inference time
    # (app.core.ml.predict_category), so training and prediction see
    # identical text.
    descriptions = [normalize_narration(item[0]) for item in MOCK_TRANSACTIONS_DATA]
    categories = [item[1] for item in MOCK_TRANSACTIONS_DATA]

    # 70/15/15 stratified train/validation/test split, so there's a real,
    # reproducible accuracy figure to cite instead of just cross-validation run by hand.
    X_train, X_temp, y_train, y_temp = train_test_split(
        descriptions, categories, test_size=0.30, stratify=categories, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
    )

    eval_pipeline = _new_pipeline()
    eval_pipeline.fit(X_train, y_train)

    train_accuracy = accuracy_score(y_train, eval_pipeline.predict(X_train))
    val_accuracy = accuracy_score(y_val, eval_pipeline.predict(X_val))
    test_accuracy = accuracy_score(y_test, eval_pipeline.predict(X_test))

    print(f"Split sizes -> train: {len(X_train)}, validation: {len(X_val)}, test: {len(X_test)}")
    print(f"Train accuracy: {train_accuracy:.4f}")
    print(f"Validation accuracy: {val_accuracy:.4f}")
    print(f"Test accuracy: {test_accuracy:.4f}")

    # Train the final deployed model on the FULL dataset (now that we have a held-out
    # accuracy figure from the split above), so production predictions benefit from
    # every labelled example.
    pipeline = _new_pipeline()
    pipeline.fit(descriptions, categories)

    # Ensure target directory exists
    model_dir = "app/ml/artifacts"
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "model.joblib")

    # Persist model pipeline
    joblib.dump(pipeline, model_path)
    print(f"Successfully trained and saved model pipeline to: {model_path}")

    metrics = {
        "train_samples": len(X_train),
        "validation_samples": len(X_val),
        "test_samples": len(X_test),
        "train_accuracy": round(float(train_accuracy), 4),
        "validation_accuracy": round(float(val_accuracy), 4),
        "test_accuracy": round(float(test_accuracy), 4),
        "total_training_corpus_size": len(descriptions),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    metrics_path = os.path.join(model_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved training metrics to: {metrics_path}")

    return metrics


async def seed_database_categories():
    print("Seeding default categories to database...")
    async_session = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )

    async with async_session() as session:
        for cat_info in DEFAULT_CATEGORIES:
            # Check if category exists
            stmt = select(Category).where(Category.name == cat_info["name"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()

            if not existing:
                new_cat = Category(
                    name=cat_info["name"],
                    type=cat_info["type"],
                    is_default=cat_info["is_default"]
                )
                session.add(new_cat)
                print(f"Adding category: {cat_info['name']} ({cat_info['type']})")
        
        await session.commit()
    print("Database seeding completed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed database and train baseline ML model.")
    parser.add_argument("--train-model", action="store_true", help="Train and save the ML model.")
    parser.add_argument("--seed-db", action="store_true", help="Seed default categories to the database.")
    args = parser.parse_args()

    # If no flags passed, run both
    if not args.train_model and not args.seed_db:
        args.train_model = True
        args.seed_db = True

    if args.train_model:
        train_baseline_model()

    if args.seed_db:
        asyncio.run(seed_database_categories())
