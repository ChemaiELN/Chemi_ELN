"""
Database session factory — canonical location.
The old app.database module re-exports from here for backward compatibility.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_pool_kwargs = (
    {}
    if _is_sqlite
    else {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}
)

engine = create_engine(settings.DATABASE_URL, **_pool_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
