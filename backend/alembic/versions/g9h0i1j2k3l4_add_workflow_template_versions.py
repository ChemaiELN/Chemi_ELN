"""add workflow_template_versions table

Revision ID: g9h0i1j2k3l4
Revises: f8a9b0c1d2e3
Create Date: 2026-06-15

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

PUUID = UUID(as_uuid=False)

revision = 'g9h0i1j2k3l4'
down_revision = 'f8a9b0c1d2e3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'workflow_template_versions',
        sa.Column('id',          PUUID,                      primary_key=True),
        sa.Column('template_id', PUUID,                      sa.ForeignKey('workflow_templates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version',     sa.Integer(),               nullable=False),
        sa.Column('definition',  sa.JSON(),                  nullable=True),
        sa.Column('saved_by',    PUUID,                      sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('saved_at',    sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_workflow_template_versions_template_id', 'workflow_template_versions', ['template_id'])


def downgrade() -> None:
    op.drop_index('ix_workflow_template_versions_template_id', table_name='workflow_template_versions')
    op.drop_table('workflow_template_versions')
