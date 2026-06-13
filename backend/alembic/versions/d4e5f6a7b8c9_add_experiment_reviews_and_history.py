"""Add experiment_reviews (multi-reviewer gate) and experiment_history (audit log).

Drops old single-reviewer columns from experiments:
  reviewer_signed_by / reviewer_signed_at / reviewer_sign_reason

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

PK    = UUID(as_uuid=False)
PUUID = UUID(as_uuid=False)

revision      = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on    = None


def upgrade():
    # ── 1. Drop old single-reviewer columns ───────────────────────────────────
    op.drop_column("experiments", "reviewer_signed_by")
    op.drop_column("experiments", "reviewer_signed_at")
    op.drop_column("experiments", "reviewer_sign_reason")

    # ── 2. experiment_reviews — one row per assigned reviewer ─────────────────
    op.create_table(
        "experiment_reviews",
        sa.Column("id",            PK,    primary_key=True),
        sa.Column("experiment_id", PUUID,
                  sa.ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id",   PUUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_by",   PUUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("assigned_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Filled when the reviewer e-signs
        sa.Column("signed_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("sign_reason", sa.String(200), nullable=True),
        sa.Column("decision",    sa.String(20),  nullable=True),   # APPROVED | REJECTED
        sa.UniqueConstraint("experiment_id", "reviewer_id", name="uq_exp_review"),
        sa.CheckConstraint(
            "decision IS NULL OR decision IN ('APPROVED','REJECTED')",
            name="ck_review_decision",
        ),
    )
    op.create_index("ix_exp_reviews_experiment_id", "experiment_reviews", ["experiment_id"])
    op.create_index("ix_exp_reviews_reviewer_id",   "experiment_reviews", ["reviewer_id"])

    # ── 3. experiment_history — immutable audit log ────────────────────────────
    op.create_table(
        "experiment_history",
        sa.Column("id",            PK,    primary_key=True),
        sa.Column("experiment_id", PUUID,
                  sa.ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id",  PUUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action",    sa.String(50), nullable=False),
        sa.Column("details",   sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_exp_history_experiment_id", "experiment_history", ["experiment_id"])
    op.create_index("ix_exp_history_created_at",    "experiment_history", ["created_at"])


def downgrade():
    op.drop_table("experiment_history")
    op.drop_table("experiment_reviews")
    op.add_column("experiments", sa.Column(
        "reviewer_signed_by", PUUID, nullable=True))
    op.add_column("experiments", sa.Column(
        "reviewer_signed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("experiments", sa.Column(
        "reviewer_sign_reason", sa.String(200), nullable=True))
