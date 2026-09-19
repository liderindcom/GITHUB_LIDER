import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/server/db";

export const Route = createFileRoute("/api/atlas/compradores")({
  server: { handlers: { GET: async () => {
    const items = db.prepare(`SELECT compradorCodigo AS "buyerCode", MAX(compradorNome) AS "displayName" FROM produtos WHERE compradorCodigo IS NOT NULL AND TRIM(compradorCodigo) <> $$$$ AND compradorNome IS NOT NULL AND TRIM(compradorNome) <> $$$$ GROUP BY compradorCodigo ORDER BY MAX(compradorNome), compradorCodigo LIMIT 200`).all();
    return Response.json({ items, source: "postgresql_catalogo" }, { headers: { "cache-control": "no-store" } });
  } } },
});
