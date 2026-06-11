"""add scheme_mol to experiments

Revision ID: e1a2b3c4d5f6
Revises: da2536df0fed
Create Date: 2026-06-11

"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = 'e1a2b3c4d5f6'
down_revision: Union[str, None] = 'da2536df0fed'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'experiments',
        sa.Column('scheme_mol', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('experiments', 'scheme_mol')
