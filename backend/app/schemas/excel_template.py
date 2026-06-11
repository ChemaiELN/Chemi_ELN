from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, ConfigDict, field_validator


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

    @field_validator("file_size", mode="before")
    @classmethod
    def _format_file_size(cls, v: Union[int, str, None]) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            return v
        if v < 1024:
            return f"{v} B"
        if v < 1024 * 1024:
            return f"{v // 1024} KB"
        return f"{v // (1024 * 1024)} MB"


class ExcelTemplateUpdate(BaseModel):
    name: Optional[str] = None
    module: Optional[str] = None
    version: Optional[str] = None
