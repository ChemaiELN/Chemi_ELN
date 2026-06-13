"""add scheme_mol to experiments

Revision ID: f8a9b0c1d2e3
Revises: e5f6a7b8c9d0
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "f8a9b0c1d2e3"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "experiments",
        sa.Column("scheme_mol", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("experiments", "scheme_mol")
