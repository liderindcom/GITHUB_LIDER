import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildOperationalFlowProjection,
  DISCLAIMER_FLUXO_OPERACIONAL,
  hasBankBalanceOrAvailableCash,
  OPERATIONAL_FLOW_SERIES,
  PERMISSAO_COMPRADOR_AUTORIZADO,
  resolveOperationalFlowSeriesBasis,
} from "./operational-flow-core.ts";

const CONFIG_OK = {
  sourceName: "portal_cache_vendas",
  sourceCutId: "corte-2026-09-17",
  ruleVersion: "cand-2026-09-17",
  permission: PERMISSAO_COMPRADOR_AUTORIZADO,
};

const HORIZONTE = "2026-09-17";

function seriesCompletas() {
  return {
    vendas_realizadas: { ...CONFIG_OK },
    entradas_financeiras_previstas: { ...CONFIG_OK },
    compromissos_a_pagar: { ...CONFIG_OK },
  };
}

test("resolveOperationalFlowSeriesBasis exige fonte, corte, regra e permissao por serie", () => {
  assert.deepEqual(resolveOperationalFlowSeriesBasis(undefined), {
    basis: "sem_base_financeira",
    reason: "series_ausente",
  });
  assert.deepEqual(resolveOperationalFlowSeriesBasis({ sourceName: "portal_cache_vendas" }), {
    basis: "sem_base_financeira",
    reason: "corte_ausente",
  });
  assert.deepEqual(
    resolveOperationalFlowSeriesBasis({
      sourceName: "portal_cache_vendas",
      sourceCutId: "corte-2026-09-17",
      ruleVersion: "cand-2026-09-17",
    }),
    { basis: "sem_base_financeira", reason: "permissao_ausente" },
  );
  assert.deepEqual(resolveOperationalFlowSeriesBasis({ ...CONFIG_OK, permission: "fornecedor" }), {
    basis: "sem_base_financeira",
    reason: "permissao_negada",
  });
  assert.deepEqual(resolveOperationalFlowSeriesBasis(CONFIG_OK), {
    basis: "base_candidata",
    reason: "base_candidata",
  });
});

test("motor devolve SEM BASE FINANCEIRA por padrao sem series e sem preencher lacunas", () => {
  const result = buildOperationalFlowProjection({ supplierCode: "001", horizonDate: HORIZONTE });
  assert.equal(result.financialBasis, "sem_base_financeira");
  assert.equal(result.reason, "series_ausente");
  assert.equal(result.internalOnly, true);
  assert.equal(result.writesToErp, false);
  assert.equal(result.homologationStatus, "candidato");
  assert.equal(result.disclaimer, DISCLAIMER_FLUXO_OPERACIONAL);
  assert.equal(result.series.length, 3);
  for (const series of result.series) {
    assert.equal(series.financialBasis, "sem_base_financeira");
  }
  for (const row of result.rows) {
    assert.equal(row.vendasRealizadasAmount, null);
    assert.equal(row.entradasFinanceirasPrevistasAmount, null);
    assert.equal(row.compromissosAPagarAmount, null);
    assert.equal(row.projectedOperationalFlowAmount, null);
  }
  assert.equal(result.totals.projectedOperationalFlowAmount, null);
  assert.equal(hasBankBalanceOrAvailableCash({ supplierCode: "001" }), false);
});

test("uma serie sem corte derruba a projecao inteira para SEM BASE FINANCEIRA", () => {
  const todas = seriesCompletas();
  const series: Partial<
    Record<
      string,
      { sourceName: string; sourceCutId: string; ruleVersion: string; permission: string }
    >
  > = {
    vendas_realizadas: todas.vendas_realizadas,
    entradas_financeiras_previstas: todas.entradas_financeiras_previstas,
  };
  const result = buildOperationalFlowProjection({
    supplierCode: "001",
    horizonDate: HORIZONTE,
    series,
    explicitBuyerAuthorization: true,
    salesRows: [{ fornecedorCodigo: "001", eventDate: "2026-09-17", valor: 100 }],
    forecastInflowRows: [{ fornecedorCodigo: "001", eventDate: "2026-09-17", valor: 200 }],
    commitmentRows: [{ fornecedorCodigo: "001", eventDate: "2026-09-17", valor: 50 }],
  });
  assert.equal(result.financialBasis, "sem_base_financeira");
  assert.equal(result.reason, "series_ausente");
  const compromissos = result.series.find((s) => s.seriesId === "compromissos_a_pagar");
  assert.equal(compromissos?.reason, "series_ausente");
  for (const row of result.rows) {
    assert.equal(row.projectedOperationalFlowAmount, null);
  }
  assert.equal(result.totals.projectedOperationalFlowAmount, null);
});

test("falta de comprador autorizado explicito devolve base_nao_autorizada", () => {
  const result = buildOperationalFlowProjection({
    supplierCode: "001",
    horizonDate: HORIZONTE,
    series: seriesCompletas(),
  });
  assert.equal(result.financialBasis, "sem_base_financeira");
  assert.equal(result.reason, "base_nao_autorizada");
});

test("projeta fluxo operacional por faixa com todas as series autorizadas", () => {
  const result = buildOperationalFlowProjection({
    supplierCode: "001",
    horizonDate: HORIZONTE,
    series: seriesCompletas(),
    explicitBuyerAuthorization: true,
    generatedAt: "2026-09-17T12:00:00Z",
    salesRows: [
      { fornecedorCodigo: "001", eventDate: "2026-09-10", valor: 100 }, // vencido
      { fornecedorCodigo: "001", eventDate: "2026-09-17", valor: 300 }, // 0_30
    ],
    forecastInflowRows: [
      { fornecedorCodigo: "001", eventDate: "2026-09-17", valor: 910 }, // 0_30
    ],
    commitmentRows: [
      { fornecedorCodigo: "001", eventDate: "2026-09-20", valor: 400 }, // 0_30
    ],
  });
  assert.equal(result.financialBasis, "base_candidata");
  const byId = new Map(result.rows.map((r) => [r.bucketId, r]));
  assert.equal(byId.get("vencido")?.vendasRealizadasAmount, "100.00");
  assert.equal(byId.get("0_30")?.vendasRealizadasAmount, "300.00");
  assert.equal(byId.get("0_30")?.entradasFinanceirasPrevistasAmount, "910.00");
  assert.equal(byId.get("0_30")?.compromissosAPagarAmount, "400.00");
  assert.equal(byId.get("0_30")?.projectedOperationalFlowAmount, "810.00");
  assert.equal(result.totals.vendasRealizadasAmount, "400.00");
  assert.equal(result.totals.entradasFinanceirasPrevistasAmount, "910.00");
  assert.equal(result.totals.compromissosAPagarAmount, "400.00");
  assert.equal(result.totals.projectedOperationalFlowAmount, "910.00");
  assert.deepEqual(
    [...result.series.map((s) => s.seriesId)].sort(),
    [...OPERATIONAL_FLOW_SERIES].sort(),
  );
});

test("nunca declara saldo bancario nem caixa disponivel como campos", () => {
  const result = buildOperationalFlowProjection({
    supplierCode: "001",
    horizonDate: HORIZONTE,
    series: seriesCompletas(),
    explicitBuyerAuthorization: true,
  });
  const serialized = JSON.stringify(result);
  assert.equal(/bankBalance|availableCash|saldoBancario|caixaDisponivel/i.test(serialized), false);
  assert.equal("bankBalance" in result, false);
  assert.equal("availableCash" in result, false);
  assert.equal("saldoBancario" in result, false);
  assert.equal("caixaDisponivel" in result, false);
});
