import { db } from "@/server/db";

const GRAINS = ["store", "department", "section", "group", "subgroup", "sku"] as const;
type Grain = (typeof GRAINS)[number];
const SEGMENT_DEPARTMENTS: Record<string, number[]> = {
  SUPERMERCADO: [100, 102, 103, 105, 600],
  MAGAZAN: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 219, 220, 222, 223, 224, 225, 226, 227, 228, 500],
  FARMALIDER: [300],
  "HOME CENTER": [110, 115],
  OTICA: [221],
  PETSLIDER: [104, 999],
  NUTRILIDER: [106],
};
const SEGMENTS = [...Object.keys(SEGMENT_DEPARTMENTS), "OUTROS"] as const;

function one(params: URLSearchParams, name: string) {
  const value = params.get(name)?.trim();
  return value || null;
}

function numberParam(params: URLSearchParams, name: string) {
  const value = one(params, name);
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new Error(`${name} inválido`);
  return Number(value);
}

function grainParam(params: URLSearchParams): Grain {
  const grain = one(params, "grain") || "store";
  if (!GRAINS.includes(grain as Grain)) throw new Error("grain inválido");
  return grain as Grain;
}

function segmentParam(params: URLSearchParams) {
  const segment = one(params, "segmento");
  if (!segment) return null;
  if (!SEGMENTS.includes(segment as (typeof SEGMENTS)[number])) throw new Error("segmento inválido");
  return segment;
}

function segmentFilter(params: URLSearchParams) {
  const segment = segmentParam(params);
  if (!segment) return { clause: null, values: [] as unknown[] };
  const codes = Object.values(SEGMENT_DEPARTMENTS).flat();
  const placeholders = (values: number[]) => values.map(() => "?").join(",");
  if (segment === "OUTROS") return { clause: `(department_code IS NULL OR department_code NOT IN (${placeholders(codes)}))`, values: codes };
  const values = SEGMENT_DEPARTMENTS[segment];
  return { clause: `department_code IN (${placeholders(values)})`, values };
}

function cutParams(params: URLSearchParams): [string | null, string | null] {
  return [one(params, "cutStart"), one(params, "cutEnd")];
}

function filters(params: URLSearchParams) {
  const [cutStart, cutEnd] = cutParams(params);
  const values: unknown[] = [cutStart, cutEnd];
  const clauses = [
    "cut_start = COALESCE(?, (SELECT MAX(cut_start) FROM fill_rate_cdam_sync_runs WHERE status = 'success'))",
    "cut_end = COALESCE(?, (SELECT MAX(cut_end) FROM fill_rate_cdam_sync_runs WHERE status = 'success'))",
  ];
  for (const [queryName, column] of [
    ["cdamCode", "cdam_code"],
    ["cdamLocalCode", "cdam_local_code"],
    ["storeCode", "store_code"],
    ["departmentCode", "department_code"],
    ["sectionCode", "section_code"],
    ["groupCode", "group_code"],
    ["subgroupCode", "subgroup_code"],
    ["skuCode", "sku_code"],
  ] as const) {
    const value = numberParam(params, queryName);
    if (value !== null) {
      clauses.push(`${column} = ?`);
      values.push(value);
    }
  }
  const segment = segmentFilter(params);
  if (segment.clause) { clauses.push(segment.clause); values.push(...segment.values); }
  return { clauses, values, requestedCut: cutStart || "latest" };
}

function sourceCut(cutStart: string | null, cutEnd: string | null) {
  const row = db.prepare(`
    SELECT cut_start::text AS cut_start, cut_end::text AS cut_end
      FROM fill_rate_cdam_sync_runs
     WHERE status = 'success'
       AND (? IS NULL OR cut_start <= ?::date)
       AND (? IS NULL OR cut_end >= ?::date)
     ORDER BY cut_end DESC
     LIMIT 1
  `).get(cutStart, cutStart, cutEnd, cutEnd) as { cut_start: string; cut_end: string } | undefined;
  return row;
}

function lineFilters(params: URLSearchParams, cut: { cut_start: string; cut_end: string }) {
  const [cutStart, cutEnd] = cutParams(params);
  const values: unknown[] = [cut.cut_start, cut.cut_end, cutStart || cut.cut_start, cutEnd || cut.cut_end];
  const clauses = [
    "cut_start = ? AND cut_end = ?",
    "TO_DATE(LPAD(order_date_raw::text, 6, '0'), 'DDMMYY') BETWEEN ?::date AND ?::date",
  ];
  for (const [queryName, column] of [
    ["cdamCode", "cdam_code"], ["cdamLocalCode", "cdam_local_code"], ["storeCode", "store_code"],
    ["departmentCode", "department_code"], ["sectionCode", "section_code"], ["groupCode", "group_code"],
    ["subgroupCode", "subgroup_code"], ["skuCode", "sku_code"],
  ] as const) {
    const value = numberParam(params, queryName);
    if (value !== null) { clauses.push(`${column} = ?`); values.push(value); }
  }
  const segment = segmentFilter(params);
  if (segment.clause) { clauses.push(segment.clause); values.push(...segment.values); }
  return { clauses, values };
}

const GRAIN_DIMENSIONS: Record<Grain, string[]> = {
  store: ["store_code"],
  department: ["store_code", "department_code"],
  section: ["store_code", "department_code", "section_code"],
  group: ["store_code", "department_code", "section_code", "group_code"],
  subgroup: ["store_code", "department_code", "section_code", "group_code", "subgroup_code"],
  sku: ["store_code", "department_code", "section_code", "group_code", "subgroup_code", "sku_code"],
};

function dynamicRows(params: URLSearchParams, grain: Grain, cut: { cut_start: string; cut_end: string }, limit: number) {
  const { clauses, values } = lineFilters(params, cut);
  const dimensions = GRAIN_DIMENSIONS[grain];
  const groupKeys = ["cdam_local_code", ...dimensions];
  const projected = ["store_code", "department_code", "section_code", "group_code", "subgroup_code", "sku_code"]
    .map((column) => dimensions.includes(column) ? `MAX(fr.${column}) FILTER (WHERE fr.${column} IS NOT NULL) AS ${column}` : `NULL AS ${column}`)
    .join(', ');
  return db.prepare(`
    WITH grouped AS (
      SELECT MIN(fr.cut_start) AS cut_start, MAX(fr.cut_end) AS cut_end,
             MAX(fr.cdam_code) AS cdam_code, fr.cdam_local_code, ${projected},
             '${grain}' AS grain, COUNT(DISTINCT fr.order_code) AS order_count, COUNT(*) AS line_count,
             SUM(fr.quantity_ordered) AS quantity_ordered, SUM(fr.quantity_fulfilled) AS quantity_fulfilled,
             SUM(fr.quantity_ordered - fr.quantity_fulfilled) AS quantity_gap,
             CASE WHEN SUM(fr.quantity_ordered) > 0 THEN SUM(fr.quantity_fulfilled) / SUM(fr.quantity_ordered) END AS quantity_fill_rate,
             COUNT(*) FILTER (WHERE fr.quantity_fulfilled >= fr.quantity_ordered) AS full_line_count,
             (array_agg(fr.source_run_id ORDER BY fr.observed_at DESC))[1] AS source_run_id, MAX(fr.observed_at) AS observed_at
        FROM fill_rate_cdam_lines fr
       WHERE ${clauses.map((clause) => clause.replace(/\b(cut_start|cut_end|order_date_raw|cdam_code|cdam_local_code|store_code|department_code|section_code|group_code|subgroup_code|sku_code)\b/g, 'fr.$1')).join(' AND ')}
       GROUP BY ${groupKeys.map((key) => `fr.${key}`).join(', ')}
    )
    SELECT grouped.*,
           CASE WHEN grouped.department_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.departamento, '')) FROM produtos p WHERE CAST(p.departamentoCodigo AS TEXT) = CAST(grouped.department_code AS TEXT)) END AS department_description,
           CASE WHEN grouped.section_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.secao, '')) FROM produtos p WHERE CAST(p.secaoCodigo AS TEXT) = CAST(grouped.section_code AS TEXT) AND CAST(p.departamentoCodigo AS TEXT) = CAST(grouped.department_code AS TEXT)) END AS section_description,
           CASE WHEN grouped.group_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.grupo, '')) FROM produtos p WHERE CAST(p.grupoCodigo AS TEXT) = CAST(grouped.group_code AS TEXT) AND CAST(p.secaoCodigo AS TEXT) = CAST(grouped.section_code AS TEXT)) END AS group_description,
           CASE WHEN grouped.subgroup_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.subgrupo, '')) FROM produtos p WHERE CAST(p.subgrupoCodigo AS TEXT) = CAST(grouped.subgroup_code AS TEXT) AND CAST(p.grupoCodigo AS TEXT) = CAST(grouped.group_code AS TEXT)) END AS subgroup_description,
           CASE WHEN grouped.sku_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.descricao, '')) FROM produtos p WHERE CAST(p.codigoProdutoRms AS TEXT) = CAST(grouped.sku_code AS TEXT) OR CAST(p.sku AS TEXT) = CAST(grouped.sku_code AS TEXT)) END AS sku_description
      FROM grouped
     ORDER BY quantity_gap DESC, store_code NULLS LAST, sku_code NULLS LAST
     LIMIT ?
  `).all(...values, limit);
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function fillRateRows(params: URLSearchParams) {
  try {
    const grain = grainParam(params);
    const [cutStart, cutEnd] = cutParams(params);
    const cut = sourceCut(cutStart, cutEnd);
    if (!cut) return json({ source: "portal_postgresql_cache", originHotPath: false, grain, requestedCut: cutStart || "latest", reconciliationStatus: "sem_dados", warnings: ["corte não carregado no cache PostgreSQL"], rows: [] });
    const requestedCut = cutStart || "latest";
    const rawLimit = numberParam(params, "limit") ?? 200;
    const limit = Math.min(Math.max(rawLimit, 1), 25000);
    const exact = cutStart === cut.cut_start && cutEnd === cut.cut_end;
    const exactFilters = filters(params);
    const exactClauses = exactFilters.clauses.map((clause) => clause.replace(/^(cut_start|cut_end|cdam_code|cdam_local_code|store_code|department_code|section_code|group_code|subgroup_code|sku_code)\b/, 'a.$1'));
    const rows = exact ? db
      .prepare(
        `SELECT a.cut_start, a.cut_end, a.cdam_code, a.cdam_local_code, a.store_code, a.department_code,
                a.section_code, a.group_code, a.subgroup_code, a.sku_code, a.grain,
                a.order_count, a.line_count, a.quantity_ordered, a.quantity_fulfilled,
                a.quantity_gap, a.quantity_fill_rate, a.full_line_count, a.source_run_id,
                a.observed_at,
                CASE WHEN a.department_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.departamento, '')) FROM produtos p WHERE CAST(p.departamentoCodigo AS TEXT) = CAST(a.department_code AS TEXT)) END AS department_description,
                CASE WHEN a.section_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.secao, '')) FROM produtos p WHERE CAST(p.secaoCodigo AS TEXT) = CAST(a.section_code AS TEXT) AND CAST(p.departamentoCodigo AS TEXT) = CAST(a.department_code AS TEXT)) END AS section_description,
                CASE WHEN a.group_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.grupo, '')) FROM produtos p WHERE CAST(p.grupoCodigo AS TEXT) = CAST(a.group_code AS TEXT) AND CAST(p.secaoCodigo AS TEXT) = CAST(a.section_code AS TEXT)) END AS group_description,
                CASE WHEN a.subgroup_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.subgrupo, '')) FROM produtos p WHERE CAST(p.subgrupoCodigo AS TEXT) = CAST(a.subgroup_code AS TEXT) AND CAST(p.grupoCodigo AS TEXT) = CAST(a.group_code AS TEXT)) END AS subgroup_description,
                CASE WHEN a.sku_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.descricao, '')) FROM produtos p WHERE CAST(p.codigoProdutoRms AS TEXT) = CAST(a.sku_code AS TEXT) OR CAST(p.sku AS TEXT) = CAST(a.sku_code AS TEXT)) END AS sku_description
           FROM fill_rate_cdam_aggregates a
          WHERE a.grain = ? AND ${exactClauses.join(" AND ")}
          ORDER BY quantity_gap DESC, store_code NULLS LAST, sku_code NULLS LAST
          LIMIT ?`,
      )
      .all(grain, ...exactFilters.values, limit) : dynamicRows(params, grain, cut, limit);
    return json({
      source: "portal_postgresql_cache",
      originHotPath: false,
      grain,
      requestedCut,
      reconciliationStatus: rows.length ? "reconciliado" : "sem_dados",
      warnings: ["o histórico não contém snapshot causal de estoque"],
      rows,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "consulta indisponível";
    const status = /inválido/.test(detail) ? 400 : 503;
    return json({ error: status === 400 ? "invalid_filter" : "fill_rate_database_unavailable", detail }, status);
  }
}

export function fillRateSummary(params: URLSearchParams) {
  try {
    const [cutStart, cutEnd] = cutParams(params);
    const cut = sourceCut(cutStart, cutEnd);
    if (!cut) return json({ source: "portal_postgresql_cache", originHotPath: false, requestedCut: cutStart || "latest", reconciliationStatus: "sem_dados", warnings: ["corte não carregado no cache PostgreSQL"], summary: {} });
    const exact = cutStart === cut.cut_start && cutEnd === cut.cut_end;
    const requestedCut = cutStart || "latest";
    const { clauses, values } = exact ? filters(params) : lineFilters(params, cut);
    const summary = db
      .prepare(
        `SELECT COUNT(*) AS line_count, COUNT(DISTINCT order_code) AS order_count,
                SUM(quantity_ordered) AS quantity_ordered,
                SUM(quantity_fulfilled) AS quantity_fulfilled,
                SUM(quantity_ordered - quantity_fulfilled) AS quantity_gap,
                CASE WHEN SUM(quantity_ordered) > 0
                     THEN SUM(quantity_fulfilled) / SUM(quantity_ordered) END AS quantity_fill_rate
           FROM fill_rate_cdam_lines
          WHERE ${clauses.join(" AND ")}`,
      )
      .get(...values);
    return json({
      source: "portal_postgresql_cache",
      originHotPath: false,
      requestedCut,
      reconciliationStatus: "reconciliado",
      warnings: ["o histórico não contém snapshot causal de estoque"],
      summary,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "consulta indisponível";
    const status = /inválido/.test(detail) ? 400 : 503;
    return json({ error: status === 400 ? "invalid_filter" : "fill_rate_database_unavailable", detail }, status);
  }
}
