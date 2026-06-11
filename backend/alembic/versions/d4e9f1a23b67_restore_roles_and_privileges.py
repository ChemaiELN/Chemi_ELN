"""restore roles and role_privileges tables; add FK users.role -> roles.code

Revision ID: d4e9f1a23b67
Revises: c1f3a8b92e45
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd4e9f1a23b67'
down_revision: Union[str, None] = 'c1f3a8b92e45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Recreate roles lookup table
    op.create_table(
        'roles',
        sa.Column('id',          sa.String(36),  primary_key=True),
        sa.Column('code',        sa.String(20),  nullable=False, unique=True),
        sa.Column('name',        sa.String(100), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('is_active',   sa.Boolean,     nullable=False, server_default='true'),
        sa.Column('created_at',  sa.DateTime(timezone=True)),
    )

    # 2. Seed the four roles
    op.execute("""
        INSERT INTO roles (id, code, name, description, is_active, created_at)
        VALUES
          (gen_random_uuid()::text, 'QA',   'Quality Assurance',  'Admin role — bypasses permission checks',      true, now()),
          (gen_random_uuid()::text, 'HOD',  'Head of Department', 'Department head — manages notebooks and team', true, now()),
          (gen_random_uuid()::text, 'TL',   'Team Lead',          'Team lead — oversees chemists',                true, now()),
          (gen_random_uuid()::text, 'CHEM', 'Chemist',            'Research chemist — day-to-day lab work',       true, now())
    """)

    # 3. Add FK constraint on users.role -> roles.code
    op.create_foreign_key(
        'fk_users_role_roles_code',
        'users', 'roles',
        ['role'], ['code'],
    )

    # 4. Recreate role_privileges table
    op.create_table(
        'role_privileges',
        sa.Column('id',            sa.String(36), primary_key=True),
        sa.Column('role_id',       sa.String(36), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('department_id', sa.String(36), sa.ForeignKey('departments.id')),
        sa.Column('privilege_key', sa.String(50), nullable=False),
        sa.Column('is_granted',    sa.Boolean,    nullable=False, server_default='true'),
        sa.Column('updated_by',    sa.String(36)),
        sa.Column('updated_at',    sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table('role_privileges')
    op.drop_constraint('fk_users_role_roles_code', 'users', type_='foreignkey')
    op.drop_table('roles')
