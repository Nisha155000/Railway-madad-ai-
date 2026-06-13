# File Changes Reference

## Detailed Changes by File

### 1. backend/models/complaint.py

**Location**: Lines 15-22 (Status Enum)
```python
# BEFORE:
class ComplaintStatus(str, enum.Enum):
    Pending    = "Pending"
    InProgress = "In Progress"
    Resolved   = "Resolved"

# AFTER:
class ComplaintStatus(str, enum.Enum):
    Open                           = "Open"
    InProgress                     = "In Progress"
    AwaitingPassengerVerification  = "Awaiting Passenger Verification"
    Closed                         = "Closed"
```

**Location**: Lines 25-50 (Complaint Class)
```python
# ADDED FIELDS:
verification_id  = Column(String(50), unique=True, nullable=False, index=True)
closed_at        = Column(DateTime(timezone=True), nullable=True)
verified_by_worker = Column(Boolean, default=False)

# MODIFIED:
status = Column(PgEnum(ComplaintStatus, name="complaint_status"), 
                nullable=False, default=ComplaintStatus.Open)  # Changed from Pending
```

---

### 2. backend/routers/complaints.py

**Location**: Lines 1-10 (Imports)
```python
# ADDED:
import random
from datetime import datetime
from ..schemas.complaint import VerifyComplaintRequest, VerifyComplaintResponse
```

**Location**: Lines 23-37 (New Function)
```python
# ADDED:
def _generate_verification_id(db: Session) -> str:
    """Generate unique Complaint Verification ID (RM-YYYY-XXXXXX)."""
    import datetime as dt
    year = dt.datetime.now().year
    while True:
        random_num = random.randint(100000, 999999)
        verification_id = f"RM-{year}-{random_num}"
        if not db.query(Complaint).filter(Complaint.verification_id == verification_id).first():
            return verification_id
```

**Location**: Lines 105-130 (Update submit_complaint)
```python
# ADDED (before db.add(complaint)):
verification_id = _generate_verification_id(db)

# MODIFIED complaint creation:
complaint = Complaint(
    ...
    status=ComplaintStatus.Open,  # Changed from Pending
    verification_id=verification_id,  # NEW
)
```

**Location**: Lines 300-400 (New Endpoints)
```python
# ADDED:
@router.post("/{complaint_id}/mark-resolved", response_model=ComplaintOut)
def mark_complaint_resolved(
    complaint_id: int,
    remarks: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark complaint as resolved by department staff."""
    if current_user.role != UserRole.staff:
        raise HTTPException(status_code=403, detail="Only department staff can mark as resolved")
    
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    if complaint.department != current_user.department:
        raise HTTPException(status_code=403, detail="Can only manage complaints assigned to your department")
    
    _add_history(db, complaint, ComplaintStatus.AwaitingPassengerVerification,
                 updated_by=current_user.name, notes=remarks or "Marked as resolved, awaiting passenger verification")
    complaint.status = ComplaintStatus.AwaitingPassengerVerification
    complaint.remarks = remarks or complaint.remarks
    
    db.commit()
    db.refresh(complaint)
    return complaint


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
```

---

### 3. backend/schemas/complaint.py

**Location**: Lines 50-65 (Update ComplaintOut)
```python
# MODIFIED:
class ComplaintOut(BaseModel):
    ...
    verification_id: str  # ADDED
    closed_at: Optional[datetime] = None  # ADDED
    verified_by_worker: bool = False  # ADDED
    ...

# ADDED after ComplaintOut:
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
```

---

### 4. backend/main.py

**Location**: Lines 60-100 (Update Demo Data)
```python
# ADDED helper function inside seed_demo_data():
def gen_verification_id():
    import random
    import datetime as dt
    year = dt.datetime.now().year
    random_num = random.randint(100000, 999999)
    return f"RM-{year}-{random_num}"

# MODIFIED each complaint sample:
samples = [
    Complaint(
        ...
        status=ComplaintStatus.Open,  # Changed from Pending
        verification_id=gen_verification_id(),  # ADDED
    ),
    ...
]
```

---

### 5. frontend/src/App.jsx

**Location**: Line 6 (Status Options)
```javascript
// BEFORE:
const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];

// AFTER:
const STATUS_OPTIONS = ["Open", "In Progress", "Awaiting Passenger Verification", "Closed"];
```

**Location**: Line 62-65 (Add State)
```javascript
// ADDED:
const [verificationModal, setVerificationModal] = useState(null);
const [verificationForm, setVerificationForm] = useState({ verification_id: "", remarks: "" });
```

**Location**: Lines 240-300 (Add Handlers)
```javascript
// ADDED:
async function markComplaintResolved() {
  try {
    if (!deptComplaint) {
      throw new Error("Load a complaint first");
    }
    const updated = await request(`/complaints/${deptComplaint.id}/mark-resolved?remarks=Marked+as+resolved`, {
      method: "POST",
      token,
    });
    setDeptComplaint(updated);
    setComplaints((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    showToast(setToast, "Complaint marked as resolved. Awaiting passenger verification.");
    setStatusUpdate({ status: "Awaiting Passenger Verification", remarks: "" });
  } catch (error) {
    showToast(setToast, error.message, "error");
  }
}

async function verifyAndCloseComplaint() {
  try {
    if (!deptComplaint) {
      throw new Error("Load a complaint first");
    }
    if (!verificationForm.verification_id.trim()) {
      throw new Error("Enter verification ID");
    }
    const result = await request("/complaints/verify", {
      method: "POST",
      token,
      json: {
        complaint_id: deptComplaint.id,
        verification_id: verificationForm.verification_id,
        remarks: verificationForm.remarks,
      },
    });

    if (!result.success) {
      showToast(setToast, result.message, "error");
      return;
    }

    const updated = await request(`/complaints/${deptComplaint.id}`, { token });
    setDeptComplaint(updated);
    setComplaints((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    showToast(setToast, "Complaint successfully verified and closed.", "success");
    setVerificationModal(null);
    setVerificationForm({ verification_id: "", remarks: "" });
  } catch (error) {
    showToast(setToast, error.message, "error");
  }
}
```

**Location**: Lines 360-375 (Update DepartmentDashboard Call)
```javascript
// MODIFIED:
{page === "department" && user?.role === "staff" && (
  <DepartmentDashboard
    departmentName={user.department}
    complaints={departmentComplaints.filter((item) => item.department === user.department)}
    deptComplaintCode={deptComplaintCode}
    deptComplaint={deptComplaint}
    statusUpdate={statusUpdate}
    verificationModal={verificationModal}  # ADDED
    verificationForm={verificationForm}  # ADDED
    onCodeChange={setDeptComplaintCode}
    onLoadComplaint={loadDepartmentComplaint}
    onStatusUpdate={setStatusUpdate}
    onSubmitStatus={updateDepartmentStatus}
    onMarkResolved={markComplaintResolved}  # ADDED
    onVerificationModalOpen={() => setVerificationModal(true)}  # ADDED
    onVerificationModalClose={() => setVerificationModal(null)}  # ADDED
    onVerificationFormChange={setVerificationForm}  # ADDED
    onVerifyAndClose={verifyAndCloseComplaint}  # ADDED
  />
)}
```

**Location**: Lines 1500-1550 (Update ComplaintDetail)
```javascript
// MODIFIED signature:
function ComplaintDetail({ complaint, showVerificationId = false }) {
  return (
    <div className="detail-card">
      ...
      {showVerificationId && complaint.verification_id && (
        <div className="detail-row" style={{ backgroundColor: "#e8f5e9", padding: "8px", borderRadius: "4px" }}>
          <span>Verification ID</span>
          <strong style={{ color: "#2e7d32", fontSize: "1.1em" }}>{complaint.verification_id}</strong>
        </div>
      )}
      ...
    </div>
  );
}
```

**Location**: Lines 1320-1335 (Update Passenger Dashboard - Track Complaint)
```javascript
// MODIFIED:
{trackedComplaint ? (
  <ComplaintDetail complaint={trackedComplaint} showVerificationId={true} />  # ADDED showVerificationId
) : (
  <p className="muted">Enter an ID to check status.</p>
)}
```

**Location**: Lines 1370-1550 (Replace DepartmentDashboard Component)
```javascript
// COMPLETELY REWRITTEN - See TECHNICAL_SPECIFICATIONS.md for full component code
// Key additions:
// - Mark as Resolved button
// - Conditional rendering based on status
// - Verification modal dialog
// - New state management
// - Toast notifications
```

---

### 6. frontend/src/styles.css

**Location**: End of file (Added ~100 lines)
```css
/* ADDED: Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: var(--surface-strong);
  border-radius: 12px;
  box-shadow: var(--shadow);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.3rem;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.6rem;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: color-mix(in srgb, var(--text) 12%, transparent);
  color: var(--text);
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid var(--border);
}

/* ADDED: Status badge styles */
.status-awaiting-passenger-verification {
  background: var(--warn-bg);
  color: var(--warn-text);
}

.status-closed {
  background: var(--good-bg);
  color: var(--good-text);
}
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Files Modified | 6 |
| New Functions | 2 (Backend: _generate_verification_id, mark_complaint_resolved, verify_and_close_complaint) |
| New Schemas | 2 (VerifyComplaintRequest, VerifyComplaintResponse) |
| Database Fields Added | 3 (verification_id, closed_at, verified_by_worker) |
| Status Values | 4 (Open, In Progress, Awaiting Passenger Verification, Closed) |
| API Endpoints Added | 2 (/mark-resolved, /verify) |
| Frontend State Variables | 2 (verificationModal, verificationForm) |
| Frontend Handlers | 2 (markComplaintResolved, verifyAndCloseComplaint) |
| CSS Classes Added | 10+ (modal, close-btn, status badges, etc.) |
| Documentation Files | 4 (Guides + Technical Specs) |

---

**Version**: 1.0  
**Date**: 2026-06-12  
**Status**: Ready for Testing
