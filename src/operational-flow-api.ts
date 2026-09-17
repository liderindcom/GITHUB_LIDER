import { createServerFn } from "@tanstack/react-start";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import {
  buildOperationalFlowProjection,
  DISCLAIMER_FLUXO_OPERACIONAL,
  OPERATIONAL_FLOW_SERIES,
  PERMISSAO_COMPRADOR_AUTORIZADO,
  type OperationalFlowCacheRow,
  type OperationalFlowInput,
  type OperationalFlowProjection,
  type OperationalFlowSeriesConfig,
  type OperationalFlowSeriesId,
} from "@/lib/operational-flow-core";
import { db } from "@/server/db";
import { exigirInterno } from "@/server/sessao-portal";

export const RULE_VERSION_FLUXO_OPERACIONAL = "cand-2026-09-17";

/**
 * As séries derivam exclusivamente dos caches documentados do portal:
 *   vendas_realizadas            → vendas (populada de RMS)
 *   entradas_financeiras_previstas → notas_fiscais (vencimento/pagamento previsto)
 *   compromissos_a_pagar         → contas_receber (débitos a pagar ao Líder)
 *
 * O cache não fornece um corte (sourceCutId) estável para cada fonte, então o
 * motor devolve SEM BASE FINANCEIRA para as séries sem corte, sem preencher
 * lacunas. Nunca é saldo bancário nem caixa disponível.
 */

type FlowServerInput = {
  supplierCode: string;
  horizonDate?: string;
  salesCutId?: string;
  forecastInflowCutId?: string;
  commitmentCutId?: string;
};

function tabelaExiste(nome: string): boolean {
  try {
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nome);
    return true;
  } catch {
    return false;
  }
}

function seriesConfig(sourceName: string, sourceCutId: string | null): OperationalFlowSeriesConfig {
  return {
    sourceName,
    sourceCutId,
    ruleVersion: RULE_VERSION_FLUXO_OPERACIONAL,
    permission: PERMISSAO_COMPRADOR_AUTORIZADO,
  };
}

/**
 * Projeção candidata de fluxo operacional por fornecedor/horizonte.
 *
 * Exposto SOMENTE a comprador interno autorizado (sessão interna verificada no
 * servidor). Nunca a fornecedor/AppCom. Cada série é devolvida SEM BASE
 * FINANCEIRA quando fonte, corte, regra ou permissão estiver ausente, sem
 * preencher lacunas. Nunca declara caixa disponível.
 */
export const consultarFluxoOperacionalFornecedor = createServerFn({ method: "GET" })
  .validator((data: FlowServerInput) => ({
    supplierCode: normalizarCodigoFornecedor(data?.supplierCode),
    horizonDate: data?.horizonDate,
    salesCutId: data?.salesCutId,
    forecastInflowCutId: data?.forecastInflowCutId,
    commitmentCutId: data?.commitmentCutId,
  }))
  .handler(({ data }): OperationalFlowProjection => {
    exigirInterno();

    const supplierCode = normalizarCodigoFornecedor(data.supplierCode);
    if (!supplierCode) throw new Error("Código do fornecedor obrigatório.");

    const salesCutId = data.salesCutId?.trim() || null;
    const forecastInflowCutId = data.forecastInflowCutId?.trim() || null;
    const commitmentCutId = data.commitmentCutId?.trim() || null;

    const salesByDate = readVendasValor(supplierCode);

    const forecastInflowRows = tabelaExiste("notas_fiscais")
      ? (
          db
            .prepare(
              `SELECT fornecedorCodigo, COALESCE(NULLIF(dataPagamento, ''), emissao) AS eventDate,
                    COALESCE(valorLiquido, valor, 0) AS valor
             FROM notas_fiscais
             WHERE fornecedorCodigo = ? AND status <> 'Pago'`,
            )
            .all(supplierCode) as Array<{
            fornecedorCodigo: string | null;
            eventDate: string | null;
            valor: number | null;
          }>
        )
          .filter((row) => !!(row.fornecedorCodigo ?? "").toString().trim())
          .map((row) => ({
            fornecedorCodigo: String(row.fornecedorCodigo).trim(),
            eventDate: String(row.eventDate ?? "").trim(),
            valor: Number(row.valor ?? 0),
          }))
      : [];

    const commitmentRows = tabelaExiste("contas_receber")
      ? (
          db
            .prepare(
              `SELECT fornecedorCodigo, vencimento AS eventDate, valor
             FROM contas_receber
             WHERE fornecedorCodigo = ? AND status IN ('Programado', 'Aberto')`,
            )
            .all(supplierCode) as Array<{
            fornecedorCodigo: string | null;
            eventDate: string | null;
            valor: number | null;
          }>
        )
          .filter((row) => !!(row.fornecedorCodigo ?? "").toString().trim())
          .map((row) => ({
            fornecedorCodigo: String(row.fornecedorCodigo).trim(),
            eventDate: String(row.eventDate ?? "").trim(),
            valor: Number(row.valor ?? 0),
          }))
      : [];

    const series = buildSeries(salesCutId, forecastInflowCutId, commitmentCutId);

    const input: OperationalFlowInput = {
      supplierCode,
      ...(data.horizonDate ? { horizonDate: data.horizonDate } : {}),
      series,
      explicitBuyerAuthorization: true,
      salesRows: salesByDate,
      forecastInflowRows,
      commitmentRows,
    };

    return buildOperationalFlowProjection(input);
  });

function readVendasValor(supplierCode: string): OperationalFlowCacheRow[] {
  if (!tabelaExiste("vendas")) return [];
  const comProdutos = tabelaExiste("produtos");
  const fornecedorExpr = comProdutos ? "p.fornecedorCodigo" : "v.fornecedorCodigo";
  const joinProdutos = comProdutos ? "JOIN produtos p ON p.sku = v.sku" : "";
  const rows = db
    .prepare(
      `SELECT v.data AS eventDate, ${fornecedorExpr} AS fornecedorCodigo,
              SUM(COALESCE(v.quantidade, 0) * COALESCE(v.valorUnitario, 0)) AS valor
       FROM vendas v
       ${joinProdutos}
       WHERE ${fornecedorExpr} = ?
       GROUP BY v.data, ${fornecedorExpr}`,
    )
    .all(supplierCode) as Array<{
    eventDate: string | null;
    fornecedorCodigo: string | null;
    valor: number | null;
  }>;
  return rows
    .filter((row) => !!(row.fornecedorCodigo ?? "").toString().trim())
    .map((row) => ({
      fornecedorCodigo: String(row.fornecedorCodigo).trim(),
      eventDate: String(row.eventDate ?? "").trim(),
      valor: Number(row.valor ?? 0),
    }));
}

function buildSeries(
  salesCutId: string | null,
  forecastInflowCutId: string | null,
  commitmentCutId: string | null,
): Partial<Record<OperationalFlowSeriesId, OperationalFlowSeriesConfig>> {
  return {
    vendas_realizadas: seriesConfig("portal_cache_vendas", salesCutId),
    entradas_financeiras_previstas: seriesConfig("portal_cache_notas_fiscais", forecastInflowCutId),
    compromissos_a_pagar: seriesConfig("portal_cache_contas_receber", commitmentCutId),
  };
}

export const FLUXO_OPERACIONAL_SERIES = OPERATIONAL_FLOW_SERIES;
export const DISCLAIMER_FLUXO_OPERACIONAL_API = DISCLAIMER_FLUXO_OPERACIONAL;
