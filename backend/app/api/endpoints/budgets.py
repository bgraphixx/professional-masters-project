import uuid
from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Budget, Transaction
from app.schemas.schemas import BudgetCreate, BudgetUpdate, BudgetResponse

router = APIRouter()


async def _enrich_budget(budget: Budget, db: AsyncSession) -> BudgetResponse:
    """Attach computed spent_amount / percent_used / is_breached to a Budget ORM row."""
    # Sum all expense transactions for this user + category in the budget's month/year
    first_day = date(budget.year, budget.month, 1)
    # last day of month
    if budget.month == 12:
        last_day = date(budget.year + 1, 1, 1)
    else:
        last_day = date(budget.year, budget.month + 1, 1)

    stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == budget.user_id,
        Transaction.category_id == budget.category_id,
        Transaction.type == "expense",
        Transaction.transaction_date >= first_day,
        Transaction.transaction_date < last_day,
    )
    result = await db.execute(stmt)
    spent = float(result.scalar_one())
    limit = float(budget.limit_amount)
    percent = round((spent / limit) * 100, 1) if limit > 0 else 0.0

    data = BudgetResponse.model_validate(budget)
    data.spent_amount = spent
    data.percent_used = percent
    data.is_breached = spent >= limit
    return data


# Safety cap on how many months a single request can backfill for one series,
# in case a recurring budget is very old and a far-future month is requested.
_MAX_GENERATE_MONTHS = 36


def _period(month: int, year: int) -> int:
    return year * 12 + month


def _month_year_from_period(period: int) -> tuple[int, int]:
    year, month0 = divmod(period - 1, 12)
    return month0 + 1, year


async def _materialize_recurring_budgets(
    user_id: uuid.UUID, target_month: int, target_year: int, db: AsyncSession
) -> None:
    """Ensure every active recurring series has a row up to (target_month, target_year)."""
    target_period = _period(target_month, target_year)

    stmt = (
        select(Budget)
        .where(Budget.user_id == user_id, Budget.series_id.isnot(None))
        .order_by(Budget.series_id, Budget.year.desc(), Budget.month.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    latest_by_series: dict[uuid.UUID, Budget] = {}
    for row in rows:
        latest_by_series.setdefault(row.series_id, row)  # first seen per series = latest, per ordering above

    created = False
    for series_id, latest in latest_by_series.items():
        if not latest.is_recurring:
            continue
        latest_period = _period(latest.month, latest.year)
        if latest_period >= target_period:
            continue

        months_to_fill = min(target_period - latest_period, _MAX_GENERATE_MONTHS)
        for offset in range(1, months_to_fill + 1):
            month, year = _month_year_from_period(latest_period + offset)
            exists_stmt = select(Budget.id).where(
                Budget.user_id == user_id,
                Budget.category_id == latest.category_id,
                Budget.month == month,
                Budget.year == year,
            )
            if (await db.execute(exists_stmt)).scalar_one_or_none():
                continue  # a manual override already occupies this month
            db.add(Budget(
                user_id=user_id,
                category_id=latest.category_id,
                limit_amount=latest.limit_amount,
                month=month,
                year=year,
                is_recurring=True,
                series_id=series_id,
            ))
            created = True

    if created:
        await db.commit()


@router.get("", response_model=List[BudgetResponse])
async def get_budgets(
    month: int = None,
    year: int = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all budgets for the current user, optionally filtered by month/year."""
    today = date.today()
    m = month or today.month
    y = year or today.year

    await _materialize_recurring_budgets(current_user.id, m, y, db)

    stmt = (
        select(Budget)
        .where(Budget.user_id == current_user.id, Budget.month == m, Budget.year == y)
        .options(selectinload(Budget.category))
        .order_by(Budget.id)
    )
    result = await db.execute(stmt)
    budgets = result.scalars().all()
    return [await _enrich_budget(b, db) for b in budgets]


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_in: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a budget for a category in a given month/year. Prevents duplicates."""
    # Check for duplicate
    stmt = select(Budget).where(
        Budget.user_id == current_user.id,
        Budget.category_id == budget_in.category_id,
        Budget.month == budget_in.month,
        Budget.year == budget_in.year,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A budget for this category and month already exists.",
        )

    new_id = uuid.uuid4()
    new_budget = Budget(
        id=new_id,
        user_id=current_user.id,
        category_id=budget_in.category_id,
        limit_amount=budget_in.limit_amount,
        month=budget_in.month,
        year=budget_in.year,
        is_recurring=budget_in.is_recurring,
        # A recurring budget is its own series head; future months auto-generate off it.
        series_id=new_id if budget_in.is_recurring else None,
    )
    db.add(new_budget)
    await db.commit()
    await db.refresh(new_budget)

    # Reload with category
    stmt = select(Budget).where(Budget.id == new_budget.id).options(selectinload(Budget.category))
    result = await db.execute(stmt)
    budget = result.scalar_one()
    return await _enrich_budget(budget, db)


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    budget_in: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the limit_amount (and optionally is_recurring) of an existing budget.

    Past months are untouched, preserving history. Setting is_recurring=False
    stops the series from this month forward: any already-generated future
    rows in the same series are removed so the change takes effect regardless
    of which month's row the user happens to be editing.
    """
    stmt = (
        select(Budget)
        .where(Budget.id == budget_id, Budget.user_id == current_user.id)
        .options(selectinload(Budget.category))
    )
    result = await db.execute(stmt)
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found.")

    budget.limit_amount = budget_in.limit_amount
    if budget_in.is_recurring is not None:
        if budget_in.is_recurring and budget.series_id is None:
            budget.series_id = budget.id  # turning a one-time budget into a series head
        elif not budget_in.is_recurring and budget.series_id is not None:
            this_period = _period(budget.month, budget.year)
            future_stmt = select(Budget).where(
                Budget.series_id == budget.series_id,
                Budget.id != budget.id,
            )
            future_rows = (await db.execute(future_stmt)).scalars().all()
            for row in future_rows:
                if _period(row.month, row.year) > this_period:
                    await db.delete(row)
        budget.is_recurring = budget_in.is_recurring
    await db.commit()
    await db.refresh(budget)

    stmt = select(Budget).where(Budget.id == budget.id).options(selectinload(Budget.category))
    result = await db.execute(stmt)
    budget = result.scalar_one()
    return await _enrich_budget(budget, db)


@router.delete("/{budget_id}", status_code=status.HTTP_200_OK)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a budget."""
    stmt = select(Budget).where(Budget.id == budget_id, Budget.user_id == current_user.id)
    result = await db.execute(stmt)
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found.")

    await db.delete(budget)
    await db.commit()
    return {"message": "Budget deleted successfully."}
