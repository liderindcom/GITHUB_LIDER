#!/usr/bin/env python3
"""Agregado candidato de compromissos a pagar por fornecedor/horizonte.

Origem exclusiva: cache SQLite do portal (tabela contas_receber populada
assincronamente de RMS.AA1RTITU) com fornecedorCodigo, vencimento, valor e
status Programado/Aberto.

O caminho do SQLite de origem e obrigatorio e a leitura e somente-leitura
(mode=ro). Este script NAO acessa /lider, RMS, credenciais nem PostgreSQL;
apenas agrega o cache e emite JSON no stdout. Sem reserva, saldo ou custo de
capital. Interno para comprador autorizado; nunca exposto a fornecedor/AppCom.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RULE_VERSION = "cand-2026-09-17"
SOURCE_NAME = "portal_sqlite_cache"
PERMISSION = "comprador_autorizado"
DISCLAIMER = (
    "Agregado de compromissos a pagar apenas. Sem reserva financeira, saldo ou custo de capital. "
    "Interno para comprador autorizado; nunca exposto a fornecedor ou AppCom."
)

# (bucket_id, dias_minimo, dias_maximo, fallback_from, fallback_to)
BUCKETS = [
    ("vencido", None, -1, "1970-01-01", None),
    ("0_30", 0, 30, None, None),
    ("31_60", 31, 60, None, None),
    ("61_90", 61, 90, None, None),
    ("91_180", 91, 180, None, None),
    ("181_mais", 181, None, None, "9999-12-31"),
]


def iso(d: date) -> str:
    return d.isoformat()


def add_days(d: date, days: int) -> date:
    return d + timedelta(days=days)


def money(value: float) -> str:
    return f"{value:.2f}"


def read_only_connect(path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=120)
    con.row_factory = sqlite3.Row
    return con


def aggregate_rows(
    rows: list[sqlite3.Row],
    supplier: str,
    horizon: date,
) -> dict:
    lines: list[dict] = []
    buckets: list[dict] = []
    totals = {"statusProgramadoAmount": "0.00", "statusAbertoAmount": "0.00",
              "totalAmount": "0.00", "rowCount": 0}
    total_programado = 0.0
    total_aberto = 0.0
    total_rows = 0

    for bucket_id, from_days, to_days, fallback_from, fallback_to in BUCKETS:
        due_from = iso(add_days(horizon, from_days)) if from_days is not None else fallback_from
        due_to = iso(add_days(horizon, to_days)) if to_days is not None else fallback_to
        buckets.append({"bucketId": bucket_id, "dueFrom": due_from, "dueTo": due_to})

        programado = 0.0
        aberto = 0.0
        count = 0
        for row in rows:
            if str(row["fornecedorCodigo"] or "").strip() != supplier:
                continue
            if row["status"] not in ("Programado", "Aberto"):
                continue
            due = row["vencimento"]
            if not due:
                continue
            try:
                due_date = date.fromisoformat(str(due)[:10])
            except ValueError:
                continue
            diff_days = (due_date - horizon).days
            if from_days is not None and diff_days < from_days:
                continue
            if to_days is not None and diff_days > to_days:
                continue
            valor = float(row["valor"] or 0.0)
            if row["status"] == "Programado":
                programado += valor
            elif row["status"] == "Aberto":
                aberto += valor
            count += 1

        lines.append(
            {
                "bucketId": bucket_id,
                "dueFrom": due_from,
                "dueTo": due_to,
                "statusProgramadoAmount": money(programado),
                "statusAbertoAmount": money(aberto),
                "totalAmount": money(programado + aberto),
                "rowCount": count,
            }
        )
        total_programado += programado
        total_aberto += aberto
        total_rows += count

    totals = {
        "statusProgramadoAmount": money(total_programado),
        "statusAbertoAmount": money(total_aberto),
        "totalAmount": money(total_programado + total_aberto),
        "rowCount": total_rows,
    }
    return {"buckets": buckets, "lines": lines, "totals": totals}


def build_document(
    supplier: str,
    horizon: date,
    cut_id: str,
    parts: dict,
) -> dict:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "homologationStatus": "candidato",
        "supplierCode": supplier,
        "horizon": {
            "horizonId": f"h-{iso(horizon)}",
            "horizonDate": iso(horizon),
            "buckets": parts["buckets"],
        },
        "internalOnly": True,
        # Sem corte estável documentado no cache: o motor não abre base financeira.
        "financialBasis": "sem_base_financeira",
        "reason": "corte_ausente" if not cut_id else "base_candidata",
        "sourceName": SOURCE_NAME,
        "sourceCutId": cut_id or None,
        "ruleVersion": RULE_VERSION,
        "permission": PERMISSION,
        "rows": parts["lines"],
        "totals": parts["totals"],
        "writesToErp": False,
        "disclaimer": DISCLAIMER,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", required=True, help="Caminho do SQLite de origem (obrigatório).")
    parser.add_argument("--supplier", default="", help="Filtrar um fornecedorCodigo.")
    parser.add_argument("--horizon", default=iso(date.today()), help="Data de horizonte (YYYY-MM-DD).")
    parser.add_argument("--source-cut-id", default="", help="Identificador do corte do cache, se documentado.")
    parser.add_argument("--out", default="-", help="Arquivo de saída JSON; '-' para stdout.")
    args = parser.parse_args()

    source = Path(args.sqlite).expanduser().resolve()
    if not source.is_file():
        print(f"SQLite de origem nao encontrado: {source}", file=sys.stderr)
        return 2

    try:
        horizon = date.fromisoformat(args.horizon)
    except ValueError:
        print("--horizon invalido; use YYYY-MM-DD.", file=sys.stderr)
        return 2

    # Leitura somente-leitura; sem escrita em lugar nenhum nesta etapa.
    with read_only_connect(source) as con:
        tables = {
            r[0]
            for r in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='contas_receber'"
            )
        }
        if "contas_receber" not in tables:
            documents: list[dict] = []
        else:
            rows = con.execute(
                "SELECT fornecedorCodigo, vencimento, valor, status "
                "FROM contas_receber "
                "WHERE status IN ('Programado', 'Aberto')"
            ).fetchall()
            suppliers = sorted({str(r["fornecedorCodigo"] or "").strip() for r in rows})
            suppliers = [s for s in suppliers if s]
            if args.supplier:
                suppliers = [s for s in suppliers if s == args.supplier]
            documents = [
                build_document(s, horizon, args.source_cut_id, aggregate_rows(rows, s, horizon))
                for s in suppliers
            ]

    payload = json.dumps(documents, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(payload)
    else:
        Path(args.out).write_text(payload + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
