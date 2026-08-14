import json
import os
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin
from app.db.session import get_db
from app.db.models import Category, Transaction, User
from app.schemas.schemas import (
    AdminMLMetricsResponse,
    AdminUserListResponse,
    AdminUserResponse,
    CategoryCreate,
    CategoryResponse,
)

router = APIRouter()


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    skip: int = 0,
    limit: int = 50,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of users for account oversight, with transaction counts."""
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    stmt = (
        select(User, func.count(Transaction.id).label("transaction_count"))
        .outerjoin(Transaction, Transaction.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    users = [
        AdminUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            created_at=user.created_at,
            status="active",
            transaction_count=tx_count,
        )
        for user, tx_count in rows
    ]

    return AdminUserListResponse(total=total, skip=skip, limit=limit, users=users)


@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Category).order_by(Category.name.asc()))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: CategoryCreate,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (
        await db.execute(select(Category).where(Category.name == category_in.name))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists.",
        )

    new_category = Category(name=category_in.name, type=category_in.type, is_default=False)
    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)
    return new_category


@router.get("/ml/metrics", response_model=AdminMLMetricsResponse)
async def get_ml_metrics(
    _admin: User = Depends(get_current_admin),
):
    """Surface the train/validation/test accuracy figures produced by the last
    seed script run, plus basic stats about the deployed model artifact."""
    current_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    model_dir = os.path.join(current_dir, "ml", "artifacts")
    metrics_path = os.path.join(model_dir, "metrics.json")
    model_path = os.path.join(model_dir, "model.joblib")

    data = {}
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            data = json.load(f)

    if os.path.exists(model_path):
        stat = os.stat(model_path)
        data["model_file_timestamp"] = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
        data["model_file_size_bytes"] = stat.st_size

    return AdminMLMetricsResponse(**data)
