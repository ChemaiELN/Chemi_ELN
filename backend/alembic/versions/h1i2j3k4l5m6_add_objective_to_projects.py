"""add objective to projects

Revision ID: h1i2j3k4l5m6
Revises: g9h0i1j2k3l4
Create Date: 2026-06-15

"""
import sqlalchemy as sa
from alembic import op

revision = 'h1i2j3k4l5m6'
down_revision = 'g9h0i1j2k3l4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('objective', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'objective')
