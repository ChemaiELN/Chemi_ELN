"""ADC Synthesis tables: extend projects/project_users/project_attachments and add 4 new tables

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PgUUID

revision = 't3u4v5w6x7y8'
down_revision = 's2t3u4v5w6x7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend projects (1.1 Project Master ADC fields) ───────────────────────
    op.add_column('projects', sa.Column('customer',            sa.String(200), nullable=True))
    op.add_column('projects', sa.Column('adc_code',            sa.String(100), nullable=True))
    op.add_column('projects', sa.Column('target_antigen',      sa.String(200), nullable=True))
    op.add_column('projects', sa.Column('antibody_clone',      sa.String(200), nullable=True))
    op.add_column('projects', sa.Column('payload',             sa.String(300), nullable=True))
    op.add_column('projects', sa.Column('linker',              sa.String(200), nullable=True))
    op.add_column('projects', sa.Column('target_dar',          sa.String(50),  nullable=True))
    op.add_column('projects', sa.Column('project_stage',       sa.String(50),  nullable=True))
    op.add_column('projects', sa.Column('qa_review_required',  sa.Boolean(),   nullable=True))

    # ── Extend project_users (team role) ──────────────────────────────────────
    op.add_column('project_users', sa.Column('role', sa.String(50), nullable=True))

    # ── Extend project_attachments (1.5 Related Documents) ───────────────────
    op.add_column('project_attachments', sa.Column('comments', sa.Text(), nullable=True))

    # ── adc_objective (1.4) ───────────────────────────────────────────────────
    op.create_table(
        'adc_objective',
        sa.Column('id',               PgUUID(as_uuid=False), primary_key=True),
        sa.Column('experiment_id',    PgUUID(as_uuid=False), sa.ForeignKey('experiments.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('study_purpose',    sa.Text(),     nullable=True),
        sa.Column('hypothesis',       sa.Text(),     nullable=True),
        sa.Column('success_criteria', sa.Text(),     nullable=True),
        sa.Column('created_at',       sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',       sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_adc_objective_experiment_id', 'adc_objective', ['experiment_id'])

    # ── adc_regulatory_classification (1.6) ──────────────────────────────────
    op.create_table(
        'adc_regulatory_classification',
        sa.Column('id',                   PgUUID(as_uuid=False), primary_key=True),
        sa.Column('experiment_id',        PgUUID(as_uuid=False), sa.ForeignKey('experiments.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('oel_band',             sa.String(50),  nullable=True),
        sa.Column('containment_category', sa.String(100), nullable=True),
        sa.Column('gmp_classification',   sa.String(50),  nullable=True),
        sa.Column('created_at',           sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',           sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_adc_regulatory_classification_experiment_id', 'adc_regulatory_classification', ['experiment_id'])

    # ── adc_risk_assessment (1.7 header) ─────────────────────────────────────
    op.create_table(
        'adc_risk_assessment',
        sa.Column('id',                 PgUUID(as_uuid=False), primary_key=True),
        sa.Column('experiment_id',      PgUUID(as_uuid=False), sa.ForeignKey('experiments.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('assessment_id',      sa.String(100), nullable=True),
        sa.Column('assessment_type',    sa.String(50),  nullable=True),
        sa.Column('last_reviewed',      sa.Date(),      nullable=True),
        sa.Column('reviewed_by',        sa.String(200), nullable=True),
        sa.Column('overall_risk_level', sa.String(20),  nullable=True),
        sa.Column('status',             sa.String(30),  nullable=True, server_default='Draft'),
        sa.Column('additional_notes',   sa.Text(),      nullable=True),
        sa.Column('created_at',         sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at',         sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_adc_risk_assessment_experiment_id', 'adc_risk_assessment', ['experiment_id'])

    # ── adc_risk_item (1.7 FMEA rows) ────────────────────────────────────────
    op.create_table(
        'adc_risk_item',
        sa.Column('id',                 sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column('risk_assessment_id', PgUUID(as_uuid=False), sa.ForeignKey('adc_risk_assessment.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seq_no',             sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('process_step',       sa.String(300), nullable=True),
        sa.Column('failure_mode',       sa.String(300), nullable=True),
        sa.Column('severity',           sa.SmallInteger(), nullable=True),
        sa.Column('occurrence',         sa.SmallInteger(), nullable=True),
        sa.Column('detection',          sa.SmallInteger(), nullable=True),
        sa.Column('rpn',                sa.Integer(),   nullable=True),
        sa.Column('mitigation',         sa.Text(),      nullable=True),
    )
    op.create_index('ix_adc_risk_item_risk_assessment_id', 'adc_risk_item', ['risk_assessment_id'])


def downgrade() -> None:
    op.drop_table('adc_risk_item')
    op.drop_table('adc_risk_assessment')
    op.drop_table('adc_regulatory_classification')
    op.drop_table('adc_objective')

    op.drop_column('project_attachments', 'comments')
    op.drop_column('project_users', 'role')

    op.drop_column('projects', 'qa_review_required')
    op.drop_column('projects', 'project_stage')
    op.drop_column('projects', 'target_dar')
    op.drop_column('projects', 'linker')
    op.drop_column('projects', 'payload')
    op.drop_column('projects', 'antibody_clone')
    op.drop_column('projects', 'target_antigen')
    op.drop_column('projects', 'adc_code')
    op.drop_column('projects', 'customer')
