from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class InvMaterial(Base):
    __tablename__ = "inv_materials"

    id                = Column(Integer, primary_key=True, index=True)
    code              = Column(String(50), unique=True, nullable=False, index=True)
    name              = Column(String(255), nullable=False)
    material_type     = Column(String(100), nullable=True)   # Chemical, Reagent, Buffer, etc.
    cas_no            = Column(String(50), nullable=True)
    molecular_formula = Column(String(100), nullable=True)
    mol_weight        = Column(Numeric(12, 4), nullable=True)
    storage_condition = Column(String(200), nullable=True)
    hazard_class      = Column(String(100), nullable=True)
    description       = Column(Text, nullable=True)
    is_active         = Column(Boolean, default=True, nullable=False)

    # Relationships
    chemical_props    = relationship("InvMaterialChemicalProps", back_populates="material", uselist=False, cascade="all, delete-orphan")
    formulation_props = relationship("InvMaterialFormulationProps", back_populates="material", uselist=False, cascade="all, delete-orphan")
    manufacturer_mappings = relationship("InvManufacturerMapping", back_populates="material", cascade="all, delete-orphan")
    batches           = relationship("InvBatch", back_populates="material")
    stock_requests    = relationship("InvStockRequest", back_populates="material")


class InvMaterialChemicalProps(Base):
    __tablename__ = "inv_material_chemical_props"

    id          = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("inv_materials.id", ondelete="CASCADE"), unique=True, nullable=False)
    purity_pct  = Column(Numeric(6, 2), nullable=True)
    grade       = Column(String(100), nullable=True)
    appearance  = Column(String(200), nullable=True)
    solubility  = Column(String(200), nullable=True)
    boiling_pt  = Column(String(50), nullable=True)
    melting_pt  = Column(String(50), nullable=True)
    flash_pt    = Column(String(50), nullable=True)
    density     = Column(Numeric(8, 4), nullable=True)
    ph_range    = Column(String(50), nullable=True)

    material = relationship("InvMaterial", back_populates="chemical_props")


class InvMaterialFormulationProps(Base):
    __tablename__ = "inv_material_formulation_props"

    id                  = Column(Integer, primary_key=True, index=True)
    material_id         = Column(Integer, ForeignKey("inv_materials.id", ondelete="CASCADE"), unique=True, nullable=False)
    role                = Column(String(100), nullable=True)
    concentration       = Column(String(100), nullable=True)
    units               = Column(String(50), nullable=True)
    function            = Column(Text, nullable=True)
    compatibility_notes = Column(Text, nullable=True)

    material = relationship("InvMaterial", back_populates="formulation_props")
