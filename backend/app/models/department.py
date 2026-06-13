from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, PUUID, new_uuid, now_utc


class Department(Base):
    __tablename__ = "departments"

    id:          Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    code:        Mapped[str]  = mapped_column(String(20), unique=True, nullable=False)  # RD / ARD / QA
    name:        Mapped[str]  = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    is_active:   Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by:  Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
