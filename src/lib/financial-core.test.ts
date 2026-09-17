import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildConsultiveResult,
  canTransition,
  isAutomaticFinancialActionAllowed,
  PACKAGE_STATUSES,
  resolveConsultiveBasis,
} from "./financial-core.ts";

const BASE_COMPLETO = {
  sourceName: "portal_postgres_cache",
  sourceCutId: "corte-2026-09-17",
  ruleVersion: "cand-2026-09-17",
  permission: "concedida",
  policyVersion: "cand-2026-09-17",
};

test("resolveConsultiveBasis exige os quatro elementos antes de qualquer base", () => {
  assert.deepEqual(resolveConsultiveBasis({}), {
    basis: "sem_base_financeira",
    reason: "fonte_ausente",
  });
  assert.deepEqual(resolveConsultiveBasis({ sourceName: "portal_postgres_cache" }), {
    basis: "sem_base_financeira",
    reason: "corte_ausente",
  });
  assert.deepEqual(
    resolveConsultiveBasis({
      sourceName: "portal_postgres_cache",
      sourceCutId: "corte-2026-09-17",
    }),
    { basis: "sem_base_financeira", reason: "regra_ausente" },
  );
  assert.deepEqual(
    resolveConsultiveBasis({
      sourceName: "portal_postgres_cache",
      sourceCutId: "corte-2026-09-17",
      ruleVersion: "cand-2026-09-17",
    }),
    { basis: "sem_base_financeira", reason: "permissao_ausente" },
  );
});

test("resolveConsultiveBasis nao autoriza base sem permissao concedida ou pedido explicito", () => {
  assert.deepEqual(
    resolveConsultiveBasis({
      sourceName: "portal_postgres_cache",
      sourceCutId: "corte-2026-09-17",
      ruleVersion: "cand-2026-09-17",
      permission: "negada",
    }),
    { basis: "sem_base_financeira", reason: "permissao_negada" },
  );
  assert.deepEqual(resolveConsultiveBasis(BASE_COMPLETO), {
    basis: "sem_base_financeira",
    reason: "base_nao_autorizada",
  });
  assert.deepEqual(resolveConsultiveBasis({ ...BASE_COMPLETO, explicitCandidateBasis: true }), {
    basis: "base_candidata",
    reason: "base_candidata",
  });
});

test("motor consultivo devolve SEM BASE FINANCEIRA por padrao", () => {
  const result = buildConsultiveResult({});
  assert.equal(result.basis, "sem_base_financeira");
  assert.equal(result.reason, "fonte_ausente");
  assert.equal(result.package.status, "rascunho");
  assert.equal(result.package.financialBasis, "sem_base_financeira");
  assert.equal(result.package.totals, null);
  assert.equal(result.package.writesToErp, false);
  assert.equal(result.automaticEmission, false);
  assert.equal(result.automaticBlock, false);
  assert.equal(result.writesToErp, false);
});

test("motor consultivo so abre base candidata com fonte, corte, regra e permissao", () => {
  const result = buildConsultiveResult({
    ...BASE_COMPLETO,
    explicitCandidateBasis: true,
    supplierId: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(result.basis, "base_candidata");
  assert.equal(result.package.status, "cotado");
  assert.equal(result.package.evidenceEnvelope.sourceName, "portal_postgres_cache");
  assert.equal(result.package.evidenceEnvelope.sourceCutId, "corte-2026-09-17");
  assert.equal(result.package.evidenceEnvelope.ruleVersion, "cand-2026-09-17");
  assert.equal(result.package.evidenceEnvelope.permission, "concedida");
});

test("maquina de estados exige acao explicita para transicoes sensiveis", () => {
  assert.equal(canTransition("rascunho", "cotado"), true);
  assert.equal(canTransition("em_analise", "aprovado"), false);
  assert.equal(canTransition("em_analise", "aprovado", { explicitAction: true }), true);
  assert.equal(canTransition("em_analise", "aprovado", { explicitAction: false }), false);
  assert.equal(canTransition("rascunho", "aprovado"), false);
  assert.equal(canTransition("liquidado", "liquidado_parcial"), false);
});

test("emissao e bloqueio automaticos sao proibidos", () => {
  assert.equal(isAutomaticFinancialActionAllowed("emitir"), false);
  assert.equal(isAutomaticFinancialActionAllowed("bloquear"), false);
  assert.equal((PACKAGE_STATUSES as readonly string[]).includes("emitido"), false);
  assert.equal((PACKAGE_STATUSES as readonly string[]).includes("bloqueado"), false);
});
