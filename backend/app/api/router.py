from fastapi import APIRouter
from app.api.endpoints import auth, transactions, ml, budgets, insights, admin

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(ml.router, prefix="/ml", tags=["ml"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["budgets"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
