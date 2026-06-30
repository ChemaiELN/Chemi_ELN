"""Projects — basic CRUD. Phase D2 foundation for ADC notebooks."""
from typing import Any, Optional
import uuid
import datetime
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.project import Project, ProjectUser, Route, Stage
from app.models.admin import User, Department

router = APIRouter(prefix="/projects", tags=["projects"])


def _uuid():
    return uuid.uuid4()


def _now():
    return datetime.datetime.utcnow()


# ── Serialisers ───────────────────────────────────────────────────────────────

def _project_dict(p: Project, detail: bool = False, creator: User = None, dept: Department = None) -> dict:
    d: dict = {
        "id":                   str(p.id),
        "code":                 p.code,
        "name":                 p.name,
        "product_name":         p.product_name,
        "in_house_project_id":  p.in_house_project_id,
        "project_type":         p.project_type,
        "market":               p.market,
        "department_id":        str(p.department_id) if p.department_id else None,
        "manager_id":           str(p.manager_id)    if p.manager_id    else None,
        "created_by":           str(p.created_by),
        "start_date":           p.start_date.isoformat()  if p.start_date   else None,
        "target_date":          p.target_date.isoformat() if p.target_date  else None,
        "status":               p.status,
        "description":          p.description,
        "remarks":              p.remarks,
        # ADC
        "customer":             p.customer,
        "adc_code":             p.adc_code,
        "target_antigen":       p.target_antigen,
        "antibody_clone":       p.antibody_clone,
        "payload":              p.payload,
        "linker":               p.linker,
        "target_dar":           p.target_dar,
        "project_stage":        p.project_stage,
        "qa_review_required":   p.qa_review_required,
        # Regulatory
        "oel_band":             p.oel_band,
        "containment_category": p.containment_category,
        "gmp_non_gmp":          p.gmp_non_gmp,
        "created_by_name":      creator.username if creator else None,
        "department_name":      dept.name if dept else None,
        "created_at":           p.created_at.isoformat(),
        "updated_at":           p.updated_at.isoformat(),
    }
    if detail:
        d.update({
            "objective":                 p.objective,
            "observation":               p.observation,
            "related_docs_comments":     p.related_docs_comments,
            "related_docs_observations": p.related_docs_observations,
            "regulatory_observations":   p.regulatory_observations,
            "scheme_data":               p.scheme_data,
        })
    return d


def _get_or_404(db: Session, project_id: str) -> Project:
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return p


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_projects(
    status:        Optional[str] = Query(None),
    search:        Optional[str] = Query(None),
    skip:          int           = Query(0, ge=0),
    limit:         int           = Query(100, le=500),
    assigned_only: bool          = Query(False),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    q = db.query(Project)
    if assigned_only:
        q = q.join(ProjectUser, ProjectUser.project_id == Project.id).filter(
            ProjectUser.user_id == current_user.id
        )
    if status:
        q = q.filter(Project.status == status)
    if search:
        q = q.filter(Project.name.ilike(f"%{search}%") | Project.code.ilike(f"%{search}%"))
    total = q.count()
    rows  = q.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()

    # Batch-load creators and departments to avoid N+1
    creator_ids = {p.created_by for p in rows if p.created_by}
    dept_ids    = {p.department_id for p in rows if p.department_id}
    creators    = {u.id: u for u in db.query(User).filter(User.id.in_(creator_ids)).all()} if creator_ids else {}
    depts       = {d.id: d for d in db.query(Department).filter(Department.id.in_(dept_ids)).all()} if dept_ids else {}

    return {
        "total": total,
        "items": [
            _project_dict(p, creator=creators.get(p.created_by), dept=depts.get(p.department_id))
            for p in rows
        ],
    }


@router.get("/{project_id}")
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    p = _get_or_404(db, project_id)
    creator = db.query(User).filter(User.id == p.created_by).first() if p.created_by else None
    dept    = db.query(Department).filter(Department.id == p.department_id).first() if p.department_id else None
    return _project_dict(p, detail=True, creator=creator, dept=dept)


@router.post("")
def create_project(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    if not body.get("name"):
        raise HTTPException(422, "name is required")
    if not body.get("code"):
        raise HTTPException(422, "code is required")
    if db.query(Project).filter(Project.code == body["code"]).first():
        raise HTTPException(409, f"Project code '{body['code']}' already exists")

    now = _now()
    p = Project(
        id=_uuid(),
        code=body["code"],
        name=body["name"],
        product_name=         body.get("product_name"),
        in_house_project_id=  body.get("in_house_project_id"),
        project_type=         body.get("project_type"),
        market=               body.get("market"),
        department_id=        body.get("department_id"),
        manager_id=           body.get("manager_id"),
        created_by=           current_user.id,
        start_date=           body.get("start_date"),
        target_date=          body.get("target_date"),
        status=               body.get("status", "ACTIVE"),
        description=          body.get("description"),
        objective=            body.get("objective"),
        remarks=              body.get("remarks"),
        customer=             body.get("customer"),
        adc_code=             body.get("adc_code"),
        target_antigen=       body.get("target_antigen"),
        antibody_clone=       body.get("antibody_clone"),
        payload=              body.get("payload"),
        linker=               body.get("linker"),
        target_dar=           body.get("target_dar"),
        project_stage=        body.get("project_stage"),
        qa_review_required=   body.get("qa_review_required"),
        oel_band=             body.get("oel_band"),
        containment_category= body.get("containment_category"),
        gmp_non_gmp=          body.get("gmp_non_gmp"),
        created_at=now,
        updated_at=now,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    dept = db.query(Department).filter(Department.id == p.department_id).first() if p.department_id else None
    return _project_dict(p, detail=True, creator=current_user, dept=dept)


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    p = _get_or_404(db, project_id)
    editable = [
        "name", "product_name", "in_house_project_id", "project_type", "market",
        "department_id", "manager_id", "start_date", "target_date", "status",
        "description", "objective", "observation", "remarks",
        "related_docs_comments", "related_docs_observations",
        "customer", "adc_code", "target_antigen", "antibody_clone",
        "payload", "linker", "target_dar", "project_stage", "qa_review_required",
        "oel_band", "containment_category", "gmp_non_gmp", "regulatory_observations",
        "scheme_data",
    ]
    for field in editable:
        if field in body:
            setattr(p, field, body[field])
    p.updated_at = _now()
    db.commit()
    db.refresh(p)
    creator = db.query(User).filter(User.id == p.created_by).first() if p.created_by else None
    dept    = db.query(Department).filter(Department.id == p.department_id).first() if p.department_id else None
    return _project_dict(p, detail=True, creator=creator, dept=dept)


@router.delete("/{project_id}")
def archive_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    p = _get_or_404(db, project_id)
    p.status = "ARCHIVED"
    p.updated_at = _now()
    db.commit()
    return {"ok": True}


# ── Team members sub-resource ────────────────────────────────────────────────

@router.get("/{project_id}/members")
def list_members(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, project_id)
    from app.models.project import ProjectUser
    rows = db.query(ProjectUser).filter(ProjectUser.project_id == project_id).all()
    user_ids = {r.user_id for r in rows}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return [
        {
            "user_id":  str(r.user_id),
            "role":     r.role,
            "added_at": r.added_at.isoformat(),
            "username": users[r.user_id].username if r.user_id in users else None,
        }
        for r in rows
    ]


@router.post("/{project_id}/members")
def add_member(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    _get_or_404(db, project_id)
    from app.models.project import ProjectUser
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(422, "user_id is required")
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(404, "User not found")
    existing = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == user_id,
    ).first()
    if existing:
        existing.role = body.get("role", existing.role)
        db.commit()
        return {"ok": True, "updated": True}
    db.add(ProjectUser(
        project_id=project_id,
        user_id=user_id,
        role=body.get("role", "Member"),
        added_by=current_user.id,
        added_at=_now(),
    ))
    db.commit()
    return {"ok": True, "updated": False}


@router.delete("/{project_id}/members/{user_id}")
def remove_member(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, project_id)
    from app.models.project import ProjectUser
    row = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == user_id,
    ).first()
    if not row:
        raise HTTPException(404, "Member not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


# ── Routes sub-resource ───────────────────────────────────────────────────────

@router.get("/{project_id}/routes")
def list_routes(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    _get_or_404(db, project_id)
    rows = (
        db.query(Route)
        .filter(Route.project_id == project_id)
        .order_by(Route.sort_order)
        .all()
    )
    return [
        {
            "id": str(r.id), "code": r.code, "name": r.name,
            "sort_order": r.sort_order, "status": r.status,
            "stages": [
                {"id": str(s.id), "code": s.code, "name": s.name,
                 "sort_order": s.sort_order, "status": s.status}
                for s in sorted(r.stages, key=lambda x: x.sort_order)
            ],
        }
        for r in rows
    ]


# ── Attachments sub-resource ─────────────────────────────────────────────────

UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "projects"),
)


def _attachment_dict(a) -> dict:
    return {
        "id":          str(a.id),
        "filename":    a.filename,
        "file_size":   a.file_size,
        "file_type":   a.file_type,
        "comments":    a.comments,
        "uploaded_by": str(a.uploaded_by) if a.uploaded_by else None,
        "uploaded_at": a.uploaded_at.isoformat() if a.uploaded_at else None,
    }


@router.get("/{project_id}/attachments")
def list_attachments(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    from app.models.project import ProjectAttachment
    _get_or_404(db, project_id)
    rows = (
        db.query(ProjectAttachment)
        .filter(ProjectAttachment.project_id == project_id)
        .order_by(ProjectAttachment.uploaded_at.desc())
        .all()
    )
    return [_attachment_dict(a) for a in rows]


@router.post("/{project_id}/attachments")
async def upload_attachment(
    project_id: str,
    file: UploadFile = File(...),
    comments: str = Form(""),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    from app.models.project import ProjectAttachment
    _get_or_404(db, project_id)

    project_upload_dir = os.path.join(UPLOAD_DIR, str(project_id))
    os.makedirs(project_upload_dir, exist_ok=True)

    attach_id = _uuid()
    # Prefix filename with UUID to avoid collisions
    safe_filename = f"{attach_id}_{file.filename}"
    dest_path = os.path.join(project_upload_dir, safe_filename)

    with open(dest_path, "wb") as out_file:
        shutil.copyfileobj(file.file, out_file)

    file_size = os.path.getsize(dest_path)

    now = _now()
    attachment = ProjectAttachment(
        id=attach_id,
        project_id=project_id,
        filename=file.filename,
        file_path=dest_path,
        file_size=file_size,
        file_type=file.content_type,
        comments=comments,
        uploaded_by=current_user.id,
        uploaded_at=now,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return _attachment_dict(attachment)


@router.delete("/{project_id}/attachments/{attach_id}")
def delete_attachment(
    project_id: str,
    attach_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    from app.models.project import ProjectAttachment
    _get_or_404(db, project_id)
    attachment = (
        db.query(ProjectAttachment)
        .filter(
            ProjectAttachment.id == attach_id,
            ProjectAttachment.project_id == project_id,
        )
        .first()
    )
    if not attachment:
        raise HTTPException(404, "Attachment not found")

    if attachment.file_path and os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)

    db.delete(attachment)
    db.commit()
    return {"ok": True}


# ── Risk Assessment sub-resource ─────────────────────────────────────────────

def _risk_row_dict(row) -> dict:
    severity   = row.severity   or 0
    occurrence = row.occurrence or 0
    detection  = row.detection  or 0
    return {
        "id":           str(row.id),
        "sort_order":   row.sort_order,
        "process_step": row.process_step,
        "failure_mode": row.failure_mode,
        "severity":     severity,
        "occurrence":   occurrence,
        "detection":    detection,
        "rpn":          severity * occurrence * detection,
        "mitigation":   row.mitigation,
        "created_at":   row.created_at.isoformat() if row.created_at else None,
    }


def _risk_assessment_dict(ra) -> dict:
    return {
        "id":                str(ra.id),
        "project_id":        str(ra.project_id),
        "assessment_id":     ra.assessment_id,
        "assessment_type":   ra.assessment_type,
        "last_reviewed":     ra.last_reviewed.isoformat() if ra.last_reviewed else None,
        "reviewed_by":       str(ra.reviewed_by) if ra.reviewed_by else None,
        "overall_risk_level": ra.overall_risk_level,
        "status":            ra.status,
        "additional_notes":  ra.additional_notes,
        "observations":      ra.observations,
        "created_at":        ra.created_at.isoformat() if ra.created_at else None,
        "updated_at":        ra.updated_at.isoformat() if ra.updated_at else None,
        "rows": [
            _risk_row_dict(r)
            for r in sorted(ra.rows, key=lambda x: (x.sort_order or 0))
        ],
        "exists": True,
    }


@router.get("/{project_id}/risk-assessment")
def get_risk_assessment(
    project_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    from app.models.project import ProjectRiskAssessment
    _get_or_404(db, project_id)
    ra = (
        db.query(ProjectRiskAssessment)
        .filter(ProjectRiskAssessment.project_id == project_id)
        .first()
    )
    if not ra:
        return {"exists": False}
    return _risk_assessment_dict(ra)


@router.put("/{project_id}/risk-assessment")
def upsert_risk_assessment(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    from app.models.project import ProjectRiskAssessment
    _get_or_404(db, project_id)
    now = _now()

    ra = (
        db.query(ProjectRiskAssessment)
        .filter(ProjectRiskAssessment.project_id == project_id)
        .first()
    )
    if ra is None:
        ra = ProjectRiskAssessment(
            id=_uuid(),
            project_id=project_id,
            created_at=now,
        )
        db.add(ra)

    updatable = [
        "assessment_id", "assessment_type", "last_reviewed", "reviewed_by",
        "overall_risk_level", "status", "additional_notes", "observations",
    ]
    for field in updatable:
        if field in body:
            setattr(ra, field, body[field])
    ra.updated_at = now

    db.commit()
    db.refresh(ra)
    return _risk_assessment_dict(ra)


@router.post("/{project_id}/risk-assessment/rows")
def add_risk_row(
    project_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    from app.models.project import ProjectRiskAssessment, ProjectRiskRow
    _get_or_404(db, project_id)
    ra = (
        db.query(ProjectRiskAssessment)
        .filter(ProjectRiskAssessment.project_id == project_id)
        .first()
    )
    if not ra:
        raise HTTPException(404, "Risk assessment not found; create it first via PUT")

    now = _now()
    row = ProjectRiskRow(
        id=_uuid(),
        assessment_id=ra.id,
        sort_order=body.get("sort_order", 0),
        process_step=body.get("process_step"),
        failure_mode=body.get("failure_mode"),
        severity=body.get("severity"),
        occurrence=body.get("occurrence"),
        detection=body.get("detection"),
        mitigation=body.get("mitigation"),
        created_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _risk_row_dict(row)


@router.patch("/{project_id}/risk-assessment/rows/{row_id}")
def update_risk_row(
    project_id: str,
    row_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    from app.models.project import ProjectRiskAssessment, ProjectRiskRow
    _get_or_404(db, project_id)
    ra = (
        db.query(ProjectRiskAssessment)
        .filter(ProjectRiskAssessment.project_id == project_id)
        .first()
    )
    if not ra:
        raise HTTPException(404, "Risk assessment not found")

    row = (
        db.query(ProjectRiskRow)
        .filter(ProjectRiskRow.id == row_id, ProjectRiskRow.assessment_id == ra.id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Risk row not found")

    updatable = ["sort_order", "process_step", "failure_mode", "severity", "occurrence", "detection", "mitigation"]
    for field in updatable:
        if field in body:
            setattr(row, field, body[field])

    db.commit()
    db.refresh(row)
    return _risk_row_dict(row)


@router.delete("/{project_id}/risk-assessment/rows/{row_id}")
def delete_risk_row(
    project_id: str,
    row_id: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    from app.models.project import ProjectRiskAssessment, ProjectRiskRow
    _get_or_404(db, project_id)
    ra = (
        db.query(ProjectRiskAssessment)
        .filter(ProjectRiskAssessment.project_id == project_id)
        .first()
    )
    if not ra:
        raise HTTPException(404, "Risk assessment not found")

    row = (
        db.query(ProjectRiskRow)
        .filter(ProjectRiskRow.id == row_id, ProjectRiskRow.assessment_id == ra.id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Risk row not found")

    db.delete(row)
    db.commit()
    return {"ok": True}
