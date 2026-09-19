#!/usr/bin/env python3
"""Carga global de vendas mensais Atlas por competência.

A origem RMS é lida somente uma vez por produto técnico/página para cada mês,
não por fornecedor. A janela máxima é de 24 competências e cada mês possui um
registro independente em sync_runs para retomada segura.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from apply_portal_estoque_venda_diaria import EPOCH, FILIAIS_VENDA, parse_int_id, sku_key
from apply_portal_refresh_fornecedor import connect_pg
from run_portal_fornecedor_dados_mestres_readonly import connect

MESES_MAXIMOS = 24
CHUNK_PADRAO = 750
PAUSA_PADRAO = 0.25


def mes_atual() -> int:
    hoje = date.today()
    return hoje.year * 100 + hoje.month


def meses_janela(fim: int, quantidade: int = MESES_MAXIMOS) -> list[int]:
    if quantidade < 1 or quantidade > MESES_MAXIMOS:
        raise ValueError("janela deve conter entre 1 e 24 competências")
    ano, mes = divmod(fim, 100)
    if mes < 1 or mes > 12:
        raise ValueError("competência inválida; use YYYYMM")
    resultado: list[int] = []
    for _ in range(quantidade):
        resultado.append(ano * 100 + mes)
        mes -= 1
        if mes == 0:
            ano -= 1
            mes = 12
    return list(reversed(resultado))


def ano_mes(id_mes: int) -> str:
    return f"{id_mes // 100:04d}-{id_mes % 100:02d}"


def iniciar(pg, competencia: int, total_produtos: int, chunk: int, corte: date) -> int:
    metadata = {
        "modo": "global_por_tabela",
        "tabela_origem": "RMS.AGG_VDA_PROD" if competencia == corte.year * 100 + corte.month else "RMS.AGG_VDA_PROD_MES",
        "competencia": competencia,
        "corte_inclusivo": corte.isoformat(),
        "limite_meses": MESES_MAXIMOS,
        "total_produtos": total_produtos,
        "chunk_produtos": chunk,
    }
    checksum = hashlib.sha256(json.dumps(metadata, sort_keys=True).encode()).hexdigest()
    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_runs (
              source_system, job_name, period_type, period_value, status, source_checksum, metadata
            ) VALUES (%s,%s,%s,%s,'started',%s,%s::jsonb)
            RETURNING id
            """,
            ("rms", "atlas_vendas_mensal_global", "month", ano_mes(competencia), checksum, json.dumps(metadata)),
        )
        run_id = int(cur.fetchone()[0])
    pg.commit()
    return run_id


def finalizar(pg, run_id: int, status: str, lidas: int, gravadas: int, erro: BaseException | None = None) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            UPDATE sync_runs
               SET finished_at=now(), status=%s, rows_read=%s, rows_written=%s,
                   error_code=%s, error_message=%s
             WHERE id=%s
            """,
            (status, max(0, lidas), max(0, gravadas), type(erro).__name__ if erro else None, str(erro)[:1000] if erro else None, run_id),
        )
    pg.commit()


def paginas_produtos(pg, chunk: int):
    ultimo = ""
    while True:
        with pg.cursor() as cur:
            cur.execute(
                """
                SELECT sku, codigoprodutorms, digitoprodutorms, fornecedorcodigo
                  FROM produtos
                 WHERE sku > %s
                 ORDER BY sku
                 LIMIT %s
                """,
                (ultimo, chunk),
            )
            linhas = cur.fetchall()
        if not linhas:
            return
        ultimo = str(linhas[-1][0])
        yield linhas


def mapa_oracle(linhas) -> tuple[list[int], dict[str, tuple[str, str]]]:
    ids: list[int] = []
    mapa: dict[str, tuple[str, str]] = {}
    vistos: set[int] = set()
    for sku, codigo_rms, digito, fornecedor in linhas:
        destino = (str(sku), str(fornecedor or ""))
        for bruto in (sku, codigo_rms):
            numero = parse_int_id(bruto)
            if numero is not None and numero not in vistos:
                vistos.add(numero)
                ids.append(numero)
                mapa[str(numero)] = destino
        if codigo_rms is not None and digito is not None and str(digito).strip():
            try:
                numero = int(str(int(float(codigo_rms))) + str(int(float(digito))))
            except (TypeError, ValueError):
                numero = None
            if numero is not None and numero not in vistos:
                vistos.add(numero)
                ids.append(numero)
                mapa[str(numero)] = destino
    return ids, mapa


def carregar_mes(ora, pg, competencia: int, corte: date, chunk: int, pausa: float, limite_chunks: int = 0) -> tuple[int, int, int]:
    competencia_texto = ano_mes(competencia)
    locais = ",".join(str(item) for item in FILIAIS_VENDA)
    cursor = ora.cursor()
    cursor.arraysize = 10000
    lidas = gravadas = paginas = 0
    for linhas in paginas_produtos(pg, chunk):
        paginas += 1
        if limite_chunks and paginas > limite_chunks:
            break
        ids, mapa = mapa_oracle(linhas)
        destino_skus = sorted({str(linha[0]) for linha in linhas})
        if not ids:
            continue
        agregados: dict[tuple[str, str], list[float]] = {}
        mes_em_aberto = competencia == corte.year * 100 + corte.month
        inicio_mes = date(corte.year, corte.month, 1)
        inicio_epoch = int((inicio_mes - EPOCH).days)
        fim_epoch = int((corte - EPOCH).days)
        # Oracle limita listas IN a 1.000 expressões. Um SKU pode gerar código,
        # código RMS e código+dígito; portanto o limite técnico é por ID, não SKU.
        for inicio_ids in range(0, len(ids), 900):
            ids_parte = ids[inicio_ids : inicio_ids + 900]
            if mes_em_aberto:
                consulta = f"""
                SELECT CD_PROD, SUM(QTD_VDA), SUM(VL_VDA)
                  FROM RMS.AGG_VDA_PROD
                 WHERE ID_DT BETWEEN {inicio_epoch} AND {fim_epoch}
                   AND CD_PROD IN ({','.join(str(item) for item in ids_parte)})
                   AND CD_FIL IN ({locais})
                   AND NVL(QTD_VDA, 0) <> 0
                 GROUP BY CD_PROD
                """
            else:
                consulta = f"""
                SELECT CD_PROD, SUM(QTD_VDA), SUM(VL_VDA)
                  FROM RMS.AGG_VDA_PROD_MES
                 WHERE ID_MES = {competencia}
                   AND CD_PROD IN ({','.join(str(item) for item in ids_parte)})
                   AND CD_FIL IN ({locais})
                   AND NVL(QTD_VDA, 0) <> 0
                 GROUP BY CD_PROD
                """
            cursor.execute(consulta)
            for produto, quantidade, valor in cursor:
                lidas += 1
                destino = mapa.get(sku_key(produto) or "")
                if not destino:
                    continue
                agregado = agregados.setdefault(destino, [0.0, 0.0])
                agregado[0] += float(quantidade or 0)
                agregado[1] += float(valor or 0)
        lote = [(sku, competencia_texto, qtd, valor, fornecedor) for (sku, fornecedor), (qtd, valor) in agregados.items()]
        with pg.cursor() as cur:
            cur.execute(
                "DELETE FROM vendas_mensal WHERE sku = ANY(%s) AND anomes=%s",
                (destino_skus, competencia_texto),
            )
            if lote:
                cur.executemany(
                    """
                    INSERT INTO vendas_mensal (sku, anomes, quantidade, valor, fornecedorcodigo)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (sku, anomes) DO UPDATE SET
                      quantidade=EXCLUDED.quantidade,
                      valor=EXCLUDED.valor,
                      fornecedorcodigo=EXCLUDED.fornecedorcodigo
                    """,
                    lote,
                )
        pg.commit()
        gravadas += len(lote)
        if paginas % 25 == 0:
            print(f"competencia={competencia_texto} paginas={paginas} lidas={lidas} gravadas={gravadas}", flush=True)
        if pausa > 0:
            time.sleep(pausa)
    return paginas, lidas, gravadas


def podar_retencao(pg) -> int:
    """Mantém somente a janela móvel canônica de 24 competências."""
    inicio = ano_mes(meses_janela(mes_atual(), MESES_MAXIMOS)[0])
    fim = ano_mes(mes_atual())
    with pg.cursor() as cur:
        cur.execute(
            "DELETE FROM vendas_mensal WHERE anomes < %s OR anomes > %s",
            (inicio, fim),
        )
        removidas = cur.rowcount or 0
    pg.commit()
    return int(removidas)


def main() -> int:
    parser = argparse.ArgumentParser(description="Carga global Atlas por competência RMS")
    grupo = parser.add_mutually_exclusive_group(required=False)
    grupo.add_argument("--mes", type=int, help="Uma competência YYYYMM")
    grupo.add_argument("--janela-24", action="store_true", help="Executa, em sequência, no máximo 24 competências")
    parser.add_argument("--fim-mes", type=int, default=0, help="Fim da janela; padrão mês atual")
    parser.add_argument("--ate", default="", help="Data de corte inclusiva YYYY-MM-DD; padrão ontem")
    parser.add_argument("--chunk", type=int, default=CHUNK_PADRAO)
    parser.add_argument("--pausa", type=float, default=PAUSA_PADRAO)
    parser.add_argument("--limite-chunks", type=int, default=0, help="Uso exclusivo para ensaio controlado")
    parser.add_argument("--preflight", action="store_true", help="Valida destino e plano sem abrir RMS")
    args = parser.parse_args()
    if args.chunk < 1 or args.chunk > 1000:
        raise SystemExit("chunk deve estar entre 1 e 1000")
    if args.pausa < 0:
        raise SystemExit("pausa não pode ser negativa")
    if args.limite_chunks < 0:
        raise SystemExit("limite-chunks não pode ser negativo")

    pg = connect_pg()
    if pg is None:
        raise SystemExit("DATABASE_URL ausente")
    with pg.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM produtos")
        total_produtos = int(cur.fetchone()[0])
        cur.execute("SELECT to_regclass('public.sync_runs')")
        tem_auditoria = cur.fetchone()[0] is not None
    corte = date.fromisoformat(args.ate) if args.ate else date.today() - timedelta(days=1)
    if corte >= date.today():
        raise SystemExit("data de corte deve ser no máximo ontem")
    fim = args.fim_mes or mes_atual()
    competencias = [args.mes] if args.mes else meses_janela(fim, MESES_MAXIMOS if args.janela_24 else 1)
    if any(comp not in meses_janela(mes_atual(), MESES_MAXIMOS) for comp in competencias):
        raise SystemExit("competência fora da janela permitida de 24 meses")
    print(f"PRE-FLIGHT produtos={total_produtos} competencias={','.join(map(str, competencias))} corte={corte.isoformat()} chunk={args.chunk} auditoria={tem_auditoria}", flush=True)
    if not tem_auditoria or args.preflight:
        pg.close()
        return 0 if tem_auditoria else 2

    for competencia in competencias:
        run_id = iniciar(pg, competencia, total_produtos, args.chunk, corte)
        erro: BaseException | None = None
        lidas = gravadas = 0
        try:
            with connect() as ora:
                paginas, lidas, gravadas = carregar_mes(ora, pg, competencia, corte, args.chunk, args.pausa, args.limite_chunks)
            podadas = podar_retencao(pg)
            print(f"OK competencia={ano_mes(competencia)} paginas={paginas} lidas={lidas} gravadas={gravadas} retencao_removidas={podadas}", flush=True)
        except BaseException as exc:
            erro = exc
            raise
        finally:
            finalizar(pg, run_id, "success" if erro is None else "failed", lidas, gravadas, erro)
    pg.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
