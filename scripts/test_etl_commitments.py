#!/usr/bin/env python3
"""Smoke test do ETL candidato de compromissos (sem acesso a redes/credenciais).

Cria um SQLite temporario com a tabela contas_receber, executa
etl_commitments.py em modo somente-leitura e confere o agregado JSON emitido.
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
SCRIPT = ROOT / "scripts" / "etl_commitments.py"

HORIZON = date(2026, 9, 17)  # 2026-09-17


def d(offset_days: int) -> str:
    return (HORIZON + timedelta(days=offset_days)).isoformat()


def seed(db_path: Path) -> None:
    con = sqlite3.connect(db_path)
    con.execute(
        """
        CREATE TABLE contas_receber (
          id TEXT PRIMARY KEY,
          fornecedorCodigo TEXT NOT NULL,
          vencimento TEXT,
          valor REAL,
          status TEXT
        )
        """
    )
    con.executemany(
        "INSERT INTO contas_receber (id, fornecedorCodigo, vencimento, valor, status) "
        "VALUES (?, ?, ?, ?, ?)",
        [
            ("a", "001", d(-7), 100.0, "Aberto"),
            ("b", "001", d(0), 200.0, "Programado"),
            ("c", "001", d(35), 300.0, "Aberto"),
            ("d", "001", d(75), 400.0, "Programado"),
            ("e", "001", d(120), 500.0, "Aberto"),
            ("f", "001", d(250), 600.0, "Programado"),
            ("g", "002", d(0), 9999.0, "Aberto"),
            ("h", "001", d(0), 42.0, "Descontado"),
        ],
    )
    con.commit()
    con.close()


class EtlCommitmentsTest(unittest.TestCase):
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
        proc = subprocess.run([sys.executable, str(SCRIPT)], cwd=ROOT, capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("sqlite", proc.stderr.lower())

    def test_agrega_compromissos_por_fornecedor_e_faixa(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.db"
            seed(path)
            docs = self.run_etl(path, "--supplier", "001", "--horizon", HORIZON.isoformat())
            self.assertEqual(len(docs), 1)
            doc = docs[0]
            self.assertEqual(doc["supplierCode"], "001")
            self.assertEqual(doc["internalOnly"], True)
            self.assertEqual(doc["writesToErp"], False)
            self.assertEqual(doc["homologationStatus"], "candidato")
            self.assertEqual(doc["financialBasis"], "sem_base_financeira")
            self.assertEqual(doc["reason"], "corte_ausente")
            self.assertEqual(
                doc["disclaimer"],
                "Agregado de compromissos a pagar apenas. Sem reserva financeira, saldo ou custo de capital. "
                "Interno para comprador autorizado; nunca exposto a fornecedor ou AppCom.",
            )
            by_id = {r["bucketId"]: r for r in doc["rows"]}
            self.assertEqual(by_id["vencido"]["statusAbertoAmount"], "100.00")
            self.assertEqual(by_id["0_30"]["statusProgramadoAmount"], "200.00")
            self.assertEqual(by_id["31_60"]["statusAbertoAmount"], "300.00")
            self.assertEqual(by_id["61_90"]["statusProgramadoAmount"], "400.00")
            self.assertEqual(by_id["91_180"]["statusAbertoAmount"], "500.00")
            self.assertEqual(by_id["181_mais"]["statusProgramadoAmount"], "600.00")
            self.assertEqual(doc["totals"]["totalAmount"], "2100.00")
            self.assertEqual(doc["totals"]["rowCount"], 6)
            self.assertNotIn("reserva", doc)
            self.assertNotIn("saldo", doc)
            self.assertNotIn("custoCapital", doc)

    def test_tabela_ausente_emite_lista_vazia(self) -> None:
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
