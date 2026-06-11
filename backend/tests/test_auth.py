"""
Integration tests for the authentication endpoints.

Covers:
  - POST /api/auth/login  — success, wrong password, unknown user, inactive user
  - POST /api/auth/refresh — valid rotation, revoked token, bad token
  - POST /api/auth/logout  — marks token revoked
  - POST /api/auth/change-password — success + revokes all refresh tokens
  - GET  /api/auth/me      — returns correct profile
"""
from __future__ import annotations

import pytest

from tests.conftest import make_role, make_user

_PASS = "Auth@Test1"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def active_user(db, role):
    return make_user(db, role.id, username="auth_user", password=_PASS)


@pytest.fixture
def inactive_user(db, role):
    return make_user(db, role.id, username="auth_inactive", password=_PASS, is_active=False)


def _login(client, username: str, password: str):
    return client.post("/api/auth/login", json={"username": username, "password": password})


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

def test_login_success(client, active_user):
    resp = _login(client, "auth_user", _PASS)
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body.get("token_type") == "bearer"


def test_login_wrong_password(client, active_user):
    resp = _login(client, "auth_user", "WrongPass!")
    assert resp.status_code == 401


def test_login_unknown_user(client):
    resp = _login(client, "nobody_here", _PASS)
    assert resp.status_code == 401


def test_login_inactive_user(client, inactive_user):
    resp = _login(client, "auth_inactive", _PASS)
    # Inactive accounts must not receive tokens
    assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# /me
# ─────────────────────────────────────────────────────────────────────────────

def test_me_returns_profile(client, active_user):
    tokens = _login(client, "auth_user", _PASS).json()
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "auth_user"
    assert body["email"] == "auth_user@test.example.com"


def test_me_requires_auth(client, active_user):
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


def test_me_invalid_token(client, active_user):
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# Token refresh
# ─────────────────────────────────────────────────────────────────────────────

def test_refresh_returns_new_tokens(client, active_user):
    first = _login(client, "auth_user", _PASS).json()
    resp = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert resp.status_code == 200
    second = resp.json()
    assert "access_token" in second
    assert "refresh_token" in second
    # New refresh token must differ from the old one (rotation)
    assert second["refresh_token"] != first["refresh_token"]


def test_refresh_old_token_revoked_after_rotation(client, active_user):
    """After rotation, the original refresh token must be invalidated."""
    first = _login(client, "auth_user", _PASS).json()
    client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    # Replay the original token — must be rejected
    replay = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code in (401, 403)


def test_refresh_invalid_token(client, active_user):
    resp = client.post("/api/auth/refresh", json={"refresh_token": "bad.token.value"})
    assert resp.status_code in (401, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────

def test_logout_revokes_token(client, active_user):
    tokens = _login(client, "auth_user", _PASS).json()
    resp = client.post("/api/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code in (200, 204)
    # Revoked token must no longer be usable for refresh
    retry = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert retry.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# Change password
# ─────────────────────────────────────────────────────────────────────────────

def test_change_password_success(client, active_user):
    tokens = _login(client, "auth_user", _PASS).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": _PASS, "new_password": "NewPass@2024"},
        headers=headers,
    )
    assert resp.status_code in (200, 204)


def test_change_password_wrong_current(client, active_user):
    tokens = _login(client, "auth_user", _PASS).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "WrongOld!", "new_password": "NewPass@2024"},
        headers=headers,
    )
    assert resp.status_code in (400, 401, 403)


def test_change_password_revokes_refresh_tokens(client, active_user):
    """After a password change, previously issued refresh tokens must be invalid."""
    tokens = _login(client, "auth_user", _PASS).json()
    old_refresh = tokens["refresh_token"]
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    change_resp = client.post(
        "/api/auth/change-password",
        json={"current_password": _PASS, "new_password": "AfterChange@1"},
        headers=headers,
    )
    assert change_resp.status_code in (200, 204)

    # The old refresh token must now be rejected
    retry = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert retry.status_code in (401, 403)
