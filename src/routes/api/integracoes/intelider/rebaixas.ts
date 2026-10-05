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

type CompradorIntegracao = { codigo: string; segmentos: Set<string> };

function normalizarTexto(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function configuracaoCompradores(): Map<string, Set<string>> | null {
  const raw = process.env["INTELIDER_REBAIXA_COMPRADORES_JSON"]?.trim();
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const mapa = new Map<string, Set<string>>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const candidato = item as { codigo?: unknown; segmentos?: unknown };
      const codigo = String(candidato.codigo ?? "").trim();
      const segmentos = Array.isArray(candidato.segmentos)
        ? candidato.segmentos.map(normalizarTexto).filter(Boolean)
        : [];
      if (codigo && segmentos.length) mapa.set(codigo, new Set(segmentos));
    }
    return mapa.size ? mapa : null;
  } catch {
    return null;
  }
}

function integracaoAutorizada(request: Request): CompradorIntegracao | null {
  const esperado = process.env["INTELIDER_INTEGRATION_TOKEN"]?.trim();
  const comprador = request.headers.get("x-intelider-comprador")?.trim();
  const compradores = configuracaoCompradores();
  if (!esperado || !comprador || !compradores) return null;

  const recebido = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!recebido) return null;

  const esperadoBytes = Buffer.from(esperado);
  const recebidoBytes = Buffer.from(recebido);
  const tokenValido =
    esperadoBytes.length === recebidoBytes.length && timingSafeEqual(esperadoBytes, recebidoBytes);
  if (!tokenValido) return null;
  const segmentos = compradores.get(comprador);
  return segmentos ? { codigo: comprador, segmentos } : null;
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
        const integracao = integracaoAutorizada(request);
        if (!integracao) {
          const configurado = Boolean(process.env["INTELIDER_REBAIXA_COMPRADORES_JSON"]?.trim());
          return jsonError(
            configurado ? "Não autorizado." : "Integração sem escopo configurado.",
            configurado ? 401 : 503,
          );
        }

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
            `,
          )
          .all(...parametros) as RebaixaRow[];

        const visiveis = rows
          .filter((row) =>
            jsonArray(row.segmentos).some((segmento) =>
              integracao.segmentos.has(normalizarTexto(segmento)),
            ),
          )
          .slice(0, limite);

        return Response.json(
          {
            compradorCodigo: integracao.codigo,
            items: visiveis.map((row) => ({
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
            count: visiveis.length,
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
