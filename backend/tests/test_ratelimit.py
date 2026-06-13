"""
Rate-limiting enforcement tests (M6).

Strategy: the shared conftest disables slowapi by setting RATELIMIT_ENABLED=0
before the app is imported. In each test here we temporarily flip
`app.state.limiter.enabled = True`, run the hammer, then restore the flag
in a fixture teardown — so this module cannot interfere with other tests.

Tests cover:
  - Login endpoint: 6th call within 1 minute returns 429
  - Forgot-password endpoint: 6th call within 1 minute returns 429
  - The 5 calls before the limit must all return the normal response code
"""
from __future__ import annotations

import pytest

from tests.conftest import make_crd_settings, make_role, make_user

_PASS = "RateLimit@1"


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def crd(db):
    return make_crd_settings(db)


@pytest.fixture
def chemist_role(db):
    return make_role(db, "CHEMIST")


@pytest.fixture
def active_user(db, chemist_role):
    return make_user(db, chemist_role.id, username="rl_user", password=_PASS)


@pytest.fixture(autouse=False)
def rate_limit_enabled(client):
    """Enable the per-router limiter for the duration of the test, then restore.

    The auth router owns its own Limiter instance (to avoid a circular import
    with app.main).  We must enable THAT limiter, not the main.py one.
    """
    from app.modules.auth.router import limiter as auth_limiter
    # Clear any counters left by previous tests
    try:
        auth_limiter._storage.reset()
    except Exception:
        pass
    auth_limiter.enabled = True
    yield
    auth_limiter.enabled = False
    try:
        auth_limiter._storage.reset()
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _post(client, url: str, body: dict) -> int:
    return client.post(url, json=body).status_code


# ─────────────────────────────────────────────────────────────────────────────
# Login rate limit
# ─────────────────────────────────────────────────────────────────────────────

def test_login_allows_5_attempts(client, active_user, crd, rate_limit_enabled):
    """The first 5 login attempts (wrong password) must not be rate-limited."""
    statuses = [
        _post(client, "/api/auth/login",
              {"username": "rl_user", "password": "WrongPass@1"})
        for _ in range(5)
    ]
    # All 5 must be auth errors (401), not rate-limit errors (429)
    for s in statuses:
        assert s == 401, f"Expected 401 but got {s} — rate limit triggered too early"


def test_login_blocked_on_6th_attempt(client, active_user, crd, rate_limit_enabled):
    """The 6th login attempt within 1 minute must return 429."""
    for _ in range(5):
        _post(client, "/api/auth/login", {"username": "rl_user", "password": "WrongPass@1"})

    resp_code = _post(client, "/api/auth/login",
                      {"username": "rl_user", "password": "WrongPass@1"})
    assert resp_code == 429, f"Expected 429 on 6th attempt, got {resp_code}"


def test_login_successful_before_limit(client, active_user, crd, rate_limit_enabled):
    """A correct login within the first 5 attempts must succeed (200)."""
    # 4 failed attempts first
    for _ in range(4):
        _post(client, "/api/auth/login", {"username": "rl_user", "password": "WrongPass@1"})

    # 5th attempt with correct credentials must succeed
    status = _post(client, "/api/auth/login",
                   {"username": "rl_user", "password": _PASS})
    assert status == 200, f"Expected 200 but got {status}"


# ─────────────────────────────────────────────────────────────────────────────
# Forgot-password rate limit
# ─────────────────────────────────────────────────────────────────────────────

def test_forgot_password_allows_5_attempts(client, active_user, crd, rate_limit_enabled):
    """The first 5 forgot-password calls must not be rate-limited (204 each)."""
    statuses = [
        _post(client, "/api/auth/forgot-password", {"email": "nobody@example.com"})
        for _ in range(5)
    ]
    for s in statuses:
        assert s == 204, f"Expected 204 but got {s}"


def test_forgot_password_blocked_on_6th_attempt(client, active_user, crd, rate_limit_enabled):
    """The 6th forgot-password call within 1 minute must return 429."""
    for _ in range(5):
        _post(client, "/api/auth/forgot-password", {"email": "nobody@example.com"})

    resp_code = _post(client, "/api/auth/forgot-password",
                      {"email": "nobody@example.com"})
    assert resp_code == 429, f"Expected 429 on 6th attempt, got {resp_code}"


# ─────────────────────────────────────────────────────────────────────────────
# Rate limit does NOT affect unrelated endpoints
# ─────────────────────────────────────────────────────────────────────────────

def test_health_endpoint_not_rate_limited(client, crd, rate_limit_enabled):
    """The health endpoint has no rate limit — 10 rapid calls must all succeed."""
    statuses = [client.get("/api/health").status_code for _ in range(10)]
    assert all(s == 200 for s in statuses), f"Unexpected statuses: {statuses}"
