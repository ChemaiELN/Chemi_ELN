import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID as _PgUUID
from sqlalchemy.orm import DeclarativeBase

# Native PostgreSQL UUID column type; Python side stays as plain str.
PUUID = _PgUUID(as_uuid=False)


class Base(DeclarativeBase):
    pass


def new_uuid() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
