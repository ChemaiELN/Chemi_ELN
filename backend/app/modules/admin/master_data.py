"""
Master Data router — FIX-41/55.

Manages lookup tables:
  - LookupChemical (chemical library for auto-fill in experiment inputs)
  - LookupInstrument (instrument inventory)
  - Site (multi-site configuration)
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import new_uuid
from app.models.master_data import LookupChemical, LookupInstrument, Site
from app.models.user import User
from app.utils.audit import get_ip, log_action
from app.utils.deps import get_current_user, require_roles
from app.utils.privileges import require_privilege, MASTER_DATA_MANAGE

router = APIRouter()

_ADMIN = require_privilege(MASTER_DATA_MANAGE)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChemicalCreate(BaseModel):
    chemical_name: str
    cas_no:        Optional[str]   = None
    formula:       Optional[str]   = None
    mol_wt:        Optional[float] = None
    vendor_name:   Optional[str]   = None
    density:       Optional[float] = None
    purity_pct:    Optional[float] = None
    is_active:     bool            = True


class ChemicalUpdate(BaseModel):
    chemical_name: Optional[str]   = None
    cas_no:        Optional[str]   = None
    formula:       Optional[str]   = None
    mol_wt:        Optional[float] = None
    vendor_name:   Optional[str]   = None
    density:       Optional[float] = None
    purity_pct:    Optional[float] = None
    is_active:     Optional[bool]  = None


class ChemicalResponse(BaseModel):
    id:            str
    chemical_name: str
    cas_no:        Optional[str]
    formula:       Optional[str]
    mol_wt:        Optional[float]
    vendor_name:   Optional[str]
    density:       Optional[float]
    purity_pct:    Optional[float]
    is_active:     bool
    model_config = ConfigDict(from_attributes=True)


class InstrumentCreate(BaseModel):
    instrument_code:    str
    instrument_type:    Optional[str] = None
    instrument_name:    str
    maintenance_status: Optional[str] = None
    calibration_status: Optional[str] = None
    is_active:          bool          = True


class InstrumentUpdate(BaseModel):
    instrument_type:    Optional[str]  = None
    instrument_name:    Optional[str]  = None
    maintenance_status: Optional[str]  = None
    calibration_status: Optional[str]  = None
    is_active:          Optional[bool] = None


class InstrumentResponse(BaseModel):
    id:                 str
    instrument_code:    str
    instrument_type:    Optional[str]
    instrument_name:    str
    maintenance_status: Optional[str]
    calibration_status: Optional[str]
    is_active:          bool
    model_config = ConfigDict(from_attributes=True)


class SiteCreate(BaseModel):
    code:      str
    name:      str
    is_active: bool = True


class SiteUpdate(BaseModel):
    name:      Optional[str]  = None
    is_active: Optional[bool] = None


class SiteResponse(BaseModel):
    id:        str
    code:      str
    name:      str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


# ── Chemicals ─────────────────────────────────────────────────────────────────

@router.post("/chemicals", status_code=201, response_model=ChemicalResponse)
def create_chemical(
    body:    ChemicalCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_ADMIN),
):
    chem = LookupChemical(id=new_uuid(), **body.model_dump())
    db.add(chem)
    db.flush()
    log_action(
        db, user_id=actor.id, username=actor.username,
        module="MasterData", action="CHEMICAL_CREATED",
        target_type="chemical", target_id=chem.id, target_label=body.chemical_name,
        detail=f"Created chemical '{body.chemical_name}'",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(chem)
    return chem


@router.get("/chemicals", response_model=List[ChemicalResponse])
def list_chemicals(
    q:           Optional[str] = Query(None, description="Search by name, CAS number, or formula"),
    active_only: bool          = Query(True),
    page:        int           = Query(1, ge=1),
    page_size:   int           = Query(50, ge=1, le=200),
    db:          Session       = Depends(get_db),
    _:           User          = Depends(get_current_user),
):
    query = db.query(LookupChemical)
    if active_only:
        query = query.filter(LookupChemical.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            LookupChemical.chemical_name.ilike(like),
            LookupChemical.cas_no.ilike(like),
            LookupChemical.formula.ilike(like),
        ))
    return (
        query.order_by(LookupChemical.chemical_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )


@router.get("/chemicals/{chem_id}", response_model=ChemicalResponse)
def get_chemical(
    chem_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(get_current_user),
):
    chem = db.get(LookupChemical, chem_id)
    if not chem:
        raise HTTPException(404, "Chemical not found")
    return chem


@router.patch("/chemicals/{chem_id}", response_model=ChemicalResponse)
def update_chemical(
    chem_id: str,
    body:    ChemicalUpdate,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_ADMIN),
):
    chem = db.get(LookupChemical, chem_id)
    if not chem:
        raise HTTPException(404, "Chemical not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(chem, field, val)
    db.commit()
    db.refresh(chem)
    return chem


@router.delete("/chemicals/{chem_id}", status_code=204)
def delete_chemical(
    chem_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(_ADMIN),
):
    chem = db.get(LookupChemical, chem_id)
    if not chem:
        raise HTTPException(404, "Chemical not found")
    db.delete(chem)
    db.commit()


# ── Instruments ───────────────────────────────────────────────────────────────

@router.post("/instruments", status_code=201, response_model=InstrumentResponse)
def create_instrument(
    body:    InstrumentCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_ADMIN),
):
    if db.query(LookupInstrument).filter(
        LookupInstrument.instrument_code == body.instrument_code
    ).first():
        raise HTTPException(400, f"Instrument code '{body.instrument_code}' already exists")
    inst = LookupInstrument(id=new_uuid(), **body.model_dump())
    db.add(inst)
    db.flush()
    log_action(
        db, user_id=actor.id, username=actor.username,
        module="MasterData", action="INSTRUMENT_CREATED",
        target_type="instrument", target_id=inst.id, target_label=body.instrument_code,
        detail=f"Created instrument '{body.instrument_name}'",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(inst)
    return inst


@router.get("/instruments", response_model=List[InstrumentResponse])
def list_instruments(
    q:               Optional[str] = Query(None),
    active_only:     bool          = Query(True),
    instrument_type: Optional[str] = Query(None),
    page:            int           = Query(1, ge=1),
    page_size:       int           = Query(50, ge=1, le=200),
    db:              Session       = Depends(get_db),
    _:               User          = Depends(get_current_user),
):
    query = db.query(LookupInstrument)
    if active_only:
        query = query.filter(LookupInstrument.is_active.is_(True))
    if instrument_type:
        query = query.filter(LookupInstrument.instrument_type == instrument_type)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            LookupInstrument.instrument_name.ilike(like),
            LookupInstrument.instrument_code.ilike(like),
        ))
    return (
        query.order_by(LookupInstrument.instrument_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )


@router.get("/instruments/{inst_id}", response_model=InstrumentResponse)
def get_instrument(
    inst_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(get_current_user),
):
    inst = db.get(LookupInstrument, inst_id)
    if not inst:
        raise HTTPException(404, "Instrument not found")
    return inst


@router.patch("/instruments/{inst_id}", response_model=InstrumentResponse)
def update_instrument(
    inst_id: str,
    body:    InstrumentUpdate,
    db:      Session = Depends(get_db),
    _:       User    = Depends(_ADMIN),
):
    inst = db.get(LookupInstrument, inst_id)
    if not inst:
        raise HTTPException(404, "Instrument not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(inst, field, val)
    db.commit()
    db.refresh(inst)
    return inst


@router.delete("/instruments/{inst_id}", status_code=204)
def delete_instrument(
    inst_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(_ADMIN),
):
    inst = db.get(LookupInstrument, inst_id)
    if not inst:
        raise HTTPException(404, "Instrument not found")
    db.delete(inst)
    db.commit()


# ── Sites ─────────────────────────────────────────────────────────────────────

@router.post("/sites", status_code=201, response_model=SiteResponse)
def create_site(
    body:    SiteCreate,
    request: Request,
    db:      Session = Depends(get_db),
    actor:   User    = Depends(_ADMIN),
):
    if db.query(Site).filter(Site.code == body.code.upper()).first():
        raise HTTPException(400, f"Site code '{body.code}' already exists")
    site = Site(id=new_uuid(), code=body.code.upper(), name=body.name, is_active=body.is_active)
    db.add(site)
    db.flush()
    log_action(
        db, user_id=actor.id, username=actor.username,
        module="MasterData", action="SITE_CREATED",
        target_type="site", target_id=site.id, target_label=body.code,
        detail=f"Created site '{body.name}'",
        ip_address=get_ip(request),
    )
    db.commit()
    db.refresh(site)
    return site


@router.get("/sites", response_model=List[SiteResponse])
def list_sites(
    active_only: bool    = Query(True),
    db:          Session = Depends(get_db),
    _:           User    = Depends(get_current_user),
):
    q = db.query(Site)
    if active_only:
        q = q.filter(Site.is_active.is_(True))
    return q.order_by(Site.code).all()


@router.patch("/sites/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: str,
    body:    SiteUpdate,
    db:      Session = Depends(get_db),
    _:       User    = Depends(_ADMIN),
):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(site, field, val)
    db.commit()
    db.refresh(site)
    return site


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(
    site_id: str,
    db:      Session = Depends(get_db),
    _:       User    = Depends(_ADMIN),
):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    db.delete(site)
    db.commit()
