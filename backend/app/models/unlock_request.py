from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class UnlockRequest(Base):
    """
    A chemist requests QA to unlock an APPROVED experiment so it can be revised.

    Workflow:
        Chemist → PENDING → QA approves → APPROVED (experiment status → UNLOCKED)
                              QA rejects → REJECTED
    """
    __tablename__ = "unlock_requests"

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id"), nullable=False)

    # Why the chemist needs to revise
    reason:        Mapped[str] = mapped_column(Text, nullable=False)

    # PENDING / APPROVED / REJECTED
    status:        Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)

    requested_by:  Mapped[str] = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    requested_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    reviewed_by:   Mapped[Optional[str]] = mapped_column(PUUID, ForeignKey("users.id"))
    reviewed_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    review_note:   Mapped[Optional[str]] = mapped_column(Text)  # QA comment on approval/rejection

    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    experiment:  Mapped["Experiment"] = relationship(foreign_keys=[experiment_id])
    requester:   Mapped["User"]       = relationship(foreign_keys=[requested_by])
    reviewer:    Mapped[Optional["User"]] = relationship(foreign_keys=[reviewed_by])


from app.models.experiment import Experiment  # noqa: E402
from app.models.user import User              # noqa: E402
