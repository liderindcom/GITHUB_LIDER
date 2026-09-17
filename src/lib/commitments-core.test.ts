import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAggregateResult,
  DISCLAIMER_COMPROMISSOS,
  hasReserveOrBalanceOrCostOfCapital,
  PERMISSAO_COMPRADOR_AUTORIZADO,
  resolveCommitmentBasis,
} from "./commitments-core.ts";

const BASE_AUTORIZADO = {
  sourceName: "portal_sqlite_cache",
  sourceCutId: "corte-2026-09-17",
  ruleVersion: "cand-2026-09-17",
  permission: PERMISSAO_COMPRADOR_AUTORIZADO,
};

const HORIZONTE = "2026-09-17";

test("resolveCommitmentBasis exige fonte, corte, regra e permissao de comprador", () => {
  assert.deepEqual(resolveCommitmentBasis({ supplierCode: "001" }), {
    basis: "sem_base_financeira",
    reason: "fonte_ausente",
  });
  assert.deepEqual(
    resolveCommitmentBasis({ supplierCode: "001", sourceName: "portal_sqlite_cache" }),
    {
      basis: "sem_base_financeira",
      reason: "corte_ausente",
    },
  );
  assert.deepEqual(
    resolveCommitmentBasis({
      supplierCode: "001",
      sourceName: "portal_sqlite_cache",
      sourceCutId: "corte-2026-09-17",
    }),
    { basis: "sem_base_financeira", reason: "regra_ausente" },
  );
  assert.deepEqual(
    resolveCommitmentBasis({
      supplierCode: "001",
      sourceName: "portal_sqlite_cache",
      sourceCutId: "corte-2026-09-17",
      ruleVersion: "cand-2026-09-17",
    }),
    { basis: "sem_base_financeira", reason: "permissao_ausente" },
  );
});

test("resolveCommitmentBasis nao autoriza base sem comprador autorizado ou pedido explicito", () => {
  assert.deepEqual(
    resolveCommitmentBasis({ ...BASE_AUTORIZADO, supplierCode: "001", permission: "fornecedor" }),
    { basis: "sem_base_financeira", reason: "permissao_negada" },
  );
  assert.deepEqual(resolveCommitmentBasis({ ...BASE_AUTORIZADO, supplierCode: "001" }), {
    basis: "sem_base_financeira",
    reason: "base_nao_autorizada",
  });
  assert.deepEqual(
    resolveCommitmentBasis({
      ...BASE_AUTORIZADO,
      supplierCode: "001",
      explicitBuyerAuthorization: true,
    }),
    { basis: "base_candidata", reason: "base_candidata" },
  );
});

test("motor devolve agregado SEM BASE FINANCEIRA por padrao e sem reserva/saldo/custo", () => {
  const result = buildAggregateResult({ supplierCode: "001", horizonDate: HORIZONTE });
  assert.equal(result.financialBasis, "sem_base_financeira");
  assert.equal(result.reason, "fonte_ausente");
  assert.equal(result.internalOnly, true);
  assert.equal(result.writesToErp, false);
  assert.equal(result.homologationStatus, "candidato");
  assert.equal(hasReserveOrBalanceOrCostOfCapital({ supplierCode: "001" }), false);
  assert.equal(result.disclaimer, DISCLAIMER_COMPROMISSOS);
  assert.equal(
    "reserva" in result ||
      "saldo" in result ||
      "custoCapital" in result ||
      "reserve" in result ||
      "balance" in result ||
      "costOfCapital" in result,
    false,
  );
});

test("motor soma por fornecedor, status e faixa de vencimento em relacao ao horizonte", () => {
  const result = buildAggregateResult({
    supplierCode: "001",
    horizonDate: HORIZONTE,
    ...BASE_AUTORIZADO,
    explicitBuyerAuthorization: true,
    generatedAt: "2026-09-17T12:00:00Z",
    rows: [
      { fornecedorCodigo: "001", vencimento: "2026-09-10", valor: 100, status: "Aberto" }, // vencido
      { fornecedorCodigo: "001", vencimento: "2026-09-17", valor: 200, status: "Programado" }, // 0_30
      { fornecedorCodigo: "001", vencimento: "2026-10-20", valor: 300, status: "Aberto" }, // 31_60
      { fornecedorCodigo: "001", vencimento: "2026-12-01", valor: 400, status: "Programado" }, // 61_90
      { fornecedorCodigo: "001", vencimento: "2027-01-01", valor: 500, status: "Aberto" }, // 91_180
      { fornecedorCodigo: "001", vencimento: "2027-06-01", valor: 600, status: "Programado" }, // 181_mais
      { fornecedorCodigo: "002", vencimento: "2026-09-17", valor: 9999, status: "Aberto" }, // outro fornecedor
      { fornecedorCodigo: "001", vencimento: "2026-09-17", valor: 42, status: "Descontado" }, // status fora
    ],
  });

  assert.equal(result.financialBasis, "base_candidata");
  const byId = new Map(result.rows.map((r) => [r.bucketId, r]));
  assert.equal(byId.get("vencido")?.statusAbertoAmount, "100.00");
  assert.equal(byId.get("0_30")?.statusProgramadoAmount, "200.00");
  assert.equal(byId.get("31_60")?.statusAbertoAmount, "300.00");
  assert.equal(byId.get("61_90")?.statusProgramadoAmount, "400.00");
  assert.equal(byId.get("91_180")?.statusAbertoAmount, "500.00");
  assert.equal(byId.get("181_mais")?.statusProgramadoAmount, "600.00");
  assert.equal(result.totals.totalAmount, "2100.00");
  assert.equal(result.totals.rowCount, 6);
  assert.equal(result.horizon.buckets[0]?.dueFrom, "1970-01-01");
  assert.equal(result.horizon.buckets.at(-1)?.dueTo, "9999-12-31");
});

test("valor zero e linhas ausentes produzem totais zerados validos", () => {
  const result = buildAggregateResult({
    supplierCode: "001",
    horizonDate: HORIZONTE,
    ...BASE_AUTORIZADO,
    explicitBuyerAuthorization: true,
    rows: [],
  });
  assert.equal(result.totals.totalAmount, "0.00");
  assert.equal(result.totals.rowCount, 0);
  assert.equal(result.rows.length, 6);
});
