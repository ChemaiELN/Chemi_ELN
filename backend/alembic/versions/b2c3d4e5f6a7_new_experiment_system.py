"""New experiment system: workflow_templates, redesigned experiments, experiment_files.
Drops old experiment-related tables and adds template columns to notebooks.

Revision ID: b2c3d4e5f6a7
Revises: f7a8b9c0d1e2
Create Date: 2026-06-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

PK   = UUID(as_uuid=False)   # primary key column type
PUUID = UUID(as_uuid=False)  # FK column type

revision      = "b2c3d4e5f6a7"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on    = None


def upgrade():
    # ── 1. Drop old experiment sub-tables (children first) ────────────────────
    op.drop_table("experiment_comments")
    op.drop_table("experiment_history")
    op.drop_table("experiment_attachments")
    op.drop_table("experiment_tlc")
    op.drop_table("experiment_parameters")
    op.drop_table("experiment_inputs")
    op.drop_table("experiment_equipment")
    op.drop_table("experiment_steps")

    # Drop experiments with CASCADE to remove all FKs pointing to it
    # (atr.fk_atr_experiment_id, unlock_requests.fk_ur_experiment_id,
    #  experiment_excel_templates.experiment_excel_templates_experiment_id_fkey, etc.)
    op.execute("DROP TABLE experiments CASCADE")

    # ── 2. Create workflow_templates ──────────────────────────────────────────
    op.create_table(
        "workflow_templates",
        sa.Column("id",          PK,             primary_key=True),
        sa.Column("name",        sa.String(255), nullable=False),
        sa.Column("slug",        sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text,        nullable=True),
        sa.Column("category",    sa.String(100), nullable=True),
        sa.Column("version",     sa.Integer,     nullable=False, server_default="1"),
        sa.Column("is_active",   sa.Boolean,     nullable=False, server_default=sa.true()),
        sa.Column("definition",  sa.JSON,        nullable=True),
        sa.Column("created_by",  PUUID,          sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_workflow_templates_slug",     "workflow_templates", ["slug"],     unique=True)
    op.create_index("ix_workflow_templates_category", "workflow_templates", ["category"], unique=False)

    # ── 3. Add template columns to notebooks ──────────────────────────────────
    op.add_column("notebooks", sa.Column(
        "template_id", PUUID,
        sa.ForeignKey("workflow_templates.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.add_column("notebooks", sa.Column("template_snapshot", sa.JSON, nullable=True))

    # description column: widen from String(1000) to Text if not already
    # (safe to run even if already Text on some DBs)
    op.alter_column("notebooks", "description",
        existing_type=sa.String(1000), type_=sa.Text, existing_nullable=True)

    # ── 4. Create new experiments table ───────────────────────────────────────
    op.create_table(
        "experiments",
        sa.Column("id",           PK,             primary_key=True),
        sa.Column("notebook_id",  PUUID,          sa.ForeignKey("notebooks.id"), nullable=False),
        sa.Column("project_id",   PUUID,          sa.ForeignKey("projects.id"),  nullable=False),
        # Identity
        sa.Column("base_code",    sa.String(50),  nullable=False),
        sa.Column("version",      sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("full_code",    sa.String(60),  nullable=False, unique=True),
        sa.Column("title",        sa.String(255), nullable=False),
        # Template screen link
        sa.Column("screen_key",   sa.String(100), nullable=True),
        sa.Column("section_key",  sa.String(100), nullable=True),
        # Data
        sa.Column("data",         sa.JSON,        nullable=True),
        sa.Column("observations", sa.Text,        nullable=True),
        sa.Column("conclusion",   sa.Text,        nullable=True),
        sa.Column("disposition",  sa.String(100), nullable=True),
        # Status
        sa.Column("status",            sa.String(20),  nullable=False, server_default="DRAFT"),
        sa.Column("is_latest_version", sa.Boolean,     nullable=False, server_default=sa.true()),
        # Versioning
        sa.Column("parent_id",     PUUID, sa.ForeignKey("experiments.id"), nullable=True),
        sa.Column("revision_note", sa.Text, nullable=True),
        # Cross-notebook link
        sa.Column("linked_preliminary_id", PUUID, sa.ForeignKey("experiments.id"), nullable=True),
        # Who did what
        sa.Column("created_by",      PUUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("submitted_by",    PUUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("submitted_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by",     PUUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_by",     PUUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejected_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        # E-signatures
        sa.Column("scientist_signed_by",   PUUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("scientist_signed_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("scientist_sign_reason", sa.String(200), nullable=True),
        sa.Column("reviewer_signed_by",    PUUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewer_signed_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_sign_reason",  sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','LOCKED','REJECTED')",
            name="ck_exp_status",
        ),
    )
    op.create_index("ix_exp_notebook_id",       "experiments", ["notebook_id"])
    op.create_index("ix_exp_project_id",        "experiments", ["project_id"])
    op.create_index("ix_exp_base_code",         "experiments", ["base_code"])
    op.create_index("ix_exp_full_code",         "experiments", ["full_code"])
    op.create_index("ix_exp_status",            "experiments", ["status"])
    op.create_index("ix_exp_is_latest_version", "experiments", ["is_latest_version"])

    # ── 5. Re-add FK constraints on tables we kept ────────────────────────────
    # NOT VALID skips validation of existing rows (old experiment IDs are gone).
    # New inserts/updates are still enforced from this point forward.
    op.execute(
        "ALTER TABLE atr ADD CONSTRAINT fk_atr_experiment_id "
        "FOREIGN KEY (experiment_id) REFERENCES experiments(id) NOT VALID"
    )
    op.execute(
        "ALTER TABLE unlock_requests ADD CONSTRAINT fk_ur_experiment_id "
        "FOREIGN KEY (experiment_id) REFERENCES experiments(id) NOT VALID"
    )

    # ── 6. Create experiment_files ────────────────────────────────────────────
    op.create_table(
        "experiment_files",
        sa.Column("id",            PK,             primary_key=True),
        sa.Column("experiment_id", PUUID,          sa.ForeignKey("experiments.id"), nullable=False),
        sa.Column("section_key",   sa.String(100), nullable=True),
        sa.Column("filename",      sa.String(255), nullable=False),
        sa.Column("file_path",     sa.String(500), nullable=False),
        sa.Column("file_size",     sa.BigInteger,  nullable=True),
        sa.Column("file_type",     sa.String(50),  nullable=True),
        sa.Column("uploaded_by",   PUUID,          sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_exp_files_exp_id", "experiment_files", ["experiment_id"])


def downgrade():
    op.drop_table("experiment_files")
    op.drop_table("experiments")
    op.drop_column("notebooks", "template_snapshot")
    op.drop_column("notebooks", "template_id")
    op.drop_table("workflow_templates")
    # Note: old tables not restored in downgrade — this is a one-way migration
