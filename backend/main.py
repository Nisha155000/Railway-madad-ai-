from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from .routers import auth, complaints, admin, department
from .core.database import engine, Base, SessionLocal
from .core.security import hash_password
from .models.user import User, UserRole
from .models.complaint import Complaint, ComplaintCategory, ComplaintPriority, ComplaintStatus

Base.metadata.create_all(bind=engine)


def ensure_audio_column():
    with engine.begin() as connection:
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(complaints)")).fetchall()}
        if "audio_url" not in columns:
            connection.execute(text("ALTER TABLE complaints ADD COLUMN audio_url VARCHAR(500)"))


ensure_audio_column()

app = FastAPI(title="Rail Madad AI", description="AI-Powered Railway Complaint Management System", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000","http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(complaints.router, prefix="/complaints", tags=["Complaints"])
app.include_router(admin.router, prefix="/dashboard", tags=["Admin"])
app.include_router(department.router, prefix="/department", tags=["Department"])


def seed_demo_data():
    db: Session = SessionLocal()
    try:
        demo_users = [
            {"name": "Admin User", "email": "admin@railmadad.demo", "password": "admin123", "role": UserRole.admin, "department": None},
            {"name": "Passenger Demo", "email": "passenger@railmadad.demo", "password": "pass123", "role": UserRole.passenger, "department": None},
            {"name": "Housekeeping Staff", "email": "housekeeping@railmadad.demo", "password": "staff123", "role": UserRole.staff, "department": "Housekeeping"},
            {"name": "Catering Staff", "email": "catering@railmadad.demo", "password": "staff123", "role": UserRole.staff, "department": "Catering"},
            {"name": "RPF Staff", "email": "rpf@railmadad.demo", "password": "staff123", "role": UserRole.staff, "department": "RPF"},
            {"name": "Medical Staff", "email": "medical@railmadad.demo", "password": "staff123", "role": UserRole.staff, "department": "Medical Team"},
            {"name": "Electrical Staff", "email": "electrical@railmadad.demo", "password": "staff123", "role": UserRole.staff, "department": "Electrical Maintenance"},
        ]

        for demo_user in demo_users:
            user = db.query(User).filter(User.email == demo_user["email"]).first()
            if not user:
                db.add(User(
                    name=demo_user["name"],
                    email=demo_user["email"],
                    password_hash=hash_password(demo_user["password"]),
                    role=demo_user["role"],
                    department=demo_user["department"],
                ))
        db.commit()

        if not db.query(Complaint).first():
            passenger = db.query(User).filter(User.role == UserRole.passenger).first()
            
            # Helper to generate verification IDs
            def gen_verification_id():
                import random
                import datetime as dt
                year = dt.datetime.now().year
                random_num = random.randint(100000, 999999)
                return f"RM-{year}-{random_num}"
            
            samples = [
                Complaint(
                    user_id=passenger.id,
                    passenger_name="Rahul Sharma",
                    passenger_email=passenger.email,
                    pnr_number="4201234567",
                    train_number="12951",
                    coach_number="S3",
                    complaint_text="The coach is dirty and garbage is lying on the floor.",
                    category=ComplaintCategory.Cleanliness,
                    priority=ComplaintPriority.LOW,
                    department="Housekeeping",
                    confidence_score=91,
                    image_verification_status="Verified",
                    image_verified=True,
                    is_duplicate=False,
                    manual_review=False,
                    status=ComplaintStatus.Open,
                    verification_id=gen_verification_id(),
                ),
                Complaint(
                    user_id=passenger.id,
                    passenger_name="Priya Patel",
                    passenger_email=passenger.email,
                    pnr_number="4209876543",
                    train_number="12002",
                    coach_number="A1",
                    complaint_text="My bag was stolen and this is a serious security threat.",
                    category=ComplaintCategory.Security,
                    priority=ComplaintPriority.HIGH,
                    department="RPF",
                    confidence_score=95,
                    image_verification_status="Verified",
                    image_verified=True,
                    is_duplicate=False,
                    manual_review=False,
                    status=ComplaintStatus.InProgress,
                    verification_id=gen_verification_id(),
                ),
                Complaint(
                    user_id=passenger.id,
                    passenger_name="Amit Kumar",
                    passenger_email=passenger.email,
                    pnr_number="4205554321",
                    train_number="12259",
                    coach_number="B2",
                    complaint_text="Food served was stale and the water issue has not been fixed.",
                    category=ComplaintCategory.Catering,
                    priority=ComplaintPriority.MEDIUM,
                    department="Catering",
                    confidence_score=84,
                    image_verification_status="Needs Review",
                    image_verified=True,
                    is_duplicate=False,
                    manual_review=False,
                    status=ComplaintStatus.Open,
                    verification_id=gen_verification_id(),
                ),
                Complaint(
                    user_id=passenger.id,
                    passenger_name="Sunita Devi",
                    passenger_email=passenger.email,
                    pnr_number="4201112233",
                    train_number="12301",
                    coach_number="S5",
                    complaint_text="Passenger fainted and needs immediate medical help.",
                    category=ComplaintCategory.Medical,
                    priority=ComplaintPriority.HIGH,
                    department="Medical Team",
                    confidence_score=93,
                    image_verification_status="Verified",
                    image_verified=True,
                    is_duplicate=False,
                    manual_review=False,
                    status=ComplaintStatus.Open,
                    verification_id=gen_verification_id(),
                ),
                Complaint(
                    user_id=passenger.id,
                    passenger_name="Vikram Singh",
                    passenger_email=passenger.email,
                    pnr_number="4207778899",
                    train_number="12009",
                    coach_number="C1",
                    complaint_text="Lights are not working and the fan is broken.",
                    category=ComplaintCategory.Electrical,
                    priority=ComplaintPriority.MEDIUM,
                    department="Electrical Maintenance",
                    confidence_score=82,
                    image_verification_status="Suspicious",
                    image_verified=False,
                    is_duplicate=False,
                    manual_review=True,
                    status=ComplaintStatus.InProgress,
                    verification_id=gen_verification_id(),
                ),
            ]
            db.add_all(samples)
            db.commit()
    except OperationalError:
        db.rollback()
    finally:
        db.close()


seed_demo_data()

@app.get("/")
def root(): return {"message": "Rail Madad AI API", "version": "1.0.0", "status": "running"}

@app.get("/health")
def health(): return {"status": "ok"}
