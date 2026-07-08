"""Inventory – Batches: CRUD, qty issue/allocate, file uploads, events."""
import datetime
import os
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvBatch, InvBatchEvent, InvBatchPack, InvBatchNoCounter, InvBatchNumberCounter
from app.schemas.inventory import (
    BatchAllocateRequest,
    BatchCreate,
    BatchEventOut,
    BatchIssueRequest,
    BatchOut,
    BatchUpdate,
)
from app.shared.files import ALLOWED_DOC_EXTS, delete_file, save_upload, validate_upload
from app.shared.inv_audit import write_inv_audit
from app.modules.inventory._qty_ledger import deduct_qty

router = APIRouter(prefix="/inventory/batches", tags=["inventory-batches"])


def _user_ref(user) -> str:
    return user.username if hasattr(user, "username") else str(user.id)


def _make_prefix(material_type: str) -> str:
    import re
    return re.sub(r'\s+', '', material_type)[:5].upper()


BATCH_NO_PREFIX = "MCE"


def _seed_max_batch_no_seq(db: Session, year: str) -> int:
    """Seed from the highest existing sequence in any MCE/{year}/{seq} batch_no."""
    pattern = f"{BATCH_NO_PREFIX}/{year}/%"
    rows = db.query(InvBatch.batch_no).filter(InvBatch.batch_no.like(pattern)).all()
    max_seq = 0
    for (no,) in rows:
        if no:
            try:
                s = int(no.split('/')[-1])
                if s > max_seq:
                    max_seq = s
            except (ValueError, IndexError):
                pass
    return max_seq


def _claim_next_batch_no_seq(db: Session, year: str) -> int:
    """Atomically increment and return the next batch_no sequence for the year.
    SELECT FOR UPDATE prevents two concurrent requests getting the same number."""
    counter = (
        db.query(InvBatchNumberCounter)
        .filter_by(year=year)
        .with_for_update()
        .first()
    )
    if counter is None:
        counter = InvBatchNumberCounter(year=year, last_seq=_seed_max_batch_no_seq(db, year))
        db.add(counter)
        db.flush()
    counter.last_seq += 1
    return counter.last_seq


def _claim_next_seq(db: Session, year: str) -> int:
    """Atomically increment and return the next global sequence for the year.
    The sequence is shared across ALL material types — only the prefix differs.
    SELECT FOR UPDATE prevents two concurrent requests getting the same number."""
    counter = (
        db.query(InvBatchNoCounter)
        .filter_by(year=year)
        .with_for_update()
        .first()
    )
    if counter is None:
        # Seed from the highest sequence number in any existing batch this year
        pattern = f"%/{year}/%"
        rows = db.query(InvBatch.inhouse_batch_no).filter(
            InvBatch.inhouse_batch_no.like(pattern)
        ).all()
        max_seq = 10000
        for (no,) in rows:
            if no:
                try:
                    s = int(no.split('/')[-1])
                    if s > max_seq:
                        max_seq = s
                except (ValueError, IndexError):
                    pass
        counter = InvBatchNoCounter(year=year, last_seq=max_seq)
        db.add(counter)
    counter.last_seq += 1
    return counter.last_seq


@router.get("/next-batch-no")
def next_batch_no(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    """Preview-only: returns the likely next batch no without claiming it."""
    year = datetime.datetime.utcnow().strftime('%y')
    counter = db.query(InvBatchNumberCounter).filter_by(year=year).first()
    next_seq = (counter.last_seq if counter else _seed_max_batch_no_seq(db, year)) + 1
    return {"batch_no": f"{BATCH_NO_PREFIX}/{year}/{next_seq:03d}"}


@router.get("/next-pack-seq")
def next_pack_seq(
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    count = db.query(InvBatchPack).count()
    return {"next_seq": count + 1}


@router.get("/next-inhouse-no")
def next_inhouse_no(
    material_type: str = Query(...),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    """Preview-only: returns the likely next inhouse batch no without committing."""
    prefix = _make_prefix(material_type)
    year = datetime.datetime.utcnow().strftime('%y')

    # Read global year counter (no lock — preview only)
    counter = db.query(InvBatchNoCounter).filter_by(year=year).first()
    if counter:
        next_seq = counter.last_seq + 1
    else:
        # Seed preview from highest existing batch number this year
        rows = db.query(InvBatch.inhouse_batch_no).filter(
            InvBatch.inhouse_batch_no.like(f"%/{year}/%")
        ).all()
        max_seq = 10000
        for (no,) in rows:
            if no:
                try:
                    s = int(no.split('/')[-1])
                    if s > max_seq:
                        max_seq = s
                except (ValueError, IndexError):
                    pass
        next_seq = max_seq + 1

    return {"inhouse_batch_no": f"{prefix}/{year}/{next_seq}"}


@router.get("", response_model=list[BatchOut])
def list_batches(
    material_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    q = db.query(InvBatch)
    if material_id is not None:
        q = q.filter(InvBatch.material_id == material_id)
    if status:
        q = q.filter(InvBatch.status == status)
    if category:
        q = q.filter(InvBatch.category == category)
    if search:
        term = f"%{search}%"
        q = q.filter(
            InvBatch.batch_no.ilike(term) | InvBatch.inhouse_batch_no.ilike(term)
        )
    return q.order_by(InvBatch.id.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=BatchOut, status_code=201)
def create_batch(
    body: BatchCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    data = body.model_dump(exclude={"batch_no"})
    data["qty_available"] = data["qty_received"]
    include_pack = data.pop("include_pack")
    pack_number = data.get("pack_number")

    # Always generate batch_no and inhouse_batch_no server-side so the counters stay accurate
    data.pop("inhouse_batch_no", None)
    year = datetime.datetime.utcnow().strftime('%y')
    batch_seq = _claim_next_batch_no_seq(db, year)
    batch = InvBatch(batch_no=f"{BATCH_NO_PREFIX}/{year}/{batch_seq:03d}", **data, include_pack=include_pack)
    db.add(batch)
    db.flush()

    mat = db.query(__import__("app.models.inventory", fromlist=["InvMaterial"]).InvMaterial).get(batch.material_id)
    mat_prefix = _make_prefix(mat.material_type or "MAT") if mat else "MAT"
    seq = _claim_next_seq(db, year)          # global counter — shared across all prefixes
    batch.inhouse_batch_no = f"{mat_prefix}/{year}/{seq}"

    # generate packs
    if include_pack and pack_number and pack_number > 0:
        qty_per_pack = Decimal(str(batch.qty_received))
        type_letter = (batch.pack_type or 'P')[0].upper()
        for i in range(1, pack_number + 1):
            sku = f"{batch.inhouse_batch_no}/{type_letter}{i}"
            db.add(InvBatchPack(
                batch_id=batch.id,
                seq_no=i,
                pack_no=sku,
                qty_per_pack=qty_per_pack,
                qty_available=qty_per_pack,
                inhouse_batch_no=sku,
            ))

    # RECEIVED event
    db.add(InvBatchEvent(
        batch_id=batch.id,
        event_type="RECEIVED",
        qty=batch.qty_received,
        performed_by=_user_ref(current_user),
        performed_at=datetime.datetime.utcnow(),
    ))

    write_inv_audit(
        db,
        event_type="BATCH_CREATED",
        entity_type="inv_batch",
        entity_id=batch.id,
        entity_ref=batch.batch_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    return batch


@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: int,
    body: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(batch, k, v)
    write_inv_audit(
        db,
        event_type="BATCH_UPDATED",
        entity_type="inv_batch",
        entity_id=batch_id,
        entity_ref=batch.batch_no,
        performed_by=_user_ref(current_user),
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.patch("/{batch_id}/toggle", response_model=BatchOut)
def toggle_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    new_status = "AVAILABLE" if batch.status in ("QUARANTINE",) else "QUARANTINE"
    batch.status = new_status
    write_inv_audit(
        db,
        event_type="BATCH_TOGGLED",
        entity_type="inv_batch",
        entity_id=batch_id,
        entity_ref=batch.batch_no,
        performed_by=_user_ref(current_user),
        new_value=new_status,
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{batch_id}/issue", response_model=BatchOut)
def issue_batch(
    batch_id: int,
    body: BatchIssueRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    deduct_qty(
        db,
        batch_id,
        body.qty,
        event_type="ISSUED",
        performed_by=_user_ref(current_user),
        ref_no=body.ref_no,
        module=body.module,
        issued_to=body.issued_to,
        purpose=body.purpose,
        project_code=body.project_code,
        remarks=body.remarks,
    )
    write_inv_audit(
        db,
        event_type="BATCH_ISSUED",
        entity_type="inv_batch",
        entity_id=batch_id,
        performed_by=_user_ref(current_user),
        details=f"qty={body.qty}",
    )
    db.commit()
    db.refresh(batch := db.get(InvBatch, batch_id))
    return batch


@router.post("/{batch_id}/allocate", response_model=BatchOut)
def allocate_batch(
    batch_id: int,
    body: BatchAllocateRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    deduct_qty(
        db,
        batch_id,
        body.qty,
        event_type="STOCK_ALLOCATION",
        performed_by=_user_ref(current_user),
        ref_no=body.ref_no,
        module=body.module,
        issued_to=body.issued_to,
        purpose=body.purpose,
        project_code=body.project_code,
        remarks=body.remarks,
    )
    write_inv_audit(
        db,
        event_type="BATCH_ALLOCATED",
        entity_type="inv_batch",
        entity_id=batch_id,
        performed_by=_user_ref(current_user),
        details=f"qty={body.qty}",
    )
    db.commit()
    db.refresh(batch := db.get(InvBatch, batch_id))
    return batch


@router.get("/{batch_id}/events", response_model=list[BatchEventOut])
def get_batch_events(
    batch_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if not db.get(InvBatch, batch_id):
        raise HTTPException(404, "Batch not found.")
    return (
        db.query(InvBatchEvent)
        .filter_by(batch_id=batch_id)
        .order_by(InvBatchEvent.performed_at.desc())
        .all()
    )


# ── CoA file ──────────────────────────────────────────────────────────────────
@router.post("/{batch_id}/coa", response_model=BatchOut)
async def upload_coa(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    validate_upload(file, allowed_exts=ALLOWED_DOC_EXTS)
    delete_file(batch.coa_file_path)
    batch.coa_file_path = await save_upload(file, subdir=f"batches/{batch_id}/coa")
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}/coa")
def download_coa(
    batch_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch or not batch.coa_file_path:
        raise HTTPException(404, "No CoA file for this batch.")
    if not os.path.exists(batch.coa_file_path):
        raise HTTPException(404, "CoA file missing from disk.")
    return FileResponse(
        batch.coa_file_path,
        media_type="application/octet-stream",
        filename=os.path.basename(batch.coa_file_path),
    )


@router.delete("/{batch_id}/coa", response_model=BatchOut)
def delete_coa(
    batch_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    delete_file(batch.coa_file_path)
    batch.coa_file_path = None
    db.commit()
    db.refresh(batch)
    return batch


# ── Other docs file ───────────────────────────────────────────────────────────
@router.post("/{batch_id}/other-docs", response_model=BatchOut)
async def upload_other_docs(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    validate_upload(file, allowed_exts=ALLOWED_DOC_EXTS)
    delete_file(batch.other_docs_file_path)
    batch.other_docs_file_path = await save_upload(file, subdir=f"batches/{batch_id}/other-docs")
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}/other-docs")
def download_other_docs(
    batch_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch or not batch.other_docs_file_path:
        raise HTTPException(404, "No other-docs file for this batch.")
    if not os.path.exists(batch.other_docs_file_path):
        raise HTTPException(404, "Other-docs file missing from disk.")
    return FileResponse(
        batch.other_docs_file_path,
        media_type="application/octet-stream",
        filename=os.path.basename(batch.other_docs_file_path),
    )


@router.delete("/{batch_id}/other-docs", response_model=BatchOut)
def delete_other_docs(
    batch_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    batch = db.get(InvBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found.")
    delete_file(batch.other_docs_file_path)
    batch.other_docs_file_path = None
    db.commit()
    db.refresh(batch)
    return batch
