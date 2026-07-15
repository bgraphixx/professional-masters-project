"""
Insights Engine — Sprint 5
Generates structured Insight rows using four rule types:
  1. Budget Alerts       — spending vs limit thresholds
  2. Trend Analysis      — month-over-month category spend spikes
  3. Recommendations     — savings rate below healthy threshold
  4. Anomaly Detection   — single transaction far above personal average
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Budget, Insight, Transaction, User


MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


async def _generate_budget_alerts(
    user: User, today: date, db: AsyncSession
) -> List[Insight]:
    """Rule 1 — warn at 80 %, alert at 100 %."""
    insights: List[Insight] = []

    budgets_res = await db.execute(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.month == today.month,
            Budget.year == today.year,
        )
    )
    budgets = budgets_res.scalars().all()

    for budget in budgets:
        first_day = date(budget.year, budget.month, 1)
        last_day = (
            date(budget.year + 1, 1, 1)
            if budget.month == 12
            else date(budget.year, budget.month + 1, 1)
        )
        spent_res = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user.id,
                Transaction.category_id == budget.category_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= first_day,
                Transaction.transaction_date < last_day,
            )
        )
        spent = float(spent_res.scalar_one())
        limit = float(budget.limit_amount)
        if limit <= 0:
            continue

        ratio = spent / limit
        month_name = MONTH_NAMES[today.month - 1]

        # Fetch category name
        from app.db.models import Category
        cat_res = await db.execute(select(Category).where(Category.id == budget.category_id))
        cat = cat_res.scalar_one_or_none()
        cat_name = cat.name if cat else "Unknown"

        if ratio >= 1.0:
            insights.append(
                Insight(
                    user_id=user.id,
                    insight_type="alert",
                    message=(
                        f"Budget breached for {cat_name} in {month_name}: "
                        f"you have spent ₦{spent:,.0f} against a ₦{limit:,.0f} limit "
                        f"({ratio * 100:.0f}%)."
                    ),
                    related_category_id=budget.category_id,
                )
            )
        elif ratio >= 0.8:
            insights.append(
                Insight(
                    user_id=user.id,
                    insight_type="alert",
                    message=(
                        f"Approaching budget limit for {cat_name} in {month_name}: "
                        f"₦{spent:,.0f} of ₦{limit:,.0f} used ({ratio * 100:.0f}%)."
                    ),
                    related_category_id=budget.category_id,
                )
            )

    return insights


async def _generate_trend_insights(
    user: User, today: date, db: AsyncSession
) -> List[Insight]:
    """Rule 2 — month-over-month category spend spikes > 30 %."""
    insights: List[Insight] = []

    # Current month bounds
    cur_first = date(today.year, today.month, 1)
    cur_last = (
        date(today.year + 1, 1, 1)
        if today.month == 12
        else date(today.year, today.month + 1, 1)
    )

    # Previous month bounds
    if today.month == 1:
        prev_first = date(today.year - 1, 12, 1)
        prev_last = date(today.year, 1, 1)
    else:
        prev_first = date(today.year, today.month - 1, 1)
        prev_last = cur_first

    # Aggregate by category for both months
    async def _spend_by_cat(from_d: date, to_d: date):
        res = await db.execute(
            select(Transaction.category_id, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user.id,
                Transaction.type == "expense",
                Transaction.transaction_date >= from_d,
                Transaction.transaction_date < to_d,
                Transaction.category_id.is_not(None),
            )
            .group_by(Transaction.category_id)
        )
        return {row[0]: float(row[1]) for row in res.all()}

    cur_spend = await _spend_by_cat(cur_first, cur_last)
    prev_spend = await _spend_by_cat(prev_first, prev_last)

    from app.db.models import Category

    for cat_id, cur_amt in cur_spend.items():
        prev_amt = prev_spend.get(cat_id, 0.0)
        if prev_amt <= 0:
            continue
        change_pct = ((cur_amt - prev_amt) / prev_amt) * 100
        if change_pct >= 30:
            cat_res = await db.execute(select(Category).where(Category.id == cat_id))
            cat = cat_res.scalar_one_or_none()
            cat_name = cat.name if cat else "a category"
            insights.append(
                Insight(
                    user_id=user.id,
                    insight_type="trend",
                    message=(
                        f"Spending on {cat_name} is up {change_pct:.0f}% compared to last month "
                        f"(₦{prev_amt:,.0f} → ₦{cur_amt:,.0f})."
                    ),
                    related_category_id=cat_id,
                )
            )

    return insights


async def _generate_recommendations(
    user: User, today: date, db: AsyncSession
) -> List[Insight]:
    """Rule 3 — flag low savings rate (< 20 % of declared monthly income)."""
    insights: List[Insight] = []

    monthly_income = float(user.monthly_income or 0)
    if monthly_income <= 0:
        return insights

    cur_first = date(today.year, today.month, 1)
    cur_last = (
        date(today.year + 1, 1, 1)
        if today.month == 12
        else date(today.year, today.month + 1, 1)
    )

    expense_res = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
            Transaction.transaction_date >= cur_first,
            Transaction.transaction_date < cur_last,
        )
    )
    total_expense = float(expense_res.scalar_one())
    net_savings = monthly_income - total_expense
    savings_rate = (net_savings / monthly_income) * 100

    if savings_rate < 20:
        month_name = MONTH_NAMES[today.month - 1]
        insights.append(
            Insight(
                user_id=user.id,
                insight_type="recommendation",
                message=(
                    f"Your savings rate for {month_name} is {savings_rate:.1f}%, "
                    f"below the recommended 20%. Consider reducing discretionary spending "
                    f"to save at least ₦{monthly_income * 0.2:,.0f} this month."
                ),
            )
        )

    return insights


async def _generate_anomalies(
    user: User, today: date, db: AsyncSession
) -> List[Insight]:
    """Rule 4 — single transaction > 3× the user's average expense transaction."""
    insights: List[Insight] = []

    # Overall average expense amount for this user
    avg_res = await db.execute(
        select(func.avg(Transaction.amount)).where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
        )
    )
    avg_amount = float(avg_res.scalar_one() or 0)
    if avg_amount <= 0:
        return insights

    threshold = avg_amount * 3

    # Look at transactions in the last 30 days
    from datetime import timedelta
    lookback = today - timedelta(days=30)

    anomalies_res = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
            Transaction.amount >= threshold,
            Transaction.transaction_date >= lookback,
        )
    )
    anomalies = anomalies_res.scalars().all()

    for tx in anomalies:
        insights.append(
            Insight(
                user_id=user.id,
                insight_type="alert",
                message=(
                    f"Unusual expense detected: ₦{float(tx.amount):,.0f} on "
                    f'"{tx.description}" ({tx.transaction_date}). '
                    f"This is {float(tx.amount) / avg_amount:.1f}x your average expense of ₦{avg_amount:,.0f}."
                ),
                related_category_id=tx.category_id,
            )
        )

    return insights


async def run_insights_engine(user: User, db: AsyncSession) -> List[Insight]:
    """
    Execute all four rule engines, deduplicate against existing un-read insights,
    persist new ones, and return the full sorted feed.
    """
    today = date.today()

    # Collect new insights from all rules
    new_insights: List[Insight] = []
    new_insights.extend(await _generate_budget_alerts(user, today, db))
    new_insights.extend(await _generate_trend_insights(user, today, db))
    new_insights.extend(await _generate_recommendations(user, today, db))
    new_insights.extend(await _generate_anomalies(user, today, db))

    # Deduplicate by message text against existing unread insights
    existing_res = await db.execute(
        select(Insight.message).where(Insight.user_id == user.id, Insight.is_read == False)  # noqa: E712
    )
    existing_messages = {row[0] for row in existing_res.all()}

    for insight in new_insights:
        if insight.message not in existing_messages:
            db.add(insight)
            existing_messages.add(insight.message)

    await db.commit()

    # Return full feed (read + unread), newest first
    feed_res = await db.execute(
        select(Insight)
        .where(Insight.user_id == user.id)
        .order_by(Insight.created_at.desc())
        .limit(50)
    )
    return feed_res.scalars().all()
