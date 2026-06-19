"""Add measuring_unit_value column to inv_batches

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa

revision = 's2t3u4v5w6x7'
down_revision = 'r1s2t3u4v5w6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('inv_batches',
        sa.Column('measuring_unit_value', sa.Numeric(12, 4), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('inv_batches', 'measuring_unit_value')
