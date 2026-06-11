from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ExcelTemplateResponse(BaseModel):
    id: str
    name: str
    module: str
    version: Optional[str] = None
    file_size: Optional[str] = None
    uploaded_by: str
    uploaded_at: datetime
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class ExcelTemplateUpdate(BaseModel):
    name: Optional[str] = None
    module: Optional[str] = None
    version: Optional[str] = None
