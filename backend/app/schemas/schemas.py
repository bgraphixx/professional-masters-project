import uuid
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    monthly_income: float = Field(default=0.0, ge=0.0)
    profession: Optional[str] = Field(default=None, max_length=100)
    consent_given: bool = Field(default=False)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)


class AccountSelfUpdate(BaseModel):
    """Fields a user may self-update via PATCH /auth/me. Deliberately excludes
    email and password — those go through their own dedicated flows."""
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    monthly_income: Optional[float] = Field(default=None, ge=0.0)
    profession: Optional[str] = Field(default=None, max_length=100)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    monthly_income: float
    profession: Optional[str] = None
    consent_given: bool
    consent_date: Optional[datetime] = None
    is_admin: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MessageResponse(BaseModel):
    message: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    is_default: bool


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(income|expense)$")


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0.0)
    transaction_date: Optional[date] = None
    description: str = Field(..., min_length=1, max_length=500)
    type: str = Field(..., pattern="^(income|expense)$")
    source: Optional[str] = Field(default="manual", pattern="^(manual|csv)$")
    category_id: Optional[uuid.UUID] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0.0)
    transaction_date: Optional[date] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    type: Optional[str] = Field(default=None, pattern="^(income|expense)$")
    category_id: Optional[uuid.UUID] = None
    is_flagged: Optional[bool] = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    amount: float
    transaction_date: date
    description: str
    type: str
    source: str
    confidence_score: float
    is_flagged: bool
    category: Optional[CategoryResponse] = None


class MLCategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)


class MLCategorizeResponse(BaseModel):
    predicted_category: str
    confidence_score: float
    is_flagged: bool


class CSVImportResponse(BaseModel):
    message: str
    total_parsed: int
    total_imported: int


class MLTrainResponse(BaseModel):
    status: str
    default_samples: int
    user_samples: int
    total_samples: int
    message: str


# ── Budget Schemas ──────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    category_id: uuid.UUID
    limit_amount: float = Field(..., gt=0.0)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)


class BudgetUpdate(BaseModel):
    limit_amount: float = Field(..., gt=0.0)


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    category_id: uuid.UUID
    limit_amount: float
    month: int
    year: int
    category: Optional[CategoryResponse] = None
    # Computed fields populated by the endpoint
    spent_amount: float = 0.0
    percent_used: float = 0.0
    is_breached: bool = False


# ── Report Schemas ───────────────────────────────────────────────────────────

class TransactionReportResponse(BaseModel):
    month: int
    year: int
    total_income: float
    total_expense: float
    net_savings: float
    category_breakdown: dict[str, float]
    budget_utilisation: List[BudgetResponse]


# ── Insight Schemas ─────────────────────────────────────────────────────────

class InsightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    insight_type: str
    message: str
    related_category_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: datetime
    category: Optional[CategoryResponse] = None


# ── Admin Schemas ────────────────────────────────────────────────────────────

class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    created_at: datetime
    status: str
    transaction_count: int


class AdminUserListResponse(BaseModel):
    total: int
    skip: int
    limit: int
    users: List[AdminUserResponse]


class AdminMLMetricsResponse(BaseModel):
    train_samples: Optional[int] = None
    validation_samples: Optional[int] = None
    test_samples: Optional[int] = None
    train_accuracy: Optional[float] = None
    validation_accuracy: Optional[float] = None
    test_accuracy: Optional[float] = None
    total_training_corpus_size: Optional[int] = None
    trained_at: Optional[str] = None
    model_file_timestamp: Optional[datetime] = None
    model_file_size_bytes: Optional[int] = None
