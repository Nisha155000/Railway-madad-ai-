from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as PgEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base

class UserRole(str, enum.Enum):
    passenger = "passenger"
    admin = "admin"
    staff = "staff"

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(120), nullable=False)
    email         = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(PgEnum(UserRole, name="user_role"), nullable=False, default=UserRole.passenger)
    department    = Column(String(100), nullable=True)
    phone         = Column(String(15), nullable=True)
    is_active     = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    complaints    = relationship("Complaint", back_populates="user")
