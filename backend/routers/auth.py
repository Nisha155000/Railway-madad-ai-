from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import hash_password, verify_password, create_access_token
from ..models.user import User
from ..schemas.complaint import RegisterRequest, LoginRequest, TokenResponse

router = APIRouter()

DEMO_USERS = {
    "admin@railmadad.demo": {"password": "admin123", "name": "Admin User", "role": "admin", "department": None},
    "passenger@railmadad.demo": {"password": "pass123", "name": "Passenger Demo", "role": "passenger", "department": None},
    "housekeeping@railmadad.demo": {"password": "staff123", "name": "Housekeeping Staff", "role": "staff", "department": "Housekeeping"},
    "catering@railmadad.demo": {"password": "staff123", "name": "Catering Staff", "role": "staff", "department": "Catering"},
    "rpf@railmadad.demo": {"password": "staff123", "name": "RPF Staff", "role": "staff", "department": "RPF"},
    "medical@railmadad.demo": {"password": "staff123", "name": "Medical Staff", "role": "staff", "department": "Medical Team"},
    "electrical@railmadad.demo": {"password": "staff123", "name": "Electrical Staff", "role": "staff", "department": "Electrical Maintenance"},
}


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if body.role == "staff" and not body.department:
        raise HTTPException(status_code=400, detail="Department is required for staff accounts")

    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        department=body.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        role=user.role,
        department=user.department,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    demo_user = DEMO_USERS.get(body.email)
    if demo_user and body.password == demo_user["password"]:
        if not user:
            user = User(
                name=demo_user["name"],
                email=body.email,
                password_hash=hash_password(demo_user["password"]),
                role=demo_user["role"],
                department=demo_user["department"],
            )
            db.add(user)
        else:
            user.name = demo_user["name"]
            user.role = demo_user["role"]
            user.department = demo_user["department"]
            user.password_hash = hash_password(demo_user["password"])
        db.commit()
        db.refresh(user)
    elif not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        role=user.role,
        department=user.department,
    )
