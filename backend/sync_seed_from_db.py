"""Sync a workflow template's `definition` in seeds/seed_adc_templates.py from the
live database — use this after applying one-off `patch_*.py` migrations so a
future `python seed_adc_templates.py` run can't silently revert them.

Finds the `TEMPLATES` list literal via `ast`, locates the dict entry whose
'slug' matches, and replaces only that entry's 'definition' value (by exact
source span) with a freshly-serialized copy of the current DB definition.
Everything else in the file — other templates, formatting, imports, the
`seed()` function — is left untouched.
"""
import sys, ast, json
sys.path.insert(0, ".")
from app.database import engine
from sqlalchemy import text

SEED_FILE = "seeds/seed_adc_templates.py"
SLUG = "adc-synthesis-v2"


def fetch_db_definition(slug: str) -> dict:
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT definition FROM workflow_templates WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
    if not row:
        raise SystemExit(f"Template '{slug}' not found in DB.")
    return row[0]


def find_definition_span(source: str, slug: str):
    tree = ast.parse(source)
    templates_list = None
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "TEMPLATES" for t in node.targets
        ):
            templates_list = node.value
            break
    if templates_list is None or not isinstance(templates_list, ast.List):
        raise SystemExit("Could not find `TEMPLATES = [...]` in seed file.")

    for tmpl_dict in templates_list.elts:
        if not isinstance(tmpl_dict, ast.Dict):
            continue
        keys = {k.value: v for k, v in zip(tmpl_dict.keys, tmpl_dict.values) if isinstance(k, ast.Constant)}
        slug_node = keys.get("slug")
        if not (isinstance(slug_node, ast.Constant) and slug_node.value == slug):
            continue
        def_node = keys.get("definition")
        if def_node is None:
            raise SystemExit(f"Template '{slug}' has no 'definition' key.")
        return def_node.lineno, def_node.col_offset, def_node.end_lineno, def_node.end_col_offset

    raise SystemExit(f"Template '{slug}' not found in TEMPLATES list.")


def replace_span(source: str, start_line, start_col, end_line, end_col, replacement: str) -> str:
    # `ast` column offsets are UTF-8 BYTE offsets, not character indices — this
    # file has non-ASCII characters (µL, °C, ...) earlier on the line, so slicing
    # the str directly by col_offset would land mid-character. Slice the UTF-8
    # bytes instead, then decode back.
    lines = source.splitlines(keepends=True)
    if start_line == end_line:
        line_bytes = lines[start_line - 1].encode("utf-8")
        new_line = line_bytes[:start_col] + replacement.encode("utf-8") + line_bytes[end_col:]
        lines[start_line - 1] = new_line.decode("utf-8")
    else:
        first = lines[start_line - 1].encode("utf-8")[:start_col].decode("utf-8")
        last = lines[end_line - 1].encode("utf-8")[end_col:].decode("utf-8")
        lines[start_line - 1:end_line] = [first + replacement + last]
    return "".join(lines)


def run():
    db_def = fetch_db_definition(SLUG)

    with open(SEED_FILE, encoding="utf-8-sig") as f:
        source = f.read()

    start_line, start_col, end_line, end_col = find_definition_span(source, SLUG)
    print(f"Found '{SLUG}' definition at line {start_line} (col {start_col}) .. line {end_line} (col {end_col})")

    replacement = repr(db_def)
    new_source = replace_span(source, start_line, start_col, end_line, end_col, replacement)

    # Validate: must still be syntactically valid, and TEMPLATES must round-trip
    # with the new definition matching the DB exactly.
    ast.parse(new_source)
    import os
    ns: dict = {"__file__": os.path.abspath(SEED_FILE), "__name__": "_sync_validation"}
    exec(compile(new_source, SEED_FILE, "exec"), ns)
    reloaded = next(t for t in ns["TEMPLATES"] if t["slug"] == SLUG)
    if reloaded["definition"] != db_def:
        raise SystemExit("Validation failed: rewritten definition does not match DB. Aborting — file NOT written.")

    with open(SEED_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_source)
    print(f"[OK] {SEED_FILE} updated — '{SLUG}' definition now matches the database exactly.")

    # Sanity: other templates untouched
    other_slugs = [t["slug"] for t in ns["TEMPLATES"] if t["slug"] != SLUG]
    print(f"Other templates left untouched: {other_slugs}")


if __name__ == "__main__":
    run()
