"""
Inventory module — re-exports all sub-routers for main.py registration.
"""
from app.modules.inventory.materials      import router as materials_router
from app.modules.inventory.manufacturers  import router as manufacturers_router
from app.modules.inventory.mappings       import router as mappings_router
from app.modules.inventory.audit          import router as audit_router
from app.modules.inventory.batches        import router as batches_router
from app.modules.inventory.batch_verification import router as batch_ver_router
from app.modules.inventory.stock_requests import router as stock_requests_router
from app.modules.inventory.equip_master   import (
    equip_type_router, instr_type_router, col_type_router,
)
from app.modules.inventory.catalogue      import (
    equip_cat_router, instr_cat_router, col_cat_router,
)
from app.modules.inventory.schedules      import (
    maint_router, calib_router, equip_ver_router, instr_ver_router,
)
from app.modules.inventory.dashboard      import router as inv_dashboard_router
from app.modules.inventory.reports        import router as inv_reports_router
