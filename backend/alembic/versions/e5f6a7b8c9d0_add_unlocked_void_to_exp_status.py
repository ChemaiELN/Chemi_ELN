"""add UNLOCKED and VOID to ck_exp_status check constraint

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-12

"""
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE experiments DROP CONSTRAINT IF EXISTS ck_exp_status")
    op.execute(
        "ALTER TABLE experiments ADD CONSTRAINT ck_exp_status "
        "CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','LOCKED','REJECTED','UNLOCKED','VOID'))"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE experiments DROP CONSTRAINT IF EXISTS ck_exp_status")
    op.execute(
        "ALTER TABLE experiments ADD CONSTRAINT ck_exp_status "
        "CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','LOCKED','REJECTED'))"
    )
