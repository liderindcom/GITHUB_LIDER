#!/usr/bin/env python3
"""Carrega ofertas de validade oficiais do CometNet para o PostgreSQL do Portal.

A origem e' a consulta de leitura ``ProdutoValidadeServlet/listProdutoValidade``.
O script nunca cria, altera ou fecha ofertas no CometNet: apenas espelha os
registros retornados para ``ofertas_intelider`` depois de conciliar produto e
fornecedor pelo cadastro canônico do Portal.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from portal_db import connect_portal  # noqa: E402

ENDPOINT = "http://intelider.lidernet.com.br:8587/ModuloCometNet/ProdutoValidadeServlet"
ORIGEM = "cometnet_produto_validade"


def decimal(value: object) -> float:
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    raw = str(value or "").strip()
    if not raw:
        return 0.0
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(Decimal(raw))
    except InvalidOperation:
        return 0.0


def data_cometnet(value: object) -> str | None:
    raw = str(value or "").strip()
    if not raw or raw in {"0", "0.0"}:
        return None
    if "/" in raw:
        try:
            return datetime.strptime(raw.split()[0], "%d/%m/%Y").date().isoformat()
        except ValueError:
            return None
    digits = "".join(char for char in raw if char.isdigit())
    if len(digits) == 7 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 6:
        try:
            return datetime.strptime(digits, "%y%m%d").date().isoformat()
        except ValueError:
            return None
    return None


def buscar_validade(loja: str, movimento: str, endpoint: str) -> list[dict[str, object]]:
    body = json.dumps({"acao": "listProdutoValidade", "filial": int(loja), "dtmovimento": movimento}).encode()
    request = Request(endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=30) as response:  # nosec B310 - endpoint operacional fixo e read-only
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"CometNet indisponível para filial {loja}: {error}") from error
    if not isinstance(payload, list):
        raise RuntimeError(f"Resposta inesperada do CometNet para filial {loja}")
    return [row for row in payload if isinstance(row, dict) and str(row.get("VLOF_CODPROD") or "").strip()]


def garantir_tabela(con) -> None:
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS ofertas_intelider (
          id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('validade', 'rebaixa')),
          fornecedorCodigo TEXT NOT NULL, sku TEXT NOT NULL, descricao TEXT NOT NULL,
          lojaId TEXT NOT NULL, lojaNome TEXT NOT NULL, precoNormal REAL NOT NULL DEFAULT 0,
          precoOferta REAL NOT NULL DEFAULT 0, descontoPercentual REAL NOT NULL DEFAULT 0,
          dataInicio TEXT, dataFim TEXT, dataVencimento TEXT, quantidadeInicial REAL NOT NULL DEFAULT 0,
          quantidadeVendida REAL NOT NULL DEFAULT 0, estoqueAtual REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Ativa', responsabilidade TEXT NOT NULL DEFAULT 'indefinida',
          reembolsoEstimado REAL NOT NULL DEFAULT 0, origemTabela TEXT NOT NULL, atualizadoEm TEXT NOT NULL
        )
        """
    )
    con.execute(
        "CREATE INDEX IF NOT EXISTS idx_ofertas_intelider_forn_tipo ON ofertas_intelider (fornecedorCodigo, tipo, dataFim)"
    )


def produto_portal(con, codigo_com_dv: str) -> dict[str, object] | None:
    return con.execute(
        """
        SELECT sku, fornecedorCodigo
        FROM produtos
        WHERE concat(codigoProdutoRms, digitoProdutoRms) = %s
        LIMIT 1
        """,
        (codigo_com_dv,),
    ).fetchone()


def quantidade_vendida(con, loja: str, sku: str, inicio: str | None, fim: str | None) -> float:
    if not inicio or not fim:
        return 0.0
    row = con.execute(
        """
        SELECT COALESCE(SUM(quantidade), 0) AS quantidade
        FROM vendas
        WHERE lojaId = %s AND sku = %s AND data >= %s AND data <= %s
        """,
        (loja, sku, inicio, fim),
    ).fetchone()
    return float(row["quantidade"] or 0) if row else 0.0


def status_oferta(inicio: str | None, fim: str | None, referencia: date) -> str:
    if fim and fim < referencia.isoformat():
        return "Expirada"
    if inicio and inicio > referencia.isoformat():
        return "Próxima ao Fim"
    return "Ativa"


def importar(lojas: list[str], movimento: str, endpoint: str, dry_run: bool) -> dict[str, int]:
    con = connect_portal()
    stats = {"consultados": 0, "conciliados": 0, "ignorados_sem_fornecedor": 0, "gravados": 0}
    agora = datetime.now().astimezone().isoformat(timespec="seconds")
    try:
        garantir_tabela(con)
        for loja in lojas:
            registros = buscar_validade(loja, movimento, endpoint)
            stats["consultados"] += len(registros)
            linhas: list[tuple[object, ...]] = []
            for item in registros:
                produto = produto_portal(con, str(item.get("VLOF_CODPROD") or ""))
                if not produto:
                    stats["ignorados_sem_fornecedor"] += 1
                    continue
                inicio = data_cometnet(item.get("VLOF_OFER_DTA_INI"))
                fim = data_cometnet(item.get("VLOF_OFER_DTA_FIM"))
                qtd_inicial = decimal(item.get("VLOF_QTDE"))
                vendido = quantidade_vendida(con, loja, str(produto["sku"]), inicio, fim)
                preco_normal = decimal(item.get("VLOF_PRC_VENDA_VIGENT") or item.get("VLOF_PRC_VENDA"))
                preco_oferta = decimal(item.get("VLOF_OFER_PRECO"))
                desconto = ((preco_normal - preco_oferta) / preco_normal * 100) if preco_normal else 0.0
                stable = f"{ORIGEM}:{movimento}:{loja}:{item['VLOF_CODPROD']}"
                oferta_id = hashlib.sha256(stable.encode()).hexdigest()[:32]
                linhas.append(
                    (
                        oferta_id, "validade", str(produto["fornecedorcodigo"]), str(produto["sku"]),
                        str(item.get("VLOF_DESC_PROD") or "").strip(), loja, f"Filial {loja}", preco_normal,
                        preco_oferta, desconto, inicio, fim, data_cometnet(item.get("VLOF_DTVALID")),
                        qtd_inicial, vendido, max(0.0, qtd_inicial - vendido),
                        status_oferta(inicio, fim, date.today()), "indefinida", 0.0, ORIGEM, agora,
                    )
                )
            stats["conciliados"] += len(linhas)
            if dry_run or not linhas:
                continue
            con.execute("DELETE FROM ofertas_intelider WHERE origemTabela = %s AND lojaId = %s AND id = ANY(%s)", (ORIGEM, loja, [row[0] for row in linhas]))
            with con.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO ofertas_intelider (
                      id, tipo, fornecedorCodigo, sku, descricao, lojaId, lojaNome, precoNormal, precoOferta,
                      descontoPercentual, dataInicio, dataFim, dataVencimento, quantidadeInicial, quantidadeVendida,
                      estoqueAtual, status, responsabilidade, reembolsoEstimado, origemTabela, atualizadoEm
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    linhas,
                )
            stats["gravados"] += len(linhas)
        if dry_run:
            con.rollback()
        else:
            con.commit()
        return stats
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loja", action="append", required=True, help="Código da filial; repita para mais de uma")
    parser.add_argument("--movimento", required=True, help="Data do movimento no formato AAAA-MM-DD")
    parser.add_argument("--endpoint", default=ENDPOINT, help="Endpoint oficial de leitura do CometNet")
    parser.add_argument("--dry-run", action="store_true", help="Consulta e concilia sem gravar")
    args = parser.parse_args()
    movimento = datetime.strptime(args.movimento, "%Y-%m-%d").strftime("%d/%m/%Y")
    resultado = importar(args.loja, movimento, args.endpoint, args.dry_run)
    print(json.dumps({"movimento": movimento, "dry_run": args.dry_run, **resultado}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
