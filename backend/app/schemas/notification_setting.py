from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationSettingCreate(BaseModel):
    key: str
    label: Optional[str] = None
    module: Optional[str] = None
    is_enabled: bool = True


class NotificationSettingUpdate(BaseModel):
    label: Optional[str] = None
    module: Optional[str] = None
    is_enabled: Optional[bool] = None


class NotificationSettingResponse(BaseModel):
    id: str
    key: str
    label: Optional[str] = None
    module: Optional[str] = None
    is_enabled: bool
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
