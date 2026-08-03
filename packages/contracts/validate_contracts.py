#!/usr/bin/env python3
"""Validate Portal do Fornecedor JSON Schema contracts and controlled examples."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = Path(__file__).resolve().parent
SEEDS = ROOT / "db" / "seeds" / "controlled_examples.json"
MIGRATIONS = ROOT / "db" / "migrations"

FORBIDDEN = re.compile(
    r"\b(pyodbc|pymssql|cx_Oracle|oracledb|sqlcmd|DB_PASSWORD|password\s*=|senha\s*=)\b",
    re.IGNORECASE,
)

SCHEMA_FILES = [
    "common.schema.json",
    "api-error.schema.json",
    "auth-session.schema.json",
    "dashboard-alerts.schema.json",
    "stock-balance.schema.json",
    "stock-movement.schema.json",
    "receivable-title.schema.json",
    "anticipation-quote.schema.json",
    "anticipation-request.schema.json",
]

EXAMPLE_TO_SCHEMA = {
    "stockBalances": "stock-balance.schema.json",
    "receivableTitles": "receivable-title.schema.json",
    "dashboardAlerts": "dashboard-alerts.schema.json",
    "anticipationQuote": "anticipation-quote.schema.json",
    "authSession": "auth-session.schema.json",
    "apiError": "api-error.schema.json",
}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"invalid JSON {path}: {exc}")
        raise


def validate_schema_shape(path: Path, schema: object) -> None:
    if not isinstance(schema, dict):
        fail(f"{path.name}: schema must be object")
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        fail(f"{path.name}: missing draft 2020-12 $schema")
    if "title" not in schema and "$defs" not in schema:
        fail(f"{path.name}: missing title")
    text = path.read_text(encoding="utf-8")
    if FORBIDDEN.search(text):
        fail(f"{path.name}: forbidden secret/hot-path token")
    # Anti-overclaim: no homologado/produção in enums where status exists
    blob = json.dumps(schema, ensure_ascii=False).lower()
    if "homologado" in blob or "pronto_producao" in blob:
        fail(f"{path.name}: overclaim status forbidden in schema")


def check_required(path: str, data: dict, required: list[str]) -> None:
    for key in required:
        if key not in data:
            fail(f"{path}: missing required field '{key}'")


def validate_example_against_required(name: str, data: dict, schema: dict) -> None:
    required = schema.get("required", [])
    if isinstance(required, list):
        check_required(name, data, required)
    if schema.get("properties", {}).get("writesToErp", {}).get("const") is False:
        if data.get("writesToErp") is not False:
            fail(f"{name}: writesToErp must be false")
    if "writesToErp" in schema.get("required", []) and data.get("writesToErp") is not False:
        fail(f"{name}: writesToErp must be false")
    # Nested rows with writesToErp
    for row in data.get("rows", []) if isinstance(data.get("rows"), list) else []:
        if "writesToErp" in row and row.get("writesToErp") is not False:
            fail(f"{name}.rows: writesToErp must be false")
    for alert in data.get("alerts", []) if isinstance(data.get("alerts"), list) else []:
        if alert.get("writesToErp") is not False:
            fail(f"{name}.alerts: writesToErp must be false")
    status = data.get("homologationStatus")
    if status is not None and status not in {"candidato", "aguarda_aceite", "restrito", "bloqueado"}:
        fail(f"{name}: invalid homologationStatus {status}")


def scan_migrations() -> None:
    if not MIGRATIONS.exists():
        fail("missing db/migrations")
    files = sorted(MIGRATIONS.glob("*.sql"))
    if len(files) < 3:
        fail("expected at least 3 migration files")
    joined = "\n".join(f.read_text(encoding="utf-8") for f in files)
    if "ROW LEVEL SECURITY" not in joined and "row level security" not in joined.lower():
        fail("migrations must enable RLS")
    if "app.supplier_id" not in joined:
        fail("migrations must reference app.supplier_id GUC")
    if FORBIDDEN.search(joined):
        fail("migrations contain forbidden secret token")


def main() -> int:
    for name in SCHEMA_FILES:
        path = CONTRACTS / name
        if not path.exists():
            fail(f"missing schema {name}")
        schema = load_json(path)
        validate_schema_shape(path, schema)

    if not SEEDS.exists():
        fail(f"missing seeds {SEEDS}")
    examples = load_json(SEEDS)
    if not isinstance(examples, dict):
        fail("seeds must be object")
    if examples.get("homologationStatus") not in {"candidato", "aguarda_aceite", "restrito", "bloqueado"}:
        fail("seeds homologationStatus invalid")

    for key, schema_name in EXAMPLE_TO_SCHEMA.items():
        if key not in examples:
            fail(f"seed missing example key {key}")
        schema = load_json(CONTRACTS / schema_name)
        data = examples[key]
        if not isinstance(data, dict):
            fail(f"example {key} must be object")
        validate_example_against_required(key, data, schema)

    # Tenant isolation smoke on seed narrative
    suppliers = examples.get("suppliers", [])
    if len(suppliers) < 2:
        fail("seed must include two suppliers for RLS isolation narrative")

    scan_migrations()

    print(
        f"OK: validated {len(SCHEMA_FILES)} schemas, "
        f"{len(EXAMPLE_TO_SCHEMA)} examples, "
        f"{len(list(MIGRATIONS.glob('*.sql')))} migrations"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
