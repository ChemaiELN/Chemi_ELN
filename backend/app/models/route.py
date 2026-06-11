from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class Route(Base):
    __tablename__ = "routes"

    id:          Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    project_id:  Mapped[str] = mapped_column(PUUID, ForeignKey("projects.id"), nullable=False)
    code:        Mapped[str] = mapped_column(String(10), nullable=False)   # R1, R2 ...
    name:        Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    sort_order:  Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    # ACTIVE / DRAFT / ARCHIVED
    status:      Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped["Project"]     = relationship(back_populates="routes")
    stages:  Mapped[List["Stage"]] = relationship(back_populates="route")


class Stage(Base):
    __tablename__ = "stages"

    id:          Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    route_id:    Mapped[str] = mapped_column(PUUID, ForeignKey("routes.id"), nullable=False)
    project_id:  Mapped[str] = mapped_column(PUUID, ForeignKey("projects.id"), nullable=False)
    code:        Mapped[str] = mapped_column(String(10), nullable=False)   # S1, S2 ...
    name:        Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    sort_order:  Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    # ACTIVE / DRAFT / ARCHIVED
    status:      Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    route:   Mapped["Route"]   = relationship(back_populates="stages")
    project: Mapped["Project"] = relationship(foreign_keys=[project_id])


from app.models.project import Project  # noqa: E402
