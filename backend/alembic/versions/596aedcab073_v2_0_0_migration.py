"""v2_0_0_migration

Revision ID: 596aedcab073
Revises: f6b3c2d9e1a4
Create Date: 2026-06-09 18:06:11.298611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '596aedcab073'
down_revision: Union[str, None] = 'f6b3c2d9e1a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Step 1: Save all existing FK constraints, then drop them ──────────────
    # This is needed because we're changing column types from VARCHAR(36) to UUID.
    # PostgreSQL won't allow type changes while FK constraints reference those columns.
    op.execute("""
        CREATE TEMP TABLE _fk_backup AS
        SELECT tc.table_name,
               tc.constraint_name,
               pg_get_constraintdef(pgc.oid) AS constraint_def
        FROM information_schema.table_constraints tc
        JOIN pg_constraint pgc
            ON pgc.conname = tc.constraint_name
            AND pgc.connamespace = 'public'::regnamespace
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
    """)

    op.execute("""
        DO $$ DECLARE r record;
        BEGIN
            FOR r IN (SELECT table_name, constraint_name FROM _fk_backup ORDER BY table_name)
            LOOP
                EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
            END LOOP;
        END $$
    """)

    # ── Step 2: Create new standalone tables (no FK constraints yet) ──────────
    op.create_table('global_settings',
        sa.Column('id', sa.SmallInteger(), nullable=False),
        sa.Column('auth_type', sa.String(length=20), nullable=False),
        sa.Column('use_random_password_through_mail', sa.Boolean(), nullable=False),
        sa.Column('default_password', sa.String(length=255), nullable=True),
        sa.Column('lock_user_after_x_attempts', sa.SmallInteger(), nullable=False),
        sa.Column('password_expiry_days', sa.SmallInteger(), nullable=False),
        sa.Column('image_file_size_kb', sa.SmallInteger(), nullable=False),
        sa.Column('attachment_size_kb', sa.Integer(), nullable=False),
        sa.Column('configure_customer_enabled', sa.Boolean(), nullable=False),
        sa.Column('include_equipment_inventory', sa.Boolean(), nullable=False),
        sa.Column('instrument_service_ip', sa.String(length=255), nullable=True),
        sa.Column('qa_privilege_role', sa.String(length=20), nullable=False),
        sa.Column('email_notification_enabled', sa.Boolean(), nullable=False),
        sa.Column('smtp_host', sa.String(length=255), nullable=True),
        sa.Column('smtp_port', sa.SmallInteger(), nullable=True),
        sa.Column('smtp_pool_address', sa.String(length=255), nullable=True),
        sa.Column('smtp_auth_enabled', sa.Boolean(), nullable=False),
        sa.Column('experiment_qa_remarks_enabled', sa.Boolean(), nullable=False),
        sa.Column('experiment_report_stage', sa.String(length=30), nullable=False),
        sa.Column('experiment_per_limit', sa.SmallInteger(), nullable=False),
        sa.Column('notebook_experiment_limit', sa.SmallInteger(), nullable=False),
        sa.Column('experiment_search_result_limit', sa.SmallInteger(), nullable=False),
        sa.Column('company_logo_path', sa.String(length=500), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sites',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    # New tables with FK deps — created without FK constraints (added at step 5)
    op.create_table('lookup_chemicals',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('chemical_name', sa.String(length=255), nullable=False),
        sa.Column('cas_no', sa.String(length=30), nullable=True),
        sa.Column('formula', sa.String(length=100), nullable=True),
        sa.Column('mol_wt', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('vendor_name', sa.String(length=255), nullable=True),
        sa.Column('density', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('purity_pct', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('lookup_instruments',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('instrument_code', sa.String(length=50), nullable=False),
        sa.Column('instrument_type', sa.String(length=100), nullable=True),
        sa.Column('instrument_name', sa.String(length=255), nullable=False),
        sa.Column('maintenance_status', sa.String(length=30), nullable=True),
        sa.Column('calibration_status', sa.String(length=30), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('instrument_code')
    )
    op.create_table('milestone_attachments',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('milestone_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('file_type', sa.String(length=50), nullable=True),
        sa.Column('uploaded_by', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('experiment_equipment',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('experiment_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('instrument_code', sa.String(length=50), nullable=True),
        sa.Column('instrument_type', sa.String(length=100), nullable=True),
        sa.Column('instrument_name', sa.String(length=255), nullable=True),
        sa.Column('maintenance_status', sa.String(length=30), nullable=True),
        sa.Column('calibration_status', sa.String(length=30), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('remarks', sa.String(length=500), nullable=True),
        sa.Column('added_by', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('added_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('experiment_excel_templates',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('experiment_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('template_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('linked_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('linked_by', sa.UUID(as_uuid=False), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('experiment_steps',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('experiment_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('step_no', sa.Integer(), nullable=False),
        sa.Column('procedure_text', sa.Text(), nullable=True),
        sa.Column('observation_text', sa.Text(), nullable=True),
        sa.Column('qty', sa.String(length=50), nullable=True),
        sa.Column('temperature', sa.String(length=50), nullable=True),
        sa.Column('attachment_path', sa.String(length=500), nullable=True),
        sa.Column('attachment_name', sa.String(length=255), nullable=True),
        sa.Column('attachment_size', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('atr_final_reports',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('atr_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('uploaded_by', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Step 3: Add new columns to existing tables ────────────────────────────
    op.add_column('atr', sa.Column('submitted_to', sa.UUID(as_uuid=False), nullable=True))
    op.add_column('atr', sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('atr', sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('atr', sa.Column('version', sa.SmallInteger(), nullable=False, server_default=sa.text("1")))
    op.add_column('atr', sa.Column('is_latest_version', sa.Boolean(), nullable=False, server_default=sa.text("true")))

    op.add_column('crd_settings', sa.Column('sample_notebook_code', sa.String(length=100), nullable=True))
    op.add_column('crd_settings', sa.Column('mandate_tl_approval_atr', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('verification_request_flow', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('route_and_stage', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('clone_procedure_without_numerical_data', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('closing_stage', sa.String(length=20), nullable=False, server_default=sa.text("''")))
    op.add_column('crd_settings', sa.Column('experiment_report_stage', sa.String(length=20), nullable=False, server_default=sa.text("''")))
    op.add_column('crd_settings', sa.Column('scheme_type', sa.String(length=30), nullable=False, server_default=sa.text("''")))
    op.add_column('crd_settings', sa.Column('procedure_display', sa.String(length=20), nullable=False, server_default=sa.text("''")))
    op.add_column('crd_settings', sa.Column('include_observation_start_end_time', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('tlc_type', sa.String(length=20), nullable=False, server_default=sa.text("''")))
    op.add_column('crd_settings', sa.Column('tlc_row_count', sa.SmallInteger(), nullable=False, server_default=sa.text("0")))
    op.add_column('crd_settings', sa.Column('reference_experiment_link_code', sa.String(length=50), nullable=True))
    op.add_column('crd_settings', sa.Column('include_reference_for_cloned_experiments', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('sla_experiments_days', sa.SmallInteger(), nullable=False, server_default=sa.text("0")))
    op.add_column('crd_settings', sa.Column('sla_delayed_submission_days', sa.SmallInteger(), nullable=False, server_default=sa.text("0")))
    op.add_column('crd_settings', sa.Column('sla_delayed_approval_days', sa.SmallInteger(), nullable=False, server_default=sa.text("0")))
    op.add_column('crd_settings', sa.Column('reauth_save', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('reauth_submit_for_verification', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('reauth_verification', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('reauth_deactivate', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('reauth_attachment_upload', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('input_default_mol_weight', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('crd_settings', sa.Column('input_default_quantity', sa.Numeric(precision=12, scale=4), nullable=True))
    op.add_column('crd_settings', sa.Column('input_auto_calc_moles', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('crd_settings', sa.Column('input_default_mole_ratio', sa.Numeric(precision=8, scale=4), nullable=True))

    op.add_column('experiment_history', sa.Column('improvement_suggestions', sa.Text(), nullable=True))
    op.add_column('experiment_history', sa.Column('submitted_to_user_id', sa.UUID(as_uuid=False), nullable=True))
    op.add_column('experiment_history', sa.Column('save_comments', sa.Text(), nullable=True))

    op.add_column('experiment_inputs', sa.Column('formula', sa.String(length=100), nullable=True))
    op.add_column('experiment_inputs', sa.Column('batch_lot_no', sa.String(length=100), nullable=True))
    op.add_column('experiment_inputs', sa.Column('vendor_name', sa.String(length=255), nullable=True))
    op.add_column('experiment_inputs', sa.Column('batch_no', sa.String(length=100), nullable=True))
    op.add_column('experiment_inputs', sa.Column('available_qty', sa.Numeric(precision=12, scale=4), nullable=True))
    op.add_column('experiment_inputs', sa.Column('required_qty', sa.Numeric(precision=12, scale=4), nullable=True))
    op.add_column('experiment_inputs', sa.Column('required_qty_unit', sa.String(length=20), nullable=True))
    op.add_column('experiment_inputs', sa.Column('density', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('experiment_inputs', sa.Column('strength', sa.Numeric(precision=8, scale=2), nullable=True))
    op.add_column('experiment_inputs', sa.Column('ww_ratio', sa.Numeric(precision=8, scale=4), nullable=True))
    op.add_column('experiment_inputs', sa.Column('molarity', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('experiment_inputs', sa.Column('remarks', sa.Text(), nullable=True))

    op.add_column('experiment_parameters', sa.Column('code', sa.String(length=20), nullable=True))
    op.add_column('experiment_parameters', sa.Column('input_output', sa.String(length=10), nullable=False, server_default=sa.text("'INPUT'")))
    op.add_column('experiment_parameters', sa.Column('user_entered_or_formula', sa.String(length=20), nullable=False, server_default=sa.text("'USER ENTERED'")))
    op.add_column('experiment_parameters', sa.Column('param_type', sa.String(length=10), nullable=False, server_default=sa.text("'NUMBER'")))
    op.add_column('experiment_parameters', sa.Column('formula_expression', sa.String(length=500), nullable=True))
    op.add_column('experiment_parameters', sa.Column('parameter_value', sa.Numeric(precision=20, scale=6), nullable=True))
    op.add_column('experiment_parameters', sa.Column('uom', sa.String(length=30), nullable=True))
    op.add_column('experiment_parameters', sa.Column('remarks', sa.String(length=500), nullable=True))

    op.add_column('experiment_tlc', sa.Column('drawing_path', sa.String(length=500), nullable=True))

    op.add_column('experiments', sa.Column('precautions', sa.Text(), nullable=True))
    op.add_column('experiments', sa.Column('is_highlighted', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('experiments', sa.Column('highlight_comments', sa.Text(), nullable=True))
    op.add_column('experiments', sa.Column('submitted_to', sa.UUID(as_uuid=False), nullable=True))
    op.add_column('experiments', sa.Column('submitted_to_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('experiments', sa.Column('post_verification_remarks', sa.Text(), nullable=True))
    op.add_column('experiments', sa.Column('improvement_suggestions', sa.Text(), nullable=True))
    op.add_column('experiments', sa.Column('save_comments', sa.Text(), nullable=True))
    op.add_column('experiments', sa.Column('reference_exp_code', sa.String(length=60), nullable=True))
    op.add_column('experiments', sa.Column('tlc_drawing_path', sa.String(length=500), nullable=True))

    op.add_column('users', sa.Column('middle_initials', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('contact_no', sa.String(length=30), nullable=True))
    op.add_column('users', sa.Column('site', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('dashboard_reference', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('allow_settings_update', sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column('users', sa.Column('must_reset_password', sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # ── Step 4: Change column types (VARCHAR→UUID, VARCHAR→Text, etc.) ─────────
    # All FK constraints have been dropped in step 1, so these can run freely.
    op.alter_column('atr', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('atr', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='experiment_id::uuid')
    op.alter_column('atr', 'notebook_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='notebook_id::uuid')
    op.alter_column('atr', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='project_id::uuid')
    op.alter_column('atr', 'status',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=30),
               existing_nullable=False)
    op.alter_column('atr', 'raised_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='raised_by::uuid')
    op.alter_column('atr', 'assigned_to',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='assigned_to::uuid')
    op.alter_column('atr', 'completed_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='completed_by::uuid')
    op.alter_column('atr', 'verified_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='verified_by::uuid')

    op.alter_column('atr_attachments', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('atr_attachments', 'atr_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='atr_id::uuid')
    op.alter_column('atr_attachments', 'uploaded_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='uploaded_by::uuid')

    op.alter_column('audit_log', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('audit_log', 'user_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='user_id::uuid')

    op.alter_column('departments', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('departments', 'created_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='created_by::uuid')

    op.alter_column('excel_templates', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('excel_templates', 'file_size',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.BigInteger(),
               existing_nullable=True,
               postgresql_using="NULLIF(file_size, '')::bigint")
    op.alter_column('excel_templates', 'uploaded_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='uploaded_by::uuid')

    op.alter_column('experiment_attachments', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiment_attachments', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')
    op.alter_column('experiment_attachments', 'uploaded_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='uploaded_by::uuid')

    op.alter_column('experiment_comments', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiment_comments', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')
    op.alter_column('experiment_comments', 'version_experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='version_experiment_id::uuid')
    op.alter_column('experiment_comments', 'parent_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='parent_id::uuid')
    op.alter_column('experiment_comments', 'created_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='created_by::uuid')

    op.alter_column('experiment_history', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiment_history', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')
    op.alter_column('experiment_history', 'version_experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='version_experiment_id::uuid')
    op.alter_column('experiment_history', 'action',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=30),
               existing_nullable=False)
    op.alter_column('experiment_history', 'action_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='action_by::uuid')

    op.alter_column('experiment_inputs', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiment_inputs', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')
    op.alter_column('experiment_inputs', 'cas_no',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=30),
               existing_nullable=True)
    op.alter_column('experiment_inputs', 'quantity',
               existing_type=sa.NUMERIC(precision=10, scale=4),
               type_=sa.Numeric(precision=12, scale=4),
               existing_nullable=True)
    op.alter_column('experiment_inputs', 'moles',
               existing_type=sa.NUMERIC(precision=12, scale=6),
               type_=sa.Numeric(precision=14, scale=8),
               existing_nullable=True)

    op.alter_column('experiment_parameters', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiment_parameters', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')

    op.alter_column('experiment_tlc', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiment_tlc', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')

    op.alter_column('experiments', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('experiments', 'notebook_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='notebook_id::uuid')
    op.alter_column('experiments', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')
    op.alter_column('experiments', 'route_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='route_id::uuid')
    op.alter_column('experiments', 'stage_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='stage_id::uuid')
    op.alter_column('experiments', 'status',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=30),
               existing_nullable=False)
    op.alter_column('experiments', 'created_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='created_by::uuid')
    op.alter_column('experiments', 'submitted_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='submitted_by::uuid')
    op.alter_column('experiments', 'verified_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='verified_by::uuid')
    op.alter_column('experiments', 'approved_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='approved_by::uuid')
    op.alter_column('experiments', 'rejected_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='rejected_by::uuid')
    op.alter_column('experiments', 'unlocked_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='unlocked_by::uuid')
    op.alter_column('experiments', 'root_experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='root_experiment_id::uuid')
    op.alter_column('experiments', 'parent_experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='parent_experiment_id::uuid')
    op.drop_column('experiments', 'scheme_mol')

    op.alter_column('milestones', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('milestones', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')
    op.alter_column('milestones', 'owner_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='owner_id::uuid')

    op.alter_column('notebook_permissions', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('notebook_permissions', 'notebook_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='notebook_id::uuid')
    op.alter_column('notebook_permissions', 'user_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='user_id::uuid')
    op.alter_column('notebook_permissions', 'granted_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='granted_by::uuid')

    op.alter_column('notebooks', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('notebooks', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')
    op.alter_column('notebooks', 'route_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='route_id::uuid')
    op.alter_column('notebooks', 'stage_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='stage_id::uuid')
    op.alter_column('notebooks', 'created_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='created_by::uuid')

    op.alter_column('notification_settings', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')

    op.alter_column('password_reset_tokens', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('password_reset_tokens', 'user_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='user_id::uuid')

    op.alter_column('project_attachments', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('project_attachments', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')
    op.alter_column('project_attachments', 'uploaded_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='uploaded_by::uuid')

    op.alter_column('project_users', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')
    op.alter_column('project_users', 'user_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='user_id::uuid')
    op.alter_column('project_users', 'added_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='added_by::uuid')

    op.alter_column('projects', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('projects', 'department_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='department_id::uuid')
    op.alter_column('projects', 'manager_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='manager_id::uuid')
    op.alter_column('projects', 'created_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='created_by::uuid')

    op.alter_column('refresh_tokens', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('refresh_tokens', 'user_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='user_id::uuid')

    op.alter_column('role_privileges', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('role_privileges', 'role_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='role_id::uuid')
    op.alter_column('role_privileges', 'department_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='department_id::uuid')
    op.alter_column('role_privileges', 'updated_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='updated_by::uuid')

    op.alter_column('roles', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('roles', 'description',
               existing_type=sa.VARCHAR(length=500),
               type_=sa.Text(),
               existing_nullable=True)

    op.alter_column('routes', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('routes', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')

    op.alter_column('sequence_counters', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')

    op.alter_column('stages', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('stages', 'route_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='route_id::uuid')
    op.alter_column('stages', 'project_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='project_id::uuid')

    op.alter_column('unlock_requests', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('unlock_requests', 'experiment_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='experiment_id::uuid')
    op.alter_column('unlock_requests', 'requested_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='requested_by::uuid')
    op.alter_column('unlock_requests', 'reviewed_by',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='reviewed_by::uuid')

    op.alter_column('users', 'id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='id::uuid')
    op.alter_column('users', 'role_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=False,
               postgresql_using='role_id::uuid')
    op.alter_column('users', 'department_id',
               existing_type=sa.VARCHAR(length=36),
               type_=sa.UUID(as_uuid=False),
               existing_nullable=True,
               postgresql_using='department_id::uuid')

    # ── Step 5: Restore all original FK constraints ───────────────────────────
    op.execute("""
        DO $$ DECLARE r record;
        BEGIN
            FOR r IN (SELECT table_name, constraint_def FROM _fk_backup ORDER BY table_name)
            LOOP
                EXECUTE format('ALTER TABLE %I ADD %s', r.table_name, r.constraint_def);
            END LOOP;
        END $$
    """)

    # ── Step 6: Add new FK constraints (new columns + new tables) ─────────────
    # New FK columns on existing tables
    op.create_foreign_key(None, 'atr', 'users', ['submitted_to'], ['id'])
    op.create_foreign_key(None, 'experiment_history', 'users', ['submitted_to_user_id'], ['id'])
    op.create_foreign_key(None, 'experiments', 'users', ['submitted_to'], ['id'])

    # FK constraints for new tables
    op.create_foreign_key(None, 'lookup_chemicals', 'users', ['created_by'], ['id'])
    op.create_foreign_key(None, 'lookup_instruments', 'users', ['created_by'], ['id'])
    op.create_foreign_key(None, 'milestone_attachments', 'milestones', ['milestone_id'], ['id'])
    op.create_foreign_key(None, 'milestone_attachments', 'users', ['uploaded_by'], ['id'])
    op.create_foreign_key(None, 'experiment_equipment', 'experiments', ['experiment_id'], ['id'])
    op.create_foreign_key(None, 'experiment_equipment', 'users', ['added_by'], ['id'])
    op.create_foreign_key(None, 'experiment_excel_templates', 'experiments', ['experiment_id'], ['id'])
    op.create_foreign_key(None, 'experiment_excel_templates', 'excel_templates', ['template_id'], ['id'])
    op.create_foreign_key(None, 'experiment_excel_templates', 'users', ['linked_by'], ['id'])
    op.create_foreign_key(None, 'experiment_steps', 'experiments', ['experiment_id'], ['id'])
    op.create_foreign_key(None, 'atr_final_reports', 'atr', ['atr_id'], ['id'])
    op.create_foreign_key(None, 'atr_final_reports', 'users', ['uploaded_by'], ['id'])


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, 'atr_final_reports', type_='foreignkey')
    op.drop_constraint(None, 'atr_final_reports', type_='foreignkey')
    op.drop_constraint(None, 'experiment_steps', type_='foreignkey')
    op.drop_constraint(None, 'experiment_excel_templates', type_='foreignkey')
    op.drop_constraint(None, 'experiment_excel_templates', type_='foreignkey')
    op.drop_constraint(None, 'experiment_excel_templates', type_='foreignkey')
    op.drop_constraint(None, 'experiment_equipment', type_='foreignkey')
    op.drop_constraint(None, 'experiment_equipment', type_='foreignkey')
    op.drop_constraint(None, 'milestone_attachments', type_='foreignkey')
    op.drop_constraint(None, 'milestone_attachments', type_='foreignkey')
    op.drop_constraint(None, 'lookup_instruments', type_='foreignkey')
    op.drop_constraint(None, 'lookup_chemicals', type_='foreignkey')
    op.drop_constraint(None, 'experiments', type_='foreignkey')
    op.drop_constraint(None, 'experiment_history', type_='foreignkey')
    op.drop_constraint(None, 'atr', type_='foreignkey')

    op.alter_column('users', 'department_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('users', 'role_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('users', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('users', 'must_reset_password')
    op.drop_column('users', 'allow_settings_update')
    op.drop_column('users', 'dashboard_reference')
    op.drop_column('users', 'site')
    op.drop_column('users', 'contact_no')
    op.drop_column('users', 'middle_initials')
    op.alter_column('unlock_requests', 'reviewed_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('unlock_requests', 'requested_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('unlock_requests', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('unlock_requests', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('stages', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('stages', 'route_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('stages', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('sequence_counters', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('routes', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('routes', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('roles', 'description',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=500),
               existing_nullable=True)
    op.alter_column('roles', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('role_privileges', 'updated_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('role_privileges', 'department_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('role_privileges', 'role_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('role_privileges', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('refresh_tokens', 'user_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('refresh_tokens', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('projects', 'created_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('projects', 'manager_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('projects', 'department_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('projects', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('project_users', 'added_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('project_users', 'user_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('project_users', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('project_attachments', 'uploaded_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('project_attachments', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('project_attachments', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('password_reset_tokens', 'user_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('password_reset_tokens', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notification_settings', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notebooks', 'created_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notebooks', 'stage_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('notebooks', 'route_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('notebooks', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notebooks', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notebook_permissions', 'granted_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('notebook_permissions', 'user_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notebook_permissions', 'notebook_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('notebook_permissions', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('milestones', 'owner_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('milestones', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('milestones', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.add_column('experiments', sa.Column('scheme_mol', sa.TEXT(), autoincrement=False, nullable=True))
    op.alter_column('experiments', 'parent_experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'root_experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'unlocked_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'rejected_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'approved_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'verified_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'submitted_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'created_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiments', 'status',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False)
    op.alter_column('experiments', 'stage_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'route_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiments', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiments', 'notebook_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiments', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('experiments', 'tlc_drawing_path')
    op.drop_column('experiments', 'reference_exp_code')
    op.drop_column('experiments', 'save_comments')
    op.drop_column('experiments', 'improvement_suggestions')
    op.drop_column('experiments', 'post_verification_remarks')
    op.drop_column('experiments', 'submitted_to_at')
    op.drop_column('experiments', 'submitted_to')
    op.drop_column('experiments', 'highlight_comments')
    op.drop_column('experiments', 'is_highlighted')
    op.drop_column('experiments', 'precautions')
    op.alter_column('experiment_tlc', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_tlc', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('experiment_tlc', 'drawing_path')
    op.alter_column('experiment_parameters', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_parameters', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('experiment_parameters', 'remarks')
    op.drop_column('experiment_parameters', 'uom')
    op.drop_column('experiment_parameters', 'parameter_value')
    op.drop_column('experiment_parameters', 'formula_expression')
    op.drop_column('experiment_parameters', 'param_type')
    op.drop_column('experiment_parameters', 'user_entered_or_formula')
    op.drop_column('experiment_parameters', 'input_output')
    op.drop_column('experiment_parameters', 'code')
    op.alter_column('experiment_inputs', 'moles',
               existing_type=sa.Numeric(precision=14, scale=8),
               type_=sa.NUMERIC(precision=12, scale=6),
               existing_nullable=True)
    op.alter_column('experiment_inputs', 'quantity',
               existing_type=sa.Numeric(precision=12, scale=4),
               type_=sa.NUMERIC(precision=10, scale=4),
               existing_nullable=True)
    op.alter_column('experiment_inputs', 'cas_no',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
    op.alter_column('experiment_inputs', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_inputs', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('experiment_inputs', 'remarks')
    op.drop_column('experiment_inputs', 'molarity')
    op.drop_column('experiment_inputs', 'ww_ratio')
    op.drop_column('experiment_inputs', 'strength')
    op.drop_column('experiment_inputs', 'density')
    op.drop_column('experiment_inputs', 'required_qty_unit')
    op.drop_column('experiment_inputs', 'required_qty')
    op.drop_column('experiment_inputs', 'available_qty')
    op.drop_column('experiment_inputs', 'batch_no')
    op.drop_column('experiment_inputs', 'vendor_name')
    op.drop_column('experiment_inputs', 'batch_lot_no')
    op.drop_column('experiment_inputs', 'formula')
    op.alter_column('experiment_history', 'action_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_history', 'action',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False)
    op.alter_column('experiment_history', 'version_experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiment_history', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_history', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('experiment_history', 'save_comments')
    op.drop_column('experiment_history', 'submitted_to_user_id')
    op.drop_column('experiment_history', 'improvement_suggestions')
    op.alter_column('experiment_comments', 'created_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_comments', 'parent_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiment_comments', 'version_experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('experiment_comments', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_comments', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_attachments', 'uploaded_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_attachments', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('experiment_attachments', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('excel_templates', 'uploaded_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('excel_templates', 'file_size',
               existing_type=sa.BigInteger(),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
    op.alter_column('excel_templates', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('departments', 'created_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('departments', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('crd_settings', 'input_default_mole_ratio')
    op.drop_column('crd_settings', 'input_auto_calc_moles')
    op.drop_column('crd_settings', 'input_default_quantity')
    op.drop_column('crd_settings', 'input_default_mol_weight')
    op.drop_column('crd_settings', 'reauth_attachment_upload')
    op.drop_column('crd_settings', 'reauth_deactivate')
    op.drop_column('crd_settings', 'reauth_verification')
    op.drop_column('crd_settings', 'reauth_submit_for_verification')
    op.drop_column('crd_settings', 'reauth_save')
    op.drop_column('crd_settings', 'sla_delayed_approval_days')
    op.drop_column('crd_settings', 'sla_delayed_submission_days')
    op.drop_column('crd_settings', 'sla_experiments_days')
    op.drop_column('crd_settings', 'include_reference_for_cloned_experiments')
    op.drop_column('crd_settings', 'reference_experiment_link_code')
    op.drop_column('crd_settings', 'tlc_row_count')
    op.drop_column('crd_settings', 'tlc_type')
    op.drop_column('crd_settings', 'include_observation_start_end_time')
    op.drop_column('crd_settings', 'procedure_display')
    op.drop_column('crd_settings', 'scheme_type')
    op.drop_column('crd_settings', 'experiment_report_stage')
    op.drop_column('crd_settings', 'closing_stage')
    op.drop_column('crd_settings', 'clone_procedure_without_numerical_data')
    op.drop_column('crd_settings', 'route_and_stage')
    op.drop_column('crd_settings', 'verification_request_flow')
    op.drop_column('crd_settings', 'mandate_tl_approval_atr')
    op.drop_column('crd_settings', 'sample_notebook_code')
    op.alter_column('audit_log', 'user_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('audit_log', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('atr_attachments', 'uploaded_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('atr_attachments', 'atr_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('atr_attachments', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('atr', 'verified_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('atr', 'completed_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('atr', 'assigned_to',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('atr', 'raised_by',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.alter_column('atr', 'status',
               existing_type=sa.String(length=30),
               type_=sa.VARCHAR(length=20),
               existing_nullable=False)
    op.alter_column('atr', 'project_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('atr', 'notebook_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('atr', 'experiment_id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=True)
    op.alter_column('atr', 'id',
               existing_type=sa.UUID(as_uuid=False),
               type_=sa.VARCHAR(length=36),
               existing_nullable=False)
    op.drop_column('atr', 'is_latest_version')
    op.drop_column('atr', 'version')
    op.drop_column('atr', 'assigned_at')
    op.drop_column('atr', 'submitted_at')
    op.drop_column('atr', 'submitted_to')
    op.drop_table('atr_final_reports')
    op.drop_table('experiment_steps')
    op.drop_table('experiment_excel_templates')
    op.drop_table('experiment_equipment')
    op.drop_table('milestone_attachments')
    op.drop_table('lookup_instruments')
    op.drop_table('lookup_chemicals')
    op.drop_table('sites')
    op.drop_table('global_settings')
    # ### end Alembic commands ###
