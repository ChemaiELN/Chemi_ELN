# Import all models here so SQLAlchemy / Alembic can discover every table.

from app.models.base import Base  # noqa: F401

from app.models.department import Department  # noqa: F401
from app.models.user import User, Role, RolePrivilege, PasswordResetToken, RefreshToken  # noqa: F401
from app.models.project import (  # noqa: F401
    Project, ProjectUser, Milestone, ProjectAttachment, MilestoneAttachment,
)
from app.models.route import Route, Stage  # noqa: F401
from app.models.notebook import Notebook, NotebookPermission  # noqa: F401
from app.models.experiment import (  # noqa: F401
    Experiment,
    ExperimentStep,
    ExperimentEquipment,
    ExperimentInput,
    ExperimentParameter,
    ExperimentTLC,
    ExperimentAttachment,
    ExperimentHistory,
    ExperimentComment,
)
from app.models.unlock_request import UnlockRequest  # noqa: F401
from app.models.atr import ATR, ATRAttachment, ATRFinalReport  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.sequence import SequenceCounter  # noqa: F401
from app.models.settings import (  # noqa: F401
    CompanySettings,
    GlobalSettings,
    CRDSettings,
    SMTPConfig,
    NotificationSetting,
    ExcelTemplate,
)
from app.models.master_data import (  # noqa: F401
    LookupChemical,
    LookupInstrument,
    Site,
    ExperimentExcelTemplate,
)

# ── Inventory Master models ───────────────────────────────────────────────────
from app.models.inventory_materials import (  # noqa: F401
    InvMaterial,
    InvMaterialChemicalProps,
    InvMaterialFormulationProps,
)
from app.models.inventory_manufacturers import (  # noqa: F401
    InvManufacturer,
    InvManufacturerMapping,
)
from app.models.inventory_batches import (  # noqa: F401
    InvBatch,
    InvBatchEvent,
    InvBatchVerification,
)
from app.models.inventory_stock import (  # noqa: F401
    InvStockRequest,
    InvStockRequestEvent,
)
from app.models.inventory_equipment import (  # noqa: F401
    InvEquipmentType,
    InvInstrumentType,
    InvColumnType,
    InvEquipmentCatalogue,
    InvInstrumentCatalogue,
    InvColumnCatalogue,
    InvMaintenanceSchedule,
    InvCalibrationSchedule,
    InvEquipmentVerification,
    InvInstrumentVerification,
    InvAuditTrail,
)
