"""add observation to projects

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-06-15

"""
import sqlalchemy as sa
from alembic import op

revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('observation', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'observation')
