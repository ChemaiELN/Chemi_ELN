"""
Inventory — General Lookup Pydantic schemas
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


LOOKUP_TYPES: List[str] = [
    "API Subtype",
    "Batch Characterstics Key",
    "Batch Status",
    "Batch Type",
    "Calibration Category",
    "Chamber User",
    "Column Auto Gen",
    "Column Category",
    "Column Type",
    "Criticality Level",
    "Document Type",
    "Equipment Types",
    "Equipment Usage Types",
    "ExperimentResults",
    "FPP Subtype",
    "HPLC LOV",
    "Input Type",
    "Instrument UOM",
    "Instrument Usage Types",
    "Inventory UOM",
    "LoginIssuesUserRequest",
    "Maintainance Frequency",
    "Maintenance Category",
    "Material Type",
    "Pack Type",
    "Packaging Type",
    "Packaging Unit",
    "Packaging Unit Semi Solid",
    "PackagingMaterial",
    "PreconfiguredPreacutions",
    "Priority",
    "Project Types",
    "Reference Type",
    "Report Type",
    "ResultOutputParameters",
    "ROA",
    "SampleMethods",
    "Specification Type",
    "Stability Test",
    "Stability UOM",
    "STP Type",
    "Template Type",
    "Therapeutic Function",
    "Therapeutic Function Liquids",
    "Unit Of Currency",
    "Unit Of Measurement",
    "UnitOfInput",
    "UnitOfResultParameter",
    "Vendor Code",
]


class GeneralLookupCreate(BaseModel):
    lookup_type:  str
    lookup_value: str
    lookup_code:  str
    description:  Optional[str] = None
    is_active:    bool = True


class GeneralLookupUpdate(BaseModel):
    lookup_type:  Optional[str] = None
    lookup_value: Optional[str] = None
    lookup_code:  Optional[str] = None
    description:  Optional[str] = None


class GeneralLookupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    lookup_type:  str
    lookup_value: str
    lookup_code:  str
    description:  Optional[str] = None
    is_active:    bool
    created_by:   Optional[str] = None
    created_at:   Optional[datetime] = None
    updated_at:   Optional[datetime] = None
