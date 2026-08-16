import io
import csv
import uuid
import re
from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import pdfplumber

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Transaction, Category, Budget
from app.schemas.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    CSVImportResponse,
    CategoryResponse,
    TransactionReportResponse,
)
from app.core.ml import predict_category
from app.api.endpoints.budgets import _enrich_budget

router = APIRouter()

def parse_date(date_str: str) -> date:
    date_str = date_str.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y", "%d-%b-%Y", "%d-%b-%y", "%d %B %Y", "%d-%B-%Y"):
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

@router.get("/report", response_model=TransactionReportResponse)
async def get_monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Monthly summary: total income/expense, net savings, per-category
    breakdown, and budget utilisation for the given month/year."""
    first_day = date(year, month, 1)
    last_day = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    stmt = (
        select(Transaction)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= first_day,
            Transaction.transaction_date < last_day,
        )
        .options(selectinload(Transaction.category))
    )
    result = await db.execute(stmt)
    transactions = result.scalars().all()

    total_income = 0.0
    total_expense = 0.0
    category_breakdown: dict = {}

    for tx in transactions:
        amount = float(tx.amount)
        # Self-transfers (savings apps, fixed deposits) move money between
        # the user's own accounts rather than earning or spending it, so
        # they're excluded from income/expense totals — but still shown in
        # the category breakdown for visibility.
        is_internal_transfer = tx.category is not None and tx.category.type == "transfer"
        if not is_internal_transfer:
            if tx.type == "income":
                total_income += amount
            else:
                total_expense += amount
        cat_name = tx.category.name if tx.category else "Uncategorized"
        category_breakdown[cat_name] = category_breakdown.get(cat_name, 0.0) + amount

    budgets_stmt = (
        select(Budget)
        .where(Budget.user_id == current_user.id, Budget.month == month, Budget.year == year)
        .options(selectinload(Budget.category))
        .order_by(Budget.id)
    )
    budgets_result = await db.execute(budgets_stmt)
    budgets = budgets_result.scalars().all()
    budget_utilisation = [await _enrich_budget(b, db) for b in budgets]

    return TransactionReportResponse(
        month=month,
        year=year,
        total_income=round(total_income, 2),
        total_expense=round(total_expense, 2),
        net_savings=round(total_income - total_expense, 2),
        category_breakdown={k: round(v, 2) for k, v in category_breakdown.items()},
        budget_utilisation=budget_utilisation,
    )

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
    # A category the user typed in themselves is a real human label; one
    # predict_category() guesses is not, until the user reviews/edits it.
    category_confirmed = category_id is not None

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
        is_flagged=is_flagged,
        category_confirmed=category_confirmed
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

    # Special handling: if category is manually overridden, set confidence score to 100%,
    # unflag, and mark it as a human-confirmed label for future retraining.
    if tx_in.category_id is not None:
        tx.category_id = tx_in.category_id
        tx.confidence_score = 1.00
        tx.is_flagged = False
        tx.category_confirmed = True

    await db.commit()
    await db.refresh(tx)

    # Reload relationship
    stmt = select(Transaction).where(Transaction.id == tx.id).options(selectinload(Transaction.category))
    res = await db.execute(stmt)
    return res.scalar_one()

@router.delete("/all")
async def delete_all_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(Transaction).where(Transaction.user_id == current_user.id)
    await db.execute(stmt)
    await db.commit()
    return {"message": "All transactions deleted successfully."}

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

@router.post("/import-pdf", response_model=CSVImportResponse)
async def import_transactions_pdf(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    bank: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    contents = await file.read()
    try:
        pdf = pdfplumber.open(io.BytesIO(contents), password=password or "")
    except Exception as e:
        err_str = str(e).lower()
        if "password" in err_str or "encrypt" in err_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This PDF is password protected. Please provide the correct password."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read PDF file: {str(e)}"
        )

    header = None
    date_idx = desc_idx = amount_idx = debit_idx = credit_idx = -1
    rows_to_process = []
    
    # Text-based parsing for statements without table borders (e.g. OPay)
    opay_transactions = []
    opay_start_pattern = re.compile(r'^(\d{2} [a-zA-Z]{3} \d{4} \d{2}:\d{2}:\d{2})\s+(\d{2} [a-zA-Z]{3} \d{4})(?:\s+(.*))?$')
    opay_end_pattern = re.compile(r'(.*?\s+)?([\d,\.\-]+|--)\s+([\d,\.\-]+|--)\s+([\d,\.\-]+|--)\s+([A-Za-z]+)\s*(\d*)$')
    
    with pdf:
        for page in pdf.pages:
            # Try parsing raw text for known borderless formats first
            text = page.extract_text()
            if text:
                current_tx = None
                for line in text.split('\n'):
                    line = line.strip()
                    if not line: continue
                    start_match = opay_start_pattern.match(line)
                    if start_match:
                        if current_tx and current_tx['debit'] is not None:
                            opay_transactions.append(current_tx)
                        current_tx = {'date': start_match.group(2), 'desc': start_match.group(3) or "", 'debit': None, 'credit': None}
                        end_match = opay_end_pattern.search(current_tx['desc'])
                        if end_match:
                            desc = end_match.group(1) or ""
                            current_tx['desc'] = current_tx['desc'][:end_match.start()] + desc
                            current_tx['debit'] = end_match.group(2)
                            current_tx['credit'] = end_match.group(3)
                    elif current_tx and current_tx['debit'] is None:
                        end_match = opay_end_pattern.search(line)
                        if end_match:
                            desc = end_match.group(1) or ""
                            current_tx['desc'] += " " + line[:end_match.start()] + desc
                            current_tx['debit'] = end_match.group(2)
                            current_tx['credit'] = end_match.group(3)
                        else:
                            current_tx['desc'] += " " + line
                if current_tx and current_tx['debit'] is not None:
                    opay_transactions.append(current_tx)

            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    clean_row = [str(c).replace('\n', ' ').strip() if c is not None else "" for c in row]
                    if not any(clean_row):
                        continue
                        
                    if header is None:
                        row_lower = [c.lower() for c in clean_row]
                        has_date = any(x in c for x in ["date"] for c in row_lower)
                        has_desc = any(x in c for x in ["description", "narration", "remarks", "details", "memo"] for c in row_lower)
                        if has_date and has_desc:
                            header = clean_row
                            for i, col in enumerate(row_lower):
                                if "date" in col:
                                    date_idx = i
                                elif any(x in col for x in ("description", "narration", "remarks", "details", "memo")):
                                    desc_idx = i
                                elif any(x in col for x in ("amount", "value", "balance")): 
                                    if "balance" not in col or "amount" in col:
                                        amount_idx = i
                                elif any(x in col for x in ("debit", "withdrawal", "payment")):
                                    debit_idx = i
                                elif any(x in col for x in ("credit", "deposit", "receipt")):
                                    credit_idx = i
                        continue
                    else:
                        rows_to_process.append(clean_row)

    # Use OPay parsed transactions if we successfully matched its unique text pattern
    if len(opay_transactions) > 0 and (bank == 'opay' or not bank or len(rows_to_process) == 0):
        header = True  # bypass header check
        date_idx, desc_idx, debit_idx, credit_idx, amount_idx = 0, 1, 2, 3, -1
        rows_to_process = [[tx['date'], tx['desc'].strip(), tx['debit'], tx['credit']] for tx in opay_transactions]

    if header is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not locate a valid transaction table in the PDF."
        )

    if desc_idx == -1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not locate Description/Narration column in the PDF table."
        )
    if amount_idx == -1 and (debit_idx == -1 or credit_idx == -1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not locate Amount or Debit/Credit columns in the PDF table."
        )
    if date_idx == -1:
        date_idx = 0

    cats_res = await db.execute(select(Category))
    all_categories = cats_res.scalars().all()
    category_map = {c.name: c.id for c in all_categories}

    total_parsed = 0
    total_imported = 0

    for row in rows_to_process:
        if len(row) <= max(date_idx, desc_idx, amount_idx, debit_idx, credit_idx):
            continue

        total_parsed += 1
        raw_date = row[date_idx]
        raw_desc = row[desc_idx].strip()
        if not raw_desc:
            continue

        tx_date = parse_date(raw_date)

        tx_type = "expense"
        tx_amount = 0.0

        if amount_idx != -1:
            val = clean_amount(row[amount_idx])
            if val < 0:
                tx_type = "expense"
                tx_amount = abs(val)
            elif val > 0:
                tx_type = "income"
                tx_amount = val
            else:
                continue
        else:
            debit_val = clean_amount(row[debit_idx]) if debit_idx != -1 and debit_idx < len(row) else 0.0
            credit_val = clean_amount(row[credit_idx]) if credit_idx != -1 and credit_idx < len(row) else 0.0

            if credit_val > 0.0:
                tx_type = "income"
                tx_amount = credit_val
            elif debit_val > 0.0:
                tx_type = "expense"
                tx_amount = debit_val
            else:
                continue

        predicted_name, confidence, flagged = predict_category(raw_desc)
        category_id = category_map.get(predicted_name)

        new_tx = Transaction(
            user_id=current_user.id,
            category_id=category_id,
            amount=tx_amount,
            transaction_date=tx_date,
            description=raw_desc,
            type=tx_type,
            source="pdf",
            confidence_score=confidence,
            is_flagged=flagged
        )

        db.add(new_tx)
        total_imported += 1

    await db.commit()

    return {
        "message": f"Successfully extracted {total_parsed} rows and imported {total_imported} transactions from PDF.",
        "total_parsed": total_parsed,
        "total_imported": total_imported
    }

