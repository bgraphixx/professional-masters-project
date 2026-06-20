from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Transaction
from app.schemas.schemas import MLCategorizeRequest, MLCategorizeResponse, MLTrainResponse
from app.core.ml import predict_category, retrain_model

router = APIRouter()

@router.post("/categorise", response_model=MLCategorizeResponse)
async def categorize_transaction_text(
    payload: MLCategorizeRequest,
    current_user: User = Depends(get_current_user)
):
    predicted_category, confidence, flagged = predict_category(payload.description)
    return {
        "predicted_category": predicted_category,
        "confidence_score": confidence,
        "is_flagged": flagged
    }

@router.post("/train", response_model=MLTrainResponse)
async def train_model_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Query all transactions where category_id is present, joined with category name
    stmt = (
        select(Transaction)
        .where(Transaction.category_id.isnot(None))
        .options(selectinload(Transaction.category))
    )
    result = await db.execute(stmt)
    transactions = result.scalars().all()

    # Format user transactions for training
    user_labeled_data = []
    for tx in transactions:
        if tx.category:
            user_labeled_data.append((tx.description, tx.category.name))

    # Retrain
    default_count, user_count = retrain_model(user_labeled_data)

    return {
        "status": "success",
        "default_samples": default_count,
        "user_samples": user_count,
        "total_samples": default_count + user_count,
        "message": f"Successfully retrained the model with {default_count} default samples and {user_count} user samples."
    }

