import { createServerFn } from "@tanstack/react-start";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import {
  buildAggregateResult,
  DISCLAIMER_COMPROMISSOS,
  PERMISSAO_COMPRADOR_AUTORIZADO,
  type CommitmentAggregateResult,
  type CommitmentCacheRow,
} from "@/lib/commitments-core";
import { db } from "@/server/db";
import { exigirInterno } from "@/server/sessao-portal";

export const RULE_VERSION_COMPROMISSOS = "cand-2026-09-17";
export const SOURCE_NAME_COMPROMISSOS = "portal_cache_contas_receber";

function tabelaContasReceberExiste(): boolean {
  try {
    db.prepare("SELECT 1 FROM contas_receber LIMIT 1").get();
    return true;
  } catch {
    return false;
  }
}

/**
 * Agregado de compromissos a pagar por fornecedor/horizonte.
 *
 * Exposto SOMENTE a comprador interno autorizado (sessão interna verificada no
 * servidor). Nunca a fornecedor/AppCom. O cache documentado não fornece um
 * corte (sourceCutId) estável, então o motor devolve sem_base_financeira por
 * padrão: SEM reserva, SEM saldo e SEM custo de capital.
 */
export const consultarCompromissosFornecedor = createServerFn({ method: "GET" })
  .validator((data: { supplierCode: string; horizonDate?: string }) => ({
    supplierCode: normalizarCodigoFornecedor(data?.supplierCode),
    horizonDate: data?.horizonDate,
  }))
  .handler(({ data }): CommitmentAggregateResult => {
    exigirInterno();

    const supplierCode = normalizarCodigoFornecedor(data.supplierCode);
    if (!supplierCode) throw new Error("Código do fornecedor obrigatório.");

    if (!tabelaContasReceberExiste()) {
      return buildAggregateResult({
        supplierCode,
        ...(data.horizonDate ? { horizonDate: data.horizonDate } : {}),
        sourceName: SOURCE_NAME_COMPROMISSOS,
        sourceCutId: null,
        ruleVersion: RULE_VERSION_COMPROMISSOS,
        permission: PERMISSAO_COMPRADOR_AUTORIZADO,
        explicitBuyerAuthorization: true,
        rows: [],
      });
    }

    const rows = db
      .prepare(
        `SELECT fornecedorCodigo, vencimento, valor, status
         FROM contas_receber
         WHERE status IN ('Programado', 'Aberto')`,
      )
      .all() as Array<{
      fornecedorCodigo: string | null;
      vencimento: string | null;
      valor: number | null;
      status: string | null;
    }>;

    const cacheRows: CommitmentCacheRow[] = rows
      .filter((row) => !!(row.fornecedorCodigo ?? "").toString().trim())
      .map((row) => ({
        fornecedorCodigo: String(row.fornecedorCodigo).trim(),
        vencimento: String(row.vencimento ?? "").trim(),
        valor: Number(row.valor ?? 0),
        status: String(row.status ?? "").trim(),
      }));

    return buildAggregateResult({
      supplierCode,
      ...(data.horizonDate ? { horizonDate: data.horizonDate } : {}),
      sourceName: SOURCE_NAME_COMPROMISSOS,
      sourceCutId: null,
      ruleVersion: RULE_VERSION_COMPROMISSOS,
      permission: PERMISSAO_COMPRADOR_AUTORIZADO,
      explicitBuyerAuthorization: true,
      rows: cacheRows,
    });
  });

export const DISCLAIMER_COMPROMISSOS_API = DISCLAIMER_COMPROMISSOS;
