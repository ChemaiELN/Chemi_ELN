"""
Rich-text utilities for Chemia ELN.

Two tools:
  1. BeautifulSoup  — parse / strip / sanitise HTML produced by react-quill
  2. difflib        — word-level and line-level diffs between two HTML fields

Both are used when comparing experiment versions (aim, objective, procedure,
observations, conclusion).  difflib is part of the Python standard library;
beautifulsoup4 is listed in requirements.txt.
"""
from __future__ import annotations

import difflib
import re
from typing import Optional

from bs4 import BeautifulSoup

# ── Parser choice ─────────────────────────────────────────────────────────────
# Python's built-in html.parser — no C extension required.
_PARSER = "html.parser"

# Rich-text fields on Experiment that contain HTML
RICH_TEXT_FIELDS = (
    "aim",
    "objective",
    "procedure",
    "observations",
    "conclusion",
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. BeautifulSoup helpers
# ─────────────────────────────────────────────────────────────────────────────

def strip_html(html: Optional[str]) -> str:
    """
    Return plain text from an HTML string produced by react-quill.

    * Preserves newlines at block boundaries (p, br, li, …).
    * Collapses multiple blank lines into one.
    * Returns an empty string for None / blank input.

    Example
    -------
    >>> strip_html("<p>Hello <strong>world</strong></p><p>Line 2</p>")
    'Hello world\\nLine 2'
    """
    if not html:
        return ""

    soup = BeautifulSoup(html, _PARSER)

    # Insert a newline before every block-level tag so get_text() keeps them.
    BLOCK_TAGS = {"p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6",
                  "blockquote", "pre", "tr"}
    for tag in soup.find_all(BLOCK_TAGS):
        tag.insert_before("\n")

    text = soup.get_text(separator="")
    # Collapse 3+ consecutive newlines → 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def sanitise_html(html: Optional[str]) -> str:
    """
    Return cleaned HTML, keeping only safe formatting tags.

    Removes scripts, styles, on* attributes and unknown tags while
    preserving the visual structure expected from react-quill output.

    Allowed tags (superset of what Quill produces):
      p, br, strong, em, u, s, a, ul, ol, li,
      h1–h3, blockquote, pre, code, span, div
    """
    if not html:
        return ""

    ALLOWED_TAGS = {
        "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
        "a", "ul", "ol", "li", "h1", "h2", "h3",
        "blockquote", "pre", "code", "span", "div",
    }
    ALLOWED_ATTRS = {
        "a":    ["href", "title", "target"],
        "span": ["style", "class"],
        "p":    ["class"],
        "div":  ["class"],
    }

    soup = BeautifulSoup(html, _PARSER)

    for tag in soup.find_all(True):
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()          # keep inner text, drop the tag
        else:
            allowed = ALLOWED_ATTRS.get(tag.name, [])
            for attr in list(tag.attrs):
                if attr not in allowed or attr.startswith("on"):
                    del tag[attr]

    return str(soup)


def html_to_text_lines(html: Optional[str]) -> list[str]:
    """
    Convert HTML to a list of non-empty plain-text lines.
    Used as input to difflib comparison functions.
    """
    return [ln for ln in strip_html(html).splitlines() if ln.strip()]


# ─────────────────────────────────────────────────────────────────────────────
# 2. difflib helpers
# ─────────────────────────────────────────────────────────────────────────────

def diff_html_unified(
    old_html: Optional[str],
    new_html: Optional[str],
    field_name: str = "field",
    context: int = 3,
) -> str:
    """
    Return a unified-diff string comparing the plain-text content of two
    HTML values.  Useful for audit log details and version history.

    Parameters
    ----------
    old_html   : HTML string of the previous value (or None / empty)
    new_html   : HTML string of the new value (or None / empty)
    field_name : label shown in the diff header
    context    : lines of context around each change

    Returns
    -------
    A unified-diff string, or an empty string if the content is identical.
    """
    old_lines = html_to_text_lines(old_html)
    new_lines = html_to_text_lines(new_html)

    diff = list(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"{field_name} (before)",
            tofile=f"{field_name} (after)",
            lineterm="",
            n=context,
        )
    )
    return "\n".join(diff)


def diff_html_html(
    old_html: Optional[str],
    new_html: Optional[str],
) -> str:
    """
    Return an HTML fragment that highlights insertions and deletions
    between two HTML values, suitable for rendering in the UI.

    Uses difflib.SequenceMatcher on word tokens so the diff is
    fine-grained rather than line-by-line.

    Insertions are wrapped in <ins> tags, deletions in <del> tags.
    """
    old_text = strip_html(old_html)
    new_text = strip_html(new_html)

    old_words = _tokenise(old_text)
    new_words = _tokenise(new_text)

    sm = difflib.SequenceMatcher(None, old_words, new_words, autojunk=False)
    parts: list[str] = []

    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            parts.append(_safe_join(old_words[i1:i2]))
        elif op == "insert":
            parts.append(f'<ins class="rt-ins">{_safe_join(new_words[j1:j2])}</ins>')
        elif op == "delete":
            parts.append(f'<del class="rt-del">{_safe_join(old_words[i1:i2])}</del>')
        elif op == "replace":
            parts.append(f'<del class="rt-del">{_safe_join(old_words[i1:i2])}</del>')
            parts.append(f'<ins class="rt-ins">{_safe_join(new_words[j1:j2])}</ins>')

    return "".join(parts)


def similarity_ratio(
    old_html: Optional[str],
    new_html: Optional[str],
) -> float:
    """
    Return a 0.0–1.0 similarity ratio between the plain-text content
    of two HTML values (1.0 = identical, 0.0 = completely different).
    """
    old_text = strip_html(old_html)
    new_text = strip_html(new_html)
    return difflib.SequenceMatcher(None, old_text, new_text).ratio()


def fields_changed(
    old_data: dict,
    new_data: dict,
    fields: tuple[str, ...] = RICH_TEXT_FIELDS,
) -> dict[str, float]:
    """
    Compare a set of rich-text fields between two dicts and return a
    mapping of {field_name: similarity_ratio} for fields that changed.

    Fields that are identical (ratio == 1.0) are excluded from the result.

    Example
    -------
    >>> fields_changed({"procedure": "<p>Old</p>"}, {"procedure": "<p>New</p>"})
    {'procedure': 0.0}
    """
    changed: dict[str, float] = {}
    for field in fields:
        old_val = old_data.get(field)
        new_val = new_data.get(field)
        ratio = similarity_ratio(old_val, new_val)
        if ratio < 1.0:
            changed[field] = round(ratio, 4)
    return changed


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _tokenise(text: str) -> list[str]:
    """Split text into word+whitespace tokens for fine-grained diffing."""
    return re.findall(r"\S+|\s+", text)


def _safe_join(tokens: list[str]) -> str:
    """HTML-escape and join tokens."""
    import html as html_module
    return html_module.escape("".join(tokens))
