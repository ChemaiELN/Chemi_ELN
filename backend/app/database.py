# Backward-compatibility shim — canonical source moved to app.db.session
from app.db.session import engine, SessionLocal, get_db  # noqa: F401
