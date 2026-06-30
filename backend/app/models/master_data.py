import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


def _uuid():
    return uuid.uuid4()


class MasterDataItem(Base):
    __tablename__ = "master_data_items"
    __table_args__ = (
        UniqueConstraint("category", "code", name="uq_master_data_category_code"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    category = Column(String(50), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
