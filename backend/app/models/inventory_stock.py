from sqlalchemy import Column, Integer, String, Text, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class InvStockRequest(Base):
    __tablename__ = "inv_stock_requests"

    id               = Column(Integer, primary_key=True, index=True)
    request_no       = Column(String(100), unique=True, nullable=False, index=True)
    material_id      = Column(Integer, ForeignKey("inv_materials.id"), nullable=False)
    qty_required     = Column(Numeric(12, 4), nullable=False)
    unit             = Column(String(20), nullable=False, default="g")
    required_by_date = Column(Date, nullable=True)
    # criticality: LOW, MEDIUM, HIGH, CRITICAL
    criticality      = Column(String(20), nullable=False, default="MEDIUM")
    purpose          = Column(Text, nullable=True)
    requested_by     = Column(String(200), nullable=True)
    requested_at     = Column(DateTime(timezone=True), server_default=func.now())
    approved_by      = Column(String(200), nullable=True)
    approved_at      = Column(DateTime(timezone=True), nullable=True)
    # status: PENDING, APPROVED, REJECTED, FULFILLED
    status           = Column(String(20), nullable=False, default="PENDING")
    remarks          = Column(Text, nullable=True)

    # Relationships
    material = relationship("InvMaterial", back_populates="stock_requests")
    events   = relationship("InvStockRequestEvent", back_populates="request", cascade="all, delete-orphan")


class InvStockRequestEvent(Base):
    __tablename__ = "inv_stock_request_events"

    id           = Column(Integer, primary_key=True, index=True)
    request_id   = Column(Integer, ForeignKey("inv_stock_requests.id", ondelete="CASCADE"), nullable=False)
    # event_type: SUBMITTED, APPROVED, REJECTED, FULFILLED, CANCELLED
    event_type   = Column(String(50), nullable=False)
    performed_by = Column(String(200), nullable=True)
    performed_at = Column(DateTime(timezone=True), server_default=func.now())
    remarks      = Column(Text, nullable=True)

    request = relationship("InvStockRequest", back_populates="events")
