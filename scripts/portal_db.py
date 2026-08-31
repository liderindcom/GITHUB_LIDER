"""Conexão do portal: PostgreSQL se DATABASE_URL existir, senão SQLite.

Uso:
    from portal_db import connect_portal
    con = connect_portal()
    con.execute("SELECT 1")
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

ROOT = Path("/lider/portal-fornecedor")
SQLITE_PATH = ROOT / "db" / "portal.db"
ENV_PATH = ROOT / ".env.postgres"


def _load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_PATH.is_file():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    env.update(os.environ)
    return env


def database_url() -> str:
    env = _load_env()
    if (env.get("PORTAL_DB_ENGINE") or "").lower() == "sqlite":
        return ""
    return env.get("DATABASE_URL") or ""


def connect_portal():
    url = database_url()
    if url:
        import psycopg
        from psycopg.rows import dict_row

        conn = psycopg.connect(url, row_factory=dict_row)
        return conn
    conn = sqlite3.connect(str(SQLITE_PATH), timeout=180)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
