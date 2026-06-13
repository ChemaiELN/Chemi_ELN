from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class WorkflowTemplateCreate(BaseModel):
    name:        str
    slug:        str   = Field(description="URL-safe unique identifier e.g. adc-preliminary")
    description: Optional[str] = None
    category:    Optional[str] = None
    definition:  Dict[str, Any] = Field(default={}, description="Full template JSON definition")


class WorkflowTemplateUpdate(BaseModel):
    name:        Optional[str]           = None
    description: Optional[str]           = None
    category:    Optional[str]           = None
    is_active:   Optional[bool]          = None
    definition:  Optional[Dict[str, Any]] = None


class WorkflowTemplateResponse(BaseModel):
    id:          str
    name:        str
    slug:        str
    description: Optional[str]
    category:    Optional[str]
    version:     int
    is_active:   bool
    definition:  Optional[Dict[str, Any]]
    created_at:  datetime
    updated_at:  datetime
    model_config = ConfigDict(from_attributes=True)


class WorkflowTemplateSummary(BaseModel):
    """Lightweight — for dropdowns when creating a notebook."""
    id:       str
    name:     str
    slug:     str
    category: Optional[str]
    version:  int
    model_config = ConfigDict(from_attributes=True)
