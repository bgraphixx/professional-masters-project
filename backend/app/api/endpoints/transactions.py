import io
import csv
import uuid
import re
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Transaction, Category
from app.schemas.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    CSVImportResponse,
    CategoryResponse
)
from app.core.ml import predict_category

router = APIRouter()

def parse_date(date_str: str) -> date:
    date_str = date_str.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    return date.today()

def clean_amount(val: str) -> float:
    if not val:
        return 0.0
    cleaned = re.sub(r"[^\d\.\-]", "", val.strip())
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

@router.get("", response_model=List[TransactionResponse])
async def get_transactions(
    category_id: Optional[uuid.UUID] = None,
    type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .options(selectinload(Transaction.category))
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    )

    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if type:
        stmt = stmt.where(Transaction.type == type)
    if start_date:
        stmt = stmt.where(Transaction.transaction_date >= start_date)
    if end_date:
        stmt = stmt.where(Transaction.transaction_date <= end_date)

    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Category).order_by(Category.name.asc()))
    return result.scalars().all()

@router.post("", response_model=TransactionResponse)
async def create_transaction(
    tx_in: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    category_id = tx_in.category_id
    confidence_score = 1.00
    is_flagged = False

    # Run ML prediction if category is omitted
    if not category_id:
        predicted_name, confidence, flagged = predict_category(tx_in.description)
        confidence_score = confidence
        is_flagged = flagged

        # Find matching Category in DB
        stmt = select(Category).where(Category.name == predicted_name)
        res = await db.execute(stmt)
        cat = res.scalar_one_or_none()
        if cat:
            category_id = cat.id

    tx_date = tx_in.transaction_date or date.today()

    new_tx = Transaction(
        user_id=current_user.id,
        category_id=category_id,
        amount=tx_in.amount,
        transaction_date=tx_date,
        description=tx_in.description,
        type=tx_in.type,
        source=tx_in.source or "manual",
        confidence_score=confidence_score,
        is_flagged=is_flagged
    )

    db.add(new_tx)
    await db.commit()
    await db.refresh(new_tx)

    # Reload with category relationship preloaded
    stmt = select(Transaction).where(Transaction.id == new_tx.id).options(selectinload(Transaction.category))
    res = await db.execute(stmt)
    return res.scalar_one()

@router.put("/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: uuid.UUID,
    tx_in: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    res = await db.execute(stmt)
    tx = res.scalar_one_or_none()

    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or unauthorized access"
        )

    # Update values
    if tx_in.amount is not None:
        tx.amount = tx_in.amount
    if tx_in.transaction_date is not None:
        tx.transaction_date = tx_in.transaction_date
    if tx_in.description is not None:
        tx.description = tx_in.description
    if tx_in.type is not None:
        tx.type = tx_in.type
    if tx_in.is_flagged is not None:
        tx.is_flagged = tx_in.is_flagged

    # Special handling: if category is manually overridden, set confidence score to 100% and unflag
    if tx_in.category_id is not None:
        tx.category_id = tx_in.category_id
        tx.confidence_score = 1.00
        tx.is_flagged = False

    await db.commit()
    await db.refresh(tx)

    # Reload relationship
    stmt = select(Transaction).where(Transaction.id == tx.id).options(selectinload(Transaction.category))
    res = await db.execute(stmt)
    return res.scalar_one()

@router.delete("/{tx_id}")
async def delete_transaction(
    tx_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    res = await db.execute(stmt)
    tx = res.scalar_one_or_none()

    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or unauthorized access"
        )

    await db.delete(tx)
    await db.commit()
    return {"message": "Transaction deleted successfully."}

@router.post("/import-csv", response_model=CSVImportResponse)
async def import_transactions_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    contents = await file.read()
    try:
        decoded = contents.decode("utf-8")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode CSV file. Please ensure it is in UTF-8 format."
        )

    csv_file = io.StringIO(decoded)
    reader = csv.reader(csv_file)

    # Read header row
    try:
        header = next(reader)
    except StopIteration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty"
        )

    # Map headers
    date_idx = desc_idx = amount_idx = debit_idx = credit_idx = -1
    for i, col in enumerate(header):
        col_lower = col.strip().lower()
        if col_lower in ("date", "transaction date", "value date"):
            date_idx = i
        elif col_lower in ("description", "narration", "remarks", "memo"):
            desc_idx = i
        elif col_lower in ("amount", "value"):
            amount_idx = i
        elif col_lower in ("debit", "withdrawal", "payment"):
            debit_idx = i
        elif col_lower in ("credit", "deposit", "receipt"):
            credit_idx = i

    # Validate header presence
    if desc_idx == -1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not locate Description/Narration column in CSV header."
        )
    if amount_idx == -1 and (debit_idx == -1 or credit_idx == -1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not locate Amount or Debit/Credit columns in CSV header."
        )
    if date_idx == -1:
        # Default to index 0 if not matched, or raise
        date_idx = 0

    # Retrieve all categories for linking predictions quickly
    cats_res = await db.execute(select(Category))
    all_categories = cats_res.scalars().all()
    category_map = {c.name: c.id for c in all_categories}

    total_parsed = 0
    total_imported = 0

    for row in reader:
        if not row or len(row) <= max(date_idx, desc_idx, amount_idx, debit_idx, credit_idx):
            continue

        total_parsed += 1
        raw_date = row[date_idx]
        raw_desc = row[desc_idx].strip()
        if not raw_desc:
            continue

        tx_date = parse_date(raw_date)

        # Parse type and amount
        tx_type = "expense"
        tx_amount = 0.0

        if amount_idx != -1:
            val = clean_amount(row[amount_idx])
            if val < 0:
                tx_type = "expense"
                tx_amount = abs(val)
            else:
                tx_type = "income"
                tx_amount = val
        else:
            # Check debit and credit
            debit_val = clean_amount(row[debit_idx]) if debit_idx != -1 else 0.0
            credit_val = clean_amount(row[credit_idx]) if credit_idx != -1 else 0.0

            if credit_val > 0.0:
                tx_type = "income"
                tx_amount = credit_val
            elif debit_val > 0.0:
                tx_type = "expense"
                tx_amount = debit_val
            else:
                continue

        # Predict Category
        predicted_name, confidence, flagged = predict_category(raw_desc)
        category_id = category_map.get(predicted_name)

        new_tx = Transaction(
            user_id=current_user.id,
            category_id=category_id,
            amount=tx_amount,
            transaction_date=tx_date,
            description=raw_desc,
            type=tx_type,
            source="csv",
            confidence_score=confidence,
            is_flagged=flagged
        )

        db.add(new_tx)
        total_imported += 1

    await db.commit()

    return {
        "message": f"Successfully parsed {total_parsed} rows and imported {total_imported} transactions.",
        "total_parsed": total_parsed,
        "total_imported": total_imported
    }
