"""Add GR/document/pack fields to inv_batches and create inv_batch_packs

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-06-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'n7o8p9q0r1s2'
down_revision: Union[str, None] = 'm6n7o8p9q0r1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. New columns on inv_batches ─────────────────────────────────────────
    op.add_column('inv_batches', sa.Column('gr_date',             sa.Date(),         nullable=True))
    op.add_column('inv_batches', sa.Column('coa_file',            sa.String(500),    nullable=True))
    op.add_column('inv_batches', sa.Column('coa_filename',        sa.String(255),    nullable=True))
    op.add_column('inv_batches', sa.Column('other_docs_file',     sa.String(500),    nullable=True))
    op.add_column('inv_batches', sa.Column('other_docs_filename', sa.String(255),    nullable=True))
    op.add_column('inv_batches', sa.Column('include_pack',        sa.Boolean(),      nullable=False, server_default=sa.text('false')))
    op.add_column('inv_batches', sa.Column('pack_type',           sa.String(100),    nullable=True))
    op.add_column('inv_batches', sa.Column('pack_number',         sa.Integer(),      nullable=True))
    op.add_column('inv_batches', sa.Column('pack_mode',           sa.String(20),     nullable=True))

    # ── 2. inv_batch_packs ────────────────────────────────────────────────────
    op.create_table(
        'inv_batch_packs',
        sa.Column('id',               sa.Integer(),      nullable=False),
        sa.Column('batch_id',         sa.Integer(),      nullable=False),
        sa.Column('seq_no',           sa.Integer(),      nullable=False),
        sa.Column('pack_no',          sa.String(20),     nullable=False),
        sa.Column('qty_per_pack',     sa.Numeric(12, 4), nullable=False),
        sa.Column('inhouse_batch_no', sa.String(200),    nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['inv_batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_batch_packs_id',       'inv_batch_packs', ['id'],       unique=False)
    op.create_index('ix_inv_batch_packs_batch_id', 'inv_batch_packs', ['batch_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_inv_batch_packs_batch_id', table_name='inv_batch_packs')
    op.drop_index('ix_inv_batch_packs_id',       table_name='inv_batch_packs')
    op.drop_table('inv_batch_packs')

    op.drop_column('inv_batches', 'pack_mode')
    op.drop_column('inv_batches', 'pack_number')
    op.drop_column('inv_batches', 'pack_type')
    op.drop_column('inv_batches', 'include_pack')
    op.drop_column('inv_batches', 'other_docs_filename')
    op.drop_column('inv_batches', 'other_docs_file')
    op.drop_column('inv_batches', 'coa_filename')
    op.drop_column('inv_batches', 'coa_file')
    op.drop_column('inv_batches', 'gr_date')
