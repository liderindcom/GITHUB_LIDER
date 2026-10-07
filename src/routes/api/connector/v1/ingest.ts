import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/server/db";

const MAX_RECORDS = 5000;

type IngestRecord = {
  idempotency_key?: unknown; data?: unknown; fornecedor_codigo?: unknown; fornecedor_nome?: unknown;
  loja_codigo?: unknown; loja_nome?: unknown; numero_nota?: unknown; serie?: unknown; sku?: unknown;
  produto_descricao?: unknown; quantidade?: unknown; valor_unitario?: unknown; valor_total?: unknown;
  ocorrencias?: unknown;
};

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

function autorizado(request: Request, connectorId: string): boolean {
  const esperado = process.env["PORTAL_CONNECTOR_TOKEN"]?.trim();
  const recebido = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const ids = (process.env["PORTAL_CONNECTOR_IDS"] || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!esperado || !recebido || !connectorId || (ids.length > 0 && !ids.includes(connectorId))) return false;
  const a = Buffer.from(esperado); const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

function texto(value: unknown, limite = 400): string { return String(value ?? "").trim().slice(0, limite); }
function numero(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("valor numérico inválido");
  return parsed;
}

function garantirStaging() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rms_connector_agenda_520_staging (
      connector_id TEXT NOT NULL, idempotency_key TEXT PRIMARY KEY, data TEXT NOT NULL,
      fornecedor_codigo TEXT NOT NULL, fornecedor_nome TEXT NOT NULL, loja_codigo TEXT NOT NULL,
      loja_nome TEXT NOT NULL, numero_nota TEXT NOT NULL, serie TEXT NOT NULL, sku TEXT NOT NULL,
      produto_descricao TEXT NOT NULL, quantidade DOUBLE PRECISION NOT NULL,
      valor_unitario DOUBLE PRECISION NOT NULL, valor_total DOUBLE PRECISION NOT NULL,
      ocorrencias INTEGER NOT NULL, recebido_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rms_connector_520_staging_data
      ON rms_connector_agenda_520_staging (connector_id, data);
  `);
}

export const Route = createFileRoute("/api/connector/v1/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tamanho = Number(request.headers.get("content-length") || 0);
        if (tamanho > 10_000_000) return error("Lote maior que o limite de 10 MB.", 413);
        let body: unknown;
        try { body = await request.json(); } catch { return error("JSON inválido.", 400); }
        if (!body || typeof body !== "object") return error("Corpo inválido.", 400);
        const envelope = body as { schema?: unknown; connector_id?: unknown; records?: unknown };
        const connectorId = texto(envelope.connector_id, 100);
        if (!autorizado(request, connectorId)) return error("Não autorizado.", 401);
        if (envelope.schema !== "agenda_520_perdas_v1" || !Array.isArray(envelope.records)) return error("Contrato de dados não suportado.", 400);
        if (envelope.records.length === 0) return Response.json({ accepted: 0, duplicated: 0 });
        if (envelope.records.length > MAX_RECORDS) return error(`Máximo de ${MAX_RECORDS} registros por lote.`, 413);

        garantirStaging();
        const recebidoEm = new Date().toISOString(); let accepted = 0; let duplicated = 0;
        const insert = db.prepare(`INSERT INTO rms_connector_agenda_520_staging (
          connector_id, idempotency_key, data, fornecedor_codigo, fornecedor_nome, loja_codigo,
          loja_nome, numero_nota, serie, sku, produto_descricao, quantidade, valor_unitario,
          valor_total, ocorrencias, recebido_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        try {
          for (const candidate of envelope.records as IngestRecord[]) {
            const key = texto(candidate.idempotency_key, 128); const data = texto(candidate.data, 30);
            const fornecedor = texto(candidate.fornecedor_codigo, 80); const loja = texto(candidate.loja_codigo, 80);
            const sku = texto(candidate.sku, 100);
            if (!key || !data || !fornecedor || !loja || !sku) return error("Registro sem chave obrigatória.", 422);
            try {
              insert.run(connectorId, key, data, fornecedor, texto(candidate.fornecedor_nome), loja,
                texto(candidate.loja_nome), texto(candidate.numero_nota, 80), texto(candidate.serie, 40), sku,
                texto(candidate.produto_descricao), numero(candidate.quantidade), numero(candidate.valor_unitario),
                numero(candidate.valor_total), Math.trunc(numero(candidate.ocorrencias ?? 0)), recebidoEm);
              accepted += 1;
            } catch (cause) {
              if (String(cause).toLowerCase().includes("unique") || String(cause).toLowerCase().includes("duplicate")) { duplicated += 1; continue; }
              throw cause;
            }
          }
        } catch (cause) { return error(`Lote rejeitado: ${String(cause)}`, 422); }
        return Response.json({ accepted, duplicated, staging: true }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
