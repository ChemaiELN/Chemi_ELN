# Database Model Verification Report — FastAPI (SQLAlchemy) → Node.js (Sequelize)

**Generated:** 2026-08-12

---

## Executive Summary

| Category | Count |
|----------|-------|
| Tables missing entirely from Node.js | 13 |
| Schema-breaking column name mismatches | 4 |
| Nullable mismatches (FastAPI NOT NULL → Node.js allows NULL) | 22 |
| Missing FK constraints | All relationships (Node.js declares zero DB-level FKs) |
| Missing unique constraints | 8 |
| Missing indexes | All (Node.js declares zero indexes) |
| JSON vs JSONB type differences | 15+ columns |

---

## 1. Tables Present in FastAPI but Missing from Node.js

| Table | SQLAlchemy Class | Purpose |
|-------|-----------------|---------|
| `milestones` | `Milestone` | Project milestone tracking |
| `milestone_attachments` | `MilestoneAttachment` | Files on milestones |
| `stages` | `Stage` | Route sub-stages under projects |
| `experiment_intermediate_ids` | `ExperimentIntermediateId` | Per-screen generated IDs |
| `experiment_materials` | `ExperimentMaterial` | Inventory linkage from experiment |
| `adc_objective` | `AdcObjective` | ADC study purpose metadata |
| `adc_regulatory_classification` | `AdcRegulatoryClassification` | OEL/GMP per experiment |
| `adc_risk_assessment` | `AdcRiskAssessment` | ADC FMEA header |
| `adc_risk_item` | `AdcRiskItem` | ADC FMEA rows |
| `ard_attributes` | `ArdAttribute` | Reusable ATR form field definitions |
| `ard_data_items` | `ArdDataItem` | Reference standards / dropdown library |
| `ard_qualification_alerts` | `ArdQualificationAlert` | Days-before-expiry alert config |
| `ard_content_blocks` | `ArdContentBlock` | Rich-text library blocks |

---

## 2. Schema-Breaking Mismatches

These cause queries from one ORM to fail entirely against a DB created by the other.

### 2.1 `ard_settings`

| Column | FastAPI name | Node.js name |
|--------|-------------|-------------|
| Setting key | `setting_key` | `key` |
| Setting label | `setting_label` | `label` |
| Setting value | `setting_value` | `value` |
| Category | `setting_category` | **NOT PRESENT** |
| Description | `description` | **NOT PRESENT** |
| Value type | `value_type` | **NOT PRESENT** |

**Impact:** Any query for `setting_key = 'X'` from FastAPI will find nothing in a Node.js-created DB, and vice versa.

### 2.2 `ard_atr_forms` (ATR Form)

Primary natural-key field:
- FastAPI: column `form_no`
- Node.js: column `atr_no`

Columns in FastAPI missing from Node.js: `form_type_name`, `qc_ref`, `assigned_tl`, `assigned_team_id`, `raised_at`, `current_owner`, `current_owner_id`, `approved_by`, `approved_at`, `coa_generated_by`, `last_updated_by`, `supporting_docs`, `report_type`, `objectives`, `preapproval_note`, `mandate_certification`, `scheme_present`, `scheme_mode`, `form_category`, `associated_exp_codes`, `reference_experiment_id`, `reference_atr_form_id`, `form_open`, `origin_module`.

Columns in Node.js missing from FastAPI: `atr_no`, `batch_no`, `requested_by`, `assigned_qa_id`, `received_at`, `target_completion_date`, `completed_at`, `certified_at`, `priority`, `internal_remarks`, `clarifications`, `chemicals`, `audit_trail`, `external_source_module`.

### 2.3 `ard_test_configurations`

| Column | FastAPI | Node.js |
|--------|---------|---------|
| `technique_code` | String(100) NOT NULL | Renamed to `techniqueKey` nullable |
| `test_type` | String(200) NOT NULL | **NOT PRESENT** |
| `test_subtype` | String(200) nullable | **NOT PRESENT** |
| `method_reference` | String(200) nullable | **NOT PRESENT** |
| `result_params` | JSON NOT NULL | Renamed to `parameters` JSONB nullable |
| `config_code` | String(50) nullable | **NOT PRESENT** |
| `name` | **NOT PRESENT** | STRING(200) NOT NULL |
| `techniqueId` | **NOT PRESENT** | UUID nullable |

### 2.4 `ard_analyst_qualifications`

FastAPI: one row per user, technique qualifications stored as JSON array (`technique_entries`).
Node.js: one row per analyst+technique pair (`analystId`, `techniqueKey`, `qualifiedOn`, `expiresOn`, `isActive`).

These are **fundamentally different data models** for the same concept. Data written by one ORM cannot be read by the other.

---

## 3. Nullable Mismatches (FastAPI NOT NULL → Node.js nullable)

When Node.js writes NULL for these columns, the data will fail FastAPI's NOT NULL constraint if FastAPI tries to upsert the same row.

| Table | Column | FastAPI | Node.js |
|-------|--------|---------|---------|
| `users` | `emp_no` | NOT NULL | nullable |
| `users` | `email` | NOT NULL | nullable |
| `users` | `role_id` | NOT NULL | nullable |
| `projects` | `created_by` | NOT NULL | nullable |
| `routes` | `code` | NOT NULL | nullable |
| `routes` | `sort_order` | NOT NULL | nullable |
| `routes` | `status` | NOT NULL | nullable |
| `notebooks` | `created_by` | NOT NULL | nullable |
| `experiments` | `project_id` | NOT NULL | nullable |
| `experiments` | `created_by` | NOT NULL | nullable |
| `experiment_atr_requests` | `section_id` | NOT NULL | nullable |
| `experiment_atr_requests` | `raised_by` | NOT NULL | nullable |
| `cgt_projects` | `created_by` | NOT NULL | nullable |
| `cgt_experiments` | `created_by` | NOT NULL | nullable |
| `cgt_experiments` | `cgt_project_id` | NOT NULL | nullable |
| `ard_projects` | `created_by` | NOT NULL | nullable |
| `ard_notebooks` | `created_by` | NOT NULL | nullable |
| `ard_notebooks` | `assigned_users` | NOT NULL default=[] | nullable |
| `ard_attachments` | `filename` | NOT NULL | nullable |
| `ard_attachments` | `attachment_link` | NOT NULL | nullable |
| `role_privileges` | `is_granted` | has default | no default |
| `global_settings` | `auth_type` | NOT NULL default='Application' | nullable |

---

## 4. Default Value Mismatches

| Table | Column | FastAPI Default | Node.js Default |
|-------|--------|----------------|----------------|
| `notebook_permissions` | `can_view` | `True` | `false` — new grants will deny view access |
| `project_code_counter` | `last_seq` | `30000` | `30000` — OK |
| `role_privileges` | `is_granted` | `True` | No default |
| `global_settings` | `auth_type` | `'Application'` | NULL |

**Critical:** `notebook_permissions.can_view` defaulting to `false` in Node.js means any permission record created through Node.js will prevent the user from viewing the notebook.

---

## 5. Column Presence Mismatches

### Columns in FastAPI missing from Node.js Sequelize model

| Table | Missing columns |
|-------|----------------|
| `projects` | `related_docs_comments`, `related_docs_observations` |
| `ard_techniques` | `created_by`, `updated_by`, `updated_at` |
| `ard_form_types` | `description`, `category`, `attribute_links`, `test_group_ids`, `mandate_certification`, `mandate_batch_no`, `mandate_qa_submission`, `allow_post_approval_changes`, `created_by`, `updated_by` |
| `ard_teams` | `hod_id`, `tl_id`, `tl_ids`, `member_ids`, `tl_analyst_can_review`, `created_by` |
| `ard_analyst_qualifications` | `technique_entries`, `valid_till`, `remarks`, `approval_status`, `approved_by`, `approved_at` |
| `ard_qc_trf_forms` | `reference_trf_form_id` |

### Columns in Node.js present but not in FastAPI

| Table | Extra columns |
|-------|--------------|
| `ard_techniques` | `description` |
| `ard_form_types` | `requiresBatchNo` |

---

## 6. String Length Mismatches

| Table | Column | FastAPI Length | Node.js Length |
|-------|--------|---------------|---------------|
| `projects` | `project_type` | 20 | 50 |
| `projects` | `customer` | 200 | 255 |
| `projects` | `payload` | **300** | **255** — truncation risk |
| `ard_techniques` | `code` | 100 | 50 — truncation risk |
| `cgt_projects` | `process` | **200** | **50** — truncation risk |

---

## 7. Missing Database Constraints

### Foreign Key Constraints

Node.js declares **zero** database-level FK constraints in any Sequelize model (no `references:` blocks). All referential integrity is enforced only at the application level. Consequences:
- Orphaned records can accumulate if application logic is bypassed
- No cascading deletes even where FastAPI specifies `ON DELETE CASCADE`
- No restrict/protect behavior on referenced rows

Tables with the most FK relationships unguarded: `users`, `experiments`, `notebooks`, `ard_atr_forms`, all `inv_*` tables.

### Unique Constraints Missing from Node.js

| Table | FastAPI UniqueConstraint |
|-------|------------------------|
| `department_role_mapping` | `(department_id, role_id)` |
| `user_security_questions` | `(user_id, question_index)` |
| `notebook_permissions` | `(notebook_id, user_id)` |
| `experiment_assignments` | `(experiment_id, user_id)` |
| `experiment_reviews` | `(experiment_id, reviewer_id)` |
| `cgt_notebook_permissions` | `(cgt_notebook_id, user_id)` |
| `cgt_experiment_assignments` | `(cgt_experiment_id, user_id)` |
| `master_data_items` | `(category, code)` |
| `id_sequence_counters` | `(config_id, year, period)` |
| `ard_notification_read` | `(user_id, notification_id)` |

### Check Constraints Missing from Node.js

| Table | FastAPI CheckConstraint |
|-------|------------------------|
| `experiments` | `ck_exp_status` — valid status values |
| `cgt_experiments` | `ck_cgt_exp_status` |
| `experiment_reviews` | `ck_review_decision` |
| `global_settings` | `ck_global_settings_singleton` (id = 1) |

### Indexes Missing from Node.js

FastAPI defines explicit indexes on high-traffic lookup columns. None are declared in any Sequelize model. Most impactful missing indexes:

| Table | Index | Column(s) |
|-------|-------|-----------|
| `experiments` | `ix_exp_notebook_id` | `notebook_id` |
| `experiments` | `ix_exp_status` | `status` |
| `experiments` | `ix_exp_created_by` | `created_by` |
| `cgt_experiments` | 4 similar indexes | Various |
| `master_data_items` | `category` lookup | `category` |
| `workflow_template_versions` | `template_id` | `template_id` |
| `inv_materials` | partial: `(cas_no, dept_id) WHERE cas_no IS NOT NULL` | Uniqueness guard |

---

## 8. Type System Differences

### JSON vs JSONB

FastAPI consistently uses `JSON` type; Node.js consistently uses `JSONB`. In PostgreSQL:
- JSONB stores in binary format (smaller, indexed, deduplicates keys)
- JSON stores as text (preserves whitespace, allows duplicate keys)
- Values are read-compatible; the stored bytes differ

**Impact:** If both ORMs write to the same DB column, the column type at the DB level determines which format is used. Since JSONB and JSON cannot coexist in one column, the migration must pick one type and both ORMs must use it consistently. Currently Node.js's `JSONB` declarations will create JSONB columns, which FastAPI can read correctly.

### DateTime Timezone Handling

- FastAPI ARD models: `DateTime(timezone=True)` → PostgreSQL `TIMESTAMP WITH TIME ZONE`
- FastAPI non-ARD models: `DateTime` (naive) → PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`
- Node.js: `DataTypes.DATE` → PostgreSQL `TIMESTAMP WITH TIME ZONE`

**Impact:** If Node.js writes a timestamp to a column FastAPI treats as naive (non-ARD models), FastAPI may store/display it in server local time while Node.js assumes UTC. Comparison queries across the two runtimes may be off by the server's UTC offset.

---

## 9. Recommendations

### Immediate (P0)
1. Fix `ard_settings` column names — either rename in the DB or update Node.js field mappings to use `field:` override.
2. Resolve `ard_atr_forms` primary column: decide on `form_no` or `atr_no` and standardize.
3. Align `ard_test_configurations` and `ard_analyst_qualifications` schemas — these are fundamentally different data models.

### Short Term (P1)
4. Add FK `references:` declarations to Sequelize models for the most critical relationships (users, experiments, notebooks, inventory batches).
5. Add unique constraint indexes to junction tables via Sequelize `indexes:` block.
6. Fix `notebook_permissions.can_view` default from `false` to `true`.
7. Fix nullable mismatches on `users.emp_no`, `users.email`, `users.role_id`.

### Medium Term (P2)
8. Add the 13 missing tables (especially `milestones`, `stages`, `adc_risk_*`, `experiment_materials`).
9. Fix string length mismatches on `projects.payload` (300→255 risk) and `cgt_projects.process` (200→50 risk).
10. Add database indexes via Sequelize model `indexes:` declarations.
