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

    new_budget = Budget(
        user_id=current_user.id,
        category_id=budget_in.category_id,
        limit_amount=budget_in.limit_amount,
        month=budget_in.month,
        year=budget_in.year,
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
    """Update the limit_amount of an existing budget."""
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
