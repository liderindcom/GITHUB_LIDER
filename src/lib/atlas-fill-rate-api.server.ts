import { db } from "@/server/db";

const GRAINS = ["store", "department", "section", "group", "subgroup", "sku"] as const;
type Grain = (typeof GRAINS)[number];

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

function cutParams(params: URLSearchParams) {
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
    .map((column) => dimensions.includes(column) ? `MAX(${column}) FILTER (WHERE ${column} IS NOT NULL) AS ${column}` : `NULL AS ${column}`)
    .join(', ');
  return db.prepare(`
    SELECT MIN(cut_start) AS cut_start, MAX(cut_end) AS cut_end,
           MAX(cdam_code) AS cdam_code, cdam_local_code, ${projected},
           '${grain}' AS grain, COUNT(DISTINCT order_code) AS order_count, COUNT(*) AS line_count,
           SUM(quantity_ordered) AS quantity_ordered, SUM(quantity_fulfilled) AS quantity_fulfilled,
           SUM(quantity_ordered - quantity_fulfilled) AS quantity_gap,
           CASE WHEN SUM(quantity_ordered) > 0 THEN SUM(quantity_fulfilled) / SUM(quantity_ordered) END AS quantity_fill_rate,
           COUNT(*) FILTER (WHERE quantity_fulfilled >= quantity_ordered) AS full_line_count,
           (array_agg(source_run_id ORDER BY observed_at DESC))[1] AS source_run_id, MAX(observed_at) AS observed_at
      FROM fill_rate_cdam_lines
     WHERE ${clauses.join(' AND ')}
     GROUP BY ${groupKeys.join(', ')}
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
    const rawLimit = numberParam(params, "limit") ?? 200;
    const limit = Math.min(Math.max(rawLimit, 1), 25000);
    const exact = cutStart === cut.cut_start && cutEnd === cut.cut_end;
    const rows = exact ? db
      .prepare(
        `SELECT cut_start, cut_end, cdam_code, cdam_local_code, store_code, department_code,
                section_code, group_code, subgroup_code, sku_code, grain,
                order_count, line_count, quantity_ordered, quantity_fulfilled,
                quantity_gap, quantity_fill_rate, full_line_count, source_run_id,
                observed_at
           FROM fill_rate_cdam_aggregates
          WHERE grain = ? AND ${clauses.join(" AND ")}
          ORDER BY quantity_gap DESC, store_code NULLS LAST, sku_code NULLS LAST
          LIMIT ?`,
      )
      .all(grain, ...filters(params).values, limit) : dynamicRows(params, grain, cut, limit);
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
