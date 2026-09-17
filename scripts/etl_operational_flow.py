#!/usr/bin/env python3
"""Projeção candidata de fluxo operacional por fornecedor/horizonte.

Fórmula por faixa de horizonte:
  vendas_realizadas + entradas_financeiras_previstas - compromissos_a_pagar

Cada série exige explicitamente fonte e corte (identificador de corte). Se o
corte de uma série estiver ausente, a série é devolvida SEM BASE FINANCEIRA e
não preenche lacunas. A projeção não é saldo bancário nem caixa disponível.

Origem exclusiva: caches SQLite documentados do portal (vendas + produtos,
notas_fiscais e contas_receber). O caminho do SQLite de origem é obrigatório e
a leitura é somente-leitura (mode=ro). Este script NÃO acessa /lider, RMS,
credenciais nem PostgreSQL; apenas agrega os caches e emite JSON no stdout.
Interno para comprador autorizado; nunca exposto a fornecedor/AppCom.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RULE_VERSION = "cand-2026-09-17"
PERMISSION = "comprador_autorizado"
DISCLAIMER = (
    "Fluxo operacional projetado por horizonte "
    "(vendas realizadas + entradas financeiras previstas - compromissos a pagar). "
    "Nao e saldo bancario nem caixa disponivel; sem preencher lacunas quando fonte, "
    "corte, regra ou permissao estiver ausente. Interno para comprador autorizado; "
    "nunca exposto a fornecedor ou AppCom."
)

SERIES_IDS = ["vendas_realizadas", "entradas_financeiras_previstas", "compromissos_a_pagar"]

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


def event_date(value: str) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def series_basis(source_name: str, source_cut_id: str | None) -> dict:
    if not source_cut_id:
        return {"financialBasis": "sem_base_financeira", "reason": "corte_ausente"}
    return {"financialBasis": "base_candidata", "reason": "base_candidata"}


def sum_bucket(
    rows: list[tuple[str, float]],
    supplier: str,
    horizon: date,
    bucket_id: str,
    from_days: int | None,
    to_days: int | None,
    bucket_from: str,
    bucket_to: str,
    active: bool,
) -> dict:
    amount = 0.0
    count = 0
    if active:
        for row_supplier, row_date, row_value in rows:
            if row_supplier != supplier:
                continue
            if from_days is not None and (row_date - horizon).days < from_days:
                continue
            if to_days is not None and (row_date - horizon).days > to_days:
                continue
            amount += row_value
            count += 1
    return {
        "bucketId": bucket_id,
        "fromDate": bucket_from,
        "toDate": bucket_to,
        "amount": amount,
        "rowCount": count,
    }


def load_sales(con: sqlite3.Connection, suppliers: list[str]) -> list[tuple[str, float]]:
    try:
        rows = con.execute(
            """
            SELECT p.fornecedorCodigo AS fornecedorCodigo,
                   v.data AS eventDate,
                   SUM(COALESCE(v.quantidade, 0) * COALESCE(v.valorUnitario, 0)) AS valor
            FROM vendas v
            JOIN produtos p ON p.sku = v.sku
            WHERE p.fornecedorCodigo IN
              (SELECT DISTINCT fornecedorCodigo FROM produtos WHERE fornecedorCodigo IS NOT NULL)
            GROUP BY p.fornecedorCodigo, v.data
            """
        ).fetchall()
    except sqlite3.Error:
        return []
    out: list[tuple[str, float]] = []
    for row in rows:
        supplier = str(row["fornecedorCodigo"] or "").strip()
        edate = event_date(row["eventDate"])
        if not supplier or edate is None:
            continue
        if suppliers and supplier not in suppliers:
            continue
        out.append((supplier, edate, float(row["valor"] or 0.0)))
    return out


def load_forecast_inflows(con: sqlite3.Connection, suppliers: list[str]) -> list[tuple[str, float]]:
    try:
        rows = con.execute(
            """
            SELECT fornecedorCodigo,
                   COALESCE(NULLIF(dataPagamento, ''), vencimento, emissao) AS eventDate,
                   COALESCE(valorLiquido, valor, 0) AS valor
            FROM notas_fiscais
            WHERE COALESCE(status, '') <> 'Pago'
            """
        ).fetchall()
    except sqlite3.Error:
        return []
    out: list[tuple[str, float]] = []
    for row in rows:
        supplier = str(row["fornecedorCodigo"] or "").strip()
        edate = event_date(row["eventDate"])
        if not supplier or edate is None:
            continue
        if suppliers and supplier not in suppliers:
            continue
        out.append((supplier, edate, float(row["valor"] or 0.0)))
    return out


def load_commitments(con: sqlite3.Connection, suppliers: list[str]) -> list[tuple[str, float]]:
    try:
        rows = con.execute(
            """
            SELECT fornecedorCodigo, vencimento AS eventDate, valor
            FROM contas_receber
            WHERE status IN ('Programado', 'Aberto')
            """
        ).fetchall()
    except sqlite3.Error:
        return []
    out: list[tuple[str, float]] = []
    for row in rows:
        supplier = str(row["fornecedorCodigo"] or "").strip()
        edate = event_date(row["eventDate"])
        if not supplier or edate is None:
            continue
        if suppliers and supplier not in suppliers:
            continue
        out.append((supplier, edate, float(row["valor"] or 0.0)))
    return out


def discover_suppliers(*row_sets: list[tuple[str, float]]) -> list[str]:
    suppliers = {supplier for rows in row_sets for supplier, _date, _value in rows}
    return sorted(suppliers)


def build_document(
    supplier: str,
    horizon: date,
    cuts: dict[str, str | None],
    supplier_rows: dict[str, list[tuple[str, float]]],
    source_names: dict[str, str],
) -> dict:
    series_statuses: list[dict] = []
    active_by_series: dict[str, bool] = {}
    for series_id in SERIES_IDS:
        basis = series_basis(source_names[series_id], cuts[series_id])
        active_by_series[series_id] = basis["financialBasis"] == "base_candidata"
        series_statuses.append(
            {
                "seriesId": series_id,
                "sourceName": source_names[series_id],
                "sourceCutId": cuts[series_id],
                "ruleVersion": RULE_VERSION,
                "permission": PERMISSION,
                "financialBasis": basis["financialBasis"],
                "reason": basis["reason"],
            }
        )

    overall_basis = "base_candidata" if all(active_by_series.values()) else "sem_base_financeira"
    overall_reason = "base_candidata" if overall_basis == "base_candidata" else "corte_ausente"

    lines: list[dict] = []
    buckets: list[dict] = []
    totals_per_series: dict[str, float] = {series_id: 0.0 for series_id in SERIES_IDS}
    totals_per_count: dict[str, int] = {series_id: 0 for series_id in SERIES_IDS}

    for bucket_id, from_days, to_days, fallback_from, fallback_to in BUCKETS:
        bucket_from = iso(add_days(horizon, from_days)) if from_days is not None else fallback_from
        bucket_to = iso(add_days(horizon, to_days)) if to_days is not None else fallback_to
        buckets.append({"bucketId": bucket_id, "fromDate": bucket_from, "toDate": bucket_to})

        series_amounts: dict[str, str | None] = {}
        for series_id in SERIES_IDS:
            part = sum_bucket(
                supplier_rows[series_id],
                supplier,
                horizon,
                bucket_id,
                from_days,
                to_days,
                bucket_from,
                bucket_to,
                active_by_series[series_id],
            )
            if active_by_series[series_id]:
                series_amounts[series_id] = money(part["amount"])
                totals_per_series[series_id] += part["amount"]
                totals_per_count[series_id] += part["rowCount"]
            else:
                series_amounts[series_id] = None

        projected = None
        if overall_basis == "base_candidata":
            # Por linha: vendas + entradas - compromissos da faixa.
            sales = totals_in_line(series_amounts, "vendas_realizadas")
            inflows = totals_in_line(series_amounts, "entradas_financeiras_previstas")
            commitments = totals_in_line(series_amounts, "compromissos_a_pagar")
            if sales is not None and inflows is not None and commitments is not None:
                projected = money(sales + inflows - commitments)

        lines.append(
            {
                "bucketId": bucket_id,
                "fromDate": bucket_from,
                "toDate": bucket_to,
                "vendasRealizadasAmount": series_amounts["vendas_realizadas"],
                "entradasFinanceirasPrevistasAmount": series_amounts["entradas_financeiras_previstas"],
                "compromissosAPagarAmount": series_amounts["compromissos_a_pagar"],
                "projectedOperationalFlowAmount": projected,
            }
        )

    totals: dict = {
        "rowCount": sum(totals_per_count.values()),
    }
    for series_id in SERIES_IDS:
        key = {
            "vendas_realizadas": "vendasRealizadasAmount",
            "entradas_financeiras_previstas": "entradasFinanceirasPrevistasAmount",
            "compromissos_a_pagar": "compromissosAPagarAmount",
        }[series_id]
        totals[key] = money(totals_per_series[series_id]) if active_by_series[series_id] else None

    if overall_basis == "base_candidata":
        totals["projectedOperationalFlowAmount"] = money(
            totals_per_series["vendas_realizadas"]
            + totals_per_series["entradas_financeiras_previstas"]
            - totals_per_series["compromissos_a_pagar"]
        )
    else:
        totals["projectedOperationalFlowAmount"] = None

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "homologationStatus": "candidato",
        "supplierCode": supplier,
        "horizon": {
            "horizonId": f"h-{iso(horizon)}",
            "horizonDate": iso(horizon),
            "buckets": buckets,
        },
        "internalOnly": True,
        "financialBasis": overall_basis,
        "reason": overall_reason,
        "series": series_statuses,
        "rows": lines,
        "totals": totals,
        "writesToErp": False,
        "disclaimer": DISCLAIMER,
    }


def totals_in_line(values: dict[str, str | None], key: str) -> float | None:
    raw = values.get(key)
    return float(raw) if raw is not None else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", required=True, help="Caminho do SQLite de origem (obrigatório).")
    parser.add_argument("--supplier", default="", help="Filtrar um fornecedorCodigo.")
    parser.add_argument("--horizon", default=iso(date.today()), help="Data de horizonte (YYYY-MM-DD).")
    parser.add_argument("--sales-source", default="portal_cache_vendas", help="Nome da fonte de vendas.")
    parser.add_argument("--sales-cut-id", default="", help="Corte documentado da série de vendas.")
    parser.add_argument("--forecast-source", default="portal_cache_notas_fiscais",
                        help="Nome da fonte de entradas financeiras previstas.")
    parser.add_argument("--forecast-cut-id", default="", help="Corte documentado da série de entradas previstas.")
    parser.add_argument("--commitment-source", default="portal_cache_contas_receber",
                        help="Nome da fonte de compromissos a pagar.")
    parser.add_argument("--commitment-cut-id", default="", help="Corte documentado da série de compromissos.")
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

    cuts = {
        "vendas_realizadas": args.sales_cut_id or None,
        "entradas_financeiras_previstas": args.forecast_cut_id or None,
        "compromissos_a_pagar": args.commitment_cut_id or None,
    }
    source_names = {
        "vendas_realizadas": args.sales_source,
        "entradas_financeiras_previstas": args.forecast_source,
        "compromissos_a_pagar": args.commitment_source,
    }

    # Leitura somente-leitura; sem escrita em lugar nenhum nesta etapa.
    with read_only_connect(source) as con:
        sales_rows = load_sales(con, [args.supplier] if args.supplier else [])
        forecast_rows = load_forecast_inflows(con, [args.supplier] if args.supplier else [])
        commitment_rows = load_commitments(con, [args.supplier] if args.supplier else [])
        supplier_rows = {
            "vendas_realizadas": sales_rows,
            "entradas_financeiras_previstas": forecast_rows,
            "compromissos_a_pagar": commitment_rows,
        }
        suppliers = discover_suppliers(sales_rows, forecast_rows, commitment_rows)
        if args.supplier:
            suppliers = [args.supplier]

        documents = [
            build_document(supplier, horizon, cuts, supplier_rows, source_names)
            for supplier in suppliers
        ]

    payload = json.dumps(documents, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(payload)
    else:
        Path(args.out).write_text(payload + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
