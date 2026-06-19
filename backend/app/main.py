from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router

app = FastAPI(
    title="Personal Finance Tracker API",
    version="1.0.0",
    description="Backend API for Personal Finance Tracker with AI-Powered Budgeting Insights",
)

# Configure CORS for sharing session cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach routes
app.include_router(api_router)

from app.core.ml import load_model

@app.on_event("startup")
async def startup_event():
    load_model()

@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "service": "Personal Finance Tracker API",
        "version": "1.0.0"
    }
