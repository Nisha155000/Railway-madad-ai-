# Complaint Closure Verification Feature - Implementation Guide

## Overview
This document outlines the implementation of the secure complaint closure verification mechanism for the RailMadad AI system. The feature ensures that only passengers who raised complaints can authorize their closure through a unique Verification ID system.

## Implementation Summary

### 1. Database Changes

#### Updated Complaint Model (`backend/models/complaint.py`)
- **New Status Enum Values**: `Open`, `In Progress`, `Awaiting Passenger Verification`, `Closed`
- **New Fields**:
  - `verification_id` (VARCHAR(50), UNIQUE, NOT NULL, INDEXED) - Unique verification ID (Format: RM-YYYY-XXXXXX)
  - `closed_at` (TIMESTAMP, NULL) - Timestamp when complaint was closed
  - `verified_by_worker` (BOOLEAN, DEFAULT FALSE) - Flag indicating verification status
  - Updated default `status` from `Pending` to `Open`

### 2. Backend API Endpoints

#### New Endpoints Added

##### 1. **POST `/complaints/{id}/mark-resolved`**
- **Purpose**: Department staff marks complaint as resolved
- **Access**: Department staff only (role = "staff")
- **Parameters**: 
  - `complaint_id`: ID of complaint to mark as resolved
  - `remarks`: Optional remarks
- **Logic**:
  - Validates user is staff and complaint belongs to their department
  - Changes status to `Awaiting Passenger Verification`
  - Creates history record
  - Returns updated complaint

##### 2. **POST `/complaints/verify`**
- **Purpose**: Verify complaint using passenger verification ID and close it
- **Access**: Department staff only
- **Request Body**:
  ```json
  {
    "complaint_id": 123,
    "verification_id": "RM-2026-123456",
    "remarks": "Optional remarks"
  }
  ```
- **Response**:
  ```json
  {
    "success": true/false,
    "message": "Complaint successfully verified and closed." or "Invalid Verification ID. Complaint cannot be closed.",
    "complaint_id": 123,
    "status": "Closed",
    "closed_at": "2026-06-12T10:30:00Z"
  }
  ```
- **Logic**:
  - Validates user is staff and complaint belongs to their department
  - Checks complaint status is `Awaiting Passenger Verification`
  - Compares entered verification ID with stored ID (case-insensitive)
  - If match: Changes status to `Closed`, sets `closed_at`, marks `verified_by_worker=true`
  - If mismatch: Returns failure message, keeps status unchanged
  - Creates history record for audit trail

### 3. Verification ID Generation

#### Algorithm (`backend/routers/complaints.py`)
```python
def _generate_verification_id(db: Session) -> str:
    """Generate unique Complaint Verification ID (RM-YYYY-XXXXXX)."""
    import random
    import datetime as dt
    year = dt.datetime.now().year
    while True:
        random_num = random.randint(100000, 999999)
        verification_id = f"RM-{year}-{random_num}"
        if not db.query(Complaint).filter(Complaint.verification_id == verification_id).first():
            return verification_id
```

- Format: `RM-YYYY-XXXXXX` (e.g., `RM-2026-123456`)
- Uniqueness: Checked against database
- Auto-generated on complaint creation
- Visible to passenger and assigned department only

### 4. Frontend Changes

#### UI Components Updated

##### 1. **Status Options**
```javascript
const STATUS_OPTIONS = ["Open", "In Progress", "Awaiting Passenger Verification", "Closed"];
```

##### 2. **Passenger Dashboard - Track Complaint**
- Displays `Verification ID` prominently in green box
- Message shown: "Please save this Verification ID. It will be required to close the complaint after resolution."
- Only visible to the complaint owner (passenger)

##### 3. **Department Dashboard - Manage Complaint**
New workflow:
1. Load complaint by ID
2. If status is "Open" or "In Progress":
   - Display "Mark as Resolved" button
   - Clicking changes status to "Awaiting Passenger Verification"
3. If status is "Awaiting Passenger Verification":
   - Display "Enter Passenger Verification ID" button
   - Opens modal dialog
4. Modal dialog allows staff to:
   - Enter passenger's verification ID
   - Add optional remarks
   - Submit to verify and close

##### 4. **Verification Modal**
- **Title**: "Verify & Close Complaint"
- **Fields**:
  - Complaint ID (read-only display)
  - Passenger Verification ID (required input)
  - Remarks (optional textarea)
- **Buttons**: Cancel, Verify & Close
- **Success**: Shows notification and closes complaint
- **Failure**: Shows error message, keeps complaint in "Awaiting Passenger Verification" state

#### State Management
```javascript
const [verificationModal, setVerificationModal] = useState(null);
const [verificationForm, setVerificationForm] = useState({ 
  verification_id: "", 
  remarks: "" 
});
```

#### Handlers Added
- `markComplaintResolved()` - Marks complaint as resolved
- `verifyAndCloseComplaint()` - Verifies ID and closes complaint
- `onVerificationFormChange()` - Updates verification form fields

### 5. Workflow Demonstration

#### Complete User Journey

**Phase 1: Complaint Registration**
1. Passenger submits complaint
2. System generates unique ID (e.g., RM-2026-654321)
3. AI auto-assigns to department
4. Passenger sees message: "Save this Verification ID: RM-2026-654321"

**Phase 2: Department Resolution**
1. Assigned department staff views complaint
2. Completes repair/resolution work
3. Clicks "Mark as Resolved" button
4. Complaint status: Open → Awaiting Passenger Verification

**Phase 3: Passenger Verification**
1. Worker approaches passenger, asks for saved Verification ID
2. Passenger provides: RM-2026-654321
3. Worker enters ID in system via modal
4. System validates ID

**Phase 4: Closure**
- **If Valid**: Complaint closes, history recorded
- **If Invalid**: Error shown, complaint remains open

### 6. Security Features

✅ **Complaint Access Control**
- Passengers see only their complaints
- Department staff see only their department's complaints
- Verification ID prevents unauthorized closure

✅ **Verification ID Uniqueness**
- Each complaint has unique ID
- System checks database before generating new ID

✅ **Audit Trail**
- All status transitions recorded in history
- Closure timestamp tracked
- Verification status flagged

✅ **Role-Based Access**
- Only staff can mark complaints as resolved
- Only staff can verify and close
- Passenger cannot directly close complaint

### 7. Demo Data

Demo complaints seeded with:
- Verification IDs pre-generated
- Status set to "Open" or "In Progress"
- All fields required for testing

### 8. Testing the Feature

#### Step-by-Step Test

**1. Login as Department Staff**
- Email: `housekeeping@railmadad.demo`
- Password: `staff123`
- Department: Housekeeping

**2. Load a Complaint**
- Find complaint with status "Open"
- Click to load it

**3. Mark as Resolved**
- Click "Mark as Resolved" button
- Status changes to "Awaiting Passenger Verification"

**4. Enter Verification ID**
- Click "Enter Passenger Verification ID"
- Modal opens
- In Passenger Dashboard, find the complaint's Verification ID (green box)
- Copy the Verification ID from passenger's dashboard
- Paste into modal
- Click "Verify & Close"

**5. Verify Closure**
- Status changes to "Closed"
- Closed timestamp shown
- Green success notification appears

**6. Test Invalid ID**
- Repeat steps 1-4 with different complaint
- Enter wrong verification ID
- System shows error: "Invalid Verification ID. Complaint cannot be closed."
- Status remains unchanged

### 9. Database Migration

If upgrading existing database:
```sql
-- Add new columns to complaints table
ALTER TABLE complaints ADD COLUMN verification_id VARCHAR(50) UNIQUE NOT NULL;
ALTER TABLE complaints ADD COLUMN closed_at TIMESTAMP NULL;
ALTER TABLE complaints ADD COLUMN verified_by_worker BOOLEAN DEFAULT FALSE;

-- Create index for verification_id
CREATE INDEX idx_verification_id ON complaints(verification_id);

-- Update existing complaints with verification IDs (one-time operation)
-- Run before deployment
```

### 10. API Response Examples

**Mark as Resolved Success**
```json
{
  "id": 1,
  "status": "Awaiting Passenger Verification",
  "verification_id": "RM-2026-123456",
  "remarks": "Marked as resolved, awaiting passenger verification"
}
```

**Verification Success**
```json
{
  "success": true,
  "message": "Complaint successfully verified and closed.",
  "complaint_id": 1,
  "status": "Closed",
  "closed_at": "2026-06-12T10:30:45Z"
}
```

**Verification Failure**
```json
{
  "success": false,
  "message": "Invalid Verification ID. Complaint cannot be closed.",
  "complaint_id": 1,
  "status": "Awaiting Passenger Verification",
  "closed_at": null
}
```

### 11. Files Modified

- `backend/models/complaint.py` - Added verification fields and status enum
- `backend/routers/complaints.py` - Added verification ID generation and endpoints
- `backend/schemas/complaint.py` - Added verification schemas
- `backend/main.py` - Updated demo data with verification IDs
- `frontend/src/App.jsx` - Updated UI with verification workflows
- `frontend/src/styles.css` - Added modal and status styles

### 12. Feature Enablement Checklist

- ✅ Backend model updated with verification fields
- ✅ New API endpoints implemented
- ✅ Verification ID generation working
- ✅ Frontend UI updated with verification modal
- ✅ Demo data seeded with verification IDs
- ✅ Status transitions properly configured
- ✅ Audit trail recording enabled
- ✅ Security checks in place
- ✅ CSS styling for modal and status badges

## Next Steps

1. Run database migrations (if on existing database)
2. Deploy backend changes
3. Deploy frontend changes
4. Test complete workflow with demo accounts
5. Monitor verification attempts in logs
6. Collect feedback for refinements

## Support

For issues or questions:
1. Check that all files have been modified correctly
2. Verify demo data has verification_ids
3. Test API endpoints with Postman/Thunder Client
4. Check browser console for frontend errors
5. Review server logs for backend errors
