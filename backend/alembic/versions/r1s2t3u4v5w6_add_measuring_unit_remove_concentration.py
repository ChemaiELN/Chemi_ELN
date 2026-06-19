"""Add measuring_unit enum, remove concentration from inv_batches

Revision ID: r1s2t3u4v5w6
Revises: q0r1s2t3u4v5
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'r1s2t3u4v5w6'
down_revision = 'q0r1s2t3u4v5'
branch_labels = None
depends_on = None

measuring_unit_enum = postgresql.ENUM(
    'molarity', 'concentration', 'percentage', 'ipa',
    name='measuring_unit_enum',
)


def upgrade() -> None:
    measuring_unit_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('inv_batches',
        sa.Column('measuring_unit', sa.Enum(
            'molarity', 'concentration', 'percentage', 'ipa',
            name='measuring_unit_enum', create_type=False,
        ), nullable=True)
    )
    op.drop_column('inv_batches', 'concentration')


def downgrade() -> None:
    op.add_column('inv_batches',
        sa.Column('concentration', sa.Numeric(12, 4), nullable=True)
    )
    op.drop_column('inv_batches', 'measuring_unit')
    measuring_unit_enum.drop(op.get_bind(), checkfirst=True)
