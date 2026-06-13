"""fix experiment_history action constraint to include REJECTED

Revision ID: f7a8b9c0d1e2
Revises: e1a2b3c4d5f6
Create Date: 2026-06-11

The chk_experiment_history_action constraint was missing 'REJECTED'
causing reject_experiment to fail with an IntegrityError.
"""
from alembic import op

revision = 'f7a8b9c0d1e2'
down_revision = 'e1a2b3c4d5f6'
branch_labels = None
depends_on = None

_OLD_VALUES = (
    'CREATED', 'SAVED', 'SUBMITTED', 'VERIFIED', 'APPROVED',
    'RETURNED_FOR_REWORK', 'VOID', 'UNLOCKED', 'REVISED',
    'IMPROVEMENT_SUGGESTED', 'REASSIGNED', 'HIGHLIGHTED',
)

_NEW_VALUES = _OLD_VALUES + ('REJECTED',)


def _in_clause(values):
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"action IN ({quoted})"


def upgrade() -> None:
    op.drop_constraint('chk_experiment_history_action', 'experiment_history', type_='check')
    op.create_check_constraint(
        'chk_experiment_history_action',
        'experiment_history',
        _in_clause(_NEW_VALUES),
    )


def downgrade() -> None:
    op.drop_constraint('chk_experiment_history_action', 'experiment_history', type_='check')
    op.create_check_constraint(
        'chk_experiment_history_action',
        'experiment_history',
        _in_clause(_OLD_VALUES),
    )
