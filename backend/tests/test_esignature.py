"""
Unit / integration tests for verify_esignature().

These tests call the service function directly (not through HTTP) so they are
fast and precise.  A lightweight SQLite session from conftest is used only to
satisfy the function's `db: Session` parameter — no DB writes occur.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services.esignature import ESignatureRequired, verify_esignature
from tests.conftest import make_role, make_user


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

_PASSWORD = "Correct@99"


@pytest.fixture
def user(db):
    role = make_role(db, "CHEMIST")
    return make_user(db, role.id, username="esig_user", password=_PASSWORD)


# ─────────────────────────────────────────────────────────────────────────────
# require=True  (CRD flag ON — default)
# ─────────────────────────────────────────────────────────────────────────────

def test_correct_password_passes(db, user):
    """Correct password with require=True must not raise."""
    verify_esignature(db, user, _PASSWORD, require=True, action="test")


def test_wrong_password_raises_403(db, user):
    """Wrong password must raise HTTP 403."""
    with pytest.raises(HTTPException) as exc_info:
        verify_esignature(db, user, "WrongPass1!", require=True, action="test")
    assert exc_info.value.status_code == 403


def test_missing_password_raises_when_required(db, user):
    """password=None with require=True must raise ESignatureRequired or HTTP 4xx."""
    with pytest.raises((ESignatureRequired, HTTPException)) as exc_info:
        verify_esignature(db, user, None, require=True, action="test")
    # Either a dedicated exception or an HTTP error — both are acceptable
    if isinstance(exc_info.value, HTTPException):
        assert exc_info.value.status_code in (400, 403, 422)


def test_empty_string_password_raises(db, user):
    """Empty string should be treated the same as missing."""
    with pytest.raises((ESignatureRequired, HTTPException)):
        verify_esignature(db, user, "", require=True, action="test")


# ─────────────────────────────────────────────────────────────────────────────
# require=False  (CRD flag OFF — bypass)
# ─────────────────────────────────────────────────────────────────────────────

def test_no_password_passes_when_not_required(db, user):
    """When require=False, verification should be skipped entirely."""
    verify_esignature(db, user, None, require=False, action="test")


def test_wrong_password_passes_when_not_required(db, user):
    """When require=False, the password value is irrelevant — no check runs."""
    verify_esignature(db, user, "completely_wrong", require=False, action="test")


# ─────────────────────────────────────────────────────────────────────────────
# Note: verify_esignature() does NOT check user.is_active — that gate lives
# in get_current_user() (HTTP layer) before the route handler is ever reached.
# The e-signature service only verifies the password hash.
# ─────────────────────────────────────────────────────────────────────────────

def test_inactive_user_correct_password_passes_service_layer(db):
    """
    verify_esignature itself has no is_active check — if the password is
    correct the hash comparison succeeds.  Active-status enforcement is the
    responsibility of the authentication middleware, not this service.
    """
    role = make_role(db, "CHEMIST_INACT")
    inactive = make_user(db, role.id, username="inactive_esig", password=_PASSWORD, is_active=False)
    # Should NOT raise — the service only checks the password hash
    verify_esignature(db, inactive, _PASSWORD, require=True, action="test")
