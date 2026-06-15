# Backend Diff Report
**Folder A (reference/new):** `C:\Users\Administrator\Downloads\backend`  
**Folder B (existing project):** `C:\sensor-proto\backend`  
**Date generated:** 2026-06-15  

> This report lists everything that exists in **A but is MISSING or DIFFERENT in B**, plus a section for things that exist **only in B** (additions B has that A does not).

---

## 1. Files Only in A (New Files — Not in B)

| File (relative to backend root) | Purpose |
|---|---|
| `app/models/experiment_material.py` | New SQLAlchemy model `ExperimentMaterial` |
| `alembic/versions/b7eadfe299af_add_experiment_materials.py` | Migration to create `experiment_materials` table |
| `integration_test.py` | Integration test script |
| `integration_test2.py` | Integration test script |
| `seed_adc_synthesis.py` | Seed data for ADC synthesis experiments |
| `seed_linked_synthesis.py` | Seed data for linked synthesis experiments |
| `test_backend_changes.py` | Test script for backend changes |
| `test_merged_changes.py` | Test script for merged changes |
| `test_perf_fixes.py` | Performance-fix test script |

---

## 2. Files Only in B (Additions B Has That A Does Not)

| File (relative to backend root) | Purpose |
|---|---|
| `alembic/versions/g9h0i1j2k3l4_add_workflow_template_versions.py` | Migration to create `workflow_template_versions` table |
| `alembic/versions/h1i2j3k4l5m6_add_objective_to_projects.py` | Migration to add `objective` column to `projects` |
| `alembic/versions/i2j3k4l5m6n7_add_observation_to_projects.py` | Migration to add `observation` column to `projects` |

---

## 3. New Database Models

### 3.1 `ExperimentMaterial` — New Model (A only)

**File:** `app/models/experiment_material.py`  
**Table:** `experiment_materials`  
**Status in B:** Does not exist.

This model tracks which inventory batches are reserved/issued for each reagent role (mAb, TCEP, LP, DMSO, NAC, TFF_filter) in a synthesis experiment.

**Fields:**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `experiment_id` | UUID FK → `experiments.id` | `ondelete="CASCADE"` |
| `material_role` | `String(50)` | e.g. "mAb", "TCEP", "LP", "DMSO", "NAC", "TFF_filter" |
| `material_id` | `Integer` FK → `inv_materials.id` | |
| `batch_id` | `Integer` FK → `inv_batches.id` | |
| `qty_reserved` | `Numeric(12,4)` | |
| `unit` | `String(20)` | |
| `qty_issued` | `Numeric(12,4)` nullable | |
| `status` | `String(20)` default `"RESERVED"` | CHECK: `RESERVED`, `ISSUED`, `RETURNED` |
| `remarks` | `Text` nullable | |
| `reserved_by` | UUID FK → `users.id` | |
| `reserved_at` | `DateTime(timezone=True)` | |

**Indexes:** `ix_exp_mat_experiment_id`, `ix_exp_mat_batch_id`  
**Relationships:** `experiment`, `material`, `batch`, `reserver`

---

### 3.2 `WorkflowTemplateVersion` — New Model (B only)

**File:** `app/models/workflow_template.py` (B version contains this; A does not)  
**Table:** `workflow_template_versions`  
**Status in A:** Does not exist.

This model stores historical snapshots of a workflow template's definition each time it is updated.

**Fields:**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `template_id` | UUID FK → `workflow_templates.id` | `ondelete="CASCADE"`, indexed |
| `version` | `Integer` | The version number being saved |
| `definition` | `JSON` nullable | Snapshot of the template definition |
| `saved_by` | UUID FK → `users.id` | `ondelete="SET NULL"` |
| `saved_at` | `DateTime(timezone=True)` | |

**Relationships:** `template`, `saver`

---

## 4. New Model Fields on Existing Models

### 4.1 `Project` Model — New Fields (B only)

**File:** `app/models/project.py`  
**Class:** `Project` (`__tablename__ = "projects"`)

B adds two new fields that are **not present in A**:

| Field | Type | Notes |
|---|---|---|
| `objective` | `Text` nullable | Project objective |
| `observation` | `Text` nullable | Project observation |

**A version** of `Project` only has: `description` as the free-text field (no `objective`, no `observation`).

---

## 5. New/Different Schema Fields

### 5.1 `app/schemas/experiment.py` — New Schemas in A (Missing in B)

A adds three new Pydantic schemas for inventory material management. These are **not present in B**:

| Schema Class | Purpose |
|---|---|
| `ExperimentMaterialCreate` | Request body for reserving a batch to an experiment (`material_role`, `material_id`, `batch_id`, `qty_reserved`, `unit`, `remarks`) |
| `ExperimentMaterialUpdate` | Request body for updating a reservation (`qty_issued`, `status`, `remarks`) |
| `ExperimentMaterialResponse` | Response for a material reservation, including denormalised `material_name`, `material_code`, `batch_no`, `manufacturer_name` |
| `PreliminaryDataResponse` | Response for the new `GET /{exp_id}/preliminary-data` endpoint |

A also adds `actor_name: Optional[str]` field to `ExperimentHistoryResponse`, which B does **not** have.

**B's `ExperimentHistoryResponse`:**
```python
class ExperimentHistoryResponse(BaseModel):
    id, experiment_id, actor_id, action, details, created_at   # no actor_name
```
**A's `ExperimentHistoryResponse`:**
```python
class ExperimentHistoryResponse(BaseModel):
    id, experiment_id, actor_id, actor_name: Optional[str], action, details, created_at
```

A also adds `approver: Optional[_UserShort]` to `ExperimentResponse`, which B does not have.

**B's `ExperimentResponse`** (relevant section):
```python
approved_by: Optional[str]
approved_at: Optional[datetime]
rejected_by: Optional[str]
```
**A's `ExperimentResponse`** (relevant section):
```python
approved_by:  Optional[str]
approved_at:  Optional[datetime]
approver:     Optional[_UserShort]   # NEW in A
rejected_by:  Optional[str]
```

### 5.2 `app/schemas/project.py` — New Fields in B (Missing in A)

B adds `objective` and `observation` to `ProjectUpdate` and `ProjectResponse`. These are **not present in A**.

**`ProjectUpdate` — B adds:**
```python
objective:   Optional[str] = None
observation: Optional[str] = None
```

**`ProjectResponse` — B adds:**
```python
objective:   Optional[str]
observation: Optional[str]
```

### 5.3 `app/schemas/workflow_template.py` — New Schema in B (Missing in A)

B adds `WorkflowTemplateVersionResponse` schema that A does not have:

```python
class WorkflowTemplateVersionResponse(BaseModel):
    id:          str
    template_id: str
    version:     int
    definition:  Optional[Dict[str, Any]]
    saved_by:    Optional[str]
    saved_at:    datetime
```

---

## 6. New/Changed API Endpoints

### 6.1 New Endpoints in A (Not in B)

All under `/api/experiments`:

| Method | Path | Function | Description |
|---|---|---|---|
| `GET` | `/api/experiments/{exp_id}/materials` | `list_experiment_materials` | List all batch reservations for an experiment |
| `POST` | `/api/experiments/{exp_id}/materials` | `reserve_experiment_material` | Reserve a batch for a role in an experiment |
| `PATCH` | `/api/experiments/{exp_id}/materials/{mat_id}` | `update_experiment_material` | Update qty_issued / status / remarks on a reservation |
| `GET` | `/api/experiments/{exp_id}/preliminary-data` | `get_preliminary_data` | Snapshot of the linked preliminary experiment's field data for pre-filling synthesis screens |
| `POST` | `/api/experiments/{exp_id}/void` | `void_experiment` | Void an experiment (requires `experiments.void` privilege) |

### 6.2 New Endpoints in B (Not in A)

Under `/api/workflow-templates`:

| Method | Path | Function | Description |
|---|---|---|---|
| `GET` | `/api/workflow-templates/{template_id}/versions` | `list_template_versions` | List all saved version snapshots for a workflow template |

### 6.3 Changed Endpoint Logic

#### `POST /api/experiments/{exp_id}/submit` (A differs from B)

A adds a **synthesis gate check** that B does not have. Before allowing submission, A validates that if the experiment has a linked preliminary, both `disposition` and `lp_disposition` in the preliminary's data must equal `"Release for conjugation"`. B simply transitions to SUBMITTED without this check.

**A addition in `submit_experiment()`:**
```python
# Synthesis gate: both preliminary dispositions must be "Release for conjugation"
if exp.linked_preliminary_id and exp.linked_preliminary:
    prelim_data = exp.linked_preliminary.data or {}
    mab_ok = prelim_data.get("disposition") == "Release for conjugation"
    lp_ok  = prelim_data.get("lp_disposition") == "Release for conjugation"
    if not mab_ok:
        raise HTTPException(400, "Cannot submit: linked preliminary mAb disposition is not 'Release for conjugation'")
    if not lp_ok:
        raise HTTPException(400, "Cannot submit: linked preliminary LP disposition is not 'Release for conjugation'")
```

#### `GET /api/experiments/{exp_id}/history` (A differs from B)

A adds eager-load of the `actor` relationship and resolves `actor_name` into the response. B returns raw ORM rows without the actor name.

**A version:**
```python
rows = (
    db.query(ExperimentHistory)
    .options(selectinload(ExperimentHistory.actor))
    .filter(ExperimentHistory.experiment_id == exp_id)
    .order_by(ExperimentHistory.created_at)
    .all()
)
return [
    ExperimentHistoryResponse(
        ...
        actor_name=r.actor.display_name if r.actor else None,
        ...
    )
    for r in rows
]
```

**B version:**
```python
return (
    db.query(ExperimentHistory)
    .filter(ExperimentHistory.experiment_id == exp_id)
    .order_by(ExperimentHistory.created_at)
    .all()
)
```

#### `POST /api/experiments/{exp_id}/reviewers` — `assign_reviewer()` (A differs from B)

A re-queries with `selectinload` to eagerly populate the reviewer relationship before returning. B uses `db.refresh(review)` which may trigger a lazy load.

#### `PATCH /api/workflow-templates/{template_id}` — `update_template()` (B differs from A)

B's `update_template()` creates a `WorkflowTemplateVersion` snapshot before overwriting the definition. A's version just bumps the version counter without saving a snapshot.

**B addition in `update_template()`:**
```python
if "definition" in updates:
    snapshot = WorkflowTemplateVersion(
        id=new_uuid(), template_id=t.id,
        version=t.version, definition=t.definition, saved_by=actor.id,
    )
    db.add(snapshot)
    t.version += 1
```

**A version:**
```python
if "definition" in updates:
    t.version += 1   # no snapshot saved
```

#### `GET /api/projects/` — `list_projects()` (B differs from A)

B adds a TL-scoped filter: users with role `TL` only see projects they are a member of. A shows all projects to all roles.

**B addition in `list_projects()`:**
```python
if current_user.role.code == "TL":
    member_project_ids = db.query(ProjectUser.project_id).filter(
        ProjectUser.user_id == current_user.id
    ).subquery()
    q = q.filter(Project.id.in_(member_project_ids))
```

#### `PATCH /api/projects/{project_id}` — `_project_response()` helper (B differs from A)

B's `_project_response()` helper passes `objective` and `observation` to `ProjectResponse`. A does not (since those fields don't exist in A's model/schema).

---

## 7. New Migration Files

### 7.1 Migrations Only in A

| Revision ID | File | Description |
|---|---|---|
| `b7eadfe299af` | `b7eadfe299af_add_experiment_materials.py` | Creates `experiment_materials` table. Revises `f8a9b0c1d2e3`. |

### 7.2 Migrations Only in B

| Revision ID | File | Description |
|---|---|---|
| `g9h0i1j2k3l4` | `g9h0i1j2k3l4_add_workflow_template_versions.py` | Creates `workflow_template_versions` table. Revises `f8a9b0c1d2e3`. |
| `h1i2j3k4l5m6` | `h1i2j3k4l5m6_add_objective_to_projects.py` | Adds `objective TEXT` column to `projects`. Revises `g9h0i1j2k3l4`. |
| `i2j3k4l5m6n7` | `i2j3k4l5m6n7_add_observation_to_projects.py` | Adds `observation TEXT` column to `projects`. Revises `h1i2j3k4l5m6`. |

> **Note on migration branching:** Both A and B have migrations that revise `f8a9b0c1d2e3`, creating a **branch conflict**. A's `b7eadfe299af` and B's `g9h0i1j2k3l4` both declare `down_revision = 'f8a9b0c1d2e3'`. When merging, a new merge migration will be needed.

---

## 8. Logic/Utility Differences in Shared Files

### 8.1 `app/utils/privileges.py` — `DEFAULT_GRANTS` Difference

One grant differs between A and B for `PROJECTS_CREATE`:

| Key | A (reference) | B (existing project) |
|---|---|---|
| `PROJECTS_CREATE` | `frozenset({"QA", "HOD", "TL"})` | `frozenset({"HOD"})` |

In A, users with the `TL` role and `QA` role can create projects by default. In B, only `HOD` has this default grant. (QA always bypasses the check via the super-admin shortcut, so QA is effectively the same; the meaningful difference is `TL`.)

### 8.2 `app/models/__init__.py` — Missing Import in B

A imports `ExperimentMaterial` in the models `__init__`, so Alembic can detect it for migrations:
```python
from app.models.experiment_material import ExperimentMaterial  # noqa: F401
```
B does not have this import (because the model doesn't exist in B).

B imports `WorkflowTemplateVersion` implicitly through `workflow_template.py` but does **not** explicitly add it to the `__init__` file. This is fine because it's defined in the same module, but may need adding if the project's pattern requires explicit registration.

### 8.3 `app/modules/workflow_templates/router.py` — Import Differences

A imports:
```python
from app.models.workflow_template import WorkflowTemplate
from app.schemas.workflow_template import (WorkflowTemplateCreate, ..., WorkflowTemplateUpdate)
```

B imports additionally:
```python
from app.models.workflow_template import WorkflowTemplate, WorkflowTemplateVersion
from app.schemas.workflow_template import (..., WorkflowTemplateVersionResponse)
```

### 8.4 `app/modules/experiments/router.py` — Additional Imports in A

A adds these imports that B does not have:
```python
from app.models.experiment_material import ExperimentMaterial
from app.models.inventory_batches import InvBatch
from app.models.inventory_materials import InvMaterial
from app.models.inventory_manufacturers import InvManufacturer
from app.schemas.experiment import (
    ...,
    ExperimentMaterialCreate, ExperimentMaterialResponse,
    ExperimentMaterialUpdate,
    PreliminaryDataResponse,
)
from app.utils.privileges import ..., EXPERIMENTS_VOID
```

---

## 9. Summary Table

| Category | In A only | In B only |
|---|---|---|
| New model files | `experiment_material.py` | — |
| New model classes | `ExperimentMaterial` | `WorkflowTemplateVersion` |
| New model fields | — | `Project.objective`, `Project.observation` |
| New schema classes | `ExperimentMaterialCreate`, `ExperimentMaterialUpdate`, `ExperimentMaterialResponse`, `PreliminaryDataResponse` | `WorkflowTemplateVersionResponse` |
| New schema fields | `ExperimentHistoryResponse.actor_name`, `ExperimentResponse.approver` | `ProjectUpdate.objective`, `ProjectUpdate.observation`, `ProjectResponse.objective`, `ProjectResponse.observation` |
| New API endpoints | `GET/POST /api/experiments/{id}/materials`, `PATCH /api/experiments/{id}/materials/{mat_id}`, `GET /api/experiments/{id}/preliminary-data`, `POST /api/experiments/{id}/void` | `GET /api/workflow-templates/{id}/versions` |
| Changed endpoint logic | `submit_experiment` (synthesis gate), `get_history` (actor_name), `assign_reviewer` (selectinload) | `update_template` (snapshot), `list_projects` (TL scoping), `_project_response` (objective/observation) |
| New migration files | `b7eadfe299af_add_experiment_materials.py` | `g9h0i1j2k3l4_add_workflow_template_versions.py`, `h1i2j3k4l5m6_add_objective_to_projects.py`, `i2j3k4l5m6n7_add_observation_to_projects.py` |
| Logic differences | `PROJECTS_CREATE` default grant includes TL | `PROJECTS_CREATE` default grant is HOD-only |

---

## 10. Merge Recommendations

When merging A into B (or vice versa), the following actions are needed:

1. **Copy `app/models/experiment_material.py` from A into B** — this is the new `ExperimentMaterial` model.
2. **Copy migration `b7eadfe299af_add_experiment_materials.py` from A into B** — but update `down_revision` to point to the head of B's chain (`i2j3k4l5m6n7`), or create an Alembic merge migration.
3. **Merge `app/modules/experiments/router.py`** — bring in all new material-related functions and the `preliminary-data` endpoint from A, plus the `void` endpoint and the synthesis gate in `submit_experiment`.
4. **Merge `app/schemas/experiment.py`** — add `ExperimentMaterialCreate`, `ExperimentMaterialUpdate`, `ExperimentMaterialResponse`, `PreliminaryDataResponse`, `actor_name` on history response, and `approver` on experiment response.
5. **Update `app/models/__init__.py`** in B to import `ExperimentMaterial` and `WorkflowTemplateVersion`.
6. **Decide on `PROJECTS_CREATE` default grant** — A grants it to TL, B restricts to HOD. Pick the intended policy and update `app/utils/privileges.py`.
7. The B-only additions (`WorkflowTemplateVersion`, project `objective`/`observation`, workflow version history endpoint, TL project scoping) already exist in B and do not need porting.
