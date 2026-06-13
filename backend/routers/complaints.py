import os
import shutil
import uuid
import random
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..core.security import get_current_user
from ..models.complaint import Complaint, ComplaintHistory, ComplaintStatus, ImageMetadata
from ..models.user import User, UserRole
from ..schemas.complaint import ComplaintOut, ComplaintUpdate, VerifyComplaintRequest, VerifyComplaintResponse
from ..services.ai_service import (
    compute_phash,
    run_ai_pipeline,
    run_ela_analysis,
    run_yolo_detection,
)

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────

def _generate_verification_id(db: Session) -> str:
    """Generate unique Complaint Verification ID (RM-YYYY-XXXXXX)."""
    import datetime as dt
    year = dt.datetime.now().year
    while True:
        random_num = random.randint(100000, 999999)
        verification_id = f"RM-{year}-{random_num}"
        if not db.query(Complaint).filter(Complaint.verification_id == verification_id).first():
            return verification_id


def _save_image(file: UploadFile) -> tuple[str, bytes]:
    """Persist upload to disk, return (url_path, raw_bytes)."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext      = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest     = os.path.join(settings.UPLOAD_DIR, filename)
    raw      = file.file.read()
    with open(dest, "wb") as f:
        f.write(raw)
    return f"/uploads/{filename}", raw


def _existing_hashes(db: Session) -> list[str]:
    rows = db.query(ImageMetadata.phash).filter(ImageMetadata.phash.isnot(None)).all()
    return [r.phash for r in rows]


def _add_history(db: Session, complaint: Complaint, new_status: ComplaintStatus,
                 updated_by: str = "System", notes: str = None):
    db.add(ComplaintHistory(
        complaint_id=complaint.id,
        old_status=complaint.status,
        new_status=new_status,
        updated_by=updated_by,
        notes=notes,
    ))


def _resolve_public_complaint_id(complaint_code: str) -> int | None:
    code = complaint_code.strip().upper()
    if code.startswith("RM-"):
        suffix = code.split("-", 1)[1]
        if suffix.isdigit():
            return int(suffix)
    if code.isdigit():
        return int(code)
    return None


# ── POST /complaints ──────────────────────────────────────────

@router.post("/", response_model=ComplaintOut, status_code=201)
async def submit_complaint(
    passenger_name:  str        = Form(...),
    passenger_email: Optional[str] = Form(None),
    pnr_number:      str        = Form(...),
    train_number:    str        = Form(...),
    coach_number:    Optional[str] = Form(None),
    complaint_text:  str        = Form(...),
    journey_date:    Optional[str] = Form(None),
    image:           Optional[UploadFile] = File(None),
    db:              Session    = Depends(get_db),
    current_user:    User       = Depends(get_current_user),
):
    # Validate image type if provided
    image_url, image_bytes = None, None
    if image and image.filename:
        if image.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG/PNG/WEBP images allowed")
        image_url, image_bytes = _save_image(image)

    # Run AI pipeline
    ai = await run_ai_pipeline(complaint_text, image_bytes, _existing_hashes(db))

    # Generate unique verification ID
    verification_id = _generate_verification_id(db)

    # Persist complaint
    complaint = Complaint(
        user_id=current_user.id,
        passenger_name=passenger_name,
        passenger_email=passenger_email or current_user.email,
        pnr_number=pnr_number,
        train_number=train_number,
        coach_number=coach_number or "-",
        complaint_text=complaint_text,
        image_url=image_url,
        category=ai.category,
        priority=ai.priority,
        department=ai.department,
        confidence_score=ai.confidence_score,
        image_verification_status=ai.image_verification_status,
        image_verified=ai.image_verified,
        is_duplicate=ai.is_duplicate,
        manual_review=ai.manual_review,
        status=ComplaintStatus.Open,
        verification_id=verification_id,
    )
    db.add(complaint)
    db.flush()  # get complaint.id before history insert

    _add_history(db, complaint, ComplaintStatus.Open, updated_by="AI System")

    # Persist image metadata
    if image_bytes:
        phash = compute_phash(image_bytes)
        yolo_ok, yolo_labels, yolo_conf = run_yolo_detection(image_bytes)
        ela_score, is_manip = run_ela_analysis(image_bytes)
        db.add(ImageMetadata(
            complaint_id=complaint.id,
            original_filename=image.filename,
            stored_path=image_url,
            mime_type=image.content_type,
            file_size_kb=len(image_bytes) // 1024,
            phash=phash,
            yolo_verified=yolo_ok,
            yolo_labels=yolo_labels,
            yolo_confidence=yolo_conf,
            ela_score=ela_score,
            is_manipulated=is_manip,
        ))

    db.commit()
    db.refresh(complaint)
    return complaint


# ── POST /complaints/verify ──────────────────────────────────

@router.post("/verify", response_model=VerifyComplaintResponse)
def verify_and_close_complaint(
    body: VerifyComplaintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify complaint using Verification ID and close if valid."""
    if current_user.role != UserRole.staff:
        raise HTTPException(status_code=403, detail="Only department staff can verify complaints")
    
    complaint = db.query(Complaint).filter(Complaint.id == body.complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if complaint.department != current_user.department:
        raise HTTPException(status_code=403, detail="Can only verify complaints assigned to your department")
    
    if complaint.status != ComplaintStatus.AwaitingPassengerVerification:
        raise HTTPException(
            status_code=400,
            detail=f"Complaint is not awaiting verification. Current status: {complaint.status}"
        )
    
    # Verify the ID
    if complaint.verification_id.strip().upper() != body.verification_id.strip().upper():
        return VerifyComplaintResponse(
            success=False,
            message="Invalid Verification ID. Complaint cannot be closed.",
            complaint_id=complaint.id,
            status=complaint.status,
            closed_at=complaint.closed_at
        )
    
    # ID matches - close the complaint
    _add_history(db, complaint, ComplaintStatus.Closed,
                 updated_by=current_user.name,
                 notes=f"Verified and closed. {body.remarks or ''}")
    complaint.status = ComplaintStatus.Closed
    complaint.closed_at = datetime.utcnow()
    complaint.verified_by_worker = True
    complaint.remarks = body.remarks or complaint.remarks
    
    db.commit()
    db.refresh(complaint)
    
    return VerifyComplaintResponse(
        success=True,
        message="Complaint successfully verified and closed.",
        complaint_id=complaint.id,
        status=complaint.status,
        closed_at=complaint.closed_at
    )


# ── GET /complaints ───────────────────────────────────────────

@router.get("/", response_model=List[ComplaintOut])
def list_complaints(
    status:   Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search:   Optional[str] = Query(None),
    skip:     int = Query(0, ge=0),
    limit:    int = Query(50, le=200),
    db:       Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Complaint)

    # Passengers see only their own complaints
    if current_user.role == "passenger":
        q = q.filter(Complaint.user_id == current_user.id)
    elif current_user.role == "staff":
        q = q.filter(Complaint.department == current_user.department)

    if status:
        q = q.filter(Complaint.status == status)
    if priority:
        q = q.filter(Complaint.priority == priority)
    if category:
        q = q.filter(Complaint.category == category)
    if search:
        q = q.filter(Complaint.complaint_text.ilike(f"%{search}%"))

    return q.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()


# ── GET /complaints/{id} ──────────────────────────────────────

@router.get("/code/{complaint_code}", response_model=ComplaintOut)
def get_complaint_by_code(
    complaint_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint_id = _resolve_public_complaint_id(complaint_code)
    if complaint_id is None:
        raise HTTPException(status_code=400, detail="Invalid complaint ID")
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "passenger" and complaint.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return complaint


@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint(
    complaint_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role == "passenger" and complaint.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return complaint


# ── PUT /complaints/{id} ──────────────────────────────────────

@router.put("/{complaint_id}", response_model=ComplaintOut)
def update_complaint(
    complaint_id: int,
    body:         ComplaintUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin only")

    if body.status and body.status != complaint.status:
        _add_history(db, complaint, body.status,
                     updated_by=current_user.name, notes=body.remarks)
        complaint.status = body.status
        complaint.remarks = body.remarks or complaint.remarks
        if body.status == ComplaintStatus.Resolved:
            from datetime import datetime
            complaint.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(complaint)
    return complaint


# ── DELETE /complaints/{id} ───────────────────────────────────

@router.delete("/{complaint_id}", status_code=204)
def delete_complaint(
    complaint_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    # Remove stored image file
    if complaint.image_url:
        path = complaint.image_url.lstrip("/")
        if os.path.exists(path):
            os.remove(path)
    db.delete(complaint)
    db.commit()


# ── POST /complaints/{id}/mark-resolved ──────────────────────

@router.post("/{complaint_id}/mark-resolved", response_model=ComplaintOut)
def mark_complaint_resolved(
    complaint_id: int,
    remarks: str = Query(""),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Mark complaint as resolved by department staff."""
    if current_user.role != UserRole.staff:
        raise HTTPException(status_code=403, detail="Only department staff can mark as resolved")
    
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if complaint.department != current_user.department:
        raise HTTPException(status_code=403, detail="Can only manage complaints assigned to your department")
    
    # Update status to Awaiting Passenger Verification
    _add_history(db, complaint, ComplaintStatus.AwaitingPassengerVerification,
                 updated_by=current_user.name, notes=remarks or "Marked as resolved, awaiting passenger verification")
    complaint.status = ComplaintStatus.AwaitingPassengerVerification
    complaint.remarks = remarks or complaint.remarks
    
    db.commit()
    db.refresh(complaint)
    return complaint


# ── POST /complaints/verify ──────────────────────────────────

@router.post("/verify", response_model=VerifyComplaintResponse)
def verify_and_close_complaint(
    body: VerifyComplaintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify complaint using Verification ID and close if valid."""
    if current_user.role != UserRole.staff:
        raise HTTPException(status_code=403, detail="Only department staff can verify complaints")
    
    complaint = db.query(Complaint).filter(Complaint.id == body.complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if complaint.department != current_user.department:
        raise HTTPException(status_code=403, detail="Can only verify complaints assigned to your department")
    
    if complaint.status != ComplaintStatus.AwaitingPassengerVerification:
        raise HTTPException(
            status_code=400,
            detail=f"Complaint is not awaiting verification. Current status: {complaint.status}"
        )
    
    # Verify the ID
    if complaint.verification_id.strip().upper() != body.verification_id.strip().upper():
        return VerifyComplaintResponse(
            success=False,
            message="Invalid Verification ID. Complaint cannot be closed.",
            complaint_id=complaint.id,
            status=complaint.status,
            closed_at=complaint.closed_at
        )
    
    # ID matches - close the complaint
    _add_history(db, complaint, ComplaintStatus.Closed,
                 updated_by=current_user.name,
                 notes=f"Verified and closed. {body.remarks or ''}")
    complaint.status = ComplaintStatus.Closed
    complaint.closed_at = datetime.utcnow()
    complaint.verified_by_worker = True
    complaint.remarks = body.remarks or complaint.remarks
    
    db.commit()
    db.refresh(complaint)
    
    return VerifyComplaintResponse(
        success=True,
        message="Complaint successfully verified and closed.",
        complaint_id=complaint.id,
        status=complaint.status,
        closed_at=complaint.closed_at
    )
