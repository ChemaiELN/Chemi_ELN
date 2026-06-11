"""DB integrity fixes: FK on role_privileges.updated_by, stage consistency trigger, CHECK constraints

Revision ID: f6b3c2d9e1a4
Revises: e5c2d8f14a90
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f6b3c2d9e1a4'
down_revision: Union[str, None] = 'e5c2d8f14a90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. role_privileges.updated_by FK ─────────────────────────────────────
    op.create_foreign_key(
        'fk_role_privileges_updated_by_users',
        'role_privileges', 'users',
        ['updated_by'], ['id'],
        ondelete='SET NULL',
    )

    # ── 2. Stage consistency trigger ──────────────────────────────────────────
    # Enforce that stage.project_id always matches its route.project_id
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_check_stage_project_consistency()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.project_id IS DISTINCT FROM (
                SELECT project_id FROM routes WHERE id = NEW.route_id
            ) THEN
                RAISE EXCEPTION
                    'stage.project_id (%) must match route.project_id for route %',
                    NEW.project_id, NEW.route_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_stage_project_consistency
        BEFORE INSERT OR UPDATE ON stages
        FOR EACH ROW EXECUTE FUNCTION fn_check_stage_project_consistency();
    """)

    # ── 3. CHECK constraints on ENUM-like string columns ─────────────────────

    # atr.test_type
    op.create_check_constraint(
        'chk_atr_test_type',
        'atr',
        "test_type IN ('NMR', 'HPLC', 'MS', 'IR', 'GC', 'GC-MS', 'LC-MS', 'XRD', 'DSC', 'TGA', 'UV-Vis')",
    )

    # experiment_inputs.role (nullable — NULL is allowed)
    op.create_check_constraint(
        'chk_experiment_inputs_role',
        'experiment_inputs',
        "role IS NULL OR role IN ('Reagent', 'Substrate', 'Catalyst', 'Solvent', 'Product', 'Internal Standard')",
    )

    # notification_settings.module (nullable)
    op.create_check_constraint(
        'chk_notification_settings_module',
        'notification_settings',
        "module IS NULL OR module IN ('Experiments', 'ATR', 'Projects', 'Users', 'Admin')",
    )

    # excel_templates.module (not nullable)
    op.create_check_constraint(
        'chk_excel_templates_module',
        'excel_templates',
        "module IN ('Experiments', 'ATR', 'Projects')",
    )

    # audit_log.target_type (nullable)
    op.create_check_constraint(
        'chk_audit_log_target_type',
        'audit_log',
        """target_type IS NULL OR target_type IN (
            'experiment', 'atr', 'unlock_request',
            'notebook', 'permission',
            'project', 'route', 'stage',
            'user', 'department',
            'excel_template', 'notification_setting',
            'settings'
        )""",
    )


def downgrade() -> None:
    op.drop_constraint('chk_audit_log_target_type',          'audit_log',             type_='check')
    op.drop_constraint('chk_excel_templates_module',          'excel_templates',       type_='check')
    op.drop_constraint('chk_notification_settings_module',    'notification_settings', type_='check')
    op.drop_constraint('chk_experiment_inputs_role',          'experiment_inputs',     type_='check')
    op.drop_constraint('chk_atr_test_type',                   'atr',                   type_='check')
    op.execute("DROP TRIGGER IF EXISTS trg_stage_project_consistency ON stages")
    op.execute("DROP FUNCTION IF EXISTS fn_check_stage_project_consistency()")
    op.drop_constraint('fk_role_privileges_updated_by_users', 'role_privileges',       type_='foreignkey')
