"""add preliminary_complete to notebooks

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'notebooks',
        sa.Column('preliminary_complete', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('notebooks', 'preliminary_complete')
