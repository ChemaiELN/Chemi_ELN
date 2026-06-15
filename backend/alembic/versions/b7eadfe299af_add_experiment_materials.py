"""add_experiment_materials

Revision ID: b7eadfe299af
Revises: f8a9b0c1d2e3
Create Date: 2026-06-15

Adds experiment_materials table for tracking inventory batch reservations
per reagent role (mAb, TCEP, LP, DMSO, NAC, TFF_filter) in synthesis experiments.
Status flow: RESERVED -> ISSUED -> RETURNED
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b7eadfe299af'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'experiment_materials',
        sa.Column('id',            sa.String(),      primary_key=True),
        sa.Column('experiment_id', sa.String(),      sa.ForeignKey('experiments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('material_role', sa.String(50),    nullable=False),
        sa.Column('material_id',   sa.Integer(),     sa.ForeignKey('inv_materials.id'), nullable=False),
        sa.Column('batch_id',      sa.Integer(),     sa.ForeignKey('inv_batches.id'),   nullable=False),
        sa.Column('qty_reserved',  sa.Numeric(12, 4), nullable=False),
        sa.Column('unit',          sa.String(20),    nullable=False),
        sa.Column('qty_issued',    sa.Numeric(12, 4), nullable=True),
        sa.Column('status',        sa.String(20),    nullable=False, server_default='RESERVED'),
        sa.Column('remarks',       sa.Text(),        nullable=True),
        sa.Column('reserved_by',   sa.String(),      sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reserved_at',   sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('RESERVED','ISSUED','RETURNED')", name='ck_exp_mat_status'),
    )
    op.create_index('ix_exp_mat_experiment_id', 'experiment_materials', ['experiment_id'])
    op.create_index('ix_exp_mat_batch_id',      'experiment_materials', ['batch_id'])


def downgrade() -> None:
    op.drop_index('ix_exp_mat_batch_id',      table_name='experiment_materials')
    op.drop_index('ix_exp_mat_experiment_id', table_name='experiment_materials')
    op.drop_table('experiment_materials')
