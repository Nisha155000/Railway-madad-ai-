from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
from ..models.complaint import ComplaintCategory, ComplaintPriority, ComplaintStatus
from ..models.user import UserRole

class RegisterRequest(BaseModel):
    name: str; email: EmailStr; password: str; role: UserRole = UserRole.passenger; department: Optional[str] = None
    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6: raise ValueError("Password must be at least 6 characters")
        return v

class LoginRequest(BaseModel):
    email: EmailStr; password: str

class TokenResponse(BaseModel):
    access_token: str; token_type: str = "bearer"; user_id: int; name: str; role: UserRole; department: Optional[str] = None

class AIAnalysisResult(BaseModel):
    category: ComplaintCategory; priority: ComplaintPriority; department: str
    confidence_score: int; image_verified: bool; is_duplicate: bool; manual_review: bool
    image_verification_status: str

class ComplaintCreate(BaseModel):
    passenger_name: str; passenger_email: EmailStr; pnr_number: str
    train_number: str; coach_number: str; journey_date: Optional[date] = None; complaint_text: str

class ComplaintUpdate(BaseModel):
    status: Optional[ComplaintStatus] = None; remarks: Optional[str] = None

class DepartmentStatusUpdate(BaseModel):
    complaint_id: str; status: ComplaintStatus; remarks: Optional[str] = None

class HistoryOut(BaseModel):
    id: int; old_status: Optional[ComplaintStatus]; new_status: ComplaintStatus
    updated_by: Optional[str]; notes: Optional[str]; updated_at: datetime
    model_config = {"from_attributes": True}

class ImageMetaOut(BaseModel):
    phash: Optional[str]; yolo_verified: bool; yolo_labels: Optional[List[str]]
    ela_score: Optional[float]; is_manipulated: bool
    model_config = {"from_attributes": True}

class ComplaintOut(BaseModel):
    id: int; complaint_id: str; passenger_name: str; passenger_email: str; pnr_number: str
    train_number: str; coach_number: str; complaint_text: str; image_url: Optional[str]
    category: Optional[ComplaintCategory]; priority: Optional[ComplaintPriority]
    department: Optional[str]; confidence_score: Optional[int]; image_verification_status: Optional[str]
    image_verified: bool; is_duplicate: bool; manual_review: bool; status: ComplaintStatus; remarks: Optional[str] = None; created_at: datetime
    verification_id: str; closed_at: Optional[datetime] = None; verified_by_worker: bool = False
    history: List[HistoryOut] = []; image_metadata: Optional[ImageMetaOut] = None
    model_config = {"from_attributes": True}

class VerifyComplaintRequest(BaseModel):
    complaint_id: int
    verification_id: str
    remarks: Optional[str] = None

class VerifyComplaintResponse(BaseModel):
    success: bool
    message: str
    complaint_id: int
    status: ComplaintStatus
    closed_at: Optional[datetime] = None

class DashboardStats(BaseModel):
    total_complaints: int; pending_complaints: int; resolved_complaints: int
    high_priority_count: int; manual_review_count: int; resolution_rate_pct: float

class CategoryCount(BaseModel):
    category: str; count: int

class PriorityCount(BaseModel):
    priority: str; count: int

class MonthlyPoint(BaseModel):
    month: str; total: int

class DepartmentStat(BaseModel):
    department: str; total: int; resolved: int; high: int

class AnalyticsOut(BaseModel):
    category_distribution: List[CategoryCount]; priority_distribution: List[PriorityCount]
    monthly_trend: List[MonthlyPoint]; department_stats: List[DepartmentStat]
