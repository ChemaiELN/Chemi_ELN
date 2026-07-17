"""
Laurus ELN — one-shot database seeder for a fresh/empty database.

Run AFTER `alembic upgrade head`. All seeds are idempotent, so re-running
is safe (existing rows are skipped).

    python seed_all.py

Seeds, in dependency order:
  1. Roles, Departments, department_role_mapping, and the 19 default department/role users
  2. RBAC role privileges
  3. Inventory reference data (consumable types, UOM master, test master)
  4. ADC workflow templates
  5. CGT Plasmid workflow templates (USP, DSP)
  6. CGT AAV workflow templates (USP, DSP)
  7. CGT Molecular Biology workflow templates (Cloning, PCS, Transformation,
     Plasmid Isolation, Cell Banking)
"""
import importlib
import sys

# (module path, entry function name)
STEPS = [
    ("seeds.migrate_department_roles", "migrate"),
    ("seeds.seed_privileges",       "seed"),
    ("seeds.seed_consumable_types", "run"),
    ("seeds.seed_uom_master",       "run"),
    ("seeds.seed_test_master",      "run"),
    ("seeds.seed_adc_templates",    "seed"),
    ("seeds.seed_cgt_plasmid_templates", "seed"),
    ("seeds.seed_aav_templates",    "seed"),
    ("seeds.seed_molbio_templates", "seed"),
]


def main() -> int:
    failures = 0
    for module_path, fn_name in STEPS:
        print(f"\n=== {module_path}.{fn_name}() ===")
        try:
            module = importlib.import_module(module_path)
            getattr(module, fn_name)()
        except Exception as exc:  # noqa: BLE001 — report and continue
            failures += 1
            print(f"!! FAILED: {module_path}.{fn_name}() -> {exc!r}")
    if failures:
        print(f"\nSeeding finished with {failures} failed step(s).")
        return 1
    print("\nAll seeds completed successfully.")
    print("Login with:  qa.hod  /  password@123  (QA department, HOD role — full admin)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
