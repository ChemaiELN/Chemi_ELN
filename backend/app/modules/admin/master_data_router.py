"""Admin master data — chemicals, instruments, sites."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.shared.privileges import require_privilege
from app.models.admin import User
from app.models.master_data_admin import LookupChemical, LookupInstrument, Site
from app.schemas.a3 import (
    ChemicalOut, ChemicalCreate, ChemicalUpdate,
    InstrumentOut, InstrumentCreate, InstrumentUpdate,
    SiteOut, SiteCreate, SiteUpdate,
)

router = APIRouter()


# ── Chemicals (/api/master-data/chemicals) ────────────────────

@router.get("/chemicals", response_model=list[ChemicalOut])
def list_chemicals(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(LookupChemical)
    if not include_inactive:
        q = q.filter_by(is_active=True)
    return q.order_by(LookupChemical.chemical_name).all()


@router.post("/chemicals", response_model=ChemicalOut, status_code=201)
def create_chemical(
    body: ChemicalCreate,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("master_data.manage"),
):
    chem = LookupChemical(**body.model_dump(), created_by=current_user.id)
    db.add(chem)
    db.commit()
    db.refresh(chem)
    return chem


@router.patch("/chemicals/{chem_id}", response_model=ChemicalOut)
def update_chemical(
    chem_id: UUID,
    body: ChemicalUpdate,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    chem = db.query(LookupChemical).filter_by(id=chem_id).first()
    if not chem:
        raise HTTPException(404, "Chemical not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(chem, k, v)
    db.commit()
    db.refresh(chem)
    return chem


@router.delete("/chemicals/{chem_id}", status_code=204)
def delete_chemical(
    chem_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    chem = db.query(LookupChemical).filter_by(id=chem_id).first()
    if not chem:
        raise HTTPException(404, "Chemical not found.")
    db.delete(chem)
    db.commit()


# ── Instruments (/api/master-data/instruments) ────────────────

@router.get("/instruments", response_model=list[InstrumentOut])
def list_instruments(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(LookupInstrument)
    if not include_inactive:
        q = q.filter_by(is_active=True)
    return q.order_by(LookupInstrument.instrument_code).all()


@router.post("/instruments", response_model=InstrumentOut, status_code=201)
def create_instrument(
    body: InstrumentCreate,
    db: Session = Depends(get_db),
    current_user: User = require_privilege("master_data.manage"),
):
    code = body.instrument_code.upper().strip()
    if db.query(LookupInstrument).filter_by(instrument_code=code).first():
        raise HTTPException(409, f"Instrument code '{code}' already exists.")
    instr = LookupInstrument(**{**body.model_dump(), "instrument_code": code}, created_by=current_user.id)
    db.add(instr)
    db.commit()
    db.refresh(instr)
    return instr


@router.patch("/instruments/{instr_id}", response_model=InstrumentOut)
def update_instrument(
    instr_id: UUID,
    body: InstrumentUpdate,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    instr = db.query(LookupInstrument).filter_by(id=instr_id).first()
    if not instr:
        raise HTTPException(404, "Instrument not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(instr, k, v)
    db.commit()
    db.refresh(instr)
    return instr


@router.delete("/instruments/{instr_id}", status_code=204)
def delete_instrument(
    instr_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    instr = db.query(LookupInstrument).filter_by(id=instr_id).first()
    if not instr:
        raise HTTPException(404, "Instrument not found.")
    db.delete(instr)
    db.commit()


# ── Sites (/api/master-data/sites) ───────────────────────────

@router.get("/sites", response_model=list[SiteOut])
def list_sites(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Site)
    if not include_inactive:
        q = q.filter_by(is_active=True)
    return q.order_by(Site.code).all()


@router.post("/sites", response_model=SiteOut, status_code=201)
def create_site(
    body: SiteCreate,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    code = body.code.upper().strip()
    if db.query(Site).filter_by(code=code).first():
        raise HTTPException(409, f"Site code '{code}' already exists.")
    site = Site(code=code, name=body.name.strip())
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.patch("/sites/{site_id}", response_model=SiteOut)
def update_site(
    site_id: UUID,
    body: SiteUpdate,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    site = db.query(Site).filter_by(id=site_id).first()
    if not site:
        raise HTTPException(404, "Site not found.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(site, k, v)
    db.commit()
    db.refresh(site)
    return site


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(
    site_id: UUID,
    db: Session = Depends(get_db),
    _: User = require_privilege("master_data.manage"),
):
    site = db.query(Site).filter_by(id=site_id).first()
    if not site:
        raise HTTPException(404, "Site not found.")
    db.delete(site)
    db.commit()
