# 2026-08-23 — Portal lê PostgreSQL (cópia do schema SQLite)

## O que mudou
- PostgreSQL 16 no Docker (`portal-fornecedor-pg`, só `127.0.0.1:5432`).
- Cópia 1:1 do `portal.db` (24 tabelas, counts conferidos). Não aplica `db/migrations/001`–`005`.
- `src/server/db.ts` escolhe o motor: `DATABASE_URL` → Postgres; `PORTAL_DB_ENGINE=sqlite` → SQLite.
- Worker síncrono `scripts/pg-sync-worker.mjs` traduz `?`, `PRAGMA`, `sqlite_master`, `datetime('now')`, `instr`, `GLOB`, `substr(..., -1)`.
- Loader diário continua gravando SQLite e no fim faz refresh `estoque,vendas,vendas_mensal` no Postgres.

## Rollback
No supervisor: `export PORTAL_DB_ENGINE=sqlite` e reiniciar o Vite.

## Não feito
- Loaders RMS além do diário ainda só escrevem SQLite; copiar de novo com `scripts/migrate_sqlite_to_postgres.py --tables …`.
- RLS/UUIDs das migrations 001–005.
