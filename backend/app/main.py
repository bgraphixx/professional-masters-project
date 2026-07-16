from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core.ml import load_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown logic."""
    # Startup — load ML model pipeline
    load_model()
    yield
    # Shutdown — nothing to teardown currently


app = FastAPI(
    title="Personal Finance Tracker API",
    version="1.0.0",
    description="Backend API for NairaAI — Personal Finance Tracker with AI-Powered Budgeting Insights",
    lifespan=lifespan,
)

# GZip compression for responses > 1 KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — credentials required for session cookie sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach all API routes
app.include_router(api_router)


@app.get("/", tags=["health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "Personal Finance Tracker API",
        "version": "1.0.0",
    }
