from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, PUUID, new_uuid, now_utc


class SequenceCounter(Base):
    """
    Auto-increments experiment and ATR codes.

    Examples:
      scope_key = "OQ-R1-S1",  prefix = "E"   → issues E03166, E03167 ...
      scope_key = "ATR",        prefix = "ATR" → issues ATR00001, ATR00002 ...
    """
    __tablename__ = "sequence_counters"

    id:         Mapped[str] = mapped_column(PUUID, primary_key=True, default=new_uuid)
    scope_key:  Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    prefix:     Mapped[str] = mapped_column(String(20), nullable=False)
    last_value: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
