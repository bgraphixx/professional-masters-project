from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:postgres@db:5432/finance_tracker")
    JWT_SECRET_KEY: str = Field(default="dev_secret_key_nigerian_personal_finance_tracker_2026_jwt_token_key_32")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    COOKIE_NAME: str = "session_token"
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    FRONTEND_URL: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False
    ENVIRONMENT: str = "development"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
