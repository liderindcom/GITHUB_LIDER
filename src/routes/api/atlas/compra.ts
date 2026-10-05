import { createFileRoute } from "@tanstack/react-router";

import { db } from "@/server/db";

type ItemCompra = {
  sku: string;
  descricao: string;
  ean: string | null;
  abc: string | null;
  sistematica: string | null;
  embalagemCompra: number | null;
  tipoEmbalagemCompra: string | null;
  precoTabela: number | null;
  cmvUnit: number | null;
  precoOferta: number | null;
  ofertaVigente: number | null;
  precoMinSubgrupo: number | null;
  precoMaxSubgrupo: number | null;
  precoFaixa2: number | null;
  precoFaixa3: number | null;
  qtdAtacado: number | null;
  margemCadastrada: number | null;
  custoUltimaEntrada: number | null;
  custoUltimaEntradaBruto: number | null;
};

type EstoqueOperacional = {
  posicoes: number;
  filiais: number;
  estoqueTotal: number;
  saidaMediaTotal: number;
  coberturaDias: number | null;
};

type PedidoPendente = {
  pedidos: number;
  quantidadePedida: number;
  quantidadeFaturada: number;
  pendenciaTotal: number;
  precoMedioPedido: number | null;
};

type FluxoOperacionalCompacto = {
  stockQuantity: number | null;
  averageSalesQuantity: number | null;
  pendingQuantity: number | null;
  operationalBalanceQuantity: number | null;
  coverageDays: number | null;
  sourceQualityStatus: string;
  operationalStatus: string;
  financialBaseStatus: "SEM_BASE_FINANCEIRA";
  asOfTs: string;
};

export const Route = createFileRoute("/api/atlas/compra")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const fornecedorCodigo = (url.searchParams.get("fornecedorCodigo") ?? "")
          .trim()
          .slice(0, 50);
        const compradorCodigo = (url.searchParams.get("buyer") ?? "").trim().slice(0, 50);
        const skuSolicitado = (url.searchParams.get("sku") ?? "").trim().slice(0, 80);
        if (!fornecedorCodigo || !compradorCodigo) {
          return Response.json(
            { error: "fornecedorCodigo e buyer são obrigatórios." },
            { status: 400 },
          );
        }

        const fornecedor = db
          .prepare(
            `
          SELECT codigo, nome
            FROM fornecedores
           WHERE btrim(codigo) = ? AND NULLIF(btrim(nome), '') IS NOT NULL
           LIMIT 1
        `,
          )
          .get(fornecedorCodigo) as { codigo: string; nome: string } | undefined;
        if (!fornecedor) {
          return Response.json(
            { error: "Fornecedor não encontrado na carga atual." },
            { status: 404 },
          );
        }

        const items = db
          .prepare(
            `
          SELECT sku, descricao, ean, abc, sistematica,
                 embalagemCompra AS "embalagemCompra", tipoEmbalagemCompra AS "tipoEmbalagemCompra",
                 precoTabela AS "precoTabela", cmvUnit AS "cmvUnit", precoOferta AS "precoOferta",
                 ofertaVigente AS "ofertaVigente", precoMinSubgrupo AS "precoMinSubgrupo",
                 precoMaxSubgrupo AS "precoMaxSubgrupo", precoFaixa2 AS "precoFaixa2",
                 precoFaixa3 AS "precoFaixa3", qtdAtacado AS "qtdAtacado",
                 margemCadastrada AS "margemCadastrada", custoUltimaEntrada AS "custoUltimaEntrada",
                 custoUltimaEntradaBruto AS "custoUltimaEntradaBruto"
            FROM produtos
           WHERE btrim(fornecedorCodigo)=? AND compradorCodigo=? AND COALESCE(emlinha,0)=1
           ORDER BY lower(descricao), sku LIMIT 1000
        `,
          )
          .all(fornecedorCodigo, compradorCodigo) as ItemCompra[];
        if (!items.length) {
          return Response.json(
            { error: "Nenhum produto em linha encontrado para esta carteira." },
            { status: 404 },
          );
        }

        const produto = items.find((item) => item.sku === skuSolicitado) ?? items[0];
        if (!produto) {
          return Response.json(
            { error: "Nenhum produto em linha encontrado para esta carteira." },
            { status: 404 },
          );
        }
        const estoque = db
          .prepare(
            `
          SELECT count(*) AS posicoes, count(DISTINCT lojaId) AS filiais,
                 COALESCE(sum(estoqueAtual),0) AS "estoqueTotal",
                 COALESCE(sum(saidaMedia),0) AS "saidaMediaTotal"
            FROM estoque WHERE sku=?
        `,
          )
          .get(produto.sku) as EstoqueOperacional;
        const pendente = db
          .prepare(
            `
          SELECT count(DISTINCT numero) AS pedidos,
                 COALESCE(sum(quantidadePedida),0) AS "quantidadePedida",
                 COALESCE(sum(quantidadeFaturada),0) AS "quantidadeFaturada",
                 COALESCE(sum(GREATEST(quantidadePedida-quantidadeFaturada,0)),0) AS "pendenciaTotal",
                 CASE WHEN sum(quantidadePedida) > 0
                   THEN sum(quantidadePedida*precoUnitario)/sum(quantidadePedida) ELSE NULL END AS "precoMedioPedido"
            FROM pedido_itens WHERE sku=? AND btrim(fornecedorCodigo)=?
        `,
          )
          .get(produto.sku, fornecedorCodigo) as PedidoPendente;
        const vendasMensais = db
          .prepare(
            `
          SELECT anoMes AS "anoMes", quantidade, valor
            FROM vendas_mensal WHERE sku=? ORDER BY anoMes DESC LIMIT 12
        `,
          )
          .all(produto.sku)
          .reverse() as Array<{ anoMes: string; quantidade: number; valor: number }>;
        const filiais = db
          .prepare(
            `
          SELECT lojaId AS "lojaId", estoqueAtual AS "estoqueAtual", saidaMedia AS "saidaMedia",
                 CASE WHEN saidaMedia > 0 THEN estoqueAtual/saidaMedia ELSE NULL END AS "coberturaDias"
            FROM estoque WHERE sku=? ORDER BY lojaId
        `,
          )
          .all(produto.sku);
        const coberturaDias =
          Number(estoque?.saidaMediaTotal || 0) > 0
            ? Number(estoque.estoqueTotal) / Number(estoque.saidaMediaTotal)
            : null;
        const fluxoOperacional = db
          .prepare(
            `SELECT f.stock_quantity AS "stockQuantity",
                    f.average_sales_quantity AS "averageSalesQuantity",
                    f.pending_quantity AS "pendingQuantity",
                    f.operational_balance_quantity AS "operationalBalanceQuantity",
                    f.coverage_days AS "coverageDays",
                    f.source_quality_status AS "sourceQualityStatus",
                    f.operational_status AS "operationalStatus",
                    f.financial_base_status AS "financialBaseStatus",
                    r.as_of_ts AS "asOfTs"
               FROM atlas_fluxo_operacional_publicacao p
               JOIN atlas_fluxo_operacional_runs r ON r.run_id = p.published_run_id
               JOIN atlas_fluxo_operacional_sku_fornecedor f ON f.run_id = r.run_id
              WHERE p.publication_key = TRUE
                AND f.supplier_code = ?
                AND f.product_code = ?
              LIMIT 1`,
          )
          .get(fornecedorCodigo, produto.sku) as FluxoOperacionalCompacto | undefined;

        const vendas30dias = db
          .prepare(
            `
          SELECT COALESCE(sum(quantidade),0) AS quantidade,
                 COALESCE(sum(quantidade*valorUnitario),0) AS valor
            FROM vendas WHERE sku=? AND data >= to_char(now() - interval '30 days', 'YYYY-MM-DD')
        `,
          )
          .get(produto.sku) as { quantidade: number; valor: number };

        // Preços e margens reais:
        // - Técnico (teórico): custo medio / (1 - margem alvo/100); margem = margem alvo do RMS.
        // - Demais margens calculadas sobre o custo BRUTO da última entrada.
        // - Médio: média dos últimos 30 dias de vendas (valor / quantidade).
        const numOrNull = (value: number | null | undefined): number | null =>
          value == null || Number.isNaN(Number(value)) ? null : Number(value);
        const margemSobreUltimaEntrada = (preco: number | null): number | null => {
          const p = numOrNull(preco);
          const custo = numOrNull(produto.custoUltimaEntradaBruto) ?? numOrNull(produto.custoUltimaEntrada);
          if (p == null || custo == null || p <= 0) return null;
          const margem = ((p - custo) / p) * 100;
          return margem < -1000 || margem > 1000 ? null : Number(margem.toFixed(1));
        };
        const margemAlvo = numOrNull(produto.margemCadastrada);
        const custoMedio = numOrNull(produto.cmvUnit);
        const precoTeorico =
          margemAlvo != null && custoMedio != null && margemAlvo < 100
            ? Number((custoMedio / (1 - margemAlvo / 100)).toFixed(2))
            : null;
        const precoMedio30dias =
          Number(vendas30dias.quantidade) > 0
            ? Number(vendas30dias.valor) / Number(vendas30dias.quantidade)
            : null;
        const precoAtacado = numOrNull(produto.precoFaixa3) ?? numOrNull(produto.precoFaixa2);
        const precisos = {
          tecnico: {
            preco: precoTeorico,
            margem: margemAlvo,
          },
          medio: {
            preco: precoMedio30dias != null ? Number(precoMedio30dias.toFixed(2)) : null,
            margem: margemSobreUltimaEntrada(precoMedio30dias),
          },
          venda: {
            preco: numOrNull(produto.precoTabela),
            margem: margemSobreUltimaEntrada(produto.precoTabela),
          },
          oferta: {
            preco: Number(produto.ofertaVigente) ? numOrNull(produto.precoOferta) : null,
            margem: Number(produto.ofertaVigente)
              ? margemSobreUltimaEntrada(produto.precoOferta)
              : null,
          },
          atacado: {
            preco: precoAtacado,
            margem: margemSobreUltimaEntrada(precoAtacado),
          },
        };

        return Response.json(
          {
            fornecedor: {
              codigo: fornecedorCodigo,
              nome: fornecedor.nome,
            },
            produto,
            items,
            fatos: {
              estoque: { ...estoque, coberturaDias },
              pendente,
              vendasMensais,
              filiais,
            },
            precosMargens: precisos,
            fluxoOperacional: fluxoOperacional ?? null,
            observedAt: new Date().toISOString(),
            source: "atlas_postgresql",
            scope: "produtos_em_linha_da_carteira_do_comprador",
            limitations: [
              "CMV unitário é exibido como cadastro de custo; não equivale a custo final com impostos.",
              "PIC, margem de contribuição, prazo, fill rate, última nota e recomendação dependem de contratos ainda não sincronizados.",
              "Margens de venda, oferta, atacado e preço médio são calculadas sobre o custo BRUTO da última entrada; o preço teórico é custo médio ÷ (1 − margem alvo).",
            ],
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
