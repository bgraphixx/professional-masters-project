import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    monthly_income: float = Field(default=0.0, ge=0.0)
    consent_given: bool = Field(default=False)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=100)
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    monthly_income: Optional[float] = Field(default=None, ge=0.0)
    consent_given: Optional[bool] = None

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    monthly_income: float
    consent_given: bool
    consent_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class MessageResponse(BaseModel):
    message: str

class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    is_default: bool

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True

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

    class Config:
        from_attributes = True

# ── Insight Schemas ─────────────────────────────────────────────────────────

class InsightResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    insight_type: str
    message: str
    related_category_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: datetime
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True
