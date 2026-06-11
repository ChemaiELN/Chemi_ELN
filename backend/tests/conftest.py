"""
Pytest fixtures shared across all test modules.

Database strategy
-----------------
We create a single SQLite in-memory database (StaticPool) that is shared for
the whole test session.  Each individual test wraps its DB operations in a
SAVEPOINT that is rolled back on teardown, so tests never bleed state into
each other.

The app's own `database.py` creates an engine at import time from
`settings.DATABASE_URL`.  Because we override the `get_db` FastAPI dependency
in every TestClient fixture, that engine is never used for actual queries
during tests — we always route through our own `_engine`.

SQLite + PUUID
--------------
`PUUID = postgresql.UUID(as_uuid=False)` falls back to VARCHAR for non-
PostgreSQL dialects, so `Base.metadata.create_all` on SQLite produces plain
TEXT/VARCHAR columns.  Python values are already strings (`as_uuid=False`),
so no conversion is needed.
"""
from __future__ import annotations

import os

# Set env vars BEFORE any app module is imported so pydantic-settings and
# database.py pick them up at their module-level initialisation.
os.environ.setdefault("APP_ENV",          "test")
os.environ.setdefault("SECRET_KEY",       "test-secret-key-exactly-32-bytes!!")
os.environ.setdefault("DATABASE_URL",     "sqlite:///:memory:")
# slowapi reads RATELIMIT_ENABLED at Limiter.__init__ time via starlette Config.
# Setting it before app.main is imported ensures the limiter starts disabled.
os.environ.setdefault("RATELIMIT_ENABLED", "0")

# ── bcrypt / passlib compatibility (must happen before any passlib use) ──────
# passlib 1.7.4 probes for the historic 72-byte wrap bug with a 73-byte test
# password.  bcrypt 4.x+ raises ValueError for passwords > 72 bytes, causing
# passlib's backend initialisation to crash.
# Fix: patch bcrypt.hashpw to silently truncate at 72 bytes (the old bcrypt 3.x
# behaviour).  This lets passlib initialise successfully; our test passwords
# are all well under 72 bytes so real hashing/verification is unaffected.
import bcrypt as _bcrypt_lib

_orig_bcrypt_hashpw = _bcrypt_lib.hashpw


def _compat_hashpw(password: bytes, salt: bytes) -> bytes:
    return _orig_bcrypt_hashpw(password[:72] if len(password) > 72 else password, salt)


_bcrypt_lib.hashpw = _compat_hashpw  # type: ignore[assignment]

from datetime import datetime, timezone  # noqa: E402
from decimal import Decimal              # noqa: E402
from typing import Generator             # noqa: E402

import pytest                                                    # noqa: E402
from passlib.context import CryptContext                        # noqa: E402
from sqlalchemy import create_engine                            # noqa: E402
from sqlalchemy.orm import sessionmaker, Session                # noqa: E402
from sqlalchemy.pool import StaticPool                          # noqa: E402
from fastapi.testclient import TestClient                       # noqa: E402

# Import all models so their tables are registered with Base.metadata
import app.models  # noqa: F401  (triggers __init__.py side-effects)

from app.main import app, limiter as _app_limiter  # noqa: E402
from app.database import get_db                    # noqa: E402

# Disable rate limiting for the entire test session — it's a production
# safeguard that would otherwise block rapid-fire test requests from the
# single "testclient" IP.
_app_limiter.enabled = False
from app.models.base import Base, new_uuid       # noqa: E402
from app.models.user import Role, User           # noqa: E402
from app.models.department import Department     # noqa: E402
from app.models.project import Project           # noqa: E402
from app.models.notebook import Notebook, NotebookPermission  # noqa: E402
from app.models.experiment import Experiment     # noqa: E402
from app.models.settings import CRDSettings      # noqa: E402

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─────────────────────────────────────────────────────────────────────────────
# Shared SQLite engine (one in-memory DB for the whole test run)
# ─────────────────────────────────────────────────────────────────────────────
_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="session", autouse=True)
def _create_tables() -> Generator:
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


# ─────────────────────────────────────────────────────────────────────────────
# Per-test transactional rollback
# ─────────────────────────────────────────────────────────────────────────────
@pytest.fixture
def db(_create_tables) -> Generator[Session, None, None]:
    """Yields a SQLAlchemy session inside a transaction that is rolled back."""
    conn = _engine.connect()
    txn = conn.begin()
    session = _TestSession(bind=conn)
    try:
        yield session
    finally:
        session.close()
        txn.rollback()
        conn.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    """TestClient with get_db wired to the test session."""
    def _override() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = _override

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# Seed helpers
# ─────────────────────────────────────────────────────────────────────────────
def make_role(db: Session, code: str, name: str | None = None) -> Role:
    r = Role(id=new_uuid(), code=code, name=name or code.title())
    db.add(r)
    db.flush()
    return r


def make_user(
    db: Session,
    role_id: str,
    *,
    username: str = "testuser",
    password: str = "Test@1234",
    is_active: bool = True,
) -> User:
    u = User(
        id=new_uuid(),
        username=username,
        emp_no=f"EMP-{username[:8].upper()}",
        first_name="Test",
        last_name="User",
        display_name="Test User",
        email=f"{username}@test.example.com",
        password_hash=_pwd.hash(password),
        role_id=role_id,
        is_active=is_active,
    )
    db.add(u)
    db.flush()
    return u


def make_crd_settings(
    db: Session,
    *,
    reauth_submit: bool = False,
    reauth_verification: bool = False,
    reauth_approval: bool = False,
    reauth_void: bool = False,
) -> CRDSettings:
    existing = db.get(CRDSettings, 1)
    if existing:
        existing.reauth_submit = reauth_submit
        existing.reauth_verification = reauth_verification
        existing.reauth_approval = reauth_approval
        existing.reauth_void = reauth_void
        db.flush()
        return existing
    crd = CRDSettings(
        id=1,
        reauth_submit=reauth_submit,
        reauth_verification=reauth_verification,
        reauth_approval=reauth_approval,
        reauth_void=reauth_void,
    )
    db.add(crd)
    db.flush()
    return crd


def make_department(db: Session, code: str = "RD") -> Department:
    dept = Department(id=new_uuid(), code=code, name=f"Dept {code}", is_active=True)
    db.add(dept)
    db.flush()
    return dept


def make_project(db: Session, created_by_id: str, code: str = "OQ") -> Project:
    proj = Project(
        id=new_uuid(),
        code=code,
        name="Test Project",
        created_by=created_by_id,
        status="ACTIVE",
    )
    db.add(proj)
    db.flush()
    return proj


def make_notebook(
    db: Session,
    project_id: str,
    created_by_id: str,
    code: str = "NB001",
) -> Notebook:
    nb = Notebook(
        id=new_uuid(),
        code=code,
        title="Test Notebook",
        project_id=project_id,
        created_by=created_by_id,
        status="ACTIVE",
    )
    db.add(nb)
    db.flush()
    return nb


def make_permission(
    db: Session,
    notebook_id: str,
    user_id: str,
    *,
    can_edit: bool = True,
    can_submit: bool = True,
    can_verify: bool = False,
    can_approve: bool = False,
    can_comment: bool = False,
) -> NotebookPermission:
    perm = NotebookPermission(
        id=new_uuid(),
        notebook_id=notebook_id,
        user_id=user_id,
        can_view=True,
        can_edit=can_edit,
        can_submit=can_submit,
        can_verify=can_verify,
        can_approve=can_approve,
        can_comment=can_comment,
    )
    db.add(perm)
    db.flush()
    return perm


def make_experiment(
    db: Session,
    notebook_id: str,
    project_id: str,
    created_by_id: str,
    *,
    status: str = "DRAFT",
    code: str = "OQ/E001",
) -> Experiment:
    full_code = f"{code}/001"
    exp = Experiment(
        id=new_uuid(),
        code=code,
        version=1,
        full_code=full_code,
        title="Test Experiment",
        notebook_id=notebook_id,
        project_id=project_id,
        created_by=created_by_id,
        status=status,
        is_latest_version=True,
    )
    db.add(exp)
    db.flush()
    return exp


def get_auth_headers(client: TestClient, username: str, password: str) -> dict:
    """Login and return Authorization headers for the given user."""
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
