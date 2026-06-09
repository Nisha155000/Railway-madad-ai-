from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.complaint import Complaint, ComplaintHistory, ComplaintStatus
from ..models.user import User, UserRole
from ..schemas.complaint import ComplaintOut, DepartmentStatusUpdate

router = APIRouter()


def _resolve_public_complaint_id(complaint_code: str) -> int | None:
    code = complaint_code.strip().upper()
    if code.startswith("RM-"):
        suffix = code.split("-", 1)[1]
        if suffix.isdigit():
            return int(suffix)
    if code.isdigit():
        return int(code)
    return None


def _add_history(db: Session, complaint: Complaint, new_status: ComplaintStatus, updated_by: str, remarks: str | None):
    db.add(ComplaintHistory(
        complaint_id=complaint.id,
        old_status=complaint.status,
        new_status=new_status,
        updated_by=updated_by,
        notes=remarks,
    ))


@router.get("/complaints", response_model=list[ComplaintOut])
def department_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.staff:
        raise HTTPException(status_code=403, detail="Staff access required")
    if not current_user.department:
        raise HTTPException(status_code=400, detail="Staff department not configured")
    return (
        db.query(Complaint)
        .filter(Complaint.department == current_user.department)
        .order_by(Complaint.created_at.desc())
        .all()
    )


@router.put("/update-status", response_model=ComplaintOut)
def department_update_status(
    body: DepartmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.staff:
        raise HTTPException(status_code=403, detail="Staff access required")
    if not current_user.department:
        raise HTTPException(status_code=400, detail="Staff department not configured")

    complaint_id = _resolve_public_complaint_id(body.complaint_id)
    if complaint_id is None:
        raise HTTPException(status_code=400, detail="Invalid complaint ID")

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if complaint.department != current_user.department:
        raise HTTPException(status_code=403, detail="Complaint not assigned to your department")

    if body.status and body.status != complaint.status:
        _add_history(db, complaint, body.status, current_user.name, body.remarks)
        complaint.status = body.status
        complaint.remarks = body.remarks or complaint.remarks
        if body.status == ComplaintStatus.Resolved:
            complaint.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(complaint)
    return complaint
