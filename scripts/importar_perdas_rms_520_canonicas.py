#!/usr/bin/env python3
"""Importa Perdas Físicas da Agenda RMS 520 para lote canônico paralelo.

Sem --apply, consulta e valida somente os totais de origem. Com --apply, grava
um novo lote sem alterar a tabela legada ``perdas``; a troca de leitura é feita
somente pela aplicação após a validação do lote.
"""
from __future__ import annotations

import argparse
import calendar
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import psycopg

sys.path.insert(0, "/home/administrador/rms/scripts")
from run_portal_fornecedor_dados_mestres_readonly import connect  # noqa: E402

ROOT = Path("/lider/portal-fornecedor")
ENV = ROOT / ".env.postgres"
JERONIMO_LOC = (132, 450, 469, 493, 515, 523, 531, 566, 574, 582, 639, 647, 710, 736, 752, 760, 779, 809, 817, 841, 850, 868, 876, 884, 892, 906, 914, 922)

SQL = """
SELECT f.DIG_DATA, f.DIG_LOJA, f.DIG_COD_ITEM, i.GIT_COD_FOR, i.GIT_DESCRICAO,
       SUM(f.DIG_QTD_FAT), SUM(f.DIG_QTD_FAT * NVL(f.DIG_PRECO, 0)), COUNT(*)
FROM RMS.AG1CDFAT f
JOIN RMS.AA3CITEM i ON i.GIT_COD_ITEM = f.DIG_COD_ITEM
WHERE f.DIG_AGENDA = 520
  AND f.DIG_DATA BETWEEN 1130101 AND 1261231
  AND f.DIG_LOJA NOT IN ({locais})
GROUP BY f.DIG_DATA, f.DIG_LOJA, f.DIG_COD_ITEM, i.GIT_COD_FOR, i.GIT_DESCRICAO
""".format(locais=", ".join(str(item) for item in JERONIMO_LOC))


def postgres_url() -> str:
    values: dict[str, str] = {}
    for raw in ENV.read_text().splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, value = raw.split("=", 1)
            values[key.strip()] = value.strip()
    return os.environ.get("DATABASE_URL") or values["DATABASE_URL"]


def parse_rms7(raw: object) -> str | None:
    try:
        number = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    text = str(number)
    if len(text) == 7 and text[0] in {"0", "1"}:
        year = (2000 if text[0] == "1" else 1900) + int(text[1:3])
        month, day = int(text[3:5]), int(text[5:7])
    else:
        text = text.zfill(6)
        yy, month, day = int(text[:2]), int(text[2:4]), int(text[4:6])
        year = (2000 if yy < 80 else 1900) + yy
    if not 1 <= month <= 12:
        return None
    return date(year, month, min(max(day, 1), calendar.monthrange(year, month)[1])).isoformat()


def origem():
    with connect() as oracle:
        cursor = oracle.cursor()
        cursor.arraysize = 10_000
        cursor.execute(SQL)
        while rows := cursor.fetchmany(10_000):
            for raw_date, store, item, supplier, description, quantity, amount, occurrences in rows:
                day = parse_rms7(raw_date)
                if not day:
                    continue
                try:
                    store_n, supplier_n = int(store), int(supplier)
                    sku = str(int(item)) if float(item).is_integer() else str(item).strip()
                except (TypeError, ValueError):
                    continue
                qty, total = float(quantity or 0), float(amount or 0)
                yield (
                    str(supplier_n), str(store_n), f"Loja {store_n}", sku,
                    (description or "").strip() or f"PRODUTO {sku}", qty,
                    round(total / qty, 4) if qty else 0.0, round(total, 2), day,
                    int(occurrences or 0),
                )


DDL = """
CREATE TABLE IF NOT EXISTS perdas_rms_520_canonicas (
  loteCarga TEXT NOT NULL, fornecedorCodigo TEXT NOT NULL, lojaId TEXT NOT NULL,
  lojaNome TEXT NOT NULL, sku TEXT NOT NULL, produtoDescricao TEXT NOT NULL,
  quantidade DOUBLE PRECISION NOT NULL, valorUnitario DOUBLE PRECISION NOT NULL,
  valorTotal DOUBLE PRECISION NOT NULL, data TEXT NOT NULL, ocorrencias INTEGER NOT NULL,
  carregadoEm TEXT NOT NULL,
  PRIMARY KEY (loteCarga, fornecedorCodigo, lojaId, sku, data)
);
CREATE INDEX IF NOT EXISTS idx_perdas_520_canonicas_fornecedor
  ON perdas_rms_520_canonicas (loteCarga, fornecedorCodigo, data);
CREATE TABLE IF NOT EXISTS perdas_rms_520_controle (
  chave TEXT PRIMARY KEY, loteCarga TEXT NOT NULL, registros INTEGER NOT NULL,
  origem TEXT NOT NULL, atualizadoEm TEXT NOT NULL
);
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="grava novo lote canônico")
    args = parser.parse_args()
    rows = list(origem())
    if not rows:
        raise SystemExit("RMS não retornou perdas válidas da Agenda 520")
    print(f"rms_520_registros={len(rows)} fornecedores={len({row[0] for row in rows})}")
    if not args.apply:
        return 0
    lot = datetime.now(timezone.utc).strftime("rms520-%Y%m%dT%H%M%SZ")
    now = datetime.now(timezone.utc).isoformat()
    with psycopg.connect(postgres_url()) as pg:
        with pg.cursor() as cur:
            cur.execute(DDL)
            cur.executemany(
                """INSERT INTO perdas_rms_520_canonicas
                   (loteCarga, fornecedorCodigo, lojaId, lojaNome, sku, produtoDescricao,
                    quantidade, valorUnitario, valorTotal, data, ocorrencias, carregadoEm)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                [(lot, *row, now) for row in rows],
            )
            cur.execute("SELECT COUNT(*) FROM perdas_rms_520_canonicas WHERE loteCarga = %s", (lot,))
            inserted = cur.fetchone()[0]
            if inserted != len(rows):
                raise RuntimeError(f"lote incompleto: RMS={len(rows)} PostgreSQL={inserted}")
            cur.execute(
                """INSERT INTO perdas_rms_520_controle (chave, loteCarga, registros, origem, atualizadoEm)
                   VALUES ('ativo', %s, %s, 'RMS Agenda 520', %s)
                   ON CONFLICT (chave) DO UPDATE SET loteCarga = EXCLUDED.loteCarga,
                     registros = EXCLUDED.registros, origem = EXCLUDED.origem, atualizadoEm = EXCLUDED.atualizadoEm""",
                (lot, inserted, now),
            )
    print(f"lote_canonico={lot} registros={inserted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
