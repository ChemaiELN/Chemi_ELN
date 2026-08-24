# Database Migration Guide — Alembic → Sequelize CLI

## Overview

The existing database is PostgreSQL and MUST remain PostgreSQL. All existing data is preserved. This guide covers:
1. How to connect Sequelize CLI to the existing database
2. The migration strategy (no destructive changes)
3. All available commands

---

## 1. Sequelize CLI Configuration

The `.sequelizerc` file in `backend-node/` points Sequelize CLI to:

| Item | Path |
|------|------|
| Config | `src/database/config.js` |
| Models | `src/models/` |
| Migrations | `src/database/migrations/` |
| Seeders | `src/database/seeders/` |

---

## 2. Environment Setup

Copy `.env.example` to `.env` and fill in:

```bash
cd backend-node
cp .env.example .env
# Edit .env with your PostgreSQL credentials
npm install
```

---

## 3. Migration Strategy

### IMPORTANT: Existing Data Safety

The existing PostgreSQL database contains all production/development data created by the FastAPI/Alembic backend. The Node.js Sequelize backend connects to the **same database** and the **same tables**.

**Do NOT run `sequelize-cli db:migrate` against the existing database unless you have verified what each migration does.**

Since the database already exists and is schema-complete, the migration approach is:

#### Option A: Mark All Migrations as Run (Recommended for existing database)

If the database schema is already correct, create a single initial migration that documents the schema but marks it as already applied:

```bash
cd backend-node
# Create SequelizeMeta table (tracks which migrations have run)
npx sequelize-cli db:migrate:status
# If the table doesn't exist, create it:
npx sequelize-cli db:migrate --to 00000000000000-init-existing-schema.js
```

#### Option B: Fresh Database (Development/CI)

For a brand new empty database:

```bash
cd backend-node
npm run migration:run
```

This runs all migrations in `src/database/migrations/` in order.

---

## 4. All Database Commands

```bash
# Run all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Revert all migrations
npm run migration:revert:all

# Check migration status
npx sequelize-cli db:migrate:status

# Run all seeders
npm run seed

# Revert all seeders
npm run seed:undo

# Create a new migration file
npx sequelize-cli migration:generate --name add-new-column

# Create a new seeder file
npx sequelize-cli seed:generate --name initial-roles
```

---

## 5. Alembic → Sequelize Migration Equivalence

| Alembic Command | Sequelize CLI Equivalent |
|----------------|--------------------------|
| `alembic upgrade head` | `npm run migration:run` |
| `alembic downgrade -1` | `npm run migration:revert` |
| `alembic downgrade base` | `npm run migration:revert:all` |
| `alembic current` | `npx sequelize-cli db:migrate:status` |
| `alembic revision --autogenerate` | `npx sequelize-cli migration:generate --name <name>` |
| `alembic history` | Check `SequelizeMeta` table: `SELECT * FROM "SequelizeMeta";` |

---

## 6. Writing Safe Migrations

Always write reversible migrations with both `up` and `down` functions:

```javascript
'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Use addColumn, createTable, addIndex, etc.
    await queryInterface.addColumn('users', 'new_field', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'new_field')
  },
}
```

### For existing tables — use `IF NOT EXISTS`:

```javascript
async up(queryInterface, Sequelize) {
  const tableDesc = await queryInterface.describeTable('users')
  if (!tableDesc.new_field) {
    await queryInterface.addColumn('users', 'new_field', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
  }
}
```

---

## 7. Database Table Summary

The Node.js backend uses the exact same table names as the FastAPI backend. No table renames were performed.

| Module | Tables |
|--------|--------|
| Auth | `roles`, `departments`, `labs`, `users`, `department_role_mapping`, `role_privileges`, `user_security_questions`, `global_settings` |
| Master Data | `master_data_items`, `lookup_chemicals`, `lookup_instruments`, `sites` |
| ID Sequences | `id_sequence_configs`, `id_sequence_counters` |
| ADC Projects | `projects`, `project_code_counter`, `project_users`, `routes`, `stages`, `milestones`, `project_attachments`, `project_risk_assessments`, `project_risk_rows` |
| ADC Notebooks | `notebooks`, `notebook_permissions` |
| ADC Experiments | `experiments`, `experiment_assignments`, `experiment_files`, `experiment_atr_requests`, `experiment_reviews`, `experiment_history`, `experiment_intermediate_ids`, `experiment_materials` |
| CGT | `cgt_projects`, `cgt_project_code_counter`, `cgt_notebooks`, `cgt_notebook_permissions`, `cgt_experiments`, `cgt_experiment_assignments` |
| Workflow/Calc | `workflow_templates`, `workflow_template_versions`, `calc_sheet_templates`, `calc_sheet_template_versions` |
| ARD | `ard_techniques`, `ard_test_configurations`, `ard_test_groups`, `ard_test_group_members`, `ard_attributes`, `ard_form_types`, `ard_data_items`, `ard_settings`, `ard_analyst_qualifications`, `ard_qualification_alerts`, `ard_content_blocks`, `ard_teams`, `ard_atr_forms`, `ard_atr_samples`, `ard_test_requests`, `ard_experiments`, `ard_templates`, `ard_notebooks`, `ard_projects`, `ard_project_specifications`, `ard_qc_trf_forms`, `ard_notification_read`, `ard_audit_log`, `ard_attachments` |
| Inventory | All `inv_*` tables (30+) |
