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
import time
from datetime import date, datetime, timezone
from pathlib import Path

import psycopg

sys.path.insert(0, "/home/administrador/rms/scripts")
# O Oracle Client está instalado no servidor, mas suas dependências nativas
# precisam estar no caminho dinâmico quando o carregador é executado manualmente.
os.environ.setdefault("LD_LIBRARY_PATH", "/home/administrador/instantclient_19_25")
from run_portal_fornecedor_dados_mestres_readonly import connect  # noqa: E402

ROOT = Path("/lider/portal-fornecedor")
ENV = ROOT / ".env.postgres"
JERONIMO_LOC = (132, 450, 469, 493, 515, 523, 531, 566, 574, 582, 639, 647, 710, 736, 752, 760, 779, 809, 817, 841, 850, 868, 876, 884, 892, 906, 914, 922)


def janela_13_meses() -> tuple[int, int]:
    """Retorna o primeiro dia do mês de 12 meses atrás e o fim do mês atual."""
    hoje = date.today()
    ano = hoje.year
    mes = hoje.month - 12
    while mes <= 0:
        ano -= 1
        mes += 12
    inicio = date(ano, mes, 1)
    fim = date(hoje.year, hoje.month, calendar.monthrange(hoje.year, hoje.month)[1])
    return int(inicio.strftime("1%y%m%d")), int(fim.strftime("1%y%m%d"))


INICIO_RMS, FIM_RMS = janela_13_meses()
SQL_TEMPLATE = """
SELECT f.DIG_DATA, f.DIG_LOJA, f.DIG_NUM_NFF_PDV, f.DIG_SERIE, f.DIG_COD_ITEM,
       i.GIT_COD_FOR, i.GIT_DESCRICAO,
       SUM(f.DIG_QTD_FAT), SUM(f.DIG_QTD_FAT * NVL(f.DIG_PRECO, 0)), COUNT(*)
FROM RMS.AG1CDFAT f
JOIN RMS.AA3CITEM i ON i.GIT_COD_ITEM = f.DIG_COD_ITEM
WHERE f.DIG_AGENDA = 520
  AND f.DIG_DATA BETWEEN {inicio} AND {fim}
  AND f.DIG_LOJA NOT IN ({locais})
GROUP BY f.DIG_DATA, f.DIG_LOJA, f.DIG_NUM_NFF_PDV, f.DIG_SERIE,
         f.DIG_COD_ITEM, i.GIT_COD_FOR, i.GIT_DESCRICAO
"""


def janelas_rms_13_meses() -> list[tuple[int, int]]:
    hoje = date.today()
    atual = hoje.year * 12 + hoje.month - 1
    janelas: list[tuple[int, int]] = []
    for deslocamento in range(12, -1, -1):
        ano, mes_zero = divmod(atual - deslocamento, 12)
        mes = mes_zero + 1
        inicio = date(ano, mes, 1)
        fim = date(ano, mes, calendar.monthrange(ano, mes)[1])
        janelas.append((int(inicio.strftime("1%y%m%d")), int(fim.strftime("1%y%m%d"))))
    return janelas


def dias_rms_13_meses() -> list[tuple[int, int]]:
    inicio_rms, fim_rms = janelas_rms_13_meses()[0][0], janelas_rms_13_meses()[-1][1]
    inicio = date(2000 + int(str(inicio_rms)[1:3]), int(str(inicio_rms)[3:5]), int(str(inicio_rms)[5:7]))
    fim = date(2000 + int(str(fim_rms)[1:3]), int(str(fim_rms)[3:5]), int(str(fim_rms)[5:7]))
    dias: list[tuple[int, int]] = []
    atual = inicio
    while atual <= fim:
        encoded = int(atual.strftime("1%y%m%d"))
        dias.append((encoded, encoded))
        atual = date.fromordinal(atual.toordinal() + 1)
    return dias


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
    for inicio, fim in dias_rms_13_meses():
        # O Resource Manager do Oracle encerra sessões que acumulam muitas
        # consultas de histórico. Uma sessão curta por dia evita que uma
        # consulta válida seja interrompida por ORA-00028.
        print(f"consulta_dia={inicio}", flush=True)
        for tentativa in range(1, 4):
            oracle = None
            try:
                oracle = connect()
                cursor = oracle.cursor()
                cursor.arraysize = 10_000
                cursor.execute(SQL_TEMPLATE.format(
                    inicio=inicio,
                    fim=fim,
                    locais=", ".join(str(item) for item in JERONIMO_LOC),
                ))
                linhas_dia = []
                while rows := cursor.fetchmany(10_000):
                    linhas_dia.extend(rows)
                for raw_date, store, nota, serie, item, supplier, description, quantity, amount, occurrences in linhas_dia:
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
                        str(supplier_n), str(store_n), f"Loja {store_n}",
                        str(nota).strip() if nota is not None else "",
                        str(serie).strip() if serie is not None else "", sku,
                        (description or "").strip() or f"PRODUTO {sku}", qty,
                        round(total / qty, 4) if qty else 0.0, round(total, 2), day,
                        int(occurrences or 0),
                    )
                break
            except Exception:
                if tentativa == 3:
                    raise
                time.sleep(2)
            finally:
                try:
                    if oracle is not None:
                        oracle.close()
                except Exception:
                    pass


DDL = """
CREATE TABLE IF NOT EXISTS perdas_rms_520_canonicas (
  loteCarga TEXT NOT NULL, fornecedorCodigo TEXT NOT NULL, lojaId TEXT NOT NULL,
  lojaNome TEXT NOT NULL, sku TEXT NOT NULL, produtoDescricao TEXT NOT NULL,
  numeroNota TEXT NOT NULL, serie TEXT NOT NULL,
  quantidade DOUBLE PRECISION NOT NULL, valorUnitario DOUBLE PRECISION NOT NULL,
  valorTotal DOUBLE PRECISION NOT NULL, data TEXT NOT NULL, ocorrencias INTEGER NOT NULL,
  carregadoEm TEXT NOT NULL,
  PRIMARY KEY (loteCarga, fornecedorCodigo, lojaId, numeroNota, serie, sku, data)
);
CREATE INDEX IF NOT EXISTS idx_perdas_520_canonicas_fornecedor
  ON perdas_rms_520_canonicas (loteCarga, fornecedorCodigo, data);
CREATE TABLE IF NOT EXISTS perdas_rms_520_controle (
  chave TEXT PRIMARY KEY, loteCarga TEXT NOT NULL, registros INTEGER NOT NULL,
  origem TEXT NOT NULL, atualizadoEm TEXT NOT NULL
);
ALTER TABLE perdas_rms_520_canonicas ADD COLUMN IF NOT EXISTS numeronota TEXT NOT NULL DEFAULT '';
ALTER TABLE perdas_rms_520_canonicas ADD COLUMN IF NOT EXISTS serie TEXT NOT NULL DEFAULT '';
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="grava novo lote canônico")
    args = parser.parse_args()
    print(f"janela_13_meses={INICIO_RMS}-{FIM_RMS}")
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
                   (lotecarga, fornecedorcodigo, lojaid, lojanome, numeronota, serie,
                    sku, produtodescricao, quantidade, valorunitario, valortotal, data,
                    ocorrencias, carregadoem)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                [(lot, *row, now) for row in rows],
            )
            cur.execute("SELECT COUNT(*) FROM perdas_rms_520_canonicas WHERE lotecarga = %s", (lot,))
            inserted = cur.fetchone()[0]
            if inserted != len(rows):
                raise RuntimeError(f"lote incompleto: RMS={len(rows)} PostgreSQL={inserted}")
            cur.execute(
                """INSERT INTO perdas_rms_520_controle (chave, lotecarga, registros, origem, atualizadoem)
                   VALUES ('ativo', %s, %s, 'RMS Agenda 520', %s)
                   ON CONFLICT (chave) DO UPDATE SET lotecarga = EXCLUDED.lotecarga,
                     registros = EXCLUDED.registros, origem = EXCLUDED.origem, atualizadoem = EXCLUDED.atualizadoem""",
                (lot, inserted, now),
            )
    print(f"lote_canonico={lot} registros={inserted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
