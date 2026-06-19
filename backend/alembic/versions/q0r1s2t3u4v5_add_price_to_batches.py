"""Add price to inv_batches

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'q0r1s2t3u4v5'
down_revision: Union[str, None] = 'p9q0r1s2t3u4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inv_batches', sa.Column('price', sa.Numeric(14, 4), nullable=True))


def downgrade() -> None:
    op.drop_column('inv_batches', 'price')
