from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(
    title="Chemia ELN API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": "2.0.0"}


# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers import auth                            # noqa: E402
from app.routers import users                           # noqa: E402
from app.routers import departments                     # noqa: E402
from app.routers import projects                        # noqa: E402
from app.routers import routes                          # noqa: E402
from app.routers import notebooks                       # noqa: E402
from app.routers import experiments                     # noqa: E402
from app.routers import atr as atr_module               # noqa: E402
from app.routers import admin                           # noqa: E402
from app.routers import notification_settings as ns     # noqa: E402
from app.routers import excel_templates as et           # noqa: E402
from app.routers import role_privileges as rp           # noqa: E402
from app.routers import dashboard                       # noqa: E402
from app.routers import search                          # noqa: E402
from app.routers import master_data                     # noqa: E402
from app.routers import pdf_export                      # noqa: E402

# ── Inventory Master routers ──────────────────────────────────────────────────
from app.routers import inventory_materials             # noqa: E402
from app.routers import inventory_manufacturers         # noqa: E402
from app.routers import inventory_mappings              # noqa: E402
from app.routers import inventory_audit                 # noqa: E402
from app.routers import inventory_batches               # noqa: E402
from app.routers import inventory_batch_verification    # noqa: E402
from app.routers import inventory_stock_requests        # noqa: E402
from app.routers.inventory_equip_master import (        # noqa: E402
    equip_type_router, instr_type_router, col_type_router,
)
from app.routers.inventory_catalogue import (           # noqa: E402
    equip_cat_router, instr_cat_router, col_cat_router,
)
from app.routers.inventory_schedules import (           # noqa: E402
    maint_router, calib_router, equip_ver_router, instr_ver_router,
)
from app.routers import inventory_dashboard             # noqa: E402
from app.routers import inventory_reports               # noqa: E402

app.include_router(auth.router,               prefix="/api/auth",                   tags=["Auth"])
app.include_router(users.router,              prefix="/api/users",                  tags=["Users"])
app.include_router(departments.router,        prefix="/api/departments",             tags=["Departments"])
app.include_router(projects.router,           prefix="/api/projects",               tags=["Projects"])
app.include_router(routes.router,             prefix="/api/routes",                 tags=["Routes"])
app.include_router(notebooks.router,          prefix="/api/notebooks",              tags=["Notebooks"])
app.include_router(experiments.router,        prefix="/api/experiments",            tags=["Experiments"])
app.include_router(atr_module.router,         prefix="/api/atr",                    tags=["ATR"])
app.include_router(atr_module.unlock_router,  prefix="/api/unlock-requests",        tags=["Unlock Requests"])
app.include_router(admin.router,              prefix="/api/admin",                  tags=["Admin"])
app.include_router(ns.router,                 prefix="/api/notification-settings",  tags=["Notification Settings"])
app.include_router(et.router,                 prefix="/api/excel-templates",        tags=["Excel Templates"])
app.include_router(rp.router,                 prefix="/api/role-privileges",        tags=["Role Privileges"])
app.include_router(rp.roles_router,           prefix="/api/roles",                  tags=["Roles"])
app.include_router(dashboard.router,          prefix="/api/dashboard",              tags=["Dashboard"])
app.include_router(search.router,             prefix="/api/search",                 tags=["Search"])
app.include_router(master_data.router,        prefix="/api/master-data",            tags=["Master Data"])
app.include_router(pdf_export.router,         prefix="/api/experiments",            tags=["PDF Export"])

# ── Inventory Master ──────────────────────────────────────────────────────────
app.include_router(inventory_materials.router,    prefix="/api/inventory/materials",     tags=["Inventory Materials"])
app.include_router(inventory_manufacturers.router,prefix="/api/inventory/manufacturers",  tags=["Inventory Manufacturers"])
app.include_router(inventory_mappings.router,     prefix="/api/inventory/mappings",       tags=["Inventory Mappings"])
app.include_router(inventory_audit.router,        prefix="/api/inventory/audit-trail",    tags=["Inventory Audit Trail"])
app.include_router(inventory_batches.router,           prefix="/api/inventory/batches",              tags=["Inventory Batches"])
app.include_router(inventory_batch_verification.router, prefix="/api/inventory/batch-verifications",  tags=["Inventory Batch Verifications"])
app.include_router(inventory_stock_requests.router,     prefix="/api/inventory/stock-requests",       tags=["Inventory Stock Requests"])
app.include_router(equip_type_router,                  prefix="/api/inventory/equipment-types",      tags=["Inventory Equipment Types"])
app.include_router(instr_type_router,                  prefix="/api/inventory/instrument-types",     tags=["Inventory Instrument Types"])
app.include_router(col_type_router,                    prefix="/api/inventory/column-types",         tags=["Inventory Column Types"])
app.include_router(equip_cat_router,                   prefix="/api/inventory/equipment-catalogue",  tags=["Inventory Equipment Catalogue"])
app.include_router(instr_cat_router,                   prefix="/api/inventory/instrument-catalogue", tags=["Inventory Instrument Catalogue"])
app.include_router(col_cat_router,                     prefix="/api/inventory/column-catalogue",          tags=["Inventory Column Catalogue"])
app.include_router(maint_router,                       prefix="/api/inventory/maintenance-schedules",   tags=["Inventory Maintenance Schedules"])
app.include_router(calib_router,                       prefix="/api/inventory/calibration-schedules",   tags=["Inventory Calibration Schedules"])
app.include_router(equip_ver_router,                   prefix="/api/inventory/equipment-verifications", tags=["Inventory Equipment Verifications"])
app.include_router(instr_ver_router,                   prefix="/api/inventory/instrument-verifications",    tags=["Inventory Instrument Verifications"])
app.include_router(inventory_dashboard.router,         prefix="/api/inventory/dashboard",                   tags=["Inventory Dashboard"])
app.include_router(inventory_reports.router,           prefix="/api/inventory/reports",                     tags=["Inventory Reports"])
