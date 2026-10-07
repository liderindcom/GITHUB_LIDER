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
import oracledb

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
SELECT i.I_AG520_DTAGEN, i.I_AG520_CODFORN, i.I_AG520_FORNECEDOR,
       i.I_AG520_CODORIG, i.I_AG520_NFISCAL, i.I_AG520_SERIE,
       TO_NUMBER(i.I_AG520_CODIGO || i.I_AG520_DIGITO), i.I_AG520_DESCRICAO,
       MAX(TRIM(n.N_AG520_ORIGEM)),
       SUM(i.I_AG520_QTDE), SUM(i.I_AG520_CUSTO), SUM(i.I_AG520_SUBTOTAL), COUNT(*)
FROM CONSULTA.TB_AG520_ITENS i
LEFT JOIN CONSULTA.TB_AG520_NF n
  ON n.N_AG520_DTAGEN = i.I_AG520_DTAGEN
 AND n.N_AG520_NFISCAL = i.I_AG520_NFISCAL
 AND n.N_AG520_SERIE = i.I_AG520_SERIE
 AND n.N_AG520_CODFORN = i.I_AG520_CODFORN
 AND n.N_AG520_CODORIG = i.I_AG520_CODORIG
WHERE i.I_AG520_AGENDA = 520
  AND i.I_AG520_DTAGEN BETWEEN {inicio} AND {fim}
GROUP BY i.I_AG520_DTAGEN, i.I_AG520_CODFORN, i.I_AG520_FORNECEDOR,
         i.I_AG520_CODORIG, i.I_AG520_NFISCAL, i.I_AG520_SERIE,
         i.I_AG520_CODIGO, i.I_AG520_DIGITO, i.I_AG520_DESCRICAO
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


def normalizar_fornecedor(raw: object) -> str:
    """TB_AG520 traz o código com dígito; o Portal usa o código fiscal base."""
    text = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(text) >= 2:
        base = text[:-1]
        peso, soma = 2, 0
        for char in reversed(base):
            soma += int(char) * peso
            peso = 2 if peso == 9 else peso + 1
        dv = 0 if soma % 11 < 2 else 11 - soma % 11
        if str(dv) == text[-1]:
            return base
    return text


def connect_cometnet():
    """Conexão de leitura usada pelo CometNet para as tabelas consolidadas."""
    try:
        oracledb.init_oracle_client(lib_dir="/home/administrador/instantclient_19_25")
    except oracledb.ProgrammingError:
        # O carregador abre uma sessão curta por dia para reduzir o impacto
        # do Resource Manager do Oracle.
        pass
    user = os.environ.get("COMETNET_ORACLE_USER")
    password = os.environ.get("COMETNET_ORACLE_PASSWORD")
    if not user or not password:
        raise RuntimeError(
            "COMETNET_ORACLE_USER e COMETNET_ORACLE_PASSWORD devem ser configurados no ambiente"
        )
    return oracledb.connect(
        user=user,
        password=password,
        host=os.environ.get("COMETNET_ORACLE_HOST", "10.15.2.26"),
        port=int(os.environ.get("COMETNET_ORACLE_PORT", "1521")),
        sid=os.environ.get("COMETNET_ORACLE_SID", "RMSPRD"),
    )


def origem():
    for inicio, fim in janelas_rms_13_meses():
        print(f"consulta_mes={inicio}-{fim}", flush=True)
        for tentativa in range(1, 4):
            oracle = None
            try:
                oracle = connect_cometnet()
                cursor = oracle.cursor()
                cursor.arraysize = 10_000
                cursor.execute(SQL_TEMPLATE.format(
                    inicio=inicio,
                    fim=fim,
                ))
                linhas_dia = []
                while rows := cursor.fetchmany(10_000):
                    linhas_dia.extend(rows)
                for raw_date, supplier, supplier_name, store, nota, serie, item, description, origin_name, quantity, unit_cost, total, occurrences in linhas_dia:
                    day = parse_rms7(raw_date)
                    if not day:
                        continue
                    try:
                        store_n = int(store)
                        supplier_n = normalizar_fornecedor(supplier)
                        sku = str(int(item)) if float(item).is_integer() else str(item).strip()
                    except (TypeError, ValueError):
                        continue
                    qty = float(quantity or 0)
                    total = float(total or 0)
                    yield (
                        supplier_n, str(store_n), (origin_name or "").strip() or f"Loja {store_n}",
                        str(nota).strip() if nota is not None else "",
                        str(serie).strip() if serie is not None else "", sku,
                        (description or "").strip() or f"PRODUTO {sku}", qty,
                        round(float(unit_cost or 0), 4), round(total, 2), day,
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
