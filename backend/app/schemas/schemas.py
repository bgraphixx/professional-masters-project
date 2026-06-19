import uuid
from datetime import datetime
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
    full_name: float  # Wait, full_name is str, let's fix that!
    # Ah, let's write full_name: str. Good catch!
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
