from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.models.base import Base


class InvGeneralLookup(Base):
    __tablename__ = "inv_general_lookup"

    id           = Column(Integer, primary_key=True, index=True)
    lookup_type  = Column(String(100), nullable=False, index=True)
    lookup_value = Column(String(200), nullable=False)
    lookup_code  = Column(String(100), nullable=False)
    description  = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True, nullable=False)
    created_by   = Column(String(255), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
