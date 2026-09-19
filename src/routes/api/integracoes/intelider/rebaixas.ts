import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/server/db";

type RebaixaRow = {
  id: string;
  fornecedorCodigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  segmentos: string;
  lojas: string;
  itens: string;
  status: string;
  criadoEm: string;
  enviadoEm: string | null;
};

const STATUS_VALIDOS = new Set([
  "rascunho",
  "enviada",
  "em análise",
  "aprovada",
  "recusada",
  "efetivada",
]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

function tokenValido(request: Request): boolean {
  const esperado = process.env["INTELIDER_INTEGRATION_TOKEN"]?.trim();
  if (!esperado) return false;

  const recebido = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!recebido) return false;

  const esperadoBytes = Buffer.from(esperado);
  const recebidoBytes = Buffer.from(recebido);
  return (
    esperadoBytes.length === recebidoBytes.length && timingSafeEqual(esperadoBytes, recebidoBytes)
  );
}

function jsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureSolicitacoesTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rebaixa_solicitacoes (
      id TEXT PRIMARY KEY, fornecedorCodigo TEXT NOT NULL, titulo TEXT NOT NULL,
      dataInicio TEXT NOT NULL, dataFim TEXT NOT NULL, segmentos TEXT NOT NULL,
      lojas TEXT NOT NULL, itens TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'em análise',
      criadoEm TEXT NOT NULL, enviadoEm TEXT
    );
  `);
}

export const Route = createFileRoute("/api/integracoes/intelider/rebaixas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!tokenValido(request)) return jsonError("Não autorizado.", 401);

        ensureSolicitacoesTable();
        const url = new URL(request.url);
        const status = url.searchParams.get("status")?.trim();
        const desde = url.searchParams.get("desde")?.trim();
        const limiteInformado = Number(url.searchParams.get("limit") || "100");
        const limite = Number.isFinite(limiteInformado)
          ? Math.min(Math.max(Math.trunc(limiteInformado), 1), 200)
          : 100;

        if (status && !STATUS_VALIDOS.has(status)) {
          return jsonError("Status inválido.", 400);
        }

        const filtros: string[] = [];
        const parametros: unknown[] = [];
        if (status) {
          filtros.push("status = ?");
          parametros.push(status);
        }
        if (desde) {
          filtros.push("criadoEm >= ?");
          parametros.push(desde);
        }

        const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
        const rows = db
          .prepare(
            `SELECT id, fornecedorCodigo, titulo, dataInicio, dataFim, segmentos,
                    lojas, itens, status, criadoEm, enviadoEm
               FROM rebaixa_solicitacoes
               ${where}
               ORDER BY criadoEm ASC
               LIMIT ?`,
          )
          .all(...parametros, limite) as RebaixaRow[];

        return Response.json(
          {
            items: rows.map((row) => ({
              id: row.id,
              fornecedorCodigo: row.fornecedorCodigo,
              titulo: row.titulo,
              dataInicio: row.dataInicio,
              dataFim: row.dataFim,
              segmentos: jsonArray(row.segmentos),
              lojas: jsonArray(row.lojas),
              itens: jsonArray(row.itens),
              status: row.status,
              criadoEm: row.criadoEm,
              enviadoEm: row.enviadoEm,
            })),
            count: rows.length,
            limit: limite,
          },
          {
            headers: {
              "cache-control": "no-store",
              "content-type": "application/json; charset=utf-8",
            },
          },
        );
      },
    },
  },
});
