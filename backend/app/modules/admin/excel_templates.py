import os
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import new_uuid
from app.models.settings import ExcelTemplate
from app.models.user import User
from app.schemas.excel_template import ExcelTemplateResponse, ExcelTemplateUpdate
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.privileges import require_privilege, ADMIN_TEMPLATES
from app.utils.files import delete_file, save_upload, upload_dir, validate_upload

_ALLOWED_MODULES = {"Experiments", "ATR", "Projects"}
_EXCEL_EXTENSIONS = {".xlsx", ".xls"}

router = APIRouter()


def _get_or_404(db: Session, template_id: str) -> ExcelTemplate:
    t = db.get(ExcelTemplate, template_id)
    if not t:
        raise HTTPException(404, "Excel template not found")
    return t


@router.post("/", status_code=201, response_model=ExcelTemplateResponse)
async def upload_excel_template(
    request: Request,
    name: str = Query(..., description="Template display name"),
    module: str = Query(..., description="Experiments | ATR | Projects"),
    version: Optional[str] = Query("v1"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_privilege(ADMIN_TEMPLATES)),
):
    if module not in _ALLOWED_MODULES:
        raise HTTPException(400, f"module must be one of {sorted(_ALLOWED_MODULES)}")

    ext = validate_upload(file)
    if ext not in _EXCEL_EXTENSIONS:
        raise HTTPException(400, f"Only Excel files (.xlsx, .xls) are allowed for templates; got '{ext}'")

    subdir = upload_dir() / "excel_templates" / module.lower()
    file_path, file_size = await save_upload(file, subdir)

    # Human-readable size string (e.g. "48 B", "12 KB")
    if file_size < 1024:
        size_str = f"{file_size} B"
    elif file_size < 1024 * 1024:
        size_str = f"{file_size // 1024} KB"
    else:
        size_str = f"{file_size // (1024 * 1024)} MB"

    t = ExcelTemplate(
        id=new_uuid(),
        name=name,
        module=module,
        version=version,
        file_path=file_path,
        file_size=size_str,
        uploaded_by=current_user.id,
        is_active=True,
    )
    db.add(t)
    db.flush()
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ExcelTemplates", action="UPLOADED",
        target_type="excel_template", target_id=t.id, target_label=name,
        detail=f"Uploaded template '{name}' for module {module} ({size_str})",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(t)
    return t


@router.get("/", response_model=List[ExcelTemplateResponse])
def list_excel_templates(
    module: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ExcelTemplate)
    if module:
        q = q.filter(ExcelTemplate.module == module)
    if is_active is not None:
        q = q.filter(ExcelTemplate.is_active == is_active)
    return q.order_by(ExcelTemplate.uploaded_at.desc()).all()


@router.get("/{template_id}", response_model=ExcelTemplateResponse)
def get_excel_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_404(db, template_id)


@router.get("/{template_id}/download", response_class=FileResponse)
def download_excel_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = _get_or_404(db, template_id)
    if not os.path.exists(t.file_path):
        raise HTTPException(404, "Template file not found on server")
    return FileResponse(
        path=t.file_path,
        filename=f"{t.name}_{t.version or 'v1'}{os.path.splitext(t.file_path)[1]}",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.patch("/{template_id}", response_model=ExcelTemplateResponse)
def update_excel_template(
    template_id: str,
    body: ExcelTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_privilege(ADMIN_TEMPLATES)),
):
    t = _get_or_404(db, template_id)
    if body.module and body.module not in _ALLOWED_MODULES:
        raise HTTPException(400, f"module must be one of {sorted(_ALLOWED_MODULES)}")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(t, field, val)
    db.commit()
    db.refresh(t)
    return t


@router.post("/{template_id}/activate", response_model=ExcelTemplateResponse)
def activate_excel_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_privilege(ADMIN_TEMPLATES)),
):
    t = _get_or_404(db, template_id)
    t.is_active = True
    db.commit()
    db.refresh(t)
    return t


@router.post("/{template_id}/deactivate", response_model=ExcelTemplateResponse)
def deactivate_excel_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_privilege(ADMIN_TEMPLATES)),
):
    t = _get_or_404(db, template_id)
    t.is_active = False
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{template_id}", status_code=204)
def delete_excel_template(
    template_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_privilege(ADMIN_TEMPLATES)),
):
    t = _get_or_404(db, template_id)
    file_path = t.file_path
    log_action(
        db,
        user_id=current_user.id, username=current_user.username,
        module="ExcelTemplates", action="DELETED",
        target_type="excel_template", target_id=t.id, target_label=t.name,
        detail=f"Deleted template '{t.name}'",
        ip_address=get_ip(request),
    )
    db.delete(t)
    db.commit()
    delete_file(file_path)
