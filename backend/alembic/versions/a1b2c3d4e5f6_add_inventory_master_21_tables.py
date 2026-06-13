"""Add Inventory Master 21 tables

Revision ID: a1b2c3d4e5f6
Revises: 596aedcab073
Create Date: 2026-06-09

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '596aedcab073'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. inv_materials ─────────────────────────────────────────────────────
    op.create_table(
        'inv_materials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('material_type', sa.String(100), nullable=True),
        sa.Column('cas_no', sa.String(50), nullable=True),
        sa.Column('molecular_formula', sa.String(100), nullable=True),
        sa.Column('mol_weight', sa.Numeric(12, 4), nullable=True),
        sa.Column('storage_condition', sa.String(200), nullable=True),
        sa.Column('hazard_class', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_materials_id',   'inv_materials', ['id'],   unique=False)
    op.create_index('ix_inv_materials_code', 'inv_materials', ['code'], unique=True)

    # ── 2. inv_material_chemical_props ───────────────────────────────────────
    op.create_table(
        'inv_material_chemical_props',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False),
        sa.Column('purity_pct', sa.Numeric(6, 2), nullable=True),
        sa.Column('grade', sa.String(100), nullable=True),
        sa.Column('appearance', sa.String(200), nullable=True),
        sa.Column('solubility', sa.String(200), nullable=True),
        sa.Column('boiling_pt', sa.String(50), nullable=True),
        sa.Column('melting_pt', sa.String(50), nullable=True),
        sa.Column('flash_pt', sa.String(50), nullable=True),
        sa.Column('density', sa.Numeric(8, 4), nullable=True),
        sa.Column('ph_range', sa.String(50), nullable=True),
        sa.ForeignKeyConstraint(['material_id'], ['inv_materials.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('material_id'),
    )
    op.create_index('ix_inv_material_chemical_props_id', 'inv_material_chemical_props', ['id'], unique=False)

    # ── 3. inv_material_formulation_props ────────────────────────────────────
    op.create_table(
        'inv_material_formulation_props',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(100), nullable=True),
        sa.Column('concentration', sa.String(100), nullable=True),
        sa.Column('units', sa.String(50), nullable=True),
        sa.Column('function', sa.Text(), nullable=True),
        sa.Column('compatibility_notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['material_id'], ['inv_materials.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('material_id'),
    )
    op.create_index('ix_inv_material_formulation_props_id', 'inv_material_formulation_props', ['id'], unique=False)

    # ── 4. inv_manufacturers ─────────────────────────────────────────────────
    op.create_table(
        'inv_manufacturers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('contact_person', sa.String(200), nullable=True),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('website', sa.String(300), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_manufacturers_id',   'inv_manufacturers', ['id'],   unique=False)
    op.create_index('ix_inv_manufacturers_code', 'inv_manufacturers', ['code'], unique=True)

    # ── 5. inv_manufacturer_mapping ──────────────────────────────────────────
    op.create_table(
        'inv_manufacturer_mapping',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False),
        sa.Column('manufacturer_id', sa.Integer(), nullable=False),
        sa.Column('catalogue_no', sa.String(100), nullable=True),
        sa.Column('technical_grade', sa.String(100), nullable=True),
        sa.Column('lead_time_days', sa.Integer(), nullable=True),
        sa.Column('min_order_qty', sa.Numeric(10, 3), nullable=True),
        sa.ForeignKeyConstraint(['material_id'],     ['inv_materials.id'],     ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['manufacturer_id'], ['inv_manufacturers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_manufacturer_mapping_id', 'inv_manufacturer_mapping', ['id'], unique=False)

    # ── 6. inv_batches ───────────────────────────────────────────────────────
    op.create_table(
        'inv_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_no', sa.String(100), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False),
        sa.Column('manufacturer_id', sa.Integer(), nullable=True),
        sa.Column('qty_received', sa.Numeric(12, 4), nullable=False),
        sa.Column('qty_available', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False, server_default='g'),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('mfg_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('retest_date', sa.Date(), nullable=True),
        sa.Column('invoice_no', sa.String(100), nullable=True),
        sa.Column('po_no', sa.String(100), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='AVAILABLE'),
        sa.Column('category', sa.String(20), nullable=False, server_default='available'),
        sa.Column('received_by', sa.String(200), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['material_id'],     ['inv_materials.id']),
        sa.ForeignKeyConstraint(['manufacturer_id'], ['inv_manufacturers.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_batches_id',       'inv_batches', ['id'],       unique=False)
    op.create_index('ix_inv_batches_batch_no', 'inv_batches', ['batch_no'], unique=True)

    # ── 7. inv_batch_events ──────────────────────────────────────────────────
    op.create_table(
        'inv_batch_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('qty', sa.Numeric(12, 4), nullable=True),
        sa.Column('ref_no', sa.String(100), nullable=True),
        sa.Column('module', sa.String(100), nullable=True),
        sa.Column('issued_to', sa.String(200), nullable=True),
        sa.Column('purpose', sa.Text(), nullable=True),
        sa.Column('project_code', sa.String(100), nullable=True),
        sa.Column('performed_by', sa.String(200), nullable=True),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['inv_batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_batch_events_id', 'inv_batch_events', ['id'], unique=False)

    # ── 8. inv_batch_verifications ───────────────────────────────────────────
    op.create_table(
        'inv_batch_verifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_no', sa.String(100), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('requested_by', sa.String(200), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('verified_by', sa.String(200), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['inv_batches.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_batch_verifications_id',         'inv_batch_verifications', ['id'],         unique=False)
    op.create_index('ix_inv_batch_verifications_request_no', 'inv_batch_verifications', ['request_no'], unique=True)

    # ── 9. inv_stock_requests ────────────────────────────────────────────────
    op.create_table(
        'inv_stock_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_no', sa.String(100), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False),
        sa.Column('qty_required', sa.Numeric(12, 4), nullable=False),
        sa.Column('unit', sa.String(20), nullable=False, server_default='g'),
        sa.Column('required_by_date', sa.Date(), nullable=True),
        sa.Column('criticality', sa.String(20), nullable=False, server_default='MEDIUM'),
        sa.Column('purpose', sa.Text(), nullable=True),
        sa.Column('requested_by', sa.String(200), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('approved_by', sa.String(200), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['material_id'], ['inv_materials.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_stock_requests_id',         'inv_stock_requests', ['id'],         unique=False)
    op.create_index('ix_inv_stock_requests_request_no', 'inv_stock_requests', ['request_no'], unique=True)

    # ── 10. inv_stock_request_events ─────────────────────────────────────────
    op.create_table(
        'inv_stock_request_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('performed_by', sa.String(200), nullable=True),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['inv_stock_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_stock_request_events_id', 'inv_stock_request_events', ['id'], unique=False)

    # ── 11. inv_equipment_types ──────────────────────────────────────────────
    op.create_table(
        'inv_equipment_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_equipment_types_id',   'inv_equipment_types', ['id'],   unique=False)
    op.create_index('ix_inv_equipment_types_code', 'inv_equipment_types', ['code'], unique=True)

    # ── 12. inv_instrument_types ─────────────────────────────────────────────
    op.create_table(
        'inv_instrument_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_instrument_types_id',   'inv_instrument_types', ['id'],   unique=False)
    op.create_index('ix_inv_instrument_types_code', 'inv_instrument_types', ['code'], unique=True)

    # ── 13. inv_column_types ─────────────────────────────────────────────────
    op.create_table(
        'inv_column_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('length_mm', sa.Numeric(8, 2), nullable=True),
        sa.Column('particle_size_um', sa.Numeric(8, 2), nullable=True),
        sa.Column('pore_size_angstrom', sa.Numeric(8, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_column_types_id',   'inv_column_types', ['id'],   unique=False)
    op.create_index('ix_inv_column_types_code', 'inv_column_types', ['code'], unique=True)

    # ── 14. inv_equipment_catalogue ──────────────────────────────────────────
    op.create_table(
        'inv_equipment_catalogue',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('equipment_type_id', sa.Integer(), nullable=True),
        sa.Column('serial_no', sa.String(100), nullable=True),
        sa.Column('manufacturer', sa.String(200), nullable=True),
        sa.Column('model', sa.String(200), nullable=True),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('last_maintenance_date', sa.Date(), nullable=True),
        sa.Column('maintenance_due_date', sa.Date(), nullable=True),
        sa.Column('maintenance_status', sa.String(20), nullable=False, server_default='OK'),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['equipment_type_id'], ['inv_equipment_types.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_equipment_catalogue_id',       'inv_equipment_catalogue', ['id'],       unique=False)
    op.create_index('ix_inv_equipment_catalogue_asset_id', 'inv_equipment_catalogue', ['asset_id'], unique=True)

    # ── 15. inv_instrument_catalogue ─────────────────────────────────────────
    op.create_table(
        'inv_instrument_catalogue',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('instrument_type_id', sa.Integer(), nullable=True),
        sa.Column('serial_no', sa.String(100), nullable=True),
        sa.Column('manufacturer', sa.String(200), nullable=True),
        sa.Column('model', sa.String(200), nullable=True),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('last_calibration_date', sa.Date(), nullable=True),
        sa.Column('calibration_due_date', sa.Date(), nullable=True),
        sa.Column('calibration_status', sa.String(20), nullable=False, server_default='OK'),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['instrument_type_id'], ['inv_instrument_types.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_instrument_catalogue_id',       'inv_instrument_catalogue', ['id'],       unique=False)
    op.create_index('ix_inv_instrument_catalogue_asset_id', 'inv_instrument_catalogue', ['asset_id'], unique=True)

    # ── 16. inv_column_catalogue ─────────────────────────────────────────────
    op.create_table(
        'inv_column_catalogue',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('column_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('column_type_id', sa.Integer(), nullable=True),
        sa.Column('serial_no', sa.String(100), nullable=True),
        sa.Column('manufacturer', sa.String(200), nullable=True),
        sa.Column('part_no', sa.String(100), nullable=True),
        sa.Column('purchased_date', sa.Date(), nullable=True),
        sa.Column('max_injections', sa.Integer(), nullable=True, server_default='500'),
        sa.Column('cumulative_injections', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='ACTIVE'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['column_type_id'], ['inv_column_types.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_column_catalogue_id',        'inv_column_catalogue', ['id'],        unique=False)
    op.create_index('ix_inv_column_catalogue_column_id', 'inv_column_catalogue', ['column_id'], unique=True)

    # ── 17. inv_maintenance_schedules ────────────────────────────────────────
    op.create_table(
        'inv_maintenance_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('maintenance_type', sa.String(100), nullable=True),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('completed_date', sa.Date(), nullable=True),
        sa.Column('technician', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='DUE'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['equipment_id'], ['inv_equipment_catalogue.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_maintenance_schedules_id', 'inv_maintenance_schedules', ['id'], unique=False)

    # ── 18. inv_calibration_schedules ────────────────────────────────────────
    op.create_table(
        'inv_calibration_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('instrument_id', sa.Integer(), nullable=False),
        sa.Column('calibration_type', sa.String(100), nullable=True),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('completed_date', sa.Date(), nullable=True),
        sa.Column('technician', sa.String(200), nullable=True),
        sa.Column('certificate_no', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='DUE'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['instrument_id'], ['inv_instrument_catalogue.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_calibration_schedules_id', 'inv_calibration_schedules', ['id'], unique=False)

    # ── 19. inv_equipment_verifications ──────────────────────────────────────
    op.create_table(
        'inv_equipment_verifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_no', sa.String(100), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('requested_by', sa.String(200), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('verified_by', sa.String(200), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['equipment_id'], ['inv_equipment_catalogue.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_equipment_verifications_id',         'inv_equipment_verifications', ['id'],         unique=False)
    op.create_index('ix_inv_equipment_verifications_request_no', 'inv_equipment_verifications', ['request_no'], unique=True)

    # ── 20. inv_instrument_verifications ─────────────────────────────────────
    op.create_table(
        'inv_instrument_verifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_no', sa.String(100), nullable=False),
        sa.Column('instrument_id', sa.Integer(), nullable=False),
        sa.Column('requested_by', sa.String(200), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('verified_by', sa.String(200), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['instrument_id'], ['inv_instrument_catalogue.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_instrument_verifications_id',         'inv_instrument_verifications', ['id'],         unique=False)
    op.create_index('ix_inv_instrument_verifications_request_no', 'inv_instrument_verifications', ['request_no'], unique=True)

    # ── 21. inv_audit_trail ──────────────────────────────────────────────────
    op.create_table(
        'inv_audit_trail',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('entity_ref', sa.String(200), nullable=True),
        sa.Column('performed_by', sa.String(200), nullable=True),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inv_audit_trail_id',           'inv_audit_trail', ['id'],           unique=False)
    op.create_index('ix_inv_audit_trail_event_type',   'inv_audit_trail', ['event_type'],   unique=False)
    op.create_index('ix_inv_audit_trail_performed_at', 'inv_audit_trail', ['performed_at'], unique=False)


def downgrade() -> None:
    op.drop_table('inv_audit_trail')
    op.drop_table('inv_instrument_verifications')
    op.drop_table('inv_equipment_verifications')
    op.drop_table('inv_calibration_schedules')
    op.drop_table('inv_maintenance_schedules')
    op.drop_table('inv_column_catalogue')
    op.drop_table('inv_instrument_catalogue')
    op.drop_table('inv_equipment_catalogue')
    op.drop_table('inv_column_types')
    op.drop_table('inv_instrument_types')
    op.drop_table('inv_equipment_types')
    op.drop_table('inv_stock_request_events')
    op.drop_table('inv_stock_requests')
    op.drop_table('inv_batch_verifications')
    op.drop_table('inv_batch_events')
    op.drop_table('inv_batches')
    op.drop_table('inv_manufacturer_mapping')
    op.drop_table('inv_manufacturers')
    op.drop_table('inv_material_formulation_props')
    op.drop_table('inv_material_chemical_props')
    op.drop_table('inv_materials')
