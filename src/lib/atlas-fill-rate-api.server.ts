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

const MAX_INTERACTIVE_DAYS = 7;

function historicalImportWarning(params: URLSearchParams) {
  const [start, end] = cutParams(params);
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (days <= MAX_INTERACTIVE_DAYS) return null;
  return `O período selecionado tem ${days} dias. A consulta interativa aceita no máximo ${MAX_INTERACTIVE_DAYS} dias; é necessária uma importação histórica para esse intervalo.`;
}

function filters(params: URLSearchParams) {
  const [cutStart, cutEnd] = cutParams(params);
  const values: unknown[] = [cutStart, cutEnd];
  const clauses = [
    "cut_start::date = COALESCE(?::date, (SELECT MAX(cut_start)::date FROM fill_rate_cdam_sync_runs WHERE status = 'success'))",
    "cut_end::date = COALESCE(?::date, (SELECT MAX(cut_end)::date FROM fill_rate_cdam_sync_runs WHERE status = 'success'))",
  ];
  for (const [queryName, column] of [
    ["cdamCode", "cdam_code"],
    // The Atlas selector sends the full CDAM (2011/2038); the local
    // warehouse code is stored separately as 201/203.
    ["cdamLocalCode", "cdam_code"],
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
    SELECT cut_start::text AS cut_start, cut_end::text AS cut_end, status
      FROM fill_rate_cdam_sync_runs
     WHERE (? IS NULL OR cut_start <= ?::date)
       AND (? IS NULL OR cut_end >= ?::date)
    ORDER BY (cut_start::date = ?::date AND cut_end::date = ?::date) DESC, cut_end DESC, started_at DESC
    LIMIT 1
  `).get(cutStart, cutStart, cutEnd, cutEnd, cutStart, cutEnd) as { cut_start: string; cut_end: string; status: string } | undefined;
  return row?.status === "success" ? row : undefined;
}

function lineFilters(params: URLSearchParams, cut: { cut_start: string; cut_end: string }) {
  const [cutStart, cutEnd] = cutParams(params);
  const values: unknown[] = [cut.cut_start, cut.cut_end];
  const clauses = [
    "cut_start::date = ?::date AND cut_end::date = ?::date",
  ];
  for (const [queryName, column] of [
    ["cdamCode", "cdam_code"], ["cdamLocalCode", "cdam_code"], ["storeCode", "store_code"],
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
    ), limited AS (
      SELECT * FROM grouped
       ORDER BY quantity_gap DESC, store_code NULLS LAST, sku_code NULLS LAST
       LIMIT ?
    )
    SELECT limited.*,
           CASE WHEN limited.department_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.departamento, '')) FROM produtos p WHERE CAST(p.departamentoCodigo AS TEXT) = CAST(limited.department_code AS TEXT)) END AS department_description,
           CASE WHEN limited.section_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.secao, '')) FROM produtos p WHERE CAST(p.secaoCodigo AS TEXT) = CAST(limited.section_code AS TEXT) AND CAST(p.departamentoCodigo AS TEXT) = CAST(limited.department_code AS TEXT)) END AS section_description,
           CASE WHEN limited.group_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.grupo, '')) FROM produtos p WHERE CAST(p.grupoCodigo AS TEXT) = CAST(limited.group_code AS TEXT) AND CAST(p.secaoCodigo AS TEXT) = CAST(limited.section_code AS TEXT)) END AS group_description,
           CASE WHEN limited.subgroup_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.subgrupo, '')) FROM produtos p WHERE CAST(p.subgrupoCodigo AS TEXT) = CAST(limited.subgroup_code AS TEXT) AND CAST(p.grupoCodigo AS TEXT) = CAST(limited.group_code AS TEXT)) END AS subgroup_description,
           CASE WHEN limited.sku_code IS NOT NULL THEN (SELECT MAX(NULLIF(p.descricao, '')) FROM produtos p WHERE CAST(p.codigoProdutoRms AS TEXT) = CAST(limited.sku_code AS TEXT) OR CAST(p.sku AS TEXT) = CAST(limited.sku_code AS TEXT)) END AS sku_description
      FROM limited
  `).all(...values, limit);
}

function billingSummary(params: URLSearchParams, cut: { cut_start: string; cut_end: string }) {
  const { clauses, values } = lineFilters(params, cut);
  const lineClauses = clauses.map((clause) => clause.replace(/\b(cut_start|cut_end|order_date_raw|cdam_code|cdam_local_code|store_code|department_code|section_code|group_code|subgroup_code|sku_code)\b/g, 'fr.$1'));
  return db.prepare(`
    SELECT COALESCE(SUM(e.quantity_on_time), 0) AS quantity_on_time,
           COALESCE(SUM(e.quantity_late), 0) AS quantity_late_accumulated,
           COALESCE(SUM(e.quantity_billed), 0) AS quantity_billed_total
      FROM fill_rate_cdam_billing_events e
     WHERE e.cut_start::date = ?::date AND e.cut_end::date = ?::date
       AND EXISTS (
         SELECT 1
           FROM fill_rate_cdam_lines fr
          WHERE fr.cut_start::date = e.cut_start::date
            AND fr.cut_end::date = e.cut_end::date
            AND fr.cdam_code = e.cdam_code
            AND fr.store_code = e.store_code
            AND fr.order_code = e.order_code
            AND fr.sku_code = e.sku_code
            AND ${lineClauses.join(' AND ')}
       )
  `).get(cut.cut_start, cut.cut_end, ...values) as Record<string, unknown>;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function fillRateRows(params: URLSearchParams) {
  try {
    const importWarning = historicalImportWarning(params);
    if (importWarning) return json({ source: "portal_postgresql_cache", originHotPath: false, requestedCut: params.get("cutStart") || "latest", reconciliationStatus: "importacao_necessaria", warnings: [importWarning], rows: [] });
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
        `WITH filtered AS (
          SELECT a.*
            FROM fill_rate_cdam_aggregates a
           WHERE a.grain = ? AND ${exactClauses.join(" AND ")}
           ORDER BY a.quantity_gap DESC, a.store_code NULLS LAST, a.sku_code NULLS LAST
           LIMIT ?
        ), departments AS (
          SELECT CAST(p.departamentoCodigo AS TEXT) AS code, MAX(NULLIF(p.departamento, '')) AS description
            FROM produtos p GROUP BY p.departamentoCodigo
        ), sections AS (
          SELECT CAST(p.departamentoCodigo AS TEXT) AS department_code, CAST(p.secaoCodigo AS TEXT) AS code, MAX(NULLIF(p.secao, '')) AS description
            FROM produtos p GROUP BY p.departamentoCodigo, p.secaoCodigo
        ), product_groups AS (
          SELECT CAST(p.secaoCodigo AS TEXT) AS section_code, CAST(p.grupoCodigo AS TEXT) AS code, MAX(NULLIF(p.grupo, '')) AS description
            FROM produtos p GROUP BY p.secaoCodigo, p.grupoCodigo
        ), subgroups AS (
          SELECT CAST(p.grupoCodigo AS TEXT) AS group_code, CAST(p.subgrupoCodigo AS TEXT) AS code, MAX(NULLIF(p.subgrupo, '')) AS description
            FROM produtos p GROUP BY p.grupoCodigo, p.subgrupoCodigo
        ), sku_descriptions AS (
          SELECT code, MAX(description) AS description FROM (
            SELECT CAST(p.codigoProdutoRms AS TEXT) AS code, NULLIF(p.descricao, '') AS description FROM produtos p WHERE p.codigoProdutoRms IS NOT NULL
            UNION ALL
            SELECT CAST(p.sku AS TEXT) AS code, NULLIF(p.descricao, '') AS description FROM produtos p WHERE p.sku IS NOT NULL
          ) mapped GROUP BY code
        )
        SELECT filtered.*,
               buckets.quantity_d1,
               buckets.quantity_d2,
               buckets.quantity_d3,
               departments.description AS department_description,
               sections.description AS section_description,
               product_groups.description AS group_description,
               subgroups.description AS subgroup_description,
               sku_descriptions.description AS sku_description
          FROM filtered
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(SUM(e.quantity_billed) FILTER (WHERE e.billing_date = filtered.cut_end::date + 1), 0) AS quantity_d1,
              COALESCE(SUM(e.quantity_billed) FILTER (WHERE e.billing_date = filtered.cut_end::date + 2), 0) AS quantity_d2,
              COALESCE(SUM(e.quantity_billed) FILTER (WHERE e.billing_date = filtered.cut_end::date + 3), 0) AS quantity_d3
            FROM fill_rate_cdam_billing_events e
            WHERE e.cut_start::date = filtered.cut_start::date
              AND e.cut_end::date = filtered.cut_end::date
              AND e.cdam_code = filtered.cdam_code
              AND e.store_code = filtered.store_code
              AND EXISTS (
                SELECT 1
                  FROM fill_rate_cdam_lines bl
                 WHERE bl.cut_start::date = filtered.cut_start::date
                   AND bl.cut_end::date = filtered.cut_end::date
                   AND bl.cdam_code = filtered.cdam_code
                   AND bl.store_code = filtered.store_code
                   AND bl.order_code = e.order_code
                   AND bl.sku_code = e.sku_code
                   AND bl.department_code IS NOT DISTINCT FROM filtered.department_code
                   AND bl.section_code IS NOT DISTINCT FROM filtered.section_code
                   AND bl.group_code IS NOT DISTINCT FROM filtered.group_code
                   AND bl.subgroup_code IS NOT DISTINCT FROM filtered.subgroup_code
                   AND bl.sku_code IS NOT DISTINCT FROM filtered.sku_code
              )
          ) buckets ON TRUE
          LEFT JOIN departments ON departments.code = CAST(filtered.department_code AS TEXT)
          LEFT JOIN sections ON sections.department_code = CAST(filtered.department_code AS TEXT) AND sections.code = CAST(filtered.section_code AS TEXT)
          LEFT JOIN product_groups ON product_groups.section_code = CAST(filtered.section_code AS TEXT) AND product_groups.code = CAST(filtered.group_code AS TEXT)
          LEFT JOIN subgroups ON subgroups.group_code = CAST(filtered.group_code AS TEXT) AND subgroups.code = CAST(filtered.subgroup_code AS TEXT)
          LEFT JOIN sku_descriptions ON sku_descriptions.code = CAST(filtered.sku_code AS TEXT)`,
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
    const importWarning = historicalImportWarning(params);
    if (importWarning) return json({ source: "portal_postgresql_cache", originHotPath: false, requestedCut: params.get("cutStart") || "latest", reconciliationStatus: "importacao_necessaria", warnings: [importWarning], summary: {} });
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
    let billing: Record<string, unknown> = {
      quantity_on_time: 0,
      quantity_late_accumulated: 0,
      quantity_billed_total: 0,
    };
    try {
      billing = billingSummary(params, cut);
    } catch {
      // A migration may not have reached an older read replica yet. The
      // quantitative fill-rate response remains valid and explicitly reports
      // zero billing-event data until the additive cache is available.
    }
    const ordered = Number((summary as Record<string, unknown>).quantity_ordered || 0);
    const onTime = Number(billing.quantity_on_time || 0);
    const late = Number(billing.quantity_late_accumulated || 0);
    return json({
      source: "portal_postgresql_cache",
      originHotPath: false,
      requestedCut,
      reconciliationStatus: "reconciliado",
      warnings: ["o histórico não contém snapshot causal de estoque"],
      summary: {
        ...summary,
        quantity_on_time: onTime,
        quantity_late_accumulated: late,
        quantity_billed_total: Number(billing.quantity_billed_total || 0),
        fill_rate_on_time: ordered > 0 ? onTime / ordered : null,
        fill_rate_late_accumulated: ordered > 0 ? late / ordered : null,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "consulta indisponível";
    const status = /inválido/.test(detail) ? 400 : 503;
    return json({ error: status === 400 ? "invalid_filter" : "fill_rate_database_unavailable", detail }, status);
  }
}
