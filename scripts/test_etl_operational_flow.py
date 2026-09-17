#!/usr/bin/env python3
"""Smoke test do ETL candidato de fluxo operacional (sem redes/credenciais).

Cria um SQLite temporario com vendas + produtos, notas_fiscais e
contas_receber, executa etl_operational_flow.py em modo somente-leitura e
confere a projecao JSON emitida.
"""
from __future__ import annotations

import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "etl_operational_flow.py"

HORIZON = date(2026, 9, 17)
DISCLAIMER = (
    "Fluxo operacional projetado por horizonte "
    "(vendas realizadas + entradas financeiras previstas - compromissos a pagar). "
    "Nao e saldo bancario nem caixa disponivel; sem preencher lacunas quando fonte, "
    "corte, regra ou permissao estiver ausente. Interno para comprador autorizado; "
    "nunca exposto a fornecedor ou AppCom."
)


def d(offset_days: int) -> str:
    return (HORIZON + timedelta(days=offset_days)).isoformat()


def seed(db_path: Path) -> None:
    con = sqlite3.connect(db_path)
    con.executescript(
        """
        CREATE TABLE produtos (
          sku TEXT PRIMARY KEY,
          fornecedorCodigo TEXT
        );
        CREATE TABLE vendas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT,
          lojaId TEXT,
          sku TEXT,
          quantidade REAL,
          valorUnitario REAL
        );
        CREATE TABLE notas_fiscais (
          id TEXT PRIMARY KEY,
          fornecedorCodigo TEXT,
          emissao TEXT,
          vencimento TEXT,
          dataPagamento TEXT,
          valor REAL,
          valorLiquido REAL,
          status TEXT
        );
        CREATE TABLE contas_receber (
          id TEXT PRIMARY KEY,
          fornecedorCodigo TEXT,
          vencimento TEXT,
          valor REAL,
          status TEXT
        );
        """
    )
    con.executemany(
        "INSERT INTO produtos (sku, fornecedorCodigo) VALUES (?, ?)",
        [("sku-1", "001"), ("sku-2", "002")],
    )
    con.executemany(
        "INSERT INTO vendas (data, lojaId, sku, quantidade, valorUnitario) VALUES (?, ?, ?, ?, ?)",
        [
            (d(-7), "l1", "sku-1", 2, 50.0),   # 100.00 vencido
            (d(0), "l1", "sku-1", 1, 300.0),   # 300.00 0_30
            (d(0), "l1", "sku-2", 1, 98765.0),  # outro fornecedor
        ],
    )
    con.executemany(
        "INSERT INTO notas_fiscais (id, fornecedorCodigo, emissao, vencimento, dataPagamento, valor, valorLiquido, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("nf-1", "001", d(0), "", d(10), 1000.0, 910.0, "A vencer"),   # 900.00 0_30
            ("nf-2", "001", d(0), "", "", 55.0, 55.0, "Pago"),              # paga, fora
            ("nf-3", "002", d(0), "", d(10), 9999.0, 9999.0, "A vencer"),  # outro fornecedor
        ],
    )
    con.executemany(
        "INSERT INTO contas_receber (id, fornecedorCodigo, vencimento, valor, status) VALUES (?, ?, ?, ?, ?)",
        [
            ("cr-1", "001", d(15), 400.0, "Programado"),  # 400.00 0_30
            ("cr-2", "001", d(15), 42.0, "Descontado"),    # status fora
            ("cr-3", "002", d(15), 9999.0, "Aberto"),      # outro fornecedor
        ],
    )
    con.commit()
    con.close()


class EtlOperationalFlowTest(unittest.TestCase):
    def run_etl(self, sqlite_path: Path, *extra: str) -> list[dict]:
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), "--sqlite", str(sqlite_path), *extra],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}")
        return json.loads(proc.stdout)

    def test_exige_caminho_explicito(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(SCRIPT)], cwd=ROOT, capture_output=True, text=True
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("sqlite", proc.stderr.lower())

    def test_corte_ausente_devolve_sem_base_sem_lacunas(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.db"
            seed(path)
            docs = self.run_etl(path, "--supplier", "001", "--horizon", HORIZON.isoformat())
            self.assertEqual(len(docs), 1)
            doc = docs[0]
            self.assertEqual(doc["supplierCode"], "001")
            self.assertEqual(doc["financialBasis"], "sem_base_financeira")
            self.assertEqual(doc["reason"], "corte_ausente")
            self.assertEqual(doc["internalOnly"], True)
            self.assertEqual(doc["writesToErp"], False)
            self.assertEqual(doc["homologationStatus"], "candidato")
            self.assertEqual(doc["disclaimer"], DISCLAIMER)
            for series in doc["series"]:
                self.assertEqual(series["financialBasis"], "sem_base_financeira")
                self.assertEqual(series["reason"], "corte_ausente")
            for row in doc["rows"]:
                self.assertIsNone(row["vendasRealizadasAmount"])
                self.assertIsNone(row["entradasFinanceirasPrevistasAmount"])
                self.assertIsNone(row["compromissosAPagarAmount"])
                self.assertIsNone(row["projectedOperationalFlowAmount"])
            self.assertIsNone(doc["totals"]["projectedOperationalFlowAmount"])
            self.assertNotIn("saldo", doc)
            self.assertNotIn("caixa", doc)
            self.assertNotIn("bank", json.dumps(doc))

    def test_cortes_explicitos_projetam_fluxo_operacional(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.db"
            seed(path)
            docs = self.run_etl(
                path,
                "--supplier",
                "001",
                "--horizon",
                HORIZON.isoformat(),
                "--sales-cut-id",
                "corte-vendas",
                "--forecast-cut-id",
                "corte-nf",
                "--commitment-cut-id",
                "corte-cr",
            )
            self.assertEqual(len(docs), 1)
            doc = docs[0]
            self.assertEqual(doc["financialBasis"], "base_candidata")
            self.assertEqual(doc["reason"], "base_candidata")
            by_id = {r["bucketId"]: r for r in doc["rows"]}
            self.assertEqual(by_id["vencido"]["vendasRealizadasAmount"], "100.00")
            self.assertEqual(by_id["0_30"]["vendasRealizadasAmount"], "300.00")
            self.assertEqual(by_id["0_30"]["entradasFinanceirasPrevistasAmount"], "910.00")
            self.assertEqual(by_id["0_30"]["compromissosAPagarAmount"], "400.00")
            self.assertEqual(by_id["0_30"]["projectedOperationalFlowAmount"], "810.00")
            self.assertEqual(doc["totals"]["vendasRealizadasAmount"], "400.00")
            self.assertEqual(doc["totals"]["entradasFinanceirasPrevistasAmount"], "910.00")
            self.assertEqual(doc["totals"]["compromissosAPagarAmount"], "400.00")
            self.assertEqual(doc["totals"]["projectedOperationalFlowAmount"], "910.00")

    def test_tabelas_ausentes_emitem_documento_vazio_com_series(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "vazio.db"
            con = sqlite3.connect(path)
            con.execute("CREATE TABLE outra (id INTEGER)")
            con.commit()
            con.close()
            docs = self.run_etl(path, "--horizon", HORIZON.isoformat())
            self.assertEqual(docs, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
