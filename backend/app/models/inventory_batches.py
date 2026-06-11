from sqlalchemy import Column, Integer, String, Text, Boolean, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class InvBatch(Base):
    __tablename__ = "inv_batches"

    id              = Column(Integer, primary_key=True, index=True)
    batch_no        = Column(String(100), unique=True, nullable=False, index=True)
    material_id     = Column(Integer, ForeignKey("inv_materials.id"), nullable=False)
    manufacturer_id = Column(Integer, ForeignKey("inv_manufacturers.id"), nullable=True)
    qty_received    = Column(Numeric(12, 4), nullable=False)
    qty_available   = Column(Numeric(12, 4), nullable=False)
    unit            = Column(String(20), nullable=False, default="g")
    location        = Column(String(200), nullable=True)
    mfg_date        = Column(Date, nullable=True)
    expiry_date     = Column(Date, nullable=True)
    retest_date     = Column(Date, nullable=True)
    invoice_no      = Column(String(100), nullable=True)
    po_no           = Column(String(100), nullable=True)
    remarks         = Column(Text, nullable=True)
    # status: AVAILABLE, PARTIALLY_CONSUMED, CONSUMED, EXPIRED, QUARANTINE
    status          = Column(String(30), nullable=False, default="AVAILABLE")
    # category: available, non_available, historic
    category        = Column(String(20), nullable=False, default="available")
    received_by     = Column(String(200), nullable=True)
    received_at     = Column(DateTime(timezone=True), server_default=func.now())
    is_active       = Column(Boolean, default=True, nullable=False)

    # Relationships
    material      = relationship("InvMaterial", back_populates="batches")
    manufacturer  = relationship("InvManufacturer", back_populates="batches")
    events        = relationship("InvBatchEvent", back_populates="batch", cascade="all, delete-orphan")
    verifications = relationship("InvBatchVerification", back_populates="batch", cascade="all, delete-orphan")


class InvBatchEvent(Base):
    __tablename__ = "inv_batch_events"

    id           = Column(Integer, primary_key=True, index=True)
    batch_id     = Column(Integer, ForeignKey("inv_batches.id", ondelete="CASCADE"), nullable=False)
    # event_type: RECEIVED, ISSUED, STOCK_ALLOCATION, LABEL_GENERATED, ADJUSTMENT, DISPOSAL
    event_type   = Column(String(50), nullable=False)
    qty          = Column(Numeric(12, 4), nullable=True)
    ref_no       = Column(String(100), nullable=True)
    module       = Column(String(100), nullable=True)   # ADC / QC / R&D
    issued_to    = Column(String(200), nullable=True)
    purpose      = Column(Text, nullable=True)
    project_code = Column(String(100), nullable=True)
    performed_by = Column(String(200), nullable=True)
    performed_at = Column(DateTime(timezone=True), server_default=func.now())
    remarks      = Column(Text, nullable=True)

    batch = relationship("InvBatch", back_populates="events")


class InvBatchVerification(Base):
    __tablename__ = "inv_batch_verifications"

    id           = Column(Integer, primary_key=True, index=True)
    request_no   = Column(String(100), unique=True, nullable=False, index=True)
    batch_id     = Column(Integer, ForeignKey("inv_batches.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(String(200), nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_by  = Column(String(200), nullable=True)
    verified_at  = Column(DateTime(timezone=True), nullable=True)
    # status: PENDING, VERIFIED, REJECTED
    status       = Column(String(20), nullable=False, default="PENDING")
    remarks      = Column(Text, nullable=True)

    batch = relationship("InvBatch", back_populates="verifications")
