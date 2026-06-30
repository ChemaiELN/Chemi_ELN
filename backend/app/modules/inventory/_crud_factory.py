"""Generic router factory for simple code/name type tables."""
from typing import Any, Callable, Type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db


def make_type_router(
    *,
    prefix: str,
    tags: list[str],
    model: Any,
    schema_create: Any,
    schema_update: Any,
    schema_out: Any,
    code_field: str = "code",
) -> APIRouter:
    """
    Build a minimal CRUD router for a type/lookup table.
    Endpoints: list, create, get, patch, deactivate.
    """
    router = APIRouter(prefix=prefix, tags=tags)

    @router.get("", response_model=list[schema_out])
    def list_all(
        active_only: bool = False,
        db: Session = Depends(get_db),
        _: Any = Depends(get_current_user),
    ):
        q = db.query(model)
        if active_only:
            q = q.filter(model.is_active.is_(True))
        return q.order_by(getattr(model, code_field)).all()

    @router.post("", response_model=schema_out, status_code=201)
    def create(
        body: schema_create,
        db: Session = Depends(get_db),
        _: Any = Depends(get_current_user),
    ):
        code_val = getattr(body, code_field, None)
        if code_val and db.query(model).filter(
            getattr(model, code_field) == code_val
        ).first():
            raise HTTPException(409, f"Code '{code_val}' already exists.")
        row = model(**body.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @router.get("/{item_id}", response_model=schema_out)
    def get_one(
        item_id: int,
        db: Session = Depends(get_db),
        _: Any = Depends(get_current_user),
    ):
        row = db.get(model, item_id)
        if not row:
            raise HTTPException(404, "Not found.")
        return row

    @router.patch("/{item_id}", response_model=schema_out)
    def update(
        item_id: int,
        body: schema_update,
        db: Session = Depends(get_db),
        _: Any = Depends(get_current_user),
    ):
        row = db.get(model, item_id)
        if not row:
            raise HTTPException(404, "Not found.")
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row

    @router.delete("/{item_id}/deactivate", response_model=schema_out)
    def deactivate(
        item_id: int,
        db: Session = Depends(get_db),
        _: Any = Depends(get_current_user),
    ):
        row = db.get(model, item_id)
        if not row:
            raise HTTPException(404, "Not found.")
        row.is_active = False
        db.commit()
        db.refresh(row)
        return row

    return router
