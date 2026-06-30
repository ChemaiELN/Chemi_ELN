from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="Chemia ELN API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Phase A1 ─────────────────────────────────────────────────
from app.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# ── Phase A2 ─────────────────────────────────────────────────
from app.modules.users.router import router as users_router
from app.modules.departments.router import router as departments_router
from app.modules.admin.role_privileges import router as rp_router, roles_router
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(departments_router, prefix="/api/departments", tags=["departments"])
app.include_router(rp_router, prefix="/api/role-privileges", tags=["role-privileges"])
app.include_router(roles_router, prefix="/api/roles", tags=["roles"])

# ── Phase A3 ─────────────────────────────────────────────────
from app.modules.admin.settings_router import router as settings_router
from app.modules.admin.master_data_router import router as master_data_router
app.include_router(settings_router, prefix="/api/admin/settings", tags=["admin-settings"])
app.include_router(master_data_router, prefix="/api/master-data", tags=["master-data"])

# ── Phase B2 – Inventory master data ─────────────────────────
from app.modules.inventory import (
    consumable_types_router,
    materials_router,
    manufacturers_router,
    mappings_router,
    equipment_type_router,
    instrument_type_router,
    column_type_router,
    equipment_router,
    instrument_router,
    column_router,
    # B3
    batches_router,
    batch_verif_router,
    stock_requests_router,
    maintenance_router,
    calibration_router,
    equip_verif_router,
    instr_verif_router,
    lookup_router,
    uom_router,
    test_master_router,
    dashboard_router,
    reports_router,
    storage_conditions_router,
    audit_trail_router,
)
app.include_router(consumable_types_router, prefix="/api")
app.include_router(materials_router, prefix="/api")
app.include_router(manufacturers_router, prefix="/api")
app.include_router(mappings_router, prefix="/api")
app.include_router(equipment_type_router, prefix="/api")
app.include_router(instrument_type_router, prefix="/api")
app.include_router(column_type_router, prefix="/api")
app.include_router(equipment_router, prefix="/api")
app.include_router(instrument_router, prefix="/api")
app.include_router(column_router, prefix="/api")
# B3
app.include_router(batches_router, prefix="/api")
app.include_router(batch_verif_router, prefix="/api")
app.include_router(stock_requests_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")
app.include_router(calibration_router, prefix="/api")
app.include_router(equip_verif_router, prefix="/api")
app.include_router(instr_verif_router, prefix="/api")
app.include_router(lookup_router, prefix="/api")
app.include_router(uom_router, prefix="/api")
app.include_router(test_master_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(storage_conditions_router, prefix="/api")
app.include_router(audit_trail_router, prefix="/api")

# Phase D1 — ensure all ADC models are registered with SQLAlchemy mapper
from app.models import workflow_template as _wt   # noqa: F401
from app.models import project as _proj           # noqa: F401
from app.models import notebook as _nb            # noqa: F401
from app.models import experiment as _exp         # noqa: F401
from app.models import adc as _adc               # noqa: F401

# Phase D2 — ADC module
from app.modules.workflow_templates.router import router as workflow_templates_router
from app.modules.projects.router import router as projects_router
from app.modules.notebooks.router import router as notebooks_router, nb_sub_router as notebooks_sub_router
app.include_router(workflow_templates_router, prefix="/api")
app.include_router(projects_router,           prefix="/api")
app.include_router(notebooks_router,          prefix="/api")
app.include_router(notebooks_sub_router,      prefix="/api")

# Phase D3 — Experiments
from app.modules.experiments.router import router as experiments_nb_router, exp_router as experiments_router
app.include_router(experiments_nb_router, prefix="/api")
app.include_router(experiments_router,    prefix="/api")
