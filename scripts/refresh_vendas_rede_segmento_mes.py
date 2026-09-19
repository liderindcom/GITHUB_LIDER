#!/usr/bin/env python3
"""Atualiza o agregado mensal de vendas da rede por segmento.

Le somente PostgreSQL integrado; RMS nao e consultado. A troca de uma
competencia ocorre em transacao, portanto leitores observam o valor anterior
ou o novo, nunca uma tabela parcialmente preenchida.
"""
from __future__ import annotations

import argparse
from datetime import date
import sys

sys.path.insert(0, "/home/administrador/rms/scripts")
from apply_portal_refresh_fornecedor import connect_pg

MESES_MAXIMOS = 24

def mes_atual() -> int:
    hoje = date.today()
    return hoje.year * 100 + hoje.month

def ano_mes(competencia: int) -> str:
    return f"{competencia // 100:04d}-{competencia % 100:02d}"

def meses_janela(fim: int, quantidade: int = MESES_MAXIMOS) -> list[int]:
    ano, mes = divmod(fim, 100)
    resultado: list[int] = []
    for _ in range(quantidade):
        resultado.append(ano * 100 + mes)
        mes -= 1
        if mes == 0:
            ano -= 1
            mes = 12
    return list(reversed(resultado))

DDL = """
CREATE TABLE IF NOT EXISTS vendas_rede_segmento_mes (
  segmento TEXT NOT NULL,
  anomes TEXT NOT NULL,
  quantidade DOUBLE PRECISION NOT NULL DEFAULT 0,
  valor NUMERIC(18, 2) NOT NULL DEFAULT 0,
  atualizadoem TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (segmento, anomes)
);
CREATE INDEX IF NOT EXISTS idx_vendas_rede_segmento_mes_anomes
  ON vendas_rede_segmento_mes (anomes);
"""

# Regra oficial espelhada de src/lib/acordo-acesso.ts. O segmento e
# determinado pelo departamento, nao pelo fornecedor.
SEGMENTO_SQL = """
CASE regexp_replace(COALESCE(p.departamentocodigo, ''), '^0+', '')
  WHEN '100' THEN 'SUPERMERCADO' WHEN '102' THEN 'SUPERMERCADO'
  WHEN '103' THEN 'SUPERMERCADO' WHEN '105' THEN 'SUPERMERCADO'
  WHEN '600' THEN 'SUPERMERCADO' WHEN '300' THEN 'FARMALIDER'
  WHEN '110' THEN 'HOME CENTER' WHEN '115' THEN 'HOME CENTER'
  WHEN '221' THEN 'OTICA' WHEN '104' THEN 'PETSLIDER'
  WHEN '106' THEN 'NUTRILIDER'
  WHEN '201' THEN 'MAGAZAN' WHEN '203' THEN 'MAGAZAN'
  WHEN '204' THEN 'MAGAZAN' WHEN '208' THEN 'MAGAZAN'
  WHEN '209' THEN 'MAGAZAN' WHEN '212' THEN 'MAGAZAN'
  WHEN '213' THEN 'MAGAZAN' WHEN '214' THEN 'MAGAZAN'
  WHEN '215' THEN 'MAGAZAN' WHEN '216' THEN 'MAGAZAN'
  WHEN '217' THEN 'MAGAZAN' WHEN '219' THEN 'MAGAZAN'
  WHEN '222' THEN 'MAGAZAN' WHEN '226' THEN 'MAGAZAN'
  WHEN '500' THEN 'MAGAZAN'
  ELSE 'OUTROS'
END
"""

def garantir_tabela(pg) -> None:
    with pg.cursor() as cur:
        cur.execute(DDL)
    pg.commit()

JOIN_CONDICAO = """p.sku=vm.sku OR (
  length(vm.sku)>1 AND p.codigoprodutorms=substr(vm.sku, 1, length(vm.sku)-1)
  AND p.digitoprodutorms=right(vm.sku, 1)
)"""

# Uma venda corresponde a no maximo um produto: SKU exato prevalece; a
# conversao RMS+digito e apenas fallback. Sem produto vai para sentinela
# auditavel, nunca para um segmento comercial.
JOIN_CANONICO = f"""LEFT JOIN LATERAL (
  SELECT p.sku, p.departamentocodigo
    FROM produtos p
   WHERE {JOIN_CONDICAO}
   ORDER BY CASE WHEN p.sku=vm.sku THEN 0 ELSE 1 END, p.sku
   LIMIT 1
) p ON true"""

def preflight(pg, competencias: list[int]) -> tuple[int, int]:
    meses = [ano_mes(c) for c in competencias]
    with pg.cursor() as cur:
        cur.execute(
            f"""SELECT count(*), count(*) FILTER (WHERE p.sku IS NULL)
                  FROM vendas_mensal vm
                  {JOIN_CANONICO}
                 WHERE vm.anomes = ANY(%s)""",
            (meses,),
        )
        total, sem_produto = cur.fetchone()
    return int(total or 0), int(sem_produto or 0)

def atualizar_mes(pg, competencia: int) -> tuple[int, float]:
    mes = ano_mes(competencia)
    with pg.cursor() as cur:
        cur.execute("BEGIN")
        cur.execute("DELETE FROM vendas_rede_segmento_mes WHERE anomes=%s", (mes,))
        cur.execute(
            f"""INSERT INTO vendas_rede_segmento_mes
                   (segmento, anomes, quantidade, valor, atualizadoem)
                 SELECT CASE WHEN p.sku IS NULL THEN 'SEM_CLASSIFICACAO' ELSE {SEGMENTO_SQL} END, vm.anomes,
                        SUM(vm.quantidade), SUM(vm.valor), now()
                   FROM vendas_mensal vm
                   {JOIN_CANONICO}
                  WHERE vm.anomes=%s
                  GROUP BY 1, 2""",
            (mes,),
        )
        linhas = cur.rowcount or 0
        cur.execute("SELECT COALESCE(SUM(valor), 0) FROM vendas_rede_segmento_mes WHERE anomes=%s", (mes,))
        valor_agregado = float(cur.fetchone()[0] or 0)
        cur.execute(
            """SELECT COALESCE(SUM(vm.valor), 0)
                 FROM vendas_mensal vm
                WHERE vm.anomes=%s""",
            (mes,),
        )
        valor_origem = float(cur.fetchone()[0] or 0)
        if abs(valor_agregado - valor_origem) > 0.01:
            raise RuntimeError(f"divergencia de valor em {mes}: {valor_agregado} != {valor_origem}")
    pg.commit()
    return int(linhas), valor_agregado

def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument("--mes", type=int)
    group.add_argument("--janela-24", action="store_true")
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    competencias = [args.mes] if args.mes else (meses_janela(mes_atual(), MESES_MAXIMOS) if args.janela_24 else [mes_atual()])
    permitidas = set(meses_janela(mes_atual(), MESES_MAXIMOS))
    if any(c not in permitidas for c in competencias):
        raise SystemExit("competencia fora da janela de 24 meses")
    pg = connect_pg()
    if pg is None:
        raise SystemExit("DATABASE_URL ausente")
    total, sem_produto = preflight(pg, competencias)
    print(f"PRE-FLIGHT competencias={','.join(map(str, competencias))} vendas={total} sem_classificacao={sem_produto}", flush=True)
    if args.preflight:
        return 0
    garantir_tabela(pg)
    for competencia in competencias:
        linhas, valor = atualizar_mes(pg, competencia)
        print(f"OK competencia={ano_mes(competencia)} segmentos={linhas} valor={valor:.2f}", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
