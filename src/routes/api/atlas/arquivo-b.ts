import { createFileRoute } from "@tanstack/react-router";

import { db } from "@/server/db";

type ArquivoBRow = {
  sku: string;
  description: string;
  departmentCode: string | null;
  department: string | null;
  sectionCode: string | null;
  section: string | null;
  groupCode: string | null;
  group: string | null;
  subgroupCode: string | null;
  subgroup: string | null;
  abc: string | null;
  topStar: boolean;
  classeTopStar: string | null;
  system: string | null;
  windows: Array<[number, number, number]>;
  stock: number;
  standardStock: number | null;
  replenishment: number | null;
  capacity: number | null;
  cdam: number;
  unitsPerBox: number | null;
  boxesPerLayer: number | null;
  layersPerPallet: number | null;
  packaging: string | null;
  newProduct: boolean;
  historyDays: number | null;
  ruptureDays: number;
  preRuptureDemand: number | null;
};

const ARQUIVO_B_CACHE_TTL_MS = 5 * 60 * 1000;
const ARQUIVO_B_CACHE_MAX = 32;
const arquivoBCache = new Map<string, { expiresAt: number; generatedAt: string; rows: ArquivoBRow[] }>();
let arquivoBConsultasAtivas = 0;
const arquivoBFila: Array<() => void> = [];

async function adquirirConsultaArquivoB() {
  if (arquivoBConsultasAtivas < 3) {
    arquivoBConsultasAtivas += 1;
    return;
  }
  await new Promise<void>((resolve) => arquivoBFila.push(resolve));
  arquivoBConsultasAtivas += 1;
}

function liberarConsultaArquivoB() {
  arquivoBConsultasAtivas = Math.max(0, arquivoBConsultasAtivas - 1);
  arquivoBFila.shift()?.();
}

function tokenIsValid(request: Request) {
  const expected = process.env["ATLAS_ARQUIVO_B_TOKEN"]?.trim();
  const received = request.headers.get("x-atlas-arquivo-b-token")?.trim();
  return Boolean(expected && received && expected === received);
}

export const Route = createFileRoute("/api/atlas/arquivo-b")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!tokenIsValid(request)) {
          return Response.json({ error: "Token técnico inválido." }, { status: 401 });
        }

        const url = new URL(request.url);
        const storeId = (url.searchParams.get("storeId") ?? "").trim().slice(0, 20);
        if (!storeId) {
          return Response.json({ error: "storeId é obrigatório." }, { status: 400 });
        }

        const sectionCodes = [...new Set(
          (url.searchParams.get("sectionCodes") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter((value) => /^\d+$/.test(value))
            .slice(0, 200),
        )];
        const sectionClause = sectionCodes.length
          ? ` AND btrim(p.secaoCodigo) IN (${sectionCodes.map(() => "?").join(",")})`
          : "";
        const sectionClauseVendas = sectionCodes.length
          ? ` AND EXISTS (
               SELECT 1 FROM produtos vp
                WHERE vp.sku = v.sku
                  AND btrim(vp.secaoCodigo) IN (${sectionCodes.map(() => "?").join(",")})
             )`
          : "";
        const cacheKey = `${storeId}|${sectionCodes.join(",")}`;
        const cached = arquivoBCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          return Response.json(
            { source: "rms_cache_postgresql", storeId, generatedAt: cached.generatedAt, rows: cached.rows },
            { headers: { "cache-control": "no-store", "x-arquivo-b-cache": "HIT" } },
          );
        }
        if (cached) arquivoBCache.delete(cacheKey);

        await adquirirConsultaArquivoB();
        let rows: Array<{
          sku: string;
          description: string;
          departmentCode: string | null;
          department: string | null;
          sectionCode: string | null;
          section: string | null;
          groupCode: string | null;
          group: string | null;
          subgroupCode: string | null;
          subgroup: string | null;
          abc: string | null;
          topStar: boolean;
          classeTopStar: string | null;
          system: string | null;
          unitsPerBox: number | null;
          stock: number;
          standardStock: number | null;
          replenishment: number | null;
          capacity: number | null;
          cdam: number;
          boxesPerLayer: number | null;
          layersPerPallet: number | null;
          packaging: string | null;
          meses: Record<string, number>;
          monthsWithSales: number;
        }>;
        try {
          rows = db
          .prepare(
            `
            WITH data_fim AS (
              SELECT MAX(data::date) AS fim FROM vendas
            ), vendas_topstar AS (
              SELECT v.sku,
                     p.departamentoCodigo,
                     p.secaoCodigo,
                     p.grupoCodigo,
                     p.subgrupoCodigo,
                     COALESCE(SUM(v.quantidade * v.valorUnitario), 0) AS valor,
                     COALESCE(SUM(v.quantidade), 0) AS volume
                FROM vendas v
                JOIN produtos p ON p.sku = v.sku
               WHERE v.data IS NOT NULL
                 AND v.data::date >= (SELECT fim - interval '89 days' FROM data_fim)
                 ${sectionClause}
               GROUP BY v.sku, p.departamentoCodigo, p.secaoCodigo,
                        p.grupoCodigo, p.subgrupoCodigo
            ), valor_topstar AS (
              SELECT *,
                     COALESCE(SUM(valor) OVER (
                       PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo, subgrupoCodigo
                       ORDER BY valor DESC, sku
                       ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                     ), 0) AS valor_anterior,
                     SUM(valor) OVER (
                       PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo, subgrupoCodigo
                     ) AS valor_total
                FROM vendas_topstar
            ), topstar AS (
              SELECT sku,
                     CASE WHEN valor_total > 0
                                AND valor_anterior / valor_total < 0.50
                          THEN 'A'
                          WHEN valor_total > 0
                                AND valor_anterior / valor_total < 0.80
                          THEN 'B'
                          WHEN valor_total > 0
                                AND valor_anterior / valor_total < 0.98
                          THEN 'C'
                          ELSE 'D' END AS classe_valor,
                     CASE WHEN SUM(volume) OVER (
                                PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                              ) > 0
                                AND COALESCE(SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                  ORDER BY volume DESC, sku
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                                ), 0) / SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                ) < 0.50
                          THEN 'a'
                          WHEN SUM(volume) OVER (
                                PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                              ) > 0
                                AND COALESCE(SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                  ORDER BY volume DESC, sku
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                                ), 0) / SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                ) < 0.80
                          THEN 'b'
                          WHEN SUM(volume) OVER (
                                PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                              ) > 0
                                AND COALESCE(SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                  ORDER BY volume DESC, sku
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                                ), 0) / SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                ) < 0.98
                          THEN 'c'
                          ELSE 'd' END AS classe_volume,
                     CASE WHEN valor_total > 0
                                AND valor_anterior / valor_total < 0.50
                                AND COALESCE(SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                  ORDER BY volume DESC, sku
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                                ), 0) / NULLIF(SUM(volume) OVER (
                                  PARTITION BY departamentoCodigo, secaoCodigo, grupoCodigo
                                ), 0) < 0.50
                          THEN TRUE ELSE FALSE END AS top_star
                FROM valor_topstar
            ), vendas_mes AS (
              SELECT v.sku, to_char(date_trunc('month', v.data::date), 'YYYY-MM') AS mes,
                     COALESCE(sum(v.quantidade), 0) AS quantidade
                FROM vendas v
               WHERE COALESCE(NULLIF(ltrim(btrim(v.lojaId), '0'), ''), '0') =
                     COALESCE(NULLIF(ltrim(btrim(?), '0'), ''), '0')
                 AND v.data IS NOT NULL
                 AND v.data::date >= current_date - interval '180 days'
                 ${sectionClauseVendas}
               GROUP BY v.sku, to_char(date_trunc('month', v.data::date), 'YYYY-MM')
            ), historico AS (
              SELECT sku, COALESCE(jsonb_object_agg(mes, quantidade), '{}'::jsonb) AS meses,
                     COUNT(*) FILTER (WHERE quantidade > 0) AS meses_com_venda
                FROM vendas_mes GROUP BY sku
            ), estoque_cdam AS (
              SELECT sku, COALESCE(sum(estoqueAtual), 0) AS cdam
                FROM estoque WHERE lojaId IN ('2011', '2038') GROUP BY sku
            )
            SELECT p.sku, p.descricao AS description,
                   p.departamentoCodigo AS "departmentCode", p.departamento AS department,
                   p.secaoCodigo AS "sectionCode", p.secao AS section,
                   p.grupoCodigo AS "groupCode", p.grupo AS "group",
                   p.subgrupoCodigo AS "subgroupCode", p.subgrupo AS subgroup, p.abc,
                   COALESCE(t.top_star, FALSE) AS "topStar",
                   CASE WHEN t.top_star THEN 'Aa' ELSE NULL END AS "classeTopStar",
                   p.sistematica AS system, p.embalagemCompra AS "unitsPerBox",
                   COALESCE(e.estoqueAtual, 0) AS stock,
                   COALESCE(e.estoquePadrao, p.estoquePadrao) AS "standardStock",
                   e.percentualReposicao AS replenishment,
                   e.capacidadeDeposito AS capacity,
                   COALESCE(c.cdam, 0) AS cdam,
                   p.caixasPorCamada AS "boxesPerLayer",
                   p.camadasPorPalete AS "layersPerPallet",
                   p.tipoPalete AS packaging,
                   COALESCE(h.meses, '{}'::jsonb) AS meses,
                   COALESCE(h.meses_com_venda, 0) AS "monthsWithSales"
              FROM produtos p
              LEFT JOIN estoque e ON e.sku = p.sku AND e.lojaId = ?
              LEFT JOIN estoque_cdam c ON c.sku = p.sku
              LEFT JOIN historico h ON h.sku = p.sku
              LEFT JOIN topstar t ON t.sku = p.sku
             WHERE COALESCE(p.emlinha, 0) = 1
               AND upper(btrim(COALESCE(p.sistematica, ''))) IN ('1', '01', '11', 'ESTOCADO', 'D. LOJA', 'CROSS-DOCKING', 'CROSS DOCKING', 'CROSSDOCKING')
               AND (
                 EXISTS (SELECT 1 FROM estoque mix_e WHERE mix_e.sku = p.sku AND mix_e.lojaId = ?)
                 OR EXISTS (
                   SELECT 1 FROM vendas mix_v
                    WHERE mix_v.sku = p.sku
                      AND COALESCE(NULLIF(ltrim(btrim(mix_v.lojaId), '0'), ''), '0') =
                          COALESCE(NULLIF(ltrim(btrim(?), '0'), ''), '0')
                 )
               )
               AND NOT EXISTS (
                 SELECT 1 FROM produtos_lojas_bloqueios bloqueio
                  WHERE bloqueio.sku = p.sku
                    AND bloqueio.lojaId = ?
                    AND COALESCE(bloqueio.bloqueio, 0) > 0
               )
               ${sectionClause}
             ORDER BY p.departamentoCodigo, p.secaoCodigo, p.grupoCodigo, p.subgrupoCodigo, p.sku
             LIMIT 50000
          `,
          )
          .all(...sectionCodes, storeId, ...sectionCodes, storeId, storeId, storeId, storeId, ...sectionCodes) as typeof rows;
        } finally {
          liberarConsultaArquivoB();
        }

        const today = new Date();
        const windows = Array.from({ length: 5 }, (_, index) => {
          const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        });
        const payload: ArquivoBRow[] = rows.map((row) => ({
          sku: String(row.sku),
          description: row.description || "",
          departmentCode: row.departmentCode,
          department: row.department || row.departmentCode,
          sectionCode: row.sectionCode,
          section: row.section || row.sectionCode,
          groupCode: row.groupCode,
          group: row.group,
          subgroupCode: row.subgroupCode,
          subgroup: row.subgroup,
          abc: row.abc,
          topStar: Boolean(row.topStar),
          classeTopStar: row.classeTopStar,
          system: row.system || "01",
          windows: windows.map((month) => [Number(row.meses?.[month] || 0), 0, 0]),
          stock: Number(row.stock || 0),
          standardStock: row.standardStock == null ? null : Number(row.standardStock),
          replenishment: row.replenishment == null ? null : Number(row.replenishment),
          capacity: row.capacity == null ? null : Number(row.capacity),
          cdam: Number(row.cdam || 0),
          unitsPerBox: row.unitsPerBox == null ? null : Number(row.unitsPerBox),
          boxesPerLayer: row.boxesPerLayer == null ? null : Number(row.boxesPerLayer),
          layersPerPallet: row.layersPerPallet == null ? null : Number(row.layersPerPallet),
          packaging: row.packaging || "UN",
          // A tabela de produtos não traz a data de entrada em linha no cache
          // atual. Não inferimos produto novo apenas por ausência de venda.
          newProduct: false,
          historyDays: row.monthsWithSales === 0 ? null : row.monthsWithSales * 30,
          ruptureDays: 0,
          preRuptureDemand: null,
        }));
        const generatedAt = new Date().toISOString();
        arquivoBCache.set(cacheKey, { expiresAt: Date.now() + ARQUIVO_B_CACHE_TTL_MS, generatedAt, rows: payload });
        while (arquivoBCache.size > ARQUIVO_B_CACHE_MAX) arquivoBCache.delete(arquivoBCache.keys().next().value as string);
        return Response.json(
          { source: "rms_cache_postgresql", storeId, generatedAt, rows: payload },
          { headers: { "cache-control": "no-store", "x-arquivo-b-cache": "MISS" } },
        );
      },
    },
  },
});
