"""v2 indexes and constraints: FK child-table indexes, experiment status check, singleton id checks

Revision ID: b7d4e2f8a1c9
Revises: a1b2c3d4e5f6
Create Date: 2026-06-10

Covers all schema-level additions made during the v2 hardening pass:
  - Performance indexes on experiments and audit_log
  - FK indexes on all 9 child experiment tables
  - CHECK constraint enforcing valid experiment.status values
  - CHECK constraints enforcing singleton rows (id = 1) on settings tables
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b7d4e2f8a1c9'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. experiments: query-path indexes ───────────────────────────────────
    op.create_index('ix_exp_notebook_status',  'experiments', ['notebook_id',  'status'])
    op.create_index('ix_exp_project_status',   'experiments', ['project_id',   'status'])
    op.create_index('ix_exp_latest_version',   'experiments', ['is_latest_version'])
    op.create_index('ix_exp_code',             'experiments', ['full_code'],    unique=False)
    op.create_index('ix_exp_created_at',       'experiments', ['created_at'])
    op.create_index('ix_exp_root',             'experiments', ['root_experiment_id'])

    # ── 2. audit_log: query-path indexes ─────────────────────────────────────
    op.create_index('ix_audit_module_at',   'audit_log', ['module',      'created_at'])
    op.create_index('ix_audit_user_at',     'audit_log', ['user_id',     'created_at'])
    op.create_index('ix_audit_target',      'audit_log', ['target_type', 'target_id'])
    op.create_index('ix_audit_created_at',  'audit_log', ['created_at'])

    # ── 3. experiment child tables: FK indexes ────────────────────────────────
    op.create_index('ix_exp_inputs_exp_id',   'experiment_inputs',     ['experiment_id'])
    op.create_index('ix_exp_params_exp_id',   'experiment_parameters', ['experiment_id'])
    op.create_index('ix_exp_steps_exp_id',    'experiment_steps',      ['experiment_id'])
    op.create_index('ix_exp_equip_exp_id',    'experiment_equipment',  ['experiment_id'])
    op.create_index('ix_exp_tlc_exp_id',      'experiment_tlc',        ['experiment_id'])
    op.create_index('ix_exp_attach_exp_id',   'experiment_attachments',['experiment_id'])
    op.create_index('ix_exp_hist_exp_id',     'experiment_history',    ['experiment_id'])
    op.create_index('ix_exp_hist_action_at',  'experiment_history',    ['experiment_id', 'created_at'])
    op.create_index('ix_exp_comments_exp_id', 'experiment_comments',   ['experiment_id'])

    # ── 4. experiments: status domain CHECK ──────────────────────────────────
    op.create_check_constraint(
        'ck_exp_status',
        'experiments',
        "status IN ('DRAFT','SUBMITTED','VERIFIED','APPROVED','REJECTED','UNLOCKED','VOID')",
    )

    # ── 5. Settings tables: singleton id = 1 CHECK ───────────────────────────
    for table in ('company_settings', 'global_settings', 'crd_settings', 'smtp_config'):
        op.create_check_constraint(
            f'ck_{table}_singleton',
            table,
            'id = 1',
        )


def downgrade() -> None:
    # ── 5. Drop singleton checks ──────────────────────────────────────────────
    for table in ('smtp_config', 'crd_settings', 'global_settings', 'company_settings'):
        op.drop_constraint(f'ck_{table}_singleton', table, type_='check')

    # ── 4. Drop experiment status check ──────────────────────────────────────
    op.drop_constraint('ck_exp_status', 'experiments', type_='check')

    # ── 3. Drop child FK indexes ──────────────────────────────────────────────
    op.drop_index('ix_exp_comments_exp_id', table_name='experiment_comments')
    op.drop_index('ix_exp_hist_action_at',  table_name='experiment_history')
    op.drop_index('ix_exp_hist_exp_id',     table_name='experiment_history')
    op.drop_index('ix_exp_attach_exp_id',   table_name='experiment_attachments')
    op.drop_index('ix_exp_tlc_exp_id',      table_name='experiment_tlc')
    op.drop_index('ix_exp_equip_exp_id',    table_name='experiment_equipment')
    op.drop_index('ix_exp_steps_exp_id',    table_name='experiment_steps')
    op.drop_index('ix_exp_params_exp_id',   table_name='experiment_parameters')
    op.drop_index('ix_exp_inputs_exp_id',   table_name='experiment_inputs')

    # ── 2. Drop audit_log indexes ─────────────────────────────────────────────
    op.drop_index('ix_audit_created_at', table_name='audit_log')
    op.drop_index('ix_audit_target',     table_name='audit_log')
    op.drop_index('ix_audit_user_at',    table_name='audit_log')
    op.drop_index('ix_audit_module_at',  table_name='audit_log')

    # ── 1. Drop experiment query indexes ─────────────────────────────────────
    op.drop_index('ix_exp_root',             table_name='experiments')
    op.drop_index('ix_exp_created_at',       table_name='experiments')
    op.drop_index('ix_exp_code',             table_name='experiments')
    op.drop_index('ix_exp_latest_version',   table_name='experiments')
    op.drop_index('ix_exp_project_status',   table_name='experiments')
    op.drop_index('ix_exp_notebook_status',  table_name='experiments')
