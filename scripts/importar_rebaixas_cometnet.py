#!/usr/bin/env python3
"""Espelha rebaixas ativas do CometNet no PostgreSQL do Portal, somente leitura."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from importar_ofertas_validade_cometnet import data_cometnet, decimal, garantir_tabela  # noqa: E402
from portal_db import connect_portal  # noqa: E402

ENDPOINT = "http://intelider.lidernet.com.br:8587/ModuloCometNet/RebaixaServlet"
ORIGEM = "cometnet_rebaixa"


def consulta(payload: dict[str, object], endpoint: str) -> list[dict[str, object]]:
    request = Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:  # nosec B310 - endpoint oficial fixo, leitura apenas
            # O CometNet legado responde em ISO-8859-1 apesar de não declarar charset.
            data = json.loads(response.read().decode("latin-1"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"CometNet indisponível em {payload['acao']}: {error}") from error
    if not isinstance(data, list):
        raise RuntimeError(f"Resposta inesperada em {payload['acao']}")
    return [row for row in data if isinstance(row, dict)]


def produto(con, codigo_com_dv: object) -> dict[str, object] | None:
    return con.execute(
        "SELECT sku, fornecedorCodigo FROM produtos WHERE concat(codigoProdutoRms, digitoProdutoRms) = %s LIMIT 1",
        (str(codigo_com_dv),),
    ).fetchone()


def capa_ativa(capa: dict[str, object], referencia: date) -> bool:
    inicio = data_cometnet(capa.get("DTINICIAL"))
    fim = data_cometnet(capa.get("DTFINAL"))
    return bool(inicio and fim and inicio <= referencia.isoformat() <= fim)


def obter_itens(capa: dict[str, object], endpoint: str) -> tuple[dict[str, object], list[dict[str, object]]]:
    numero = int(capa["NUM_REBAIXA"])
    return capa, consulta({"acao": "listaRebaixaItensPorCapa", "num_rebaixa": numero}, endpoint)


def obter_filiais(numero: int, codigo_produto: object, endpoint: str) -> tuple[str, list[dict[str, object]]]:
    codigo = str(codigo_produto)
    return codigo, consulta(
        {"acao": "listaRebaixaItensFilial", "num_rebaixa": numero, "item": codigo_produto}, endpoint
    )


def importar(mes: str, endpoint: str, referencia: date, dry_run: bool) -> dict[str, int]:
    capas = consulta(
        {"acao": "listRebaixaCapa", "num_rebaixa": 0, "usuario": "oscar", "anomes": mes, "isTodos": True},
        endpoint,
    )
    ativas = [capa for capa in capas if capa_ativa(capa, referencia)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        conjuntos = list(pool.map(lambda capa: obter_itens(capa, endpoint), ativas))

    detalhes: list[tuple[dict[str, object], dict[str, object], list[dict[str, object]]]] = []
    tarefas: list[tuple[int, dict[str, object]]] = []
    for capa, itens in conjuntos:
        for item in itens:
            if item.get("CODPROD"):
                tarefas.append((int(capa["NUM_REBAIXA"]), item))
    with ThreadPoolExecutor(max_workers=6) as pool:
        filiais_resultado = list(pool.map(lambda task: obter_filiais(task[0], task[1]["CODPROD"], endpoint), tarefas))
    filiais_por_item = {(numero, codigo): filiais for (numero, item), (codigo, filiais) in zip(tarefas, filiais_resultado)}

    con = connect_portal()
    stats = {"capas_consultadas": len(capas), "capas_ativas": len(ativas), "itens": 0, "linhas": 0, "ignorados_sem_fornecedor": 0}
    agora = datetime.now().astimezone().isoformat(timespec="seconds")
    linhas: list[tuple[object, ...]] = []
    try:
        garantir_tabela(con)
        for capa, itens in conjuntos:
            inicio = data_cometnet(capa.get("DTINICIAL"))
            fim = data_cometnet(capa.get("DTFINAL"))
            numero = int(capa["NUM_REBAIXA"])
            for item in itens:
                stats["itens"] += 1
                codigo = item.get("CODPROD")
                cadastro = produto(con, codigo)
                if not cadastro:
                    stats["ignorados_sem_fornecedor"] += 1
                    continue
                filiais = filiais_por_item.get((numero, str(codigo)), [])
                for filial in filiais:
                    loja = str(filial.get("CODFIL") or "").strip()
                    if not loja:
                        continue
                    preco_normal = decimal(item.get("VENDA_VIG") or item.get("VENDA_ATUAL"))
                    preco_oferta = decimal(item.get("OFER_PRECO"))
                    desconto = ((preco_normal - preco_oferta) / preco_normal * 100) if preco_normal else 0.0
                    chave = f"{ORIGEM}:{numero}:{codigo}:{loja}"
                    linhas.append(
                        (
                            hashlib.sha256(chave.encode()).hexdigest()[:32], "rebaixa", str(cadastro["fornecedorcodigo"]),
                            str(cadastro["sku"]), str(item.get("DESCPROD") or "").strip(), loja, f"Filial {loja}",
                            preco_normal, preco_oferta, desconto, inicio, fim, None,
                            # QTD_VENDA e TOTAL_REBAIXA são agregados da rede; a origem não os reparte por filial.
                            0.0, 0.0, 0.0, "Ativa", "indefinida", 0.0, ORIGEM, agora,
                        )
                    )
        stats["linhas"] = len(linhas)
        if dry_run:
            con.rollback()
            return stats
        # A substituição ocorre somente depois de todas as chamadas de origem concluírem.
        con.execute("DELETE FROM ofertas_intelider WHERE origemTabela = %s", (ORIGEM,))
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
        con.commit()
        return stats
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mes", default=date.today().strftime("%m/%Y"), help="Mês CometNet MM/AAAA")
    parser.add_argument("--referencia", default=date.today().isoformat(), help="Data de vigência AAAA-MM-DD")
    parser.add_argument("--endpoint", default=ENDPOINT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    resultado = importar(args.mes, args.endpoint, date.fromisoformat(args.referencia), args.dry_run)
    print(json.dumps({"mes": args.mes, "referencia": args.referencia, "dry_run": args.dry_run, **resultado}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
