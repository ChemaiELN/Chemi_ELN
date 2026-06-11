"""
Formula Engine (FIX-03)

Evaluates formula expressions for OUTPUT experiment parameters.

Supported operations: +, -, *, /, (, )
Formula references: P1, P2, P3 (parameter codes)

Example: P3 = P1 + P2 → if P1=25 and P2=40 then P3=65
"""
import ast
import operator
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional

# Allowed AST node types for safe evaluation
# NOTE: Python 3.12+ uses ast.Mult / ast.Div; earlier versions use ast.Mul.
# We resolve both names dynamically to stay compatible with Python 3.8–3.13.
_Mult = getattr(ast, 'Mult', None) or getattr(ast, 'Mul')  # 3.12+: Mult; <3.12: Mult too
_Div  = getattr(ast, 'Div',  None)  # ast.Div is consistent across versions
_Pow  = getattr(ast, 'Pow',  None)

_ALLOWED_NODES = {
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name,
    ast.Add, ast.Sub, _Mult, _Div, _Pow, ast.USub, ast.UAdd,
}

_OPS = {
    ast.Add:  operator.add,
    ast.Sub:  operator.sub,
    _Mult:    operator.mul,
    _Div:     operator.truediv,
    _Pow:     operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


class FormulaError(ValueError):
    """Raised when a formula cannot be evaluated."""
    pass


def _safe_eval(node: ast.AST, variables: Dict[str, float]) -> float:
    """Recursively evaluate an AST node using only safe numeric operations."""
    if type(node) not in _ALLOWED_NODES:
        raise FormulaError(f"Unsupported operation in formula: {type(node).__name__}")

    if isinstance(node, ast.Expression):
        return _safe_eval(node.body, variables)
    elif isinstance(node, ast.Constant):
        if not isinstance(node.value, (int, float)):
            raise FormulaError(f"Non-numeric constant: {node.value!r}")
        return float(node.value)
    elif isinstance(node, ast.Name):
        name = node.id.upper()
        if name not in variables:
            raise FormulaError(f"Unknown parameter: {name!r}")
        return variables[name]
    elif isinstance(node, ast.BinOp):
        if type(node.op) not in _OPS:
            raise FormulaError(f"Unsupported operator: {type(node.op).__name__}")
        left = _safe_eval(node.left, variables)
        right = _safe_eval(node.right, variables)
        if isinstance(node.op, _Div) and right == 0:
            raise FormulaError("Division by zero in formula")
        return _OPS[type(node.op)](left, right)
    elif isinstance(node, ast.UnaryOp):
        if type(node.op) not in _OPS:
            raise FormulaError(f"Unsupported unary operator: {type(node.op).__name__}")
        return _OPS[type(node.op)](_safe_eval(node.operand, variables))
    else:
        raise FormulaError(f"Cannot evaluate node type: {type(node).__name__}")


def evaluate_formula(
    formula: str,
    param_values: Dict[str, Optional[Decimal]],
    precision: int = 6,
) -> Optional[Decimal]:
    """
    Evaluate a formula string against a dict of parameter code → value.

    Args:
        formula:      Expression string, e.g. "P1+P2" or "(P1*P2)/100"
        param_values: Dict mapping parameter CODE (e.g. "P1") → Decimal value
        precision:    Number of decimal places to round to

    Returns:
        Evaluated Decimal value, or None if any referenced parameter has no value.

    Raises:
        FormulaError: If the formula is invalid or references unknown parameters.
    """
    if not formula or not formula.strip():
        return None

    # Normalise: upper-case all identifiers, strip spaces
    formula_clean = formula.strip().upper()

    # Build variable lookup — skip evaluation if any input param is None
    variables: Dict[str, float] = {}
    for code, val in param_values.items():
        if val is None:
            # Some required inputs are missing — cannot evaluate yet
            return None
        variables[code.upper()] = float(val)

    try:
        tree = ast.parse(formula_clean, mode='eval')
        result = _safe_eval(tree, variables)
    except FormulaError:
        raise
    except SyntaxError as exc:
        raise FormulaError(f"Invalid formula syntax: {exc}") from exc
    except Exception as exc:
        raise FormulaError(f"Formula evaluation error: {exc}") from exc

    # Round to requested precision
    quantize_str = Decimal(10) ** -precision
    return Decimal(str(result)).quantize(quantize_str, rounding=ROUND_HALF_UP)


def recalculate_experiment_parameters(parameters: list) -> list:
    """
    Given a list of ExperimentParameter ORM objects (or dicts),
    evaluate all OUTPUT/FORMULA parameters in dependency order.

    Returns the same list with `parameter_value` updated on OUTPUT rows.
    """
    # Build code → value map from INPUT rows
    code_to_value: Dict[str, Optional[Decimal]] = {}
    for p in parameters:
        code = (p.code if hasattr(p, 'code') else p.get('code')) or ""
        iof  = (p.input_output if hasattr(p, 'input_output') else p.get('input_output', "INPUT"))
        val  = (p.parameter_value if hasattr(p, 'parameter_value') else p.get('parameter_value'))
        if code and iof == "INPUT":
            code_to_value[code.upper()] = val

    # Resolve OUTPUT parameters; multi-pass for chained formulas
    changed = True
    iterations = 0
    while changed and iterations < 10:
        changed = False
        iterations += 1
        for p in parameters:
            code    = (p.code if hasattr(p, 'code') else p.get('code')) or ""
            iof     = (p.input_output if hasattr(p, 'input_output') else p.get('input_output', "INPUT"))
            formula = (p.formula_expression if hasattr(p, 'formula_expression') else p.get('formula_expression'))
            if iof == "OUTPUT" and formula and code:
                try:
                    new_val = evaluate_formula(formula, code_to_value)
                    old_val = (p.parameter_value if hasattr(p, 'parameter_value') else p.get('parameter_value'))
                    if new_val != old_val:
                        if hasattr(p, 'parameter_value'):
                            p.parameter_value = new_val
                        else:
                            p['parameter_value'] = new_val
                        code_to_value[code.upper()] = new_val
                        changed = True
                except FormulaError:
                    pass  # leave existing value intact

    return parameters
