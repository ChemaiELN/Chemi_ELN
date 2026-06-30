"""Inventory – Test Types, Names, and Methods CRUD (no audit trail)."""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.inventory import InvTestMethod, InvTestName, InvTestType
from app.schemas.inventory import (
    TestMethodCreate,
    TestMethodOut,
    TestMethodUpdate,
    TestNameCreate,
    TestNameOut,
    TestNameUpdate,
    TestTypeCreate,
    TestTypeOut,
    TestTypeUpdate,
)

router = APIRouter(prefix="/inventory/test-master", tags=["inventory-test-master"])


@router.get("", response_model=list[TestTypeOut])
def list_types(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    return db.query(InvTestType).order_by(InvTestType.type_key).offset(skip).limit(limit).all()


@router.post("", response_model=TestTypeOut, status_code=201)
def create_type(
    body: TestTypeCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if db.query(InvTestType).filter_by(type_key=body.type_key).first():
        raise HTTPException(409, f"type_key '{body.type_key}' already exists.")
    row = InvTestType(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{type_key}", response_model=TestTypeOut)
def get_type(
    type_key: str,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.query(InvTestType).filter_by(type_key=type_key).first()
    if not row:
        raise HTTPException(404, "Test type not found.")
    return row


@router.patch("/{type_key}", response_model=TestTypeOut)
def update_type(
    type_key: str,
    body: TestTypeUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.query(InvTestType).filter_by(type_key=type_key).first()
    if not row:
        raise HTTPException(404, "Test type not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


# ── Test Names ─────────────────────────────────────────────────────────────────
@router.post("/{type_key}/names", response_model=TestNameOut, status_code=201)
def create_name(
    type_key: str,
    body: TestNameCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    tt = db.query(InvTestType).filter_by(type_key=type_key).first()
    if not tt:
        raise HTTPException(404, "Test type not found.")
    row = InvTestName(test_type_id=tt.id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/names/{name_id}", response_model=TestNameOut)
def update_name(
    name_id: int,
    body: TestNameUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvTestName, name_id)
    if not row:
        raise HTTPException(404, "Test name not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/names/{name_id}", status_code=204)
def delete_name(
    name_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvTestName, name_id)
    if not row:
        raise HTTPException(404, "Test name not found.")
    db.delete(row)
    db.commit()


# ── Test Methods ───────────────────────────────────────────────────────────────
@router.post("/names/{name_id}/methods", response_model=TestMethodOut, status_code=201)
def create_method(
    name_id: int,
    body: TestMethodCreate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    if not db.get(InvTestName, name_id):
        raise HTTPException(404, "Test name not found.")
    row = InvTestMethod(test_name_id=name_id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/methods/{method_id}", response_model=TestMethodOut)
def update_method(
    method_id: int,
    body: TestMethodUpdate,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvTestMethod, method_id)
    if not row:
        raise HTTPException(404, "Test method not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/methods/{method_id}", status_code=204)
def delete_method(
    method_id: int,
    db: Session = Depends(get_db),
    _: Any = Depends(get_current_user),
):
    row = db.get(InvTestMethod, method_id)
    if not row:
        raise HTTPException(404, "Test method not found.")
    db.delete(row)
    db.commit()
