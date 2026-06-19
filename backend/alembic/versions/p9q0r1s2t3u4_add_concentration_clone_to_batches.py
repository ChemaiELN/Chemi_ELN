"""Add concentration and clone to inv_batches

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-06-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'p9q0r1s2t3u4'
down_revision: Union[str, None] = 'o8p9q0r1s2t3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inv_batches', sa.Column('concentration', sa.Numeric(12, 4), nullable=True))
    op.add_column('inv_batches', sa.Column('clone', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('inv_batches', 'clone')
    op.drop_column('inv_batches', 'concentration')
