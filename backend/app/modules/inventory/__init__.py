"""Inventory module – exports all sub-routers for registration in main.py."""
# B2 routers
from app.modules.inventory.consumable_types import router as consumable_types_router
from app.modules.inventory.materials import router as materials_router
from app.modules.inventory.manufacturers import router as manufacturers_router
from app.modules.inventory.mappings import router as mappings_router
from app.modules.inventory.equip_master import (
    equipment_type_router,
    instrument_type_router,
    column_type_router,
)
from app.modules.inventory.catalogue import (
    equipment_router,
    instrument_router,
    column_router,
)

# B3 routers
from app.modules.inventory.batches import router as batches_router
from app.modules.inventory.stock_requests import router as stock_requests_router
from app.modules.inventory.checklists import router as checklists_router
from app.modules.inventory.measurement_master import router as measurement_master_router
from app.modules.inventory.log_mapping import router as log_mapping_router
from app.modules.inventory.instrument_spec import router as instrument_spec_router
from app.modules.inventory.schedules import router as schedules_router
from app.modules.inventory.master_templates import router as master_templates_router
from app.modules.inventory.spare_parts import router as spare_parts_router
from app.modules.inventory.work_orders import router as work_orders_router
from app.modules.inventory.usage_logs import router as usage_logs_router
from app.modules.inventory.lookup import router as lookup_router
from app.modules.inventory.uom import router as uom_router
from app.modules.inventory.test_master import router as test_master_router
from app.modules.inventory.dashboard import router as dashboard_router
from app.modules.inventory.reports import router as reports_router
from app.modules.inventory.storage_conditions import router as storage_conditions_router
from app.modules.inventory.audit_trail import router as audit_trail_router

__all__ = [
    # B2
    "consumable_types_router",
    "materials_router",
    "manufacturers_router",
    "mappings_router",
    "equipment_type_router",
    "instrument_type_router",
    "column_type_router",
    "equipment_router",
    "instrument_router",
    "column_router",
    # B3
    "batches_router",
    "stock_requests_router",
    "checklists_router",
    "measurement_master_router",
    "log_mapping_router",
    "instrument_spec_router",
    "schedules_router",
    "master_templates_router",
    "spare_parts_router",
    "work_orders_router",
    "usage_logs_router",
    "lookup_router",
    "uom_router",
    "test_master_router",
    "dashboard_router",
    "reports_router",
    "storage_conditions_router",
    "audit_trail_router",
]
