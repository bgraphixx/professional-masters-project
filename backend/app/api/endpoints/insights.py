import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.core.insights import run_insights_engine
from app.db.session import get_db
from app.db.models import User, Insight
from app.schemas.schemas import InsightResponse

router = APIRouter()


@router.get("", response_model=List[InsightResponse])
async def get_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run the insights engine for the authenticated user, persist any new insights,
    and return the full feed (newest first, max 50 items).
    """
    insights = await run_insights_engine(current_user, db)

    # Reload with category relationship
    ids = [i.id for i in insights]
    stmt = (
        select(Insight)
        .where(Insight.id.in_(ids))
        .options(selectinload(Insight.category))
        .order_by(Insight.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{insight_id}/read", response_model=InsightResponse)
async def mark_insight_read(
    insight_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single insight as read."""
    stmt = (
        select(Insight)
        .where(Insight.id == insight_id, Insight.user_id == current_user.id)
        .options(selectinload(Insight.category))
    )
    result = await db.execute(stmt)
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found.")

    insight.is_read = True
    await db.commit()
    await db.refresh(insight)

    stmt = (
        select(Insight)
        .where(Insight.id == insight.id)
        .options(selectinload(Insight.category))
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/{insight_id}", status_code=status.HTTP_200_OK)
async def dismiss_insight(
    insight_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently dismiss (delete) an insight."""
    stmt = select(Insight).where(
        Insight.id == insight_id, Insight.user_id == current_user.id
    )
    result = await db.execute(stmt)
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found.")

    await db.delete(insight)
    await db.commit()
    return {"message": "Insight dismissed."}
