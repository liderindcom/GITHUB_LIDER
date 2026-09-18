import { createFileRoute } from "@tanstack/react-router";

import { db } from "@/server/db";

type SupplierRow = {
  supplierCode: string;
  displayName: string;
  qualityStatus: string;
};

function boundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export const Route = createFileRoute("/api/atlas/fornecedores")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = boundedInteger(url.searchParams.get("limit"), 25, 1, 100);
        const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 100000);
        const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
        const buyer = (url.searchParams.get("buyer") ?? "").trim().slice(0, 50);
        const filters = [
          "COALESCE(p.emlinha, 0) = 1",
          "NULLIF(btrim(p.fornecedorCodigo), '') IS NOT NULL",
          "NULLIF(btrim(f.nome), '') IS NOT NULL",
        ];
        const parameters: unknown[] = [];
        if (search) {
          filters.push("f.nome ILIKE ?");
          parameters.push(`%${search}%`);
        }
        if (buyer) {
          filters.push("p.compradorCodigo = ?");
          parameters.push(buyer);
        }
        const where = `WHERE ${filters.join(" AND ")}`;
        parameters.push(limit, offset);
        const rows = db
          .prepare(
            `
          WITH fornecedores_unicos AS (
            SELECT btrim(p.fornecedorCodigo) AS "supplierCode", MAX(f.nome) AS "displayName",
                   'complete' AS "qualityStatus"
              FROM produtos p
              JOIN fornecedores f ON btrim(f.codigo) = btrim(p.fornecedorCodigo)
              ${where}
             GROUP BY btrim(p.fornecedorCodigo)
          )
          SELECT "supplierCode", "displayName", "qualityStatus"
            FROM fornecedores_unicos
           ORDER BY lower("displayName"), "supplierCode"
           LIMIT ? OFFSET ?
        `,
          )
          .all(...parameters) as SupplierRow[];
        return Response.json(
          {
            items: rows,
            limit,
            offset,
            nextOffset: rows.length === limit ? offset + rows.length : null,
            source: "atlas_postgresql",
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
