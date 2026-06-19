from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.db.models import User
from app.schemas.schemas import MLCategorizeRequest, MLCategorizeResponse
from app.core.ml import predict_category

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
