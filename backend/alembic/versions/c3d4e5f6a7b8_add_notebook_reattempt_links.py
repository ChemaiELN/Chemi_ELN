"""Add parent_notebook_id and linked_notebook_id to notebooks.

parent_notebook_id  — self-ref: points to the notebook this is a re-attempt of
linked_notebook_id  — self-ref: synthesis notebook links to its preliminary notebook

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision      = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on    = None

PUUID = UUID(as_uuid=False)


def upgrade():
    op.add_column("notebooks", sa.Column(
        "parent_notebook_id", PUUID,
        sa.ForeignKey("notebooks.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("notebooks", sa.Column(
        "linked_notebook_id", PUUID,
        sa.ForeignKey("notebooks.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("notebooks", sa.Column(
        "type", sa.String(20), nullable=True,
    ))

    op.create_index("ix_nb_parent_notebook_id", "notebooks", ["parent_notebook_id"])
    op.create_index("ix_nb_linked_notebook_id", "notebooks", ["linked_notebook_id"])


def downgrade():
    op.drop_index("ix_nb_linked_notebook_id", "notebooks")
    op.drop_index("ix_nb_parent_notebook_id",  "notebooks")
    op.drop_column("notebooks", "type")
    op.drop_column("notebooks", "linked_notebook_id")
    op.drop_column("notebooks", "parent_notebook_id")
