"""Add inv_general_lookup table

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-06-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'm6n7o8p9q0r1'
down_revision: Union[str, None] = 'l5m6n7o8p9q0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inv_general_lookup',
        sa.Column('id',           sa.Integer(),      nullable=False),
        sa.Column('lookup_type',  sa.String(100),    nullable=False),
        sa.Column('lookup_value', sa.String(200),    nullable=False),
        sa.Column('lookup_code',  sa.String(100),    nullable=False),
        sa.Column('description',  sa.Text(),         nullable=True),
        sa.Column('is_active',    sa.Boolean(),      nullable=False, server_default=sa.text('true')),
        sa.Column('created_by',   sa.String(255),    nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at',   sa.DateTime(timezone=True), nullable=True,  server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_general_lookup_id',          'inv_general_lookup', ['id'],          unique=False)
    op.create_index('ix_inv_general_lookup_lookup_type', 'inv_general_lookup', ['lookup_type'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_inv_general_lookup_lookup_type', table_name='inv_general_lookup')
    op.drop_index('ix_inv_general_lookup_id',          table_name='inv_general_lookup')
    op.drop_table('inv_general_lookup')
