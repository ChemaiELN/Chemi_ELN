from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.middleware.logging import BodySizeLimitMiddleware, RequestLoggingMiddleware, configure_logging
from app.middleware.security import SecurityHeadersMiddleware

configure_logging(log_level="INFO")

# ── Rate limiter (shared instance — routers import this) ──────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Chemia ELN API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Attach limiter to app state so slowapi middleware can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Security headers (outermost — applied to every response) ─────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── Body size limit (outermost after CORS — rejects oversized JSON early) ─────
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.MAX_BODY_BYTES)

# ── Structured request logging (innermost — runs after CORS) ─────────────────
app.add_middleware(
    RequestLoggingMiddleware,
    secret_key=settings.SECRET_KEY,
    algorithm=settings.ALGORITHM,
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


# ── Domain modules ────────────────────────────────────────────────────────────
from app.modules.auth        import router as _auth_mod          # noqa: E402
from app.modules.users       import router as _users_mod         # noqa: E402
from app.modules.departments import router as _dept_mod          # noqa: E402
from app.modules.projects    import router as _proj_mod          # noqa: E402
from app.modules.projects    import routes as _proj_routes_mod   # noqa: E402
from app.modules.notebooks   import router as _nb_mod            # noqa: E402
from app.modules.experiments.router import nb_router as _exp_nb_router, router as _exp_router  # noqa: E402
from app.modules.workflow_templates import router as _wft_router_mod  # noqa: E402
from app.modules.atr         import router as _atr_mod           # noqa: E402
from app.modules.admin       import router as _admin_mod         # noqa: E402
from app.modules.admin       import notifications as _ns_mod     # noqa: E402
from app.modules.admin       import excel_templates as _et_mod   # noqa: E402
from app.modules.admin       import role_privileges as _rp_mod   # noqa: E402
from app.modules.admin       import master_data as _md_mod       # noqa: E402
from app.modules.dashboard   import router as _dash_mod          # noqa: E402
from app.modules.search      import router as _search_mod        # noqa: E402
from app.modules.reports     import router as _reports_mod       # noqa: E402

# ── Inventory module (all sub-routers in one import) ─────────────────────────
from app.modules.inventory import (                              # noqa: E402
    materials_router, manufacturers_router, mappings_router,
    audit_router, batches_router, batch_ver_router,
    stock_requests_router, equip_type_router, instr_type_router,
    col_type_router, equip_cat_router, instr_cat_router,
    col_cat_router, maint_router, calib_router,
    equip_ver_router, instr_ver_router,
    inv_dashboard_router, inv_reports_router,
)

# ── Core routes ───────────────────────────────────────────────────────────────
app.include_router(_auth_mod.router,               prefix="/api/auth",                   tags=["Auth"])
app.include_router(_users_mod.router,              prefix="/api/users",                  tags=["Users"])
app.include_router(_dept_mod.router,               prefix="/api/departments",             tags=["Departments"])
app.include_router(_proj_mod.router,               prefix="/api/projects",               tags=["Projects"])
app.include_router(_proj_routes_mod.router,        prefix="/api/routes",                 tags=["Routes"])
app.include_router(_nb_mod.router,                 prefix="/api/notebooks",              tags=["Notebooks"])
app.include_router(_exp_nb_router,                 prefix="/api/notebooks",              tags=["Experiments"])
app.include_router(_exp_router,                    prefix="/api/experiments",            tags=["Experiments"])
app.include_router(_wft_router_mod.router,         prefix="/api/workflow-templates",     tags=["Workflow Templates"])
app.include_router(_atr_mod.router,                prefix="/api/atr",                    tags=["ATR"])
app.include_router(_atr_mod.unlock_router,         prefix="/api/unlock-requests",        tags=["Unlock Requests"])
app.include_router(_admin_mod.router,              prefix="/api/admin",                  tags=["Admin"])
app.include_router(_ns_mod.router,                 prefix="/api/notification-settings",  tags=["Notification Settings"])
app.include_router(_et_mod.router,                 prefix="/api/excel-templates",        tags=["Excel Templates"])
app.include_router(_rp_mod.router,                 prefix="/api/role-privileges",        tags=["Role Privileges"])
app.include_router(_rp_mod.roles_router,           prefix="/api/roles",                  tags=["Roles"])
app.include_router(_dash_mod.router,               prefix="/api/dashboard",              tags=["Dashboard"])
app.include_router(_search_mod.router,             prefix="/api/search",                 tags=["Search"])
app.include_router(_md_mod.router,                 prefix="/api/master-data",            tags=["Master Data"])
app.include_router(_reports_mod.router,            prefix="/api/experiments",            tags=["PDF Export"])

# ── Inventory ─────────────────────────────────────────────────────────────────
app.include_router(materials_router,      prefix="/api/inventory/materials",              tags=["Inventory Materials"])
app.include_router(manufacturers_router,  prefix="/api/inventory/manufacturers",          tags=["Inventory Manufacturers"])
app.include_router(mappings_router,       prefix="/api/inventory/mappings",               tags=["Inventory Mappings"])
app.include_router(audit_router,          prefix="/api/inventory/audit-trail",            tags=["Inventory Audit Trail"])
app.include_router(batches_router,        prefix="/api/inventory/batches",                tags=["Inventory Batches"])
app.include_router(batch_ver_router,      prefix="/api/inventory/batch-verifications",    tags=["Inventory Batch Verifications"])
app.include_router(stock_requests_router, prefix="/api/inventory/stock-requests",         tags=["Inventory Stock Requests"])
app.include_router(equip_type_router,     prefix="/api/inventory/equipment-types",        tags=["Inventory Equipment Types"])
app.include_router(instr_type_router,     prefix="/api/inventory/instrument-types",       tags=["Inventory Instrument Types"])
app.include_router(col_type_router,       prefix="/api/inventory/column-types",           tags=["Inventory Column Types"])
app.include_router(equip_cat_router,      prefix="/api/inventory/equipment-catalogue",    tags=["Inventory Equipment Catalogue"])
app.include_router(instr_cat_router,      prefix="/api/inventory/instrument-catalogue",   tags=["Inventory Instrument Catalogue"])
app.include_router(col_cat_router,        prefix="/api/inventory/column-catalogue",       tags=["Inventory Column Catalogue"])
app.include_router(maint_router,          prefix="/api/inventory/maintenance-schedules",  tags=["Inventory Maintenance Schedules"])
app.include_router(calib_router,          prefix="/api/inventory/calibration-schedules",  tags=["Inventory Calibration Schedules"])
app.include_router(equip_ver_router,      prefix="/api/inventory/equipment-verifications", tags=["Inventory Equipment Verifications"])
app.include_router(instr_ver_router,      prefix="/api/inventory/instrument-verifications", tags=["Inventory Instrument Verifications"])
app.include_router(inv_dashboard_router,  prefix="/api/inventory/dashboard",              tags=["Inventory Dashboard"])
app.include_router(inv_reports_router,    prefix="/api/inventory/reports",                tags=["Inventory Reports"])
