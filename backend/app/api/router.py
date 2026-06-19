from fastapi import APIRouter
from app.api.endpoints import auth, transactions, ml

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(ml.router, prefix="/ml", tags=["ml"])
