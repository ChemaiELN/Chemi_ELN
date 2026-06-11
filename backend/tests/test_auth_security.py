"""
Tests for authentication security controls.

Covers:
  M7  — User deactivation blocks login and API access
  M8  — Password-reset token expiry enforced
  L4  — Refresh token revoked after password change / reset
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import (
    make_crd_settings,
    make_role,
    make_user,
)

_PASS = "Security@1"
_NEW  = "NewPass@99"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _login(client, username: str, password: str = _PASS) -> dict:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()


def _auth(client, username: str, password: str = _PASS) -> dict:
    tokens = _login(client, username, password)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def qa_role(db):
    return make_role(db, "QA")


@pytest.fixture
def active_user(db, chemist_role):
    return make_user(db, chemist_role.id, username="sec_chemist", password=_PASS)


@pytest.fixture
def qa_user(db, qa_role):
    return make_user(db, qa_role.id, username="sec_qa", password=_PASS)


@pytest.fixture
def crd(db):
    return make_crd_settings(db)


# ─────────────────────────────────────────────────────────────────────────────
# M7 — User deactivation
# ─────────────────────────────────────────────────────────────────────────────

def test_active_user_can_login(client, active_user, crd):
    resp = client.post("/api/auth/login",
                       json={"username": "sec_chemist", "password": _PASS})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_deactivated_user_cannot_login(client, active_user, qa_user, crd):
    qa_h = _auth(client, "sec_qa")
    client.post(f"/api/users/{active_user.id}/deactivate", headers=qa_h)

    resp = client.post("/api/auth/login",
                       json={"username": "sec_chemist", "password": _PASS})
    assert resp.status_code == 403
    assert "inactive" in resp.json()["detail"].lower()


def test_deactivated_user_access_token_rejected(client, active_user, qa_user, crd):
    """Existing access token must stop working once account is deactivated."""
    tokens = _login(client, "sec_chemist")
    h = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Deactivate via QA
    qa_h = _auth(client, "sec_qa")
    client.post(f"/api/users/{active_user.id}/deactivate", headers=qa_h)

    # Existing token should now be refused
    resp = client.get("/api/auth/me", headers=h)
    assert resp.status_code in (401, 403)


def test_reactivated_user_can_login_again(client, active_user, qa_user, crd):
    qa_h = _auth(client, "sec_qa")
    client.post(f"/api/users/{active_user.id}/deactivate", headers=qa_h)
    client.post(f"/api/users/{active_user.id}/activate",   headers=qa_h)

    resp = client.post("/api/auth/login",
                       json={"username": "sec_chemist", "password": _PASS})
    assert resp.status_code == 200


def test_qa_cannot_deactivate_own_account(client, qa_user, crd):
    qa_h = _auth(client, "sec_qa")
    resp = client.post(f"/api/users/{qa_user.id}/deactivate", headers=qa_h)
    assert resp.status_code in (400, 403)


def test_chemist_cannot_deactivate_user(client, active_user, crd):
    c_h = _auth(client, "sec_chemist")
    resp = client.post(f"/api/users/{active_user.id}/deactivate", headers=c_h)
    assert resp.status_code == 403


def test_cannot_activate_already_active_user(client, active_user, qa_user, crd):
    qa_h = _auth(client, "sec_qa")
    resp = client.post(f"/api/users/{active_user.id}/activate", headers=qa_h)
    assert resp.status_code == 400


def test_cannot_deactivate_already_inactive_user(client, active_user, qa_user, crd):
    qa_h = _auth(client, "sec_qa")
    client.post(f"/api/users/{active_user.id}/deactivate", headers=qa_h)
    resp = client.post(f"/api/users/{active_user.id}/deactivate", headers=qa_h)
    assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# M8 — Password reset token expiry
# ─────────────────────────────────────────────────────────────────────────────

def test_valid_reset_token_changes_password(client, active_user, db, crd):
    """Simulate the happy-path: generate token, use it before expiry."""
    from app.models.user import PasswordResetToken
    from app.models.base import new_uuid

    raw = secrets.token_urlsafe(32)
    stored = PasswordResetToken(
        id=new_uuid(),
        user_id=active_user.id,
        token_hash=_hash(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    db.add(stored)
    db.flush()

    resp = client.post("/api/auth/reset-password",
                       json={"token": raw, "new_password": _NEW})
    assert resp.status_code == 204

    # Old password must no longer work
    resp2 = client.post("/api/auth/login",
                        json={"username": "sec_chemist", "password": _PASS})
    assert resp2.status_code == 401

    # New password must work
    resp3 = client.post("/api/auth/login",
                        json={"username": "sec_chemist", "password": _NEW})
    assert resp3.status_code == 200


def test_expired_reset_token_rejected(client, active_user, db, crd):
    """A token with expires_at in the past must return 400."""
    from app.models.user import PasswordResetToken
    from app.models.base import new_uuid

    raw = secrets.token_urlsafe(32)
    stored = PasswordResetToken(
        id=new_uuid(),
        user_id=active_user.id,
        token_hash=_hash(raw),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    db.add(stored)
    db.flush()

    resp = client.post("/api/auth/reset-password",
                       json={"token": raw, "new_password": _NEW})
    assert resp.status_code == 400


def test_used_reset_token_cannot_be_reused(client, active_user, db, crd):
    """Token must be single-use: second call returns 400."""
    from app.models.user import PasswordResetToken
    from app.models.base import new_uuid

    raw = secrets.token_urlsafe(32)
    stored = PasswordResetToken(
        id=new_uuid(),
        user_id=active_user.id,
        token_hash=_hash(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    db.add(stored)
    db.flush()

    client.post("/api/auth/reset-password",
                json={"token": raw, "new_password": _NEW})

    resp2 = client.post("/api/auth/reset-password",
                        json={"token": raw, "new_password": "AnotherPass@1"})
    assert resp2.status_code == 400


def test_bogus_reset_token_rejected(client, active_user, crd):
    resp = client.post("/api/auth/reset-password",
                       json={"token": "not-a-real-token", "new_password": _NEW})
    assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# L4 — Refresh token revoked after password change
# ─────────────────────────────────────────────────────────────────────────────

def test_refresh_token_revoked_after_change_password(client, active_user, crd):
    tokens = _login(client, "sec_chemist")
    old_refresh = tokens["refresh_token"]
    old_access  = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Change password
    client.post("/api/auth/change-password",
                json={"current_password": _PASS, "new_password": _NEW},
                headers=old_access)

    # Old refresh token must be rejected
    resp = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401


def test_refresh_token_revoked_after_reset_password(client, active_user, db, crd):
    from app.models.user import PasswordResetToken
    from app.models.base import new_uuid

    tokens = _login(client, "sec_chemist")
    old_refresh = tokens["refresh_token"]

    raw = secrets.token_urlsafe(32)
    stored = PasswordResetToken(
        id=new_uuid(),
        user_id=active_user.id,
        token_hash=_hash(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    db.add(stored)
    db.flush()

    client.post("/api/auth/reset-password",
                json={"token": raw, "new_password": _NEW})

    # Old refresh token must be revoked
    resp = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401


def test_new_token_works_after_password_change(client, active_user, crd):
    old_access = _auth(client, "sec_chemist")

    client.post("/api/auth/change-password",
                json={"current_password": _PASS, "new_password": _NEW},
                headers=old_access)

    # Login with new password to get fresh tokens
    new_tokens = _login(client, "sec_chemist", password=_NEW)
    new_access = {"Authorization": f"Bearer {new_tokens['access_token']}"}

    resp = client.get("/api/auth/me", headers=new_access)
    assert resp.status_code == 200
    assert resp.json()["username"] == "sec_chemist"


def test_wrong_current_password_rejected_on_change(client, active_user, crd):
    h = _auth(client, "sec_chemist")
    resp = client.post("/api/auth/change-password",
                       json={"current_password": "WrongPass@1", "new_password": _NEW},
                       headers=h)
    assert resp.status_code == 400


def test_logout_revokes_refresh_token(client, active_user, crd):
    tokens = _login(client, "sec_chemist")
    old_refresh = tokens["refresh_token"]

    client.post("/api/auth/logout", json={"refresh_token": old_refresh})

    resp = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401
