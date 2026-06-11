from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class Project(Base):
    __tablename__ = "projects"

    id:            Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    code:          Mapped[str]  = mapped_column(String(20), unique=True, nullable=False)   # e.g. OQ
    name:          Mapped[str]  = mapped_column(String(255), nullable=False)
    product_name:  Mapped[Optional[str]] = mapped_column(String(255))
    project_type:  Mapped[Optional[str]] = mapped_column(String(20))   # Internal / External
    market:        Mapped[Optional[str]] = mapped_column(String(50))   # US / Europe / India / Asia
    department_id: Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("departments.id"))
    manager_id:    Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    created_by:    Mapped[str]  = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    start_date:    Mapped[Optional[date]]  = mapped_column(Date)
    target_date:   Mapped[Optional[date]]  = mapped_column(Date)
    # ACTIVE / ON HOLD / COMPLETED / CANCELLED
    status:        Mapped[str]  = mapped_column(String(20), default="ACTIVE", nullable=False)
    description:   Mapped[Optional[str]] = mapped_column(Text)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    department:     Mapped[Optional["Department"]]      = relationship(foreign_keys=[department_id])
    manager:        Mapped[Optional["User"]]            = relationship(foreign_keys=[manager_id])
    creator:        Mapped["User"]                      = relationship(foreign_keys=[created_by])
    project_users:  Mapped[List["ProjectUser"]]         = relationship(back_populates="project")
    milestones:     Mapped[List["Milestone"]]           = relationship(back_populates="project")
    routes:         Mapped[List["Route"]]               = relationship(back_populates="project")
    attachments:    Mapped[List["ProjectAttachment"]]   = relationship(back_populates="project")


class ProjectUser(Base):
    __tablename__ = "project_users"

    project_id: Mapped[str] = mapped_column(PUUID, ForeignKey("projects.id"), primary_key=True)
    user_id:    Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), primary_key=True)
    added_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    added_by:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))

    project: Mapped["Project"] = relationship(back_populates="project_users")
    user:    Mapped["User"]    = relationship(foreign_keys=[user_id])


class Milestone(Base):
    __tablename__ = "milestones"

    id:             Mapped[str]  = mapped_column(PUUID, primary_key=True, default=new_uuid)
    project_id:     Mapped[str]  = mapped_column(PUUID, ForeignKey("projects.id"), nullable=False)
    name:           Mapped[str]  = mapped_column(String(255), nullable=False)
    due_date:       Mapped[Optional[date]] = mapped_column(Date)
    completed_date: Mapped[Optional[date]] = mapped_column(Date)
    owner_id:       Mapped[Optional[str]]  = mapped_column(PUUID, ForeignKey("users.id"))
    # NOT STARTED / ON TRACK / AT RISK / DELAYED / COMPLETED
    status:         Mapped[str]  = mapped_column(String(20), default="NOT STARTED", nullable=False)
    pct:            Mapped[int]  = mapped_column(SmallInteger, default=0, nullable=False)
    created_at:     Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project:     Mapped["Project"]           = relationship(back_populates="milestones")
    owner:       Mapped[Optional["User"]]   = relationship(foreign_keys=[owner_id])
    attachments: Mapped[List["MilestoneAttachment"]] = relationship(back_populates="milestone", cascade="all, delete-orphan")


class ProjectAttachment(Base):
    """Files attached directly to a project (specs, contracts, reports…)."""
    __tablename__ = "project_attachments"

    id:          Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    project_id:  Mapped[str] = mapped_column(PUUID, ForeignKey("projects.id"), nullable=False)
    filename:    Mapped[str] = mapped_column(String(255), nullable=False)
    file_path:   Mapped[str] = mapped_column(String(500), nullable=False)
    file_size:   Mapped[Optional[int]]  = mapped_column(BigInteger)    # bytes
    file_type:   Mapped[Optional[str]] = mapped_column(String(50))    # pdf / xlsx / docx
    uploaded_by: Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project:    Mapped["Project"] = relationship(back_populates="attachments")
    uploader:   Mapped["User"]    = relationship(foreign_keys=[uploaded_by])


class MilestoneAttachment(Base):
    __tablename__ = "milestone_attachments"

    id:           Mapped[str]           = mapped_column(PUUID, primary_key=True, default=new_uuid)
    milestone_id: Mapped[str]           = mapped_column(PUUID, ForeignKey("milestones.id"), nullable=False)
    filename:     Mapped[str]           = mapped_column(String(255), nullable=False)
    file_path:    Mapped[str]           = mapped_column(String(500), nullable=False)
    file_size:    Mapped[Optional[int]] = mapped_column(BigInteger)
    file_type:    Mapped[Optional[str]] = mapped_column(String(50))
    uploaded_by:  Mapped[str]           = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    uploaded_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=now_utc)

    milestone: Mapped["Milestone"] = relationship(back_populates="attachments")
    uploader:  Mapped["User"]      = relationship(foreign_keys=[uploaded_by])


from app.models.department import Department  # noqa: E402
from app.models.user import User              # noqa: E402
from app.models.route import Route            # noqa: E402
