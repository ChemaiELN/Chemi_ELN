"""Add department_id to inv_materials

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PgUUID

revision = 'u4v5w6x7y8z9'
down_revision = 't3u4v5w6x7y8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'inv_materials',
        sa.Column(
            'department_id',
            PgUUID(as_uuid=False),
            sa.ForeignKey('departments.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_inv_materials_department_id', 'inv_materials', ['department_id'])


def downgrade() -> None:
    op.drop_index('ix_inv_materials_department_id', table_name='inv_materials')
    op.drop_column('inv_materials', 'department_id')
