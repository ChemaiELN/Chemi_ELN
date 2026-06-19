"""Add inhouse_batch_no to inv_batches

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-06-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'o8p9q0r1s2t3'
down_revision: Union[str, None] = 'n7o8p9q0r1s2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inv_batches', sa.Column('inhouse_batch_no', sa.String(200), nullable=True))
    op.create_index('ix_inv_batches_inhouse_batch_no', 'inv_batches', ['inhouse_batch_no'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_inv_batches_inhouse_batch_no', table_name='inv_batches')
    op.drop_column('inv_batches', 'inhouse_batch_no')
