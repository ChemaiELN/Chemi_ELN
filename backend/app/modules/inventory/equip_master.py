"""Equipment, Instrument, and Column type routers via CRUD factory."""
from app.models.inventory import (
    InvColumnType,
    InvEquipmentType,
    InvInstrumentType,
)
from app.schemas.inventory import (
    ColumnTypeCreate,
    ColumnTypeOut,
    ColumnTypeUpdate,
    TypeCreate,
    TypeOut,
    TypeUpdate,
)
from app.modules.inventory._crud_factory import make_type_router

equipment_type_router = make_type_router(
    prefix="/inventory/equipment-types",
    tags=["inventory-equipment-types"],
    model=InvEquipmentType,
    schema_create=TypeCreate,
    schema_update=TypeUpdate,
    schema_out=TypeOut,
)

instrument_type_router = make_type_router(
    prefix="/inventory/instrument-types",
    tags=["inventory-instrument-types"],
    model=InvInstrumentType,
    schema_create=TypeCreate,
    schema_update=TypeUpdate,
    schema_out=TypeOut,
)

column_type_router = make_type_router(
    prefix="/inventory/column-types",
    tags=["inventory-column-types"],
    model=InvColumnType,
    schema_create=ColumnTypeCreate,
    schema_update=ColumnTypeUpdate,
    schema_out=ColumnTypeOut,
)
