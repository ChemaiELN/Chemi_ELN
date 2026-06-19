"""void fields, drop orphaned tables, fix experiment_history index, cleanup privileges

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-06-16

Changes:
  BUG-005: Add voided_by, voided_at, void_reason to experiments
  BUG-012: Drop bad ix_exp_hist_action_at index (column doesn't exist); ensure
           ix_exp_history_created_at index exists on the real created_at column
  BUG-015: Drop legacy v1 tables that have no v2 ORM model
  BUG-022: Delete orphaned role_privileges rows for the removed experiments.verify key
  BUG-004: Seed EXP sequence counter from current max base_code
"""
from alembic import op
import sqlalchemy as sa

revision      = 'l5m6n7o8p9q0'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on    = None


def upgrade():
    # ── BUG-005: Add void tracking fields to experiments ──────────────────────
    from sqlalchemy.dialects.postgresql import UUID as PgUUID
    op.add_column('experiments', sa.Column('voided_by',   PgUUID(as_uuid=False), nullable=True))
    op.add_column('experiments', sa.Column('voided_at',   sa.DateTime(timezone=True), nullable=True))
    op.add_column('experiments', sa.Column('void_reason', sa.Text(), nullable=True))

    # ── BUG-012: Fix bad migration index on experiment_history ────────────────
    # The da2536df0fed migration created ix_exp_hist_action_at on columns
    # ['action', 'action_at'] but action_at does not exist — drop it if present.
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_indexes = {idx['name'] for idx in inspector.get_indexes('experiment_history')}

    if 'ix_exp_hist_action_at' in existing_indexes:
        op.drop_index('ix_exp_hist_action_at', table_name='experiment_history')

    # Ensure the correct index on created_at exists
    if 'ix_exp_history_created_at' not in existing_indexes:
        op.create_index('ix_exp_history_created_at', 'experiment_history', ['created_at'])

    # ── BUG-015: Drop legacy v1 tables (no v2 ORM model) ─────────────────────
    legacy_tables = [
        'experiment_steps',
        'experiment_equipment',
        'experiment_inputs',
        'experiment_parameters',
        'experiment_tlc',
        'experiment_comments',
        'experiment_attachments',
    ]
    all_tables = inspector.get_table_names()
    for table in legacy_tables:
        if table in all_tables:
            op.drop_table(table)

    # ── BUG-022: Remove orphaned role_privileges rows for experiments.verify ──
    op.execute(
        "DELETE FROM role_privileges WHERE privilege_key = 'experiments.verify'"
    )

    # ── BUG-004: Seed EXP sequence counter from current max base_code ─────────
    op.execute("""
        INSERT INTO sequence_counters (id, scope_key, prefix, last_value, updated_at)
        SELECT
            gen_random_uuid(),
            'EXP',
            'EXP',
            COALESCE(
                (SELECT MAX(
                    CASE
                        WHEN base_code ~ '^EXP-[0-9]+$'
                        THEN CAST(SPLIT_PART(base_code, '-', 2) AS INTEGER)
                        ELSE 0
                    END
                ) FROM experiments),
                0
            ),
            NOW()
        ON CONFLICT (scope_key) DO UPDATE
            SET last_value = GREATEST(
                sequence_counters.last_value,
                EXCLUDED.last_value
            )
    """)


def downgrade():
    # Re-add the wrong index (to keep downgrade symmetric)
    op.create_index('ix_exp_hist_action_at', 'experiment_history', ['action'])

    op.drop_column('experiments', 'void_reason')
    op.drop_column('experiments', 'voided_at')
    op.drop_column('experiments', 'voided_by')
    # Note: dropped legacy tables and deleted privilege rows are not restored
