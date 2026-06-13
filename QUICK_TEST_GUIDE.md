# Quick Test Guide - Complaint Closure Verification

## Demo Accounts

```
PASSENGER:
Email: passenger@railmadad.demo
Password: pass123
Role: Passenger

HOUSEKEEPING STAFF:
Email: housekeeping@railmadad.demo
Password: staff123
Department: Housekeeping
Role: Staff

CATERING STAFF:
Email: catering@railmadad.demo
Password: staff123
Department: Catering
Role: Staff
```

## Testing Workflow (5 minutes)

### Test 1: View Verification ID as Passenger

1. **Login**: Use passenger account
2. **Navigate**: Click "Passenger Dashboard"
3. **View Complaints**: Scroll to "Your Complaints" section
4. **Track Complaint**: 
   - Go to "Track Complaint" panel
   - Copy complaint ID (RM-2026-XXXXXX format) from table
   - Paste into Track field
   - Click "Track"
5. **Result**: Green box shows "Verification ID: RM-2026-XXXXXX"
   - Save this ID for next step

### Test 2: Mark Complaint as Resolved

1. **Login**: Use housekeeping staff account
2. **Navigate**: Click "Department Dashboard"
3. **Load Complaint**:
   - Find complaint with "Open" status in table
   - Click row to populate complaint ID field
   - Click "Load Complaint"
4. **Mark Resolved**:
   - Click "Mark as Resolved" button
   - Status changes to "Awaiting Passenger Verification"
   - Message shows: "Complaint marked as resolved. Awaiting passenger verification."

### Test 3: Verify and Close with Correct ID

1. **Continue** from Test 2 (same session)
2. **Open Modal**:
   - Click "Enter Passenger Verification ID" button
   - Modal dialog appears
3. **Enter ID**:
   - Enter the verification ID you saved in Test 1
   - Add optional remarks (e.g., "Verified by worker")
   - Click "Verify & Close"
4. **Result**:
   - Green notification: "Complaint successfully verified and closed."
   - Status changes to "Closed"
   - Timestamp shown
   - Modal closes automatically

### Test 4: Verify and Close with Incorrect ID

1. **New Complaint**: Load different complaint
2. **Mark Resolved**: Follow Test 2 steps
3. **Enter Wrong ID**:
   - Click "Enter Passenger Verification ID"
   - Enter random ID (e.g., RM-2026-000000)
   - Click "Verify & Close"
4. **Result**:
   - Red notification: "Invalid Verification ID. Complaint cannot be closed."
   - Status remains "Awaiting Passenger Verification"
   - Modal stays open

### Test 5: Try Closing Before Mark as Resolved

1. **Load**: Fresh complaint with "Open" status
2. **Attempt**: Click "Enter Passenger Verification ID" (button won't exist)
   - Result: Only "Mark as Resolved" button available
3. **Expected**: Cannot verify until marked as resolved

## Status Progression Visual

```
Passenger Submits
        ↓
    [Open] ← Automatic with ID
        ↓
Staff Views
        ↓
    [In Progress] ← Optionally updated
        ↓
Staff Marks Resolved
        ↓
[Awaiting Passenger Verification] ← Now needs verification ID
        ↓
Staff Enters Correct ID
        ↓
    [Closed] ← Success!
```

## Expected UI Changes

### Passenger Dashboard - Track Complaint Section
```
✅ Green highlighted box: "Verification ID: RM-2026-XXXXXX"
```

### Department Dashboard - Manage Complaint Section
```
✅ Button 1: "Mark as Resolved" (visible when Open/In Progress)
✅ Button 2: "Enter Passenger Verification ID" (visible when Awaiting Verification)
✅ Button 3: None (visible when Closed)
✅ Modal: "Verify & Close Complaint" popup dialog
```

### Status Badges Colors
```
✅ Open: Yellow badge
✅ In Progress: Red badge  
✅ Awaiting Passenger Verification: Yellow badge
✅ Closed: Green badge ✓
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Mark as Resolved" button not showing | Refresh page, check complaint status is Open/In Progress |
| "Verification ID" button not showing | Complaint must be in "Awaiting Passenger Verification" status first |
| Modal doesn't appear | Browser may have popups blocked, check console for errors |
| Wrong ID shows success | Check exact ID spelling (case-insensitive matching) |
| Can't find Verification ID | Go to passenger dashboard, use Track feature to view ID |

## Database Validation

Check verification_id was generated:
```sql
SELECT id, verification_id, status FROM complaints LIMIT 5;
```

Expected output:
```
id | verification_id      | status
---|--------------------|-----
1  | RM-2026-123456     | Open
2  | RM-2026-654321     | In Progress
```

## API Endpoint Testing (Postman/Thunder Client)

### Mark as Resolved
```
POST http://localhost:8000/complaints/1/mark-resolved
Headers:
  Authorization: Bearer <token>

Response:
{
  "id": 1,
  "status": "Awaiting Passenger Verification",
  "verification_id": "RM-2026-123456"
}
```

### Verify and Close
```
POST http://localhost:8000/complaints/verify
Headers:
  Authorization: Bearer <token>

Body:
{
  "complaint_id": 1,
  "verification_id": "RM-2026-123456",
  "remarks": "Verified by worker"
}

Response Success:
{
  "success": true,
  "message": "Complaint successfully verified and closed.",
  "complaint_id": 1,
  "status": "Closed",
  "closed_at": "2026-06-12T10:30:45Z"
}

Response Failure:
{
  "success": false,
  "message": "Invalid Verification ID. Complaint cannot be closed.",
  "complaint_id": 1,
  "status": "Awaiting Passenger Verification",
  "closed_at": null
}
```

## Feature Highlights

🔐 **Security**: Only matching verification IDs can close complaints
📝 **Audit**: All verification attempts logged in history
👤 **Privacy**: IDs visible to passenger and assigned department only
⏱️ **Timestamped**: Closure time automatically recorded
🔄 **Reversible**: Failed verifications don't affect complaint state
✨ **User-Friendly**: Clear UI flow with success/error notifications

## Next Steps After Testing

1. ✅ Test all 5 scenarios above
2. ✅ Verify status badges display correctly
3. ✅ Check database records for verification_id
4. ✅ Review browser console for errors
5. ✅ Check server logs for any issues
6. ✅ Test with different departments
7. ✅ Verify audit trail is created

---

**Duration**: ~5 minutes per test cycle
**Accounts Needed**: 1 passenger + 1 staff
**Success Criteria**: All 5 tests pass without errors
