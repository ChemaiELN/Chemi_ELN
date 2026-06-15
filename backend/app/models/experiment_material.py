from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey, Index,
    Integer, Numeric, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, PUUID, new_uuid, now_utc


class ExperimentMaterial(Base):
    """
    Records which inventory batch is reserved / issued for each reagent role
    in a synthesis experiment.

    material_role examples: "mAb", "TCEP", "LP", "DMSO", "NAC", "TFF_filter"
    status flow: RESERVED → ISSUED → RETURNED (partial use possible)
    """
    __tablename__ = "experiment_materials"
    __table_args__ = (
        Index("ix_exp_mat_experiment_id", "experiment_id"),
        Index("ix_exp_mat_batch_id",      "batch_id"),
        CheckConstraint(
            "status IN ('RESERVED','ISSUED','RETURNED')",
            name="ck_exp_mat_status",
        ),
    )

    id:            Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str] = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)

    material_role: Mapped[str]           = mapped_column(String(50),  nullable=False)   # mAb / TCEP / LP / DMSO / NAC / TFF_filter
    material_id:   Mapped[int]           = mapped_column(Integer, ForeignKey("inv_materials.id"), nullable=False)
    batch_id:      Mapped[int]           = mapped_column(Integer, ForeignKey("inv_batches.id"),   nullable=False)

    qty_reserved:  Mapped[Decimal]           = mapped_column(Numeric(12, 4), nullable=False)
    unit:          Mapped[str]               = mapped_column(String(20),  nullable=False)
    qty_issued:    Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)

    status:      Mapped[str]           = mapped_column(String(20), default="RESERVED", nullable=False)
    remarks:     Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    reserved_by: Mapped[str]      = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    reserved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    # ── Relationships ──────────────────────────────────────────────────────────
    experiment: Mapped["Experiment"]   = relationship(foreign_keys=[experiment_id])
    material:   Mapped["InvMaterial"]  = relationship(foreign_keys=[material_id])
    batch:      Mapped["InvBatch"]     = relationship(foreign_keys=[batch_id])
    reserver:   Mapped["User"]         = relationship(foreign_keys=[reserved_by])


from app.models.experiment         import Experiment   # noqa: E402
from app.models.inventory_materials import InvMaterial  # noqa: E402
from app.models.inventory_batches  import InvBatch      # noqa: E402
from app.models.user               import User          # noqa: E402
