"""replace users.role (code string) with users.role_id (FK -> roles.id)

Revision ID: e5c2d8f14a90
Revises: d4e9f1a23b67
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e5c2d8f14a90'
down_revision: Union[str, None] = 'd4e9f1a23b67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add role_id column (nullable while we backfill)
    op.add_column('users', sa.Column('role_id', sa.String(36), nullable=True))

    # 2. Backfill role_id from roles table using existing role code
    op.execute("""
        UPDATE users
        SET role_id = (SELECT id FROM roles WHERE code = users.role)
    """)

    # 3. Make role_id NOT NULL now that every row has a value
    op.alter_column('users', 'role_id', nullable=False)

    # 4. Add FK constraint role_id -> roles.id
    op.create_foreign_key(
        'fk_users_role_id_roles_id',
        'users', 'roles',
        ['role_id'], ['id'],
    )

    # 5. Drop the old FK on users.role -> roles.code and the role column
    op.drop_constraint('fk_users_role_roles_code', 'users', type_='foreignkey')
    op.drop_column('users', 'role')


def downgrade() -> None:
    op.add_column('users', sa.Column('role', sa.String(20), nullable=True))
    op.execute("""
        UPDATE users
        SET role = (SELECT code FROM roles WHERE id = users.role_id)
    """)
    op.alter_column('users', 'role', nullable=False)
    op.create_foreign_key(
        'fk_users_role_roles_code',
        'users', 'roles',
        ['role'], ['code'],
    )
    op.drop_constraint('fk_users_role_id_roles_id', 'users', type_='foreignkey')
    op.drop_column('users', 'role_id')
