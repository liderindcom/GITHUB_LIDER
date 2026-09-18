import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/server/db";

export const Route = createFileRoute("/api/atlas/carteira")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const buyer = new URL(request.url).searchParams.get("buyer")?.trim().slice(0, 50) ?? "";
        if (!buyer)
          return Response.json(
            { items: [], source: "atlas_postgresql" },
            { headers: { "cache-control": "no-store" } },
          );
        const rows = db
          .prepare(
            `
      WITH catalogo AS (
        SELECT btrim(fornecedorCodigo) fornecedor, count(DISTINCT sku) skus
        FROM produtos WHERE compradorCodigo=? AND COALESCE(emlinha,0)=1 GROUP BY btrim(fornecedorCodigo)
      ), estoque_forn AS (
        SELECT btrim(p.fornecedorCodigo) fornecedor, count(e.sku) posicoes,
               COALESCE(sum(e.estoqueAtual),0) estoque, COALESCE(sum(e.saidaMedia),0) saida_dia
        FROM produtos p LEFT JOIN estoque e ON e.sku=p.sku
        WHERE p.compradorCodigo=? AND COALESCE(p.emlinha,0)=1 GROUP BY btrim(p.fornecedorCodigo)
      ), vendas AS (
        SELECT btrim(p.fornecedorCodigo) fornecedor, count(vm.sku) registros,
          COALESCE(sum(CASE WHEN vm.anoMes=(SELECT max(anoMes) FROM vendas_mensal WHERE anoMes < to_char(current_date,'YYYY-MM')) THEN vm.valor END),0) venda,
          COALESCE(sum(CASE WHEN vm.anoMes=(SELECT to_char((date_trunc('month',current_date)-interval '13 month'),'YYYY-MM')) THEN vm.valor END),0) farol_base
        FROM produtos p LEFT JOIN vendas_mensal vm ON vm.sku=p.sku
        WHERE p.compradorCodigo=? AND COALESCE(p.emlinha,0)=1 GROUP BY btrim(p.fornecedorCodigo)
      ), pendente AS (
        SELECT btrim(pi.fornecedorCodigo) fornecedor,
               COALESCE(sum(GREATEST(pi.quantidadepedida-pi.quantidadefaturada,0)),0) quantidade
        FROM pedido_itens pi
        JOIN produtos p ON p.sku=pi.sku AND btrim(p.fornecedorCodigo)=btrim(pi.fornecedorCodigo)
        WHERE p.compradorCodigo=? AND COALESCE(p.emlinha,0)=1
        GROUP BY btrim(pi.fornecedorCodigo)
      )
      SELECT c.fornecedor AS "supplierCode", f.nome AS "displayName", c.skus,
        CASE WHEN v.registros>0 THEN v.venda ELSE NULL END AS venda,
        CASE WHEN v.registros>0 AND v.farol_base>0 THEN v.venda/v.farol_base ELSE NULL END AS farol,
        CASE WHEN e.posicoes>0 THEN e.estoque ELSE NULL END AS "stockCurrent",
        CASE WHEN e.posicoes>0 THEN e.saida_dia ELSE NULL END AS "dailySales",
        CASE WHEN e.posicoes>0 AND e.saida_dia>0 THEN e.estoque/e.saida_dia ELSE NULL END AS "coverageDays",
        CASE WHEN e.posicoes>0 AND e.saida_dia>0 THEN e.saida_dia*30 ELSE NULL END AS "stockIdeal",
        e.posicoes AS "stockPositions", v.registros AS "salesRecords",
        COALESCE(pe.quantidade,0) AS "pendingQuantity", 'complete' AS "qualityStatus"
      FROM catalogo c
      JOIN fornecedores f ON btrim(f.codigo)=c.fornecedor AND NULLIF(btrim(f.nome),'') IS NOT NULL
      JOIN estoque_forn e ON e.fornecedor=c.fornecedor JOIN vendas v ON v.fornecedor=c.fornecedor
      LEFT JOIN pendente pe ON pe.fornecedor=c.fornecedor
      ORDER BY CASE WHEN e.saida_dia>0 THEN e.estoque/e.saida_dia END NULLS LAST, lower(f.nome) LIMIT 100
    `,
          )
          .all(buyer, buyer, buyer, buyer) as unknown[];
        return Response.json(
          {
            items: rows,
            source: "atlas_postgresql",
            formula: "cobertura=estoque/saída média; ideal=30 dias de saída média",
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
