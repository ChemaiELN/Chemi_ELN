from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class InvManufacturer(Base):
    __tablename__ = "inv_manufacturers"

    id             = Column(Integer, primary_key=True, index=True)
    code           = Column(String(50), unique=True, nullable=False, index=True)
    name           = Column(String(255), nullable=False)
    country        = Column(String(100), nullable=True)
    contact_person = Column(String(200), nullable=True)
    email          = Column(String(200), nullable=True)
    phone          = Column(String(50), nullable=True)
    website        = Column(String(300), nullable=True)
    address        = Column(Text, nullable=True)
    is_active      = Column(Boolean, default=True, nullable=False)

    # Relationships
    mappings = relationship("InvManufacturerMapping", back_populates="manufacturer", cascade="all, delete-orphan")
    batches  = relationship("InvBatch", back_populates="manufacturer")


class InvManufacturerMapping(Base):
    __tablename__ = "inv_manufacturer_mapping"

    id               = Column(Integer, primary_key=True, index=True)
    material_id      = Column(Integer, ForeignKey("inv_materials.id", ondelete="CASCADE"), nullable=False)
    manufacturer_id  = Column(Integer, ForeignKey("inv_manufacturers.id", ondelete="CASCADE"), nullable=False)
    catalogue_no     = Column(String(100), nullable=True)
    technical_grade  = Column(String(100), nullable=True)
    lead_time_days   = Column(Integer, nullable=True)
    min_order_qty    = Column(Numeric(10, 3), nullable=True)

    # Relationships
    material     = relationship("InvMaterial", back_populates="manufacturer_mappings")
    manufacturer = relationship("InvManufacturer", back_populates="mappings")
