"""AI Service — Rail Madad AI
NLP classification, priority detection, image verification pipeline.
PROD swap-in points marked with # PROD: comments."""
from __future__ import annotations
import hashlib, random
from typing import Optional
from ..schemas.complaint import AIAnalysisResult
from ..models.complaint import ComplaintCategory, ComplaintPriority

_CAT_KW = {
    "Security":    ["theft","stolen","harassment","assault","threat","suspicious","fight","weapon","police","robbery"],
    "Catering":    ["food","meal","catering","overpriced","vendor","tea","water bottle","hungry","stale","quality"],
    "Cleanliness": ["dirty","clean","garbage","waste","toilet","filthy","stain","smell","rats","cockroach","dust"],
    "Medical":     ["medical","doctor","sick","fainted","unconscious","injury","blood","hospital","ambulance"],
    "Electrical":  ["fan","light","ac","broken","door","window","leak","electric","seat","berth","wire","bulb","power"],
}
_PRI_KW = {
    "HIGH":   ["fire","theft","stolen","harassment","assault","weapon","danger","emergency","threat","smoke","burning"],
    "MEDIUM": ["food","water","catering","overcharged","overpricing","delay","smell","sick","electric","light","fan"],
}
_DEPT = {
    "Cleanliness":"Housekeeping",
    "Catering":"Catering",
    "Security":"RPF",
    "Medical":"Medical Team",
    "Electrical":"Electrical Maintenance",
    "Others":"General Support",
}

def classify_complaint(text: str) -> ComplaintCategory:
    """Keyword classifier. PROD: replace with HuggingFace DistilBERT pipeline."""
    lower = text.lower()
    scores = {cat: sum(1 for kw in kws if kw in lower) for cat, kws in _CAT_KW.items()}
    best = max(scores, key=lambda k: scores[k])
    return ComplaintCategory(best) if scores[best] > 0 else ComplaintCategory.Others

def detect_priority(text: str) -> ComplaintPriority:
    """Rule-based priority. PROD: use fine-tuned classifier or zero-shot NLI."""
    lower = text.lower()
    for kw in _PRI_KW["HIGH"]:
        if kw in lower: return ComplaintPriority.HIGH
    for kw in _PRI_KW["MEDIUM"]:
        if kw in lower: return ComplaintPriority.MEDIUM
    return ComplaintPriority.LOW

def compute_phash(image_bytes: bytes) -> str:
    """MD5 stand-in. PROD: use imagehash.phash(PIL.Image)."""
    return hashlib.md5(image_bytes).hexdigest()

def is_duplicate(phash: str, existing: list[str]) -> bool:
    return phash in existing

def run_yolo_detection(image_bytes: bytes):
    """Simulates YOLOv8. PROD: from ultralytics import YOLO; model = YOLO('railway_yolov8.pt')"""
    labels = random.sample(["train","coach","platform","track"], k=random.randint(1,3))
    conf = round(random.uniform(0.65, 0.97), 2)
    return conf > 0.60, labels, conf

def run_ela_analysis(image_bytes: bytes):
    """Simulates ELA forgery detection. PROD: PIL resave + pixel diff."""
    score = round(random.uniform(2.0, 25.0), 2)
    return score, score > 15.0

async def run_ai_pipeline(complaint_text: str, image_bytes: Optional[bytes], existing_hashes: list[str]) -> AIAnalysisResult:
    category = classify_complaint(complaint_text)
    priority = detect_priority(complaint_text)
    department = _DEPT[category.value]
    confidence, image_verified, duplicate, manual_review = 75, True, False, False
    verification_status = "Verified"
    if image_bytes:
        phash = compute_phash(image_bytes)
        duplicate = is_duplicate(phash, existing_hashes)
        yolo_ok, _, yolo_conf = run_yolo_detection(image_bytes)
        ela_score, _ = run_ela_analysis(image_bytes)
        base = int(yolo_conf * 100)
        confidence = max(0, min(100, base - (20 if ela_score > 15 else 0) - (15 if duplicate else 0)))
        image_verified = confidence >= 60
        manual_review = confidence < 60
        verification_status = "Verified" if confidence > 70 else "Needs Review" if confidence >= 50 else "Suspicious"
    return AIAnalysisResult(category=category, priority=priority, department=department,
        confidence_score=confidence, image_verified=image_verified, is_duplicate=duplicate, manual_review=manual_review,
        image_verification_status=verification_status)
