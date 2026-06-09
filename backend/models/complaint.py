from sqlalchemy import Column, Integer, String, Text, Boolean, SmallInteger, DateTime, Date, Float, ForeignKey, Enum as PgEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..core.database import Base

class ComplaintCategory(str, enum.Enum):
    Cleanliness = "Cleanliness"
    Catering    = "Catering"
    Security    = "Security"
    Medical     = "Medical"
    Electrical  = "Electrical"
    Others      = "Others"

class ComplaintPriority(str, enum.Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"

class ComplaintStatus(str, enum.Enum):
    Pending    = "Pending"
    InProgress = "In Progress"
    Resolved   = "Resolved"

class Complaint(Base):
    __tablename__ = "complaints"
    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    passenger_name   = Column(String(120), nullable=False)
    passenger_email  = Column(String(255), nullable=False)
    pnr_number       = Column(String(10), nullable=False, index=True)
    train_number     = Column(String(10), nullable=False)
    coach_number     = Column(String(10), nullable=False)
    journey_date     = Column(Date, nullable=True)
    complaint_text   = Column(Text, nullable=False)
    image_url        = Column(String(500), nullable=True)
    category         = Column(PgEnum(ComplaintCategory, name="complaint_category"), nullable=True)
    priority         = Column(PgEnum(ComplaintPriority, name="complaint_priority"), nullable=True)
    department       = Column(String(100), nullable=True)
    confidence_score = Column(SmallInteger, nullable=True)
    image_verification_status = Column(String(30), nullable=True)
    image_verified   = Column(Boolean, default=False)
    is_duplicate     = Column(Boolean, default=False)
    manual_review    = Column(Boolean, default=False)
    status           = Column(PgEnum(ComplaintStatus, name="complaint_status"), nullable=False, default=ComplaintStatus.Pending)
    remarks          = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_at      = Column(DateTime(timezone=True), nullable=True)
    user             = relationship("User", back_populates="complaints")
    history          = relationship("ComplaintHistory", back_populates="complaint", cascade="all, delete")
    image_metadata   = relationship("ImageMetadata", back_populates="complaint", uselist=False, cascade="all, delete")

    @property
    def complaint_id(self) -> str:
        return f"RM-{self.id:06d}" if self.id is not None else "RM-NEW"

class ComplaintHistory(Base):
    __tablename__ = "complaint_history"
    id           = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status   = Column(PgEnum(ComplaintStatus, name="complaint_status"), nullable=True)
    new_status   = Column(PgEnum(ComplaintStatus, name="complaint_status"), nullable=False)
    updated_by   = Column(String(120), default="System")
    notes        = Column(Text, nullable=True)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now())
    complaint    = relationship("Complaint", back_populates="history")

class ImageMetadata(Base):
    __tablename__ = "image_metadata"
    id                = Column(Integer, primary_key=True, index=True)
    complaint_id      = Column(Integer, ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, unique=True)
    original_filename = Column(String(255))
    stored_path       = Column(String(500))
    mime_type         = Column(String(50))
    file_size_kb      = Column(Integer)
    phash             = Column(String(64), index=True)
    gps_lat           = Column(Float)
    gps_lng           = Column(Float)
    image_taken_at    = Column(DateTime(timezone=True))
    yolo_verified     = Column(Boolean, default=False)
    yolo_labels       = Column(JSON)
    yolo_confidence   = Column(Float)
    ela_score         = Column(Float)
    is_manipulated    = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    complaint         = relationship("Complaint", back_populates="image_metadata")
