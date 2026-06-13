# Technical Specifications - Complaint Verification Feature

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       COMPLAINT LIFECYCLE                        │
└─────────────────────────────────────────────────────────────────┘

1. REGISTRATION PHASE
   Passenger
      │
      ├─ Submit Complaint (POST /complaints/)
      │   ├─ Validation ✓
      │   ├─ AI Processing ✓
      │   ├─ Generate Verification ID (RM-YYYY-XXXXXX) ✓
      │   └─ Store in Database ✓
      │
      └─ Response: Complaint created with ID
         └─ Passenger views ID in Dashboard

2. ASSIGNMENT PHASE
   AI System
      │
      ├─ Analyze Category
      ├─ Assess Priority
      └─ Route to Department
         └─ Department staff sees new complaint

3. RESOLUTION PHASE
   Department Staff
      │
      ├─ Load Complaint (GET /complaints/{id})
      ├─ Work on Issue (Manual)
      └─ Mark as Resolved (POST /complaints/{id}/mark-resolved)
         │
         └─ Status: Open/In Progress → Awaiting Passenger Verification
            └─ History Record Created
            └─ Verification ID required next

4. VERIFICATION PHASE
   Department Staff + Passenger
      │
      ├─ Worker asks Passenger for Verification ID
      ├─ Passenger provides saved ID
      │
      └─ Staff enters ID (POST /complaints/verify)
         ├─ Compare: entered_id == database_id
         │
         ├─ IF MATCH:
         │  ├─ Status: Awaiting Passenger Verification → Closed
         │  ├─ Set closed_at timestamp
         │  ├─ Set verified_by_worker = true
         │  ├─ Create History Record
         │  ├─ Success Response
         │  └─ Audit Trail: ✓ Verified
         │
         └─ IF NO MATCH:
            ├─ Status remains unchanged
            ├─ Error Response
            ├─ No database updates
            └─ Audit Trail: ✗ Failed verification attempt
```

## API Contract

### 1. Generate Verification ID

**When**: During complaint creation  
**Who**: Backend (automatic)  
**Input**: Database session  
**Output**: Unique string `RM-YYYY-XXXXXX`

```
Algorithm:
1. Get current year
2. Generate random 6-digit number (100000-999999)
3. Format: RM-{YEAR}-{RANDOM}
4. Check database for duplicates
5. Retry if duplicate found
6. Return unique ID
```

### 2. Mark as Resolved Endpoint

**Endpoint**: `POST /complaints/{complaint_id}/mark-resolved`

**Authentication**: Required (Bearer token)

**Authorization**: Staff only, same department

**Query Parameters**:
```
remarks: string (optional)
```

**Success Response (200)**:
```json
{
  "id": 1,
  "complaint_id": "RM-2026-654321",
  "status": "Awaiting Passenger Verification",
  "remarks": "Marked as resolved, awaiting passenger verification",
  "verification_id": "RM-2026-654321",
  "verified_by_worker": false,
  "closed_at": null,
  "updated_at": "2026-06-12T10:15:30Z"
}
```

**Error Responses**:
- **403**: Not staff OR different department
  ```json
  {"detail": "Can only manage complaints assigned to your department"}
  ```
- **404**: Complaint not found
  ```json
  {"detail": "Complaint not found"}
  ```

### 3. Verify and Close Endpoint

**Endpoint**: `POST /complaints/verify`

**Authentication**: Required (Bearer token)

**Authorization**: Staff only, same department

**Request Body**:
```json
{
  "complaint_id": 1,
  "verification_id": "RM-2026-654321",
  "remarks": "Verified and approved for closure"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Complaint successfully verified and closed.",
  "complaint_id": 1,
  "status": "Closed",
  "closed_at": "2026-06-12T10:20:45Z"
}
```

**Failure Response (200 - Not an error HTTP status)**:
```json
{
  "success": false,
  "message": "Invalid Verification ID. Complaint cannot be closed.",
  "complaint_id": 1,
  "status": "Awaiting Passenger Verification",
  "closed_at": null
}
```

**Error Responses**:
- **403**: Not staff OR different department
  ```json
  {"detail": "Can only verify complaints assigned to your department"}
  ```
- **404**: Complaint not found
  ```json
  {"detail": "Complaint not found"}
  ```
- **400**: Wrong status
  ```json
  {"detail": "Complaint is not awaiting verification. Current status: Open"}
  ```

## Database Schema Changes

```sql
-- Updated complaints table
ALTER TABLE complaints MODIFY COLUMN status VARCHAR(50) NOT NULL;

ALTER TABLE complaints ADD COLUMN verification_id VARCHAR(50) 
  NOT NULL UNIQUE AFTER id;

ALTER TABLE complaints ADD COLUMN closed_at TIMESTAMP NULL 
  AFTER resolved_at;

ALTER TABLE complaints ADD COLUMN verified_by_worker BOOLEAN 
  DEFAULT FALSE AFTER closed_at;

-- Create indexes for performance
CREATE UNIQUE INDEX idx_verification_id ON complaints(verification_id);
CREATE INDEX idx_status_verification ON complaints(status, verification_id);

-- Enum constraints
ALTER TABLE complaints ADD CONSTRAINT check_status 
  CHECK (status IN ('Open', 'In Progress', 'Awaiting Passenger Verification', 'Closed'));
```

## Status State Machine

```
State Transitions:

┌──────────────────────────────────────────────────────────┐
│                   COMPLAINT STATES                        │
└──────────────────────────────────────────────────────────┘

[Open]
  ↓
  ├─ → [In Progress] (Optional, via admin/staff)
  │    ├─ → [Open] (Can revert)
  │    └─ → [Awaiting Passenger Verification]
  │         └─ → [Closed] (After verification)
  │         └─ → [In Progress] (If verification fails)
  │
  └─ → [Awaiting Passenger Verification]
       └─ → [Closed] (After verification)
       └─ → [Open] (If verification fails)

[Closed] - Terminal State (No transitions allowed)

Valid Transitions:
✓ Open → In Progress
✓ In Progress → Awaiting Passenger Verification
✓ Open → Awaiting Passenger Verification
✓ Awaiting Passenger Verification → Closed (on valid verification)
✓ Awaiting Passenger Verification → In Progress (on failed verification)

Invalid Transitions:
✗ Closed → Any state
✗ In Progress → Open
✗ Awaiting Passenger Verification → Open (direct)
```

## Verification Flow Chart

```
┌─ Complaint Status Check
│  ├─ Status = "Awaiting Passenger Verification"? ✓
│  └─ No? Return error 400
│
├─ Department Authorization Check
│  ├─ User.department = Complaint.department? ✓
│  └─ No? Return error 403
│
├─ Verification ID Comparison
│  ├─ upper(entered_id) = upper(stored_id)? 
│  │
│  ├─ YES:
│  │  ├─ complaint.status = "Closed"
│  │  ├─ complaint.closed_at = now()
│  │  ├─ complaint.verified_by_worker = true
│  │  ├─ Create History: "Closed" + remarks
│  │  ├─ Commit transaction
│  │  └─ Return success: true
│  │
│  └─ NO:
│     ├─ No database updates
│     └─ Return success: false
│
└─ Response to Frontend
```

## Audit Trail Integration

### History Record Format
```python
ComplaintHistory(
    complaint_id=complaint.id,
    old_status=ComplaintStatus.AwaitingPassengerVerification,
    new_status=ComplaintStatus.Closed,
    updated_by="housekeeping@railmadad.demo",
    notes=f"Verified and closed. {remarks or ''}",
    updated_at=datetime.utcnow()
)
```

### Audit Events Captured
1. **Complaint Created**: Status Open, ID generated
2. **Status Changed**: Any transition recorded
3. **Marked Resolved**: Transition to Awaiting Passenger Verification
4. **Verification Attempt (Success)**: Transition to Closed
5. **Verification Attempt (Failure)**: Recorded but status unchanged

## Frontend State Management

```javascript
// React State for Verification Feature
const [verificationModal, setVerificationModal] = useState(null);
const [verificationForm, setVerificationForm] = useState({
  verification_id: "",
  remarks: ""
});

// Derived States
const canMarkResolved = 
  deptComplaint?.status === "Open" || 
  deptComplaint?.status === "In Progress";

const canVerify = 
  deptComplaint?.status === "Awaiting Passenger Verification";

const isComplaintClosed = 
  deptComplaint?.status === "Closed";

// Event Handlers
const markComplaintResolved = async () => {
  // POST /complaints/{id}/mark-resolved
  // Update state on success
  // Show toast notification
};

const verifyAndCloseComplaint = async () => {
  // POST /complaints/verify
  // Handle success/failure responses
  // Update state
  // Show appropriate toast
};
```

## Error Handling

### Backend Error Codes
```
200 OK - Request successful (including successful/failed verification)
400 Bad Request - Invalid complaint status for operation
403 Forbidden - User not authorized (role/department mismatch)
404 Not Found - Complaint not found
500 Internal Server Error - Unexpected error

Example:
try:
    if not complaint:
        raise HTTPException(404, "Complaint not found")
    if complaint.department != current_user.department:
        raise HTTPException(403, "Access denied")
    if complaint.status != AwaitingPassengerVerification:
        raise HTTPException(400, "Invalid status for verification")
except HTTPException as e:
    return {"status": e.status_code, "detail": e.detail}
```

### Frontend Error Handling
```javascript
try {
    const result = await request("/complaints/verify", {
        method: "POST",
        token,
        json: verificationData
    });
    
    if (!result.success) {
        // Verification failed - show error toast
        showToast(setToast, result.message, "error");
        // Keep modal open for retry
        return;
    }
    
    // Verification succeeded
    showToast(setToast, result.message, "success");
    closeModal();
    
} catch (error) {
    // Network/server error
    showToast(setToast, error.message, "error");
}
```

## Performance Considerations

### Database Indexes
```sql
-- Improves verification lookup
CREATE UNIQUE INDEX idx_verification_id ON complaints(verification_id);

-- Improves queries by status and department
CREATE INDEX idx_status_dept ON complaints(status, department);

-- Improves user's complaint queries
CREATE INDEX idx_user_status ON complaints(user_id, status);
```

### Query Optimization
```python
# Avoid N+1 queries
complaints = db.query(Complaint)\
    .filter(Complaint.department == dept)\
    .joinedload(Complaint.history)\
    .joinedload(Complaint.image_metadata)\
    .all()
```

### Caching Suggestions
- Verification ID is unique and immutable (cache indefinitely)
- Complaint status changes frequently (short TTL or no cache)
- Department list is static (cache long-term)

## Testing Checklist

- [ ] Verification ID generated uniquely on complaint creation
- [ ] Verification ID visible to passenger only
- [ ] Mark as Resolved changes status correctly
- [ ] Verification endpoint validates ID case-insensitively
- [ ] Failed verification keeps complaint status unchanged
- [ ] Successful verification sets closed_at timestamp
- [ ] History records created for all transitions
- [ ] Department authorization enforced
- [ ] Frontend modal displays and closes correctly
- [ ] Toast notifications appear for success/failure
- [ ] Status badges update in real-time
- [ ] No unauthorized access to other department's complaints

## Future Enhancements

1. **SMS Verification**: Send verification ID via SMS to passenger
2. **Email Confirmation**: Email when complaint is closed
3. **Batch Verification**: Close multiple complaints at once
4. **Custom ID Format**: Configurable verification ID format
5. **Expiration**: Verification IDs expire after N days
6. **Rate Limiting**: Limit verification attempts
7. **Two-Factor**: Additional authorization step for closure
8. **Analytics**: Track closure success rate by department

---

**Version**: 1.0  
**Last Updated**: 2026-06-12  
**Maintained By**: Development Team
