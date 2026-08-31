#!/usr/bin/env python3
"""Grava no portal o nome da classe a partir do mercadologico do produto.

Fonte: consulta 21 (AA3CNVCC.NCC_DESCRICAO join depto+secao+grupo+subgrupo).
Nao usa os TSVs candidatos do portal (rejeitados).
"""
from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "db" / "portal.db"
TSV_PATH = Path(
    "/home/administrador/rms/dados/portal-fornecedor-dados-mestres/"
    "portal_fornecedor_dados_mestres_21_classificacao_mercadologica_dicionario.tsv"
)
REJECTED = Path(
    "/home/administrador/rms/dados/portal-fornecedor-dados-mestres/REJEITADO"
)


def norm(value, default="0"):
    text = "" if value is None else str(value).strip()
    if not text:
        return default
    try:
        return str(int(float(text)))
    except ValueError:
        return text.lstrip("0") or "0"


def code4(depto, secao, grupo, subgrupo):
    return ".".join([depto.zfill(3), secao.zfill(2), grupo.zfill(2), subgrupo.zfill(2)])


def labels(depto, secao, grupo, subgrupo, ncc):
    full = code4(depto, secao, grupo, subgrupo)
    leaf = ncc or f"Subgrupo {full}"
    return {
        "categoria": leaf,
        "departamento": f"Departamento {depto.zfill(3)}",
        "secao": f"Seção {depto.zfill(3)}.{secao.zfill(2)}",
        "grupo": f"Grupo {depto.zfill(3)}.{secao.zfill(2)}.{grupo.zfill(2)}",
        "subgrupo": leaf,
        "familia": full,
    }


def load_classifications():
    with TSV_PATH.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            depto = norm(row.get("department_code"))
            secao = norm(row.get("section_code"))
            grupo = norm(row.get("group_code"))
            subgrupo = norm(row.get("subgroup_code"))
            ncc = (row.get("ncc_description") or "").strip() or None
            yield depto, secao, grupo, subgrupo, labels(depto, secao, grupo, subgrupo, ncc)


def main() -> int:
    if not DB_PATH.exists():
        raise SystemExit(f"SQLite nao encontrado: {DB_PATH}")
    if not TSV_PATH.exists():
        raise SystemExit(f"consulta 21 nao encontrada: {TSV_PATH}")
    if "REJEITADO" in str(TSV_PATH) or TSV_PATH.parent == REJECTED:
        raise SystemExit("BLOQUEADO: recusou TSV da pasta REJEITADO")

    conn = sqlite3.connect(str(DB_PATH), timeout=120)
    try:
        conn.execute("PRAGMA busy_timeout = 120000")
        conn.execute("BEGIN")
        conn.execute(
            """
            CREATE TEMP TABLE classificacao_map (
                departamentoCodigo TEXT,
                secaoCodigo TEXT,
                grupoCodigo TEXT,
                subgrupoCodigo TEXT,
                categoria TEXT,
                departamento TEXT,
                secao TEXT,
                grupo TEXT,
                subgrupo TEXT,
                familia TEXT,
                PRIMARY KEY (
                    departamentoCodigo,
                    secaoCodigo,
                    grupoCodigo,
                    subgrupoCodigo
                )
            )
            """
        )
        rows = []
        with_ncc = 0
        for depto, secao, grupo, subgrupo, lab in load_classifications():
            if not lab["subgrupo"].startswith("Subgrupo "):
                with_ncc += 1
            rows.append(
                (
                    depto,
                    secao,
                    grupo,
                    subgrupo,
                    lab["categoria"],
                    lab["departamento"],
                    lab["secao"],
                    lab["grupo"],
                    lab["subgrupo"],
                    lab["familia"],
                )
            )
        conn.executemany(
            """
            INSERT OR REPLACE INTO classificacao_map
            (departamentoCodigo, secaoCodigo, grupoCodigo, subgrupoCodigo,
             categoria, departamento, secao, grupo, subgrupo, familia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        cur = conn.execute(
            """
            UPDATE produtos
               SET (categoria, departamento, secao, grupo, subgrupo, familia) = (
                       SELECT m.categoria, m.departamento, m.secao, m.grupo, m.subgrupo, m.familia
                         FROM classificacao_map m
                        WHERE m.departamentoCodigo = CAST(CAST(produtos.departamentoCodigo AS INTEGER) AS TEXT)
                          AND m.secaoCodigo = CAST(CAST(produtos.secaoCodigo AS INTEGER) AS TEXT)
                          AND m.grupoCodigo = CAST(CAST(produtos.grupoCodigo AS INTEGER) AS TEXT)
                          AND m.subgrupoCodigo = CAST(CAST(produtos.subgrupoCodigo AS INTEGER) AS TEXT)
                   )
             WHERE EXISTS (
                       SELECT 1
                         FROM classificacao_map m
                        WHERE m.departamentoCodigo = CAST(CAST(produtos.departamentoCodigo AS INTEGER) AS TEXT)
                          AND m.secaoCodigo = CAST(CAST(produtos.secaoCodigo AS INTEGER) AS TEXT)
                          AND m.grupoCodigo = CAST(CAST(produtos.grupoCodigo AS INTEGER) AS TEXT)
                          AND m.subgrupoCodigo = CAST(CAST(produtos.subgrupoCodigo AS INTEGER) AS TEXT)
                   )
            """
        )
        conn.commit()
        print(f"fonte={TSV_PATH}")
        print(f"chaves={len(rows)} com_ncc={with_ncc}")
        print(f"linhas_produtos_atualizadas={cur.rowcount}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
