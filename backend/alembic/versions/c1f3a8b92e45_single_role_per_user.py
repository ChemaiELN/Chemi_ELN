"""single role per user — remove role tables, add role column to users

Revision ID: c1f3a8b92e45
Revises: aeb7b2f53360
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c1f3a8b92e45'
down_revision: Union[str, None] = 'aeb7b2f53360'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add role column to users, defaulting to CHEM
    op.add_column('users', sa.Column('role', sa.String(20), nullable=False, server_default='CHEM'))

    # Backfill role from user_roles junction table (take the highest-rank role)
    op.execute("""
        UPDATE users u
        SET role = (
            SELECT r.code
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
            ORDER BY CASE r.code
                WHEN 'QA'   THEN 1
                WHEN 'HOD'  THEN 2
                WHEN 'TL'   THEN 3
                WHEN 'CHEM' THEN 4
                ELSE 5
            END
            LIMIT 1
        )
        WHERE EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id)
    """)

    # Drop junction and lookup tables
    op.drop_table('role_privileges')
    op.drop_table('user_roles')
    op.drop_table('roles')

    # Remove server default now that backfill is done
    op.alter_column('users', 'role', server_default=None)


def downgrade() -> None:
    # Recreate roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code', sa.String(20), unique=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )
    # Recreate user_roles table
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('role_id', sa.String(36), sa.ForeignKey('roles.id'), primary_key=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True)),
        sa.Column('assigned_by', sa.String(36)),
    )
    # Recreate role_privileges table
    op.create_table(
        'role_privileges',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('role_id', sa.String(36), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('department_id', sa.String(36), nullable=False),
        sa.Column('privilege_key', sa.String(50), nullable=False),
        sa.Column('is_granted', sa.Boolean, nullable=False),
        sa.Column('updated_by', sa.String(36)),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )
    op.drop_column('users', 'role')
