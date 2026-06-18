from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.security import require_admin
from ..models.complaint import Complaint
from ..models.user import User
from ..schemas.complaint import (
    AnalyticsOut, CategoryCount, DashboardStats,
    DepartmentStat, MonthlyPoint, PriorityCount,
)

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    db:    Session = Depends(get_db),
    _user: User    = Depends(require_admin),
):
    total    = db.query(Complaint).count()
    resolved = db.query(Complaint).filter(Complaint.status == "Closed").count()
    pending  = total - resolved
    high     = db.query(Complaint).filter(Complaint.priority == "HIGH").count()
    manual   = db.query(Complaint).filter(Complaint.manual_review.is_(True)).count()
    rate     = round((resolved / total * 100), 1) if total else 0.0

    return DashboardStats(
        total_complaints=total,
        pending_complaints=pending,
        resolved_complaints=resolved,
        high_priority_count=high,
        manual_review_count=manual,
        resolution_rate_pct=rate,
    )


@router.get("/analytics", response_model=AnalyticsOut)
def dashboard_analytics(
    db:    Session = Depends(get_db),
    _user: User    = Depends(require_admin),
):
    # Category distribution
    complaints = db.query(Complaint).all()

    category_counts = {}
    priority_counts = {}
    monthly_counts = {}
    for complaint in complaints:
        category = str(complaint.category.value if complaint.category else "Unknown")
        priority = str(complaint.priority.value if complaint.priority else "Unknown")
        month = complaint.created_at.strftime("%Y-%m") if complaint.created_at else "Unknown"
        category_counts[category] = category_counts.get(category, 0) + 1
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
        monthly_counts[month] = monthly_counts.get(month, 0) + 1

    category_distribution = [CategoryCount(category=name, count=count) for name, count in sorted(category_counts.items())]
    priority_distribution = [PriorityCount(priority=name, count=count) for name, count in sorted(priority_counts.items())]
    monthly_trend = [MonthlyPoint(month=name, total=count) for name, count in sorted(monthly_counts.items())]

    # Department stats
    depts = ["Housekeeping", "Catering", "RPF", "Medical Team", "Electrical Maintenance", "General Support"]
    dept_stats = []
    for dept in depts:
        base  = [item for item in complaints if item.department == dept]
        total = len(base)
        res   = sum(1 for item in base if str(item.status.value if hasattr(item.status, "value") else item.status) == "Closed")
        high  = sum(1 for item in base if str(item.priority.value if hasattr(item.priority, "value") else item.priority) == "HIGH")
        dept_stats.append(DepartmentStat(department=dept, total=total, resolved=res, high=high))

    return AnalyticsOut(
        category_distribution=category_distribution,
        priority_distribution=priority_distribution,
        monthly_trend=monthly_trend,
        department_stats=dept_stats,
    )
