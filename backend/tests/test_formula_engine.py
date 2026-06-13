"""
Unit tests for formula_engine.evaluate_formula.

These tests are pure unit tests — no database, no HTTP client.
They cover: arithmetic operations, missing variables, division by zero,
precision rounding, and injection-attempt safety.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.formula_engine import FormulaError, evaluate_formula


# ─────────────────────────────────────────────────────────────────────────────
# Basic arithmetic
# ─────────────────────────────────────────────────────────────────────────────

def test_addition():
    result = evaluate_formula("P1+P2", {"P1": Decimal("10"), "P2": Decimal("5")})
    assert result == Decimal("15")


def test_subtraction():
    result = evaluate_formula("P1-P2", {"P1": Decimal("10"), "P2": Decimal("3")})
    assert result == Decimal("7")


def test_multiplication():
    result = evaluate_formula("P1*P2", {"P1": Decimal("4"), "P2": Decimal("2.5")})
    assert result == Decimal("10")


def test_division():
    result = evaluate_formula("P1/P2", {"P1": Decimal("9"), "P2": Decimal("3")})
    assert result == Decimal("3")


def test_parentheses_respected():
    # (P1 + P2) * P3 != P1 + P2 * P3
    params = {"P1": Decimal("2"), "P2": Decimal("3"), "P3": Decimal("4")}
    assert evaluate_formula("(P1+P2)*P3", params) == Decimal("20")
    assert evaluate_formula("P1+P2*P3", params) == Decimal("14")


def test_percentage_calculation():
    result = evaluate_formula("(P1/P2)*100", {
        "P1": Decimal("45"),
        "P2": Decimal("50"),
    })
    assert result == Decimal("90")


# ─────────────────────────────────────────────────────────────────────────────
# Missing / None values
# ─────────────────────────────────────────────────────────────────────────────

def test_missing_variable_returns_none():
    """If any variable used by the formula has no value, return None."""
    result = evaluate_formula("P1+P2", {"P1": Decimal("5"), "P2": None})
    assert result is None


def test_all_none_returns_none():
    result = evaluate_formula("P1*P2", {"P1": None, "P2": None})
    assert result is None


def test_extra_unused_variable_none_short_circuits():
    """
    The engine short-circuits on ANY None in param_values, even for variables
    not referenced by the formula.  This is intentional — all inputs must be
    resolved before any formula is evaluated.
    """
    result = evaluate_formula("P1+P2", {"P1": Decimal("3"), "P2": Decimal("4"), "P3": None})
    assert result is None


def test_formula_ignores_extra_defined_variables():
    """Extra variables that ARE defined (non-None) don't affect the result."""
    result = evaluate_formula("P1+P2", {"P1": Decimal("3"), "P2": Decimal("4"), "P3": Decimal("999")})
    assert result == Decimal("7")


# ─────────────────────────────────────────────────────────────────────────────
# Error cases
# ─────────────────────────────────────────────────────────────────────────────

def test_division_by_zero_raises():
    with pytest.raises((FormulaError, ZeroDivisionError)):
        evaluate_formula("P1/P2", {"P1": Decimal("10"), "P2": Decimal("0")})


def test_unknown_variable_raises():
    """Referencing a parameter code not in param_values should raise FormulaError."""
    with pytest.raises(FormulaError):
        evaluate_formula("P1+P99", {"P1": Decimal("5")})


def test_empty_formula_returns_none():
    """Empty / whitespace-only formula returns None rather than raising."""
    assert evaluate_formula("", {"P1": Decimal("1")}) is None
    assert evaluate_formula("   ", {"P1": Decimal("1")}) is None


def test_floor_division_not_supported():
    """// (floor division) is not in the allowed operator set — must raise FormulaError."""
    with pytest.raises(FormulaError):
        evaluate_formula("P1//P2", {"P1": Decimal("7"), "P2": Decimal("2")})


# ─────────────────────────────────────────────────────────────────────────────
# Injection / security
# ─────────────────────────────────────────────────────────────────────────────

def test_python_builtins_injection_raises():
    """The engine must not execute arbitrary Python — e.g. __import__."""
    with pytest.raises((FormulaError, Exception)):
        evaluate_formula("__import__('os').system('echo pwned')", {})


def test_subscript_injection_raises():
    """Bracket access on variables must not be allowed."""
    with pytest.raises((FormulaError, Exception)):
        evaluate_formula("P1[0]", {"P1": Decimal("5")})


# ─────────────────────────────────────────────────────────────────────────────
# Precision
# ─────────────────────────────────────────────────────────────────────────────

def test_default_precision_six_places():
    result = evaluate_formula("P1/P2", {"P1": Decimal("1"), "P2": Decimal("3")})
    # Default precision=6: result should be rounded to 6 decimal places
    assert result is not None
    assert abs(result - Decimal("0.333333")) < Decimal("0.0000005")


def test_custom_precision():
    result = evaluate_formula(
        "P1/P2",
        {"P1": Decimal("1"), "P2": Decimal("3")},
        precision=2,
    )
    assert result is not None
    assert abs(result - Decimal("0.33")) < Decimal("0.005")
