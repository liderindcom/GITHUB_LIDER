import { createServerFn } from "@tanstack/react-start";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { db } from "../server/db";
import {
  exigirInterno,
  exigirInternoRole,
  exigirSessaoFornecedor,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
} from "../server/sessao-portal";

export type PeriodicidadeCalculoPromotor = "DIARIO" | "MENSAL";
export type StatusPeriodicidadeCalculo = "SEM_SOLICITACAO" | "PENDENTE" | "APROVADA" | "REJEITADA";

export type PreferenciaCalculoPromotor = {
  fornecedorCodigo: string;
  fornecedorNome?: string | null;
  periodicidade: PeriodicidadeCalculoPromotor;
  periodicidadeAtiva?: PeriodicidadeCalculoPromotor;
  status: StatusPeriodicidadeCalculo;
  observacao?: string | null;
  solicitadoPor?: string | null;
  solicitadoEm?: string | null;
  aprovadoPor?: string | null;
  aprovadoEm?: string | null;
  atualizadoEm?: string | null;
};

function ensurePreferencias() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS portalPromotorCalculoPreferencias (
      fornecedorCodigo TEXT PRIMARY KEY,
      periodicidade TEXT NOT NULL DEFAULT 'DIARIO',
      periodicidadeAtiva TEXT NOT NULL DEFAULT 'DIARIO',
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      observacao TEXT,
      solicitadoPor TEXT,
      solicitadoEm TEXT NOT NULL,
      aprovadoPor TEXT,
      aprovadoEm TEXT,
      atualizadoEm TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_portalPromotorCalculoPreferencias_status
      ON portalPromotorCalculoPreferencias (status, periodicidade);
  `);
  try {
    db.exec(
      "ALTER TABLE portalPromotorCalculoPreferencias ADD COLUMN periodicidadeAtiva TEXT NOT NULL DEFAULT 'DIARIO'",
    );
  } catch {
    // Coluna já existente.
  }
  try {
    db.prepare(
      "UPDATE portalPromotorCalculoPreferencias SET periodicidadeAtiva = periodicidade WHERE status = 'APROVADA'",
    ).run();
  } catch {
    // Banco legado sem a tabela ainda disponível.
  }
}

function normalizarPeriodicidade(value: unknown): PeriodicidadeCalculoPromotor {
  return String(value ?? "").toUpperCase() === "MENSAL" ? "MENSAL" : "DIARIO";
}

function normalizarStatus(value: unknown): StatusPeriodicidadeCalculo {
  const status = String(value ?? "").toUpperCase();
  if (status === "APROVADA" || status === "REJEITADA" || status === "PENDENTE") {
    return status;
  }
  return "SEM_SOLICITACAO";
}

function mapRow(
  row: Record<string, unknown> | undefined,
  codigo: string,
): PreferenciaCalculoPromotor {
  return {
    fornecedorCodigo: codigo,
    fornecedorNome: row?.["fornecedorNome"] == null ? null : String(row["fornecedorNome"]),
    periodicidade: normalizarPeriodicidade(row?.["periodicidade"]),
    periodicidadeAtiva: normalizarPeriodicidade(
      row?.["periodicidadeAtiva"] ?? row?.["periodicidade"],
    ),
    status: normalizarStatus(row?.["status"]),
    observacao: row?.["observacao"] == null ? null : String(row["observacao"]),
    solicitadoPor: row?.["solicitadoPor"] == null ? null : String(row["solicitadoPor"]),
    solicitadoEm: row?.["solicitadoEm"] == null ? null : String(row["solicitadoEm"]),
    aprovadoPor: row?.["aprovadoPor"] == null ? null : String(row["aprovadoPor"]),
    aprovadoEm: row?.["aprovadoEm"] == null ? null : String(row["aprovadoEm"]),
    atualizadoEm: row?.["atualizadoEm"] == null ? null : String(row["atualizadoEm"]),
  };
}

export const fetchPreferenciaCalculoPromotor = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo?: string) => fornecedorCodigo ?? "")
  .handler(async ({ data }) => {
    const sessao = lerSessaoPortal();
    if (!sessao) throw new Error("Sessão exigida.");
    ensurePreferencias();
    const codigo =
      sessao.tipo === "fornecedor"
        ? normalizarCodigoFornecedor(resolverCodigoFornecedorDados(sessao.codigo))
        : normalizarCodigoFornecedor(resolverCodigoFornecedorDados(data));
    if (!codigo) throw new Error("Fornecedor exigido para consultar a periodicidade.");
    const row = db
      .prepare(
        `SELECT p.fornecedorCodigo, f.nome AS fornecedorNome, p.periodicidade,
                p.periodicidadeAtiva, p.status,
                p.observacao, p.solicitadoPor, p.solicitadoEm, p.aprovadoPor,
                p.aprovadoEm, p.atualizadoEm
           FROM portalPromotorCalculoPreferencias p
           LEFT JOIN fornecedores f ON f.codigo = p.fornecedorCodigo
          WHERE p.fornecedorCodigo = ?`,
      )
      .get(codigo) as Record<string, unknown> | undefined;
    return mapRow(row, codigo);
  });

export const solicitarPreferenciaCalculoPromotor = createServerFn({ method: "POST" })
  .validator(
    (data: { periodicidade: PeriodicidadeCalculoPromotor; observacao?: string | null }) => data,
  )
  .handler(async ({ data }) => {
    const sessao = exigirSessaoFornecedor();
    ensurePreferencias();
    const codigo = normalizarCodigoFornecedor(resolverCodigoFornecedorDados(sessao.codigo));
    if (!codigo) throw new Error("Fornecedor inválido.");
    const agora = new Date().toISOString();
    const periodicidade = normalizarPeriodicidade(data.periodicidade);
    const observacao =
      String(data.observacao ?? "")
        .trim()
        .slice(0, 1000) || null;
    db.prepare(
      `INSERT INTO portalPromotorCalculoPreferencias
         (fornecedorCodigo, periodicidade, periodicidadeAtiva, status, observacao, solicitadoPor, solicitadoEm,
          aprovadoPor, aprovadoEm, atualizadoEm)
       VALUES (?, ?, 'DIARIO', 'PENDENTE', ?, ?, ?, NULL, NULL, ?)
       ON CONFLICT (fornecedorCodigo) DO UPDATE SET
         periodicidade = excluded.periodicidade,
         status = 'PENDENTE',
         observacao = excluded.observacao,
         solicitadoPor = excluded.solicitadoPor,
         solicitadoEm = excluded.solicitadoEm,
         aprovadoPor = NULL,
         aprovadoEm = NULL,
         atualizadoEm = excluded.atualizadoEm`,
    ).run(codigo, periodicidade, observacao, sessao.email || sessao.codigo, agora, agora);
    return fetchPreferenciaInterna(codigo);
  });

function fetchPreferenciaInterna(codigo: string): PreferenciaCalculoPromotor {
  const row = db
    .prepare(
      `SELECT p.fornecedorCodigo, f.nome AS fornecedorNome, p.periodicidade,
              p.periodicidadeAtiva, p.status,
              p.observacao, p.solicitadoPor, p.solicitadoEm, p.aprovadoPor,
              p.aprovadoEm, p.atualizadoEm
         FROM portalPromotorCalculoPreferencias p
         LEFT JOIN fornecedores f ON f.codigo = p.fornecedorCodigo
        WHERE p.fornecedorCodigo = ?`,
    )
    .get(codigo) as Record<string, unknown> | undefined;
  return mapRow(row, codigo);
}

export const fetchPreferenciasCalculoPromotoresAdmin = createServerFn({ method: "GET" }).handler(
  async () => {
    exigirInterno();
    ensurePreferencias();
    const rows = db
      .prepare(
        `SELECT p.fornecedorCodigo, f.nome AS fornecedorNome, p.periodicidade,
                p.periodicidadeAtiva, p.status,
                p.observacao, p.solicitadoPor, p.solicitadoEm, p.aprovadoPor,
                p.aprovadoEm, p.atualizadoEm
           FROM portalPromotorCalculoPreferencias p
           LEFT JOIN fornecedores f ON f.codigo = p.fornecedorCodigo
          ORDER BY CASE WHEN p.status = 'PENDENTE' THEN 0 ELSE 1 END,
                   COALESCE(p.solicitadoEm, p.atualizadoEm) DESC`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) =>
      mapRow(row, normalizarCodigoFornecedor(String(row["fornecedorCodigo"] ?? ""))),
    );
  },
);

export const aprovarPreferenciaCalculoPromotor = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      periodicidade: PeriodicidadeCalculoPromotor;
      aprovada: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessao = exigirInternoRole("admin");
    ensurePreferencias();
    const codigo = normalizarCodigoFornecedor(data.fornecedorCodigo);
    if (!codigo) throw new Error("Fornecedor inválido.");
    const agora = new Date().toISOString();
    const status = data.aprovada ? "APROVADA" : "REJEITADA";
    const periodicidade = normalizarPeriodicidade(data.periodicidade);
    const existente = db
      .prepare(
        "SELECT fornecedorCodigo FROM portalPromotorCalculoPreferencias WHERE fornecedorCodigo = ?",
      )
      .get(codigo);
    if (!existente) {
      db.prepare(
        `INSERT INTO portalPromotorCalculoPreferencias
          (fornecedorCodigo, periodicidade, periodicidadeAtiva, status, solicitadoPor, solicitadoEm,
           aprovadoPor, aprovadoEm, atualizadoEm)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      ).run(codigo, periodicidade, periodicidade, status, agora, sessao.codigo, agora, agora);
    } else {
      db.prepare(
        `UPDATE portalPromotorCalculoPreferencias
            SET periodicidade = ?, periodicidadeAtiva = ?, status = ?, aprovadoPor = ?, aprovadoEm = ?, atualizadoEm = ?
          WHERE fornecedorCodigo = ?`,
      ).run(periodicidade, periodicidade, status, sessao.codigo, agora, agora, codigo);
    }
    return fetchPreferenciaInterna(codigo);
  });
