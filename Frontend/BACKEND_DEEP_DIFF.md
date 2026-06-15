# Backend Deep Diff: Folder A (Downloads/backend) vs Folder B (sensor-proto/backend)

**Folder A (reference/new):** `C:\Users\Administrator\Downloads\backend`
**Folder B (existing project):** `C:\sensor-proto\backend`
**Generated:** 2026-06-15
**Method:** Every .py, .txt, .ini, .env, .example file read in full and compared line-by-line.

---

## Executive Summary

The two folders share the same base application structure. Folder A contains **new features** that Folder B does **not** have yet. Folder B contains **different new features** that Folder A does **not** have yet. There is no case where A removed something B needs — they simply diverged with parallel feature additions.

**Net additions in Folder A (must be merged INTO Folder B):**
1. New `ExperimentMaterial` model and `experiment_materials` table
2. New experiment materials endpoints (reserve/list/update batch reservations)
3. Preliminary-data snapshot endpoint (`GET /experiments/{id}/preliminary-data`)
4. Synthesis gate logic on submit (checks preliminary dispositions)
5. New schemas: `ExperimentMaterialCreate`, `ExperimentMaterialUpdate`, `ExperimentMaterialResponse`, `PreliminaryDataResponse`
6. New `EXPERIMENTS_VOID` privilege used in router + `void_experiment` endpoint
7. `ExperimentHistoryResponse` gains `actor_name` field
8. `get_history` endpoint now eager-loads actor and returns `actor_name`
9. `assign_reviewer` endpoint now eager-loads reviewer relationship before returning
10. `PROJECTS_CREATE` default grant changed: Folder A = `{QA, HOD, TL}`, Folder B = `{HOD}` only

**Net additions in Folder B (must NOT be overwritten by Folder A):**
1. `WorkflowTemplateVersion` model + `workflow_template_versions` table
2. `update_template` endpoint saves a version snapshot before overwriting definition
3. New endpoint `GET /workflow-templates/{id}/versions`
4. `WorkflowTemplateVersionResponse` schema
5. `Project` model gains `objective` and `observation` fields
6. `ProjectUpdate` schema gains `objective` and `observation`
7. `ProjectResponse` schema gains `objective` and `observation`
8. `list_projects` endpoint filters TL users to only their member projects
9. `_project_response` helper passes `objective`/`observation` to response
10. Three extra alembic migrations: `g9h0i1j2k3l4`, `h1i2j3k4l5m6`, `i2j3k4l5m6n7`

**Folder A has additional alembic migrations not in Folder B:**
- `b7eadfe299af_add_experiment_materials.py` (creates `experiment_materials` table)
- `b2c3d4e5f6a7_new_experiment_system.py` (shared filename; same content)
- `b7d4e2f8a1c9_v2_indexes_and_constraints.py` (shared; same content)
- `c3d4e5f6a7b8_add_notebook_reattempt_links.py` (shared; same content)
- `d4e5f6a7b8c9_add_experiment_reviews_and_history.py` (shared; same content)
- `e1a2b3c4d5f6_add_scheme_mol_to_experiments.py` (shared; same content)
- `e5f6a7b8c9d0_add_unlocked_void_to_exp_status.py` (shared; same content)
- `f7a8b9c0d1e2_fix_experiment_history_action_constraint.py` (shared; same content)
- `f8a9b0c1d2e3_add_scheme_mol_to_experiments.py` (shared; same content)

---

## File-by-File Diff

### FILES ONLY IN FOLDER A (new files not in Folder B)

| File | Purpose |
|------|---------|
| `app/models/experiment_material.py` | New `ExperimentMaterial` model |
| `alembic/versions/b7eadfe299af_add_experiment_materials.py` | Migration creating `experiment_materials` table |
| `integration_test.py` | New integration test (root level) |
| `integration_test2.py` | New integration test (root level) |
| `seed_adc_synthesis.py` | New seed script for ADC synthesis data |
| `seed_linked_synthesis.py` | New seed script for linked synthesis data |
| `test_backend_changes.py` | New test file |
| `test_merged_changes.py` | New test file |
| `test_perf_fixes.py` | New test file |

### FILES ONLY IN FOLDER B (new files not in Folder A — do not lose these)

| File | Purpose |
|------|---------|
| `alembic/versions/g9h0i1j2k3l4_add_workflow_template_versions.py` | Creates `workflow_template_versions` table |
| `alembic/versions/h1i2j3k4l5m6_add_objective_to_projects.py` | Adds `objective` column to `projects` |
| `alembic/versions/i2j3k4l5m6n7_add_observation_to_projects.py` | Adds `observation` column to `projects` |

---

## IDENTICAL FILES (no changes needed)

The following files are **byte-for-byte identical** between A and B:

- `app/main.py`
- `app/core/config.py`
- `app/core/security.py`
- `app/database.py`
- `app/db/__init__.py`
- `app/db/session.py`
- `app/middleware/__init__.py`
- `app/middleware/logging.py`
- `app/models/base.py`
- `app/models/atr.py`
- `app/models/audit.py`
- `app/models/department.py`
- `app/models/experiment.py`
- `app/models/inventory_batches.py`
- `app/models/inventory_equipment.py`
- `app/models/inventory_manufacturers.py`
- `app/models/inventory_materials.py`
- `app/models/inventory_stock.py`
- `app/models/master_data.py`
- `app/models/notebook.py`
- `app/models/route.py`
- `app/models/sequence.py`
- `app/models/settings.py`
- `app/models/unlock_request.py`
- `app/models/user.py`
- `app/modules/experiments/formula_engine.py`
- `app/modules/experiments/service.py`
- `app/services/esignature.py`
- `app/services/experiment_service.py`
- `app/services/formula_engine.py`
- `app/utils/audit.py`
- `app/utils/deps.py`
- `app/utils/files.py`
- `app/utils/global_settings.py`
- `app/utils/retention_cleanup.py`
- `app/utils/richtext.py`
- `app/utils/sequences.py`
- `app/utils/token_cleanup.py`
- `app/utils/tokens.py`
- `requirements.txt`
- `.env.example`
- `alembic.ini`
- `alembic/env.py`
- All shared alembic versions: `54d5062b27bf`, `58d8fa04abad`, `596aedcab073`, `8145d321d174`, `99c6cfdac31d`, `a1b2c3d4e5f6`, `aeb7b2f53360`, `b2c3d4e5f6a7`, `b7d4e2f8a1c9`, `c1f3a8b92e45`, `c3d4e5f6a7b8`, `d4e5f6a7b8c9`, `d4e9f1a23b67`, `da2536df0fed`, `e1a2b3c4d5f6`, `e5c2d8f14a90`, `e5f6a7b8c9d0`, `f6b3c2d9e1a4`, `f7a8b9c0d1e2`, `f8a9b0c1d2e3`
- All inventory module files (both routers and schemas)
- All admin, auth, atr, dashboard, departments, notebooks, reports, search, users module files

---

## DETAILED DIFFS FOR FILES THAT DIFFER

---

### 1. `app/models/__init__.py`

**A adds:**
```python
from app.models.experiment_material import ExperimentMaterial  # noqa: F401
```
(Line 14 in A, absent in B)

**B is missing this import** — if A's `experiment_material.py` is copied to B, this line must also be added.

---

### 2. `app/models/experiment_material.py` — NEW FILE IN A ONLY

Full content — this entire file must be added to B:

```python
# app/models/experiment_material.py
class ExperimentMaterial(Base):
    __tablename__ = "experiment_materials"
    __table_args__ = (
        Index("ix_exp_mat_experiment_id", "experiment_id"),
        Index("ix_exp_mat_batch_id",      "batch_id"),
        CheckConstraint(
            "status IN ('RESERVED','ISSUED','RETURNED')",
            name="ck_exp_mat_status",
        ),
    )

    id:            Mapped[str]     = mapped_column(PUUID, primary_key=True, default=new_uuid)
    experiment_id: Mapped[str]     = mapped_column(PUUID, ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    material_role: Mapped[str]     = mapped_column(String(50),  nullable=False)   # mAb / TCEP / LP / DMSO / NAC / TFF_filter
    material_id:   Mapped[int]     = mapped_column(Integer, ForeignKey("inv_materials.id"), nullable=False)
    batch_id:      Mapped[int]     = mapped_column(Integer, ForeignKey("inv_batches.id"),   nullable=False)
    qty_reserved:  Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit:          Mapped[str]     = mapped_column(String(20),  nullable=False)
    qty_issued:    Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    status:        Mapped[str]     = mapped_column(String(20), default="RESERVED", nullable=False)
    remarks:       Mapped[Optional[str]]     = mapped_column(Text, nullable=True)
    reserved_by:   Mapped[str]     = mapped_column(PUUID, ForeignKey("users.id"), nullable=False)
    reserved_at:   Mapped[datetime]= mapped_column(DateTime(timezone=True), default=now_utc)

    experiment: Mapped["Experiment"]   = relationship(foreign_keys=[experiment_id])
    material:   Mapped["InvMaterial"]  = relationship(foreign_keys=[material_id])
    batch:      Mapped["InvBatch"]     = relationship(foreign_keys=[batch_id])
    reserver:   Mapped["User"]         = relationship(foreign_keys=[reserved_by])
```

---

### 3. `app/models/workflow_template.py`

**B adds** `WorkflowTemplateVersion` class (entirely absent in A):

```python
# ONLY IN B — app/models/workflow_template.py lines 34-48
class WorkflowTemplateVersion(Base):
    __tablename__ = "workflow_template_versions"

    id:          Mapped[str]                      = mapped_column(PUUID, primary_key=True, default=new_uuid)
    template_id: Mapped[str]                      = mapped_column(PUUID, ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    version:     Mapped[int]                      = mapped_column(Integer, nullable=False)
    definition:  Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    saved_by:    Mapped[Optional[str]]            = mapped_column(PUUID, ForeignKey("users.id", ondelete="SET NULL"))
    saved_at:    Mapped[datetime]                 = mapped_column(DateTime(timezone=True), default=now_utc)

    template: Mapped["WorkflowTemplate"] = relationship(foreign_keys=[template_id])
    saver:    Mapped[Optional["User"]]   = relationship(foreign_keys=[saved_by])
```

**Action for merge:** A must adopt B's `workflow_template.py` (it has everything A has, plus the new version class).

---

### 4. `app/models/project.py`

**B adds** two new fields to `Project` (absent in A):

```python
# ONLY IN B — lines 27-28
objective:     Mapped[Optional[str]] = mapped_column(Text)
observation:   Mapped[Optional[str]] = mapped_column(Text)
```

**Action for merge:** A must adopt B's `project.py`.

---

### 5. `app/modules/experiments/router.py`

This is the most significant difference. A has extensive additions that B lacks.

#### 5a. New imports in A (absent in B)

```python
# A only — lines 40-43
from app.models.experiment_material import ExperimentMaterial
from app.models.inventory_batches import InvBatch
from app.models.inventory_materials import InvMaterial
from app.models.inventory_manufacturers import InvManufacturer
```

```python
# A only — lines 49-50 (inside schema imports)
ExperimentLinkPreliminary, ExperimentMaterialCreate, ExperimentMaterialResponse,
ExperimentMaterialUpdate, ...
PreliminaryDataResponse,
```

```python
# A only — line 57
from app.utils.privileges import require_privilege, NOTEBOOKS_CREATE, NOTEBOOKS_EDIT, EXPERIMENTS_APPROVE, EXPERIMENTS_VOID
# B line 51 is missing EXPERIMENTS_VOID:
from app.utils.privileges import require_privilege, NOTEBOOKS_CREATE, NOTEBOOKS_EDIT, EXPERIMENTS_APPROVE
```

#### 5b. New `submit_experiment` logic in A — synthesis gate check (B has no gate)

**A (lines 310-323):**
```python
    # Synthesis gate: both preliminary dispositions must be "Release for conjugation"
    if exp.linked_preliminary_id and exp.linked_preliminary:
        prelim_data = exp.linked_preliminary.data or {}
        mab_ok = prelim_data.get("disposition") == "Release for conjugation"
        lp_ok  = prelim_data.get("lp_disposition") == "Release for conjugation"
        if not mab_ok:
            raise HTTPException(
                400,
                "Cannot submit: linked preliminary mAb disposition is not 'Release for conjugation'",
            )
        if not lp_ok:
            raise HTTPException(
                400,
                "Cannot submit: linked preliminary LP disposition is not 'Release for conjugation'",
            )
```

**B:** The `submit_experiment` function has none of this gate check — it proceeds directly to setting status after the DRAFT check.

#### 5c. New `void_experiment` endpoint in A (entirely absent in B)

```python
# A only — lines 532-550
_void = require_privilege(EXPERIMENTS_VOID)

@router.post("/{exp_id}/void", response_model=ExperimentResponse)
def void_experiment(
    exp_id: str,
    body:   ExperimentReject,
    db:     Session = Depends(get_db),
    actor:  User    = Depends(_void),
):
    exp = _load(db, exp_id)
    if exp.status == "VOID":
        raise HTTPException(400, "Experiment is already void")
    exp.status           = "VOID"
    exp.rejected_by      = actor.id
    exp.rejected_at      = _utcnow()
    exp.rejection_reason = body.reason
    _log(db, exp_id, actor.id, "VOID", {"reason": body.reason})
    db.commit()
    return _load(db, exp_id)
```

#### 5d. New `get_preliminary_data` endpoint in A (entirely absent in B)

```python
# A only — lines 641-666
@router.get("/{exp_id}/preliminary-data", response_model=PreliminaryDataResponse)
def get_preliminary_data(
    exp_id: str,
    db:     Session = Depends(get_db),
    _:      User    = Depends(get_current_user),
):
    """Return the linked preliminary experiment's field data for pre-filling synthesis screens."""
    exp = (
        db.query(Experiment)
        .options(selectinload(Experiment.linked_preliminary))
        .filter(Experiment.id == exp_id)
        .first()
    )
    if not exp:
        raise HTTPException(404, "Experiment not found")
    if not exp.linked_preliminary_id or not exp.linked_preliminary:
        raise HTTPException(404, "No preliminary experiment linked to this experiment")
    prelim = exp.linked_preliminary
    return PreliminaryDataResponse(
        preliminary_id=prelim.id,
        full_code=prelim.full_code,
        title=prelim.title,
        status=prelim.status,
        data=prelim.data,
    )
```

#### 5e. All experiment materials endpoints in A (entirely absent in B)

A adds three endpoints under `/api/experiments/{id}/materials`:

```python
# A only — lines 708-717
@router.get("/{exp_id}/materials", response_model=List[ExperimentMaterialResponse])
def list_experiment_materials(...):
    ...

# A only — lines 720-773
@router.post("/{exp_id}/materials", response_model=ExperimentMaterialResponse, status_code=201)
def reserve_experiment_material(...):
    # validates material, batch, availability, creates ExperimentMaterial row
    # logs MATERIAL_RESERVED
    ...

# A only — lines 776-807
@router.patch("/{exp_id}/materials/{mat_id}", response_model=ExperimentMaterialResponse)
def update_experiment_material(...):
    # updates qty_issued, status, remarks
    # logs MATERIAL_UPDATED
    ...
```

Also adds two helpers:
```python
# A only — lines 671-705
def _materials_query(db, experiment_id): ...   # eager-loads batch.manufacturer
def _material_response(row): ...               # builds ExperimentMaterialResponse
```

#### 5f. `get_history` — improved implementation in A

**A (lines 812-838):** Adds `selectinload(ExperimentHistory.actor)` and returns `actor_name`:
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
            id=r.id,
            experiment_id=r.experiment_id,
            actor_id=r.actor_id,
            actor_name=r.actor.display_name if r.actor else None,
            action=r.action,
            details=r.details,
            created_at=r.created_at,
        )
        for r in rows
    ]
```

**B (lines 589-602):** No eager load, no `actor_name`, returns ORM rows directly:
```python
    return (
        db.query(ExperimentHistory)
        .filter(ExperimentHistory.experiment_id == exp_id)
        .order_by(ExperimentHistory.created_at)
        .all()
    )
```

#### 5g. `assign_reviewer` — improved eager-load in A

**A (lines 371-378):** Re-queries with eager load so reviewer relationship is populated:
```python
    review = (
        db.query(ExperimentReview)
        .options(selectinload(ExperimentReview.reviewer))
        .filter(ExperimentReview.id == review.id)
        .first()
    )
    return review
```

**B (lines 348-350):** Uses `db.refresh(review)` then returns bare ORM object (potential lazy-load):
```python
    db.commit()
    db.refresh(review)
    return review
```

---

### 6. `app/schemas/experiment.py`

#### 6a. `ExperimentHistoryResponse` — A adds `actor_name` field

**A (lines 47-55):**
```python
class ExperimentHistoryResponse(BaseModel):
    id:            str
    experiment_id: str
    actor_id:      str
    actor_name:    Optional[str] = None   # <-- NEW IN A
    action:        str
    details:       Optional[Dict[str, Any]]
    created_at:    datetime
    model_config = ConfigDict(from_attributes=True)
```

**B (lines 47-54):** No `actor_name` field.

#### 6b. New schemas in A only

```python
# A only — lines 99-144

class ExperimentMaterialCreate(BaseModel):
    material_role: str
    material_id:   int
    batch_id:      int
    qty_reserved:  float
    unit:          str
    remarks:       Optional[str] = None

class ExperimentMaterialUpdate(BaseModel):
    qty_issued: Optional[float] = None
    status:     Optional[str]   = None   # RESERVED | ISSUED | RETURNED
    remarks:    Optional[str]   = None

class ExperimentMaterialResponse(BaseModel):
    id:            str
    experiment_id: str
    material_role: str
    material_id:   int
    batch_id:      int
    qty_reserved:  float
    unit:          str
    qty_issued:    Optional[float]
    status:        str
    remarks:       Optional[str]
    reserved_by:   str
    reserved_at:   datetime
    material_name:  Optional[str] = None
    material_code:  Optional[str] = None
    batch_no:       Optional[str] = None
    manufacturer_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class PreliminaryDataResponse(BaseModel):
    preliminary_id:   str
    full_code:        str
    title:            str
    status:           str
    data:             Optional[Dict[str, Any]]
    model_config = ConfigDict(from_attributes=True)
```

#### 6c. `ExperimentResponse` — A adds `approver` field

**A (lines 200-204):**
```python
    approved_by:      Optional[str]
    approved_at:      Optional[datetime]
    approver:         Optional[_UserShort]    # <-- NEW IN A
    rejected_by:      Optional[str]
    rejected_at:      Optional[datetime]
```

**B (lines 152-157):** No `approver` field in `ExperimentResponse`.

---

### 7. `app/schemas/workflow_template.py`

**B adds** `WorkflowTemplateVersionResponse` schema at the top (absent in A):

```python
# B only — lines 7-14
class WorkflowTemplateVersionResponse(BaseModel):
    id:          str
    template_id: str
    version:     int
    definition:  Optional[Dict[str, Any]]
    saved_by:    Optional[str]
    saved_at:    datetime
    model_config = ConfigDict(from_attributes=True)
```

**Action for merge:** A must adopt B's `workflow_template.py` schema file.

---

### 8. `app/schemas/project.py`

**B adds** `objective` and `observation` to `ProjectUpdate` and `ProjectResponse` (absent in A):

**B `ProjectUpdate` (lines 43-55):**
```python
class ProjectUpdate(BaseModel):
    ...
    description:   Optional[str]  = None
    objective:     Optional[str]  = None     # NEW IN B
    observation:   Optional[str]  = None     # NEW IN B
    status:        Optional[str]  = None
```

**B `ProjectResponse` (lines 58-80):**
```python
class ProjectResponse(BaseModel):
    ...
    description:   Optional[str]
    objective:     Optional[str]    # NEW IN B
    observation:   Optional[str]    # NEW IN B
    created_at:    datetime
    updated_at:    datetime
```

**Action for merge:** A must adopt B's `project.py` schema.

---

### 9. `app/modules/workflow_templates/router.py`

#### 9a. New imports in B

```python
# B only — lines 8, 13-14
from app.models.workflow_template import WorkflowTemplate, WorkflowTemplateVersion
    WorkflowTemplateVersionResponse,
```

#### 9b. `update_template` — B saves a version snapshot before overwriting

**B (lines 103-121):**
```python
def update_template(
    template_id: str,
    body:        WorkflowTemplateUpdate,
    db:          Session = Depends(get_db),
    actor:       User    = Depends(_admin),   # <-- actor needed
):
    t = _get_or_404(db, template_id)
    updates = body.model_dump(exclude_unset=True)
    if "definition" in updates:
        # Snapshot the current version before overwriting
        snapshot = WorkflowTemplateVersion(
            id          = new_uuid(),
            template_id = t.id,
            version     = t.version,
            definition  = t.definition,
            saved_by    = actor.id,
        )
        db.add(snapshot)
        t.version += 1
    for field, value in updates.items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t
```

**A (lines 96-112):** `update_template` dependency is `_:  User = Depends(_admin)` (no actor), and does NOT save a snapshot — just bumps version:
```python
def update_template(
    template_id: str,
    body:        WorkflowTemplateUpdate,
    db:          Session = Depends(get_db),
    _:           User    = Depends(_admin),   # actor not available
):
    t = _get_or_404(db, template_id)
    updates = body.model_dump(exclude_unset=True)
    if "definition" in updates:
        t.version += 1   # version bump only — no snapshot saved
    for field, value in updates.items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return t
```

#### 9c. New `list_template_versions` endpoint in B only

```python
# B only — lines 126-138
@router.get("/{template_id}/versions", response_model=List[WorkflowTemplateVersionResponse])
def list_template_versions(
    template_id: str,
    db:          Session = Depends(get_db),
    _:           User    = Depends(get_current_user),
):
    _get_or_404(db, template_id)
    return (
        db.query(WorkflowTemplateVersion)
        .filter(WorkflowTemplateVersion.template_id == template_id)
        .order_by(WorkflowTemplateVersion.version.desc())
        .all()
    )
```

---

### 10. `app/modules/projects/router.py`

#### 10a. `_project_response` helper — B passes `objective` and `observation`

**B (lines 69-79):**
```python
    return ProjectResponse(
        ...
        status=p.status, description=p.description,
        objective=p.objective, observation=p.observation,   # NEW IN B
        created_at=p.created_at, updated_at=p.updated_at,
    )
```

**A (lines 69-78):** No `objective`/`observation` passed.

#### 10b. `list_projects` — B filters TL role to member projects only

**B (lines 154-159):**
```python
    # TL users only see projects they have been added to as a team member
    if current_user.role.code == "TL":
        member_project_ids = db.query(ProjectUser.project_id).filter(
            ProjectUser.user_id == current_user.id
        ).subquery()
        q = q.filter(Project.id.in_(member_project_ids))
```

**A:** No such filter — all authenticated users see all projects.

Note: B's `list_projects` renames the parameter `_: User = Depends(get_current_user)` to `current_user: User = Depends(get_current_user)` so it can access the role.

---

### 11. `app/utils/privileges.py`

One DEFAULT_GRANTS entry differs:

**A (line 125):**
```python
PROJECTS_CREATE:      frozenset({"QA", "HOD", "TL"}),
```

**B (line 125):**
```python
PROJECTS_CREATE:      frozenset({"HOD"}),
```

B restricts project creation to HOD only by default (TL and QA already bypass via QA super-admin). A still allows TL in the default grant.

---

### 12. `alembic/versions/b7eadfe299af_add_experiment_materials.py` — NEW IN A ONLY

Creates the `experiment_materials` table. Full migration:

```python
revision: str = 'b7eadfe299af'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'

def upgrade() -> None:
    op.create_table(
        'experiment_materials',
        sa.Column('id',            sa.String(),       primary_key=True),
        sa.Column('experiment_id', sa.String(),       sa.ForeignKey('experiments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('material_role', sa.String(50),     nullable=False),
        sa.Column('material_id',   sa.Integer(),      sa.ForeignKey('inv_materials.id'), nullable=False),
        sa.Column('batch_id',      sa.Integer(),      sa.ForeignKey('inv_batches.id'),   nullable=False),
        sa.Column('qty_reserved',  sa.Numeric(12, 4), nullable=False),
        sa.Column('unit',          sa.String(20),     nullable=False),
        sa.Column('qty_issued',    sa.Numeric(12, 4), nullable=True),
        sa.Column('status',        sa.String(20),     nullable=False, server_default='RESERVED'),
        sa.Column('remarks',       sa.Text(),         nullable=True),
        sa.Column('reserved_by',   sa.String(),       sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reserved_at',   sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('RESERVED','ISSUED','RETURNED')", name='ck_exp_mat_status'),
    )
    op.create_index('ix_exp_mat_experiment_id', 'experiment_materials', ['experiment_id'])
    op.create_index('ix_exp_mat_batch_id',      'experiment_materials', ['batch_id'])
```

**Note on migration chain conflict:** Both A and B have `f8a9b0c1d2e3` as the last shared migration. A adds `b7eadfe299af` after it. B adds `g9h0i1j2k3l4` → `h1i2j3k4l5m6` → `i2j3k4l5m6n7` after it. This is a **branch conflict** — both sides have `down_revision = 'f8a9b0c1d2e3'`. Alembic will detect a branching head. The merge plan must create a merge migration to unify the two branch heads.

---

### 13. `alembic/versions/g9h0i1j2k3l4_add_workflow_template_versions.py` — B ONLY

```python
revision = 'g9h0i1j2k3l4'
down_revision = 'f8a9b0c1d2e3'

def upgrade() -> None:
    op.create_table(
        'workflow_template_versions',
        sa.Column('id',          PUUID,  primary_key=True),
        sa.Column('template_id', PUUID,  sa.ForeignKey('workflow_templates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version',     sa.Integer(), nullable=False),
        sa.Column('definition',  sa.JSON(),    nullable=True),
        sa.Column('saved_by',    PUUID,        sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('saved_at',    sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_workflow_template_versions_template_id', 'workflow_template_versions', ['template_id'])
```

---

### 14. `alembic/versions/h1i2j3k4l5m6_add_objective_to_projects.py` — B ONLY

```python
revision = 'h1i2j3k4l5m6'
down_revision = 'g9h0i1j2k3l4'

def upgrade() -> None:
    op.add_column('projects', sa.Column('objective', sa.Text(), nullable=True))
```

---

### 15. `alembic/versions/i2j3k4l5m6n7_add_observation_to_projects.py` — B ONLY

```python
revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'

def upgrade() -> None:
    op.add_column('projects', sa.Column('observation', sa.Text(), nullable=True))
```

---

## Merge Action Plan

The goal is to merge Folder A's new features INTO Folder B (sensor-proto) without losing any of B's features.

### Step 1 — Copy new file from A to B

```
COPY A:\app\models\experiment_material.py  → B:\app\models\experiment_material.py
COPY A:\alembic\versions\b7eadfe299af_add_experiment_materials.py → B:\alembic\versions\
```

### Step 2 — Patch `app/models/__init__.py` in B

Add after line 13 (after `from app.models.experiment import ...`):
```python
from app.models.experiment_material import ExperimentMaterial  # noqa: F401
```

### Step 3 — Patch `app/schemas/experiment.py` in B

1. Add `actor_name: Optional[str] = None` to `ExperimentHistoryResponse`.
2. Add `approver: Optional[_UserShort]` to `ExperimentResponse` (after `approved_at`).
3. Add the three new schema classes (after `ExperimentLinkPreliminary`):
   - `ExperimentMaterialCreate`
   - `ExperimentMaterialUpdate`
   - `ExperimentMaterialResponse`
   - `PreliminaryDataResponse`

### Step 4 — Patch `app/modules/experiments/router.py` in B

1. Add new imports (lines 40-43 from A): `ExperimentMaterial`, `InvBatch`, `InvMaterial`, `InvManufacturer`
2. Add new schema imports: `ExperimentMaterialCreate`, `ExperimentMaterialResponse`, `ExperimentMaterialUpdate`, `PreliminaryDataResponse`
3. Add `EXPERIMENTS_VOID` to the privileges import line.
4. Add the synthesis gate check inside `submit_experiment` (after the DRAFT status check).
5. Add `void_experiment` endpoint (after `reject_experiment`).
6. Add `get_preliminary_data` endpoint (after `link_preliminary`).
7. Add `_materials_query` helper, `_material_response` helper.
8. Add `list_experiment_materials`, `reserve_experiment_material`, `update_experiment_material` endpoints.
9. Update `get_history` to eager-load `ExperimentHistory.actor` and return `actor_name`.
10. Update `assign_reviewer` to re-query with eager load instead of `db.refresh(review)`.

### Step 5 — Fix alembic migration branch conflict

Both `b7eadfe299af` (A) and `g9h0i1j2k3l4` (B) have `down_revision = 'f8a9b0c1d2e3'`, creating two branch heads. Create a merge migration:

```python
# new file: alembic/versions/XXXX_merge_experiment_materials_and_wf_versions.py
revision = 'XXXX'
down_revision = ('b7eadfe299af', 'i2j3k4l5m6n7')   # merges both branch heads

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
```

Or run: `alembic merge b7eadfe299af i2j3k4l5m6n7 -m "merge experiment_materials and project fields"`

### Step 6 — No action needed for

- `app/models/workflow_template.py` (B is ahead — keep B's version)
- `app/modules/workflow_templates/router.py` (B is ahead — keep B's version)
- `app/schemas/workflow_template.py` (B is ahead — keep B's version)
- `app/models/project.py` (B is ahead — keep B's version)
- `app/modules/projects/router.py` (B is ahead — keep B's version)
- `app/schemas/project.py` (B is ahead — keep B's version)
- `app/utils/privileges.py` (B's `PROJECTS_CREATE = frozenset({"HOD"})` is intentional — do not revert to A's value unless TL project creation is desired)

---

## Summary Table

| File | Action | Who is ahead |
|------|--------|--------------|
| `app/models/experiment_material.py` | **COPY from A to B** (new file) | A only |
| `app/models/__init__.py` | **PATCH B** — add ExperimentMaterial import | A |
| `app/schemas/experiment.py` | **PATCH B** — add actor_name, approver, 4 new schemas | A |
| `app/modules/experiments/router.py` | **PATCH B** — add void, preliminary-data, materials endpoints, synthesis gate, history fix, reviewer fix | A |
| `alembic/versions/b7eadfe299af_add_experiment_materials.py` | **COPY from A to B** (new migration) | A only |
| `app/models/workflow_template.py` | **KEEP B** (has WorkflowTemplateVersion) | B |
| `app/schemas/workflow_template.py` | **KEEP B** (has WorkflowTemplateVersionResponse) | B |
| `app/modules/workflow_templates/router.py` | **KEEP B** (has version snapshot + list versions endpoint) | B |
| `app/models/project.py` | **KEEP B** (has objective/observation fields) | B |
| `app/schemas/project.py` | **KEEP B** (has objective/observation in Update+Response) | B |
| `app/modules/projects/router.py` | **KEEP B** (has TL member-project filter + objective/observation in response) | B |
| `alembic/versions/g9h0i1j2k3l4_*` | **KEEP B** | B only |
| `alembic/versions/h1i2j3k4l5m6_*` | **KEEP B** | B only |
| `alembic/versions/i2j3k4l5m6n7_*` | **KEEP B** | B only |
| `app/utils/privileges.py` | Decision needed: B restricts `PROJECTS_CREATE` to HOD only; A allows QA+HOD+TL | Diverged |
| Alembic branch heads | **CREATE merge migration** combining `b7eadfe299af` + `i2j3k4l5m6n7` | Conflict |
| All other files | **IDENTICAL** — no action | Same |
