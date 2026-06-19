import asyncio
import os
import argparse
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.db.session import Base
from app.db.models import Category
from app.db.session import engine

# Make sure joblib and scikit-learn imports are correct
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Default categories list with types
DEFAULT_CATEGORIES = [
    {"name": "Food & Groceries", "type": "expense", "is_default": True},
    {"name": "Transport (Danfo, Uber, Keke)", "type": "expense", "is_default": True},
    {"name": "Airtime & Data", "type": "expense", "is_default": True},
    {"name": "Utilities", "type": "expense", "is_default": True},
    {"name": "Rent", "type": "expense", "is_default": True},
    {"name": "Salary", "type": "income", "is_default": True},
    {"name": "Business Income", "type": "income", "is_default": True},
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

    # Rent
    ("Monthly rent for 3 bedroom flat Yaba", "Rent"),
    ("Service charge for Lekki apartment", "Rent"),
    ("Annual shop space lease renewal", "Rent"),
    ("Rent payment for shared workspace", "Rent"),
    ("Landlord monthly service fee", "Rent"),
    ("Caution deposit for new flat", "Rent"),
    ("House rent payment 2026", "Rent"),
    ("Apartment lease renewal", "Rent"),

    # Salary
    ("Monthly Salary payment from Tech Corp", "Salary"),
    ("Net Salary credit for June", "Salary"),
    ("Salary payment from employer", "Salary"),
    ("Monthly basic pay credit", "Salary"),
    ("Bonus payout from company", "Salary"),
    
    # Business Income
    ("Freelance writing contract payment received", "Business Income"),
    ("Customer transfer for POS sales transaction", "Business Income"),
    ("Consulting services fee payment received", "Business Income"),
    ("Opay business account sales revenue", "Business Income"),
    ("E-commerce product sale payment", "Business Income"),
    ("Payment received for software project development", "Business Income"),
    ("Dividends payment received", "Business Income"),
    ("Freelance UI design work payout", "Business Income")
]

def train_baseline_model():
    print("Training baseline ML categorization model...")
    descriptions = [item[0] for item in MOCK_TRANSACTIONS_DATA]
    categories = [item[1] for item in MOCK_TRANSACTIONS_DATA]

    # Create the text classification pipeline
    pipeline = Pipeline([
        ('vectorizer', TfidfVectorizer(lowercase=True, ngram_range=(1, 2))),
        ('classifier', LogisticRegression(C=1.0, max_iter=1000))
    ])

    # Train model
    pipeline.fit(descriptions, categories)

    # Ensure target directory exists
    model_dir = "app/ml/artifacts"
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "model.joblib")

    # Persist model pipeline
    joblib.dump(pipeline, model_path)
    print(f"Successfully trained and saved model pipeline to: {model_path}")


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
