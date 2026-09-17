export const OPERATIONAL_FLOW_SERIES = [
  "vendas_realizadas",
  "entradas_financeiras_previstas",
  "compromissos_a_pagar",
] as const;
export type OperationalFlowSeriesId = (typeof OPERATIONAL_FLOW_SERIES)[number];

export const OPERATIONAL_FLOW_BASIS = ["sem_base_financeira", "base_candidata"] as const;
export type OperationalFlowBasis = (typeof OPERATIONAL_FLOW_BASIS)[number];

export const PERMISSAO_COMPRADOR_AUTORIZADO = "comprador_autorizado";

export type OperationalFlowBasisReason =
  | "series_ausente"
  | "fonte_ausente"
  | "corte_ausente"
  | "regra_ausente"
  | "permissao_ausente"
  | "permissao_negada"
  | "base_nao_autorizada"
  | "base_candidata";

export type OperationalFlowSeriesConfig = {
  sourceName?: string | null;
  sourceCutId?: string | null;
  ruleVersion?: string | null;
  permission?: string | null;
};

export type OperationalFlowSeriesStatus = {
  seriesId: OperationalFlowSeriesId;
  sourceName: string | null;
  sourceCutId: string | null;
  ruleVersion: string | null;
  permission: string | null;
  financialBasis: OperationalFlowBasis;
  reason: OperationalFlowBasisReason;
};

export type OperationalFlowCacheRow = {
  fornecedorCodigo: string;
  eventDate: string;
  valor: number;
};

export type OperationalFlowInput = {
  supplierCode: string;
  horizonId?: string;
  horizonDate?: string;
  series?: Partial<Record<OperationalFlowSeriesId, OperationalFlowSeriesConfig>>;
  explicitBuyerAuthorization?: boolean;
  generatedAt?: string;
  salesRows?: OperationalFlowCacheRow[];
  forecastInflowRows?: OperationalFlowCacheRow[];
  commitmentRows?: OperationalFlowCacheRow[];
};

export type OperationalFlowBucket = {
  bucketId: string;
  fromDate: string;
  toDate: string;
};

export type OperationalFlowLine = {
  bucketId: string;
  fromDate: string;
  toDate: string;
  vendasRealizadasAmount: string | null;
  entradasFinanceirasPrevistasAmount: string | null;
  compromissosAPagarAmount: string | null;
  projectedOperationalFlowAmount: string | null;
};

export type OperationalFlowTotals = {
  vendasRealizadasAmount: string | null;
  entradasFinanceirasPrevistasAmount: string | null;
  compromissosAPagarAmount: string | null;
  projectedOperationalFlowAmount: string | null;
  rowCount: number;
};

export type OperationalFlowProjection = {
  generatedAt: string;
  homologationStatus: "candidato";
  supplierCode: string;
  horizon: {
    horizonId: string;
    horizonDate: string;
    buckets: OperationalFlowBucket[];
  };
  internalOnly: true;
  financialBasis: OperationalFlowBasis;
  reason: OperationalFlowBasisReason;
  series: OperationalFlowSeriesStatus[];
  rows: OperationalFlowLine[];
  totals: OperationalFlowTotals;
  writesToErp: false;
  disclaimer: string;
};

export const DISCLAIMER_FLUXO_OPERACIONAL =
  "Fluxo operacional projetado por horizonte (vendas realizadas + entradas financeiras previstas - compromissos a pagar). Nao e saldo bancario nem caixa disponivel; sem preencher lacunas quando fonte, corte, regra ou permissao estiver ausente. Interno para comprador autorizado; nunca exposto a fornecedor ou AppCom.";

/** Faixas de horizonte relativas à data base (inclusive). Mesma semântica do agregado de compromissos. */
export const OPERATIONAL_FLOW_BUCKETS: readonly {
  id: string;
  fromDays: number | null;
  toDays: number | null;
  fromFallback: string;
  toFallback: string;
}[] = [
  { id: "vencido", fromDays: null, toDays: -1, fromFallback: "1970-01-01", toFallback: "" },
  { id: "0_30", fromDays: 0, toDays: 30, fromFallback: "", toFallback: "" },
  { id: "31_60", fromDays: 31, toDays: 60, fromFallback: "", toFallback: "" },
  { id: "61_90", fromDays: 61, toDays: 90, fromFallback: "", toFallback: "" },
  { id: "91_180", fromDays: 91, toDays: 180, fromFallback: "", toFallback: "" },
  { id: "181_mais", fromDays: 181, toDays: null, fromFallback: "", toFallback: "9999-12-31" },
];

function isEmpty(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

function toAmount(value: number): string {
  return value.toFixed(2);
}

/**
 * Cada série exige explicitamente fonte, corte, regra e permissão.
 * Sem qualquer um deles a série fica SEM BASE FINANCEIRA e não tem lacuna preenchida.
 */
export function resolveOperationalFlowSeriesBasis(
  config: OperationalFlowSeriesConfig | undefined,
): { basis: OperationalFlowBasis; reason: OperationalFlowBasisReason } {
  if (!config) return { basis: "sem_base_financeira", reason: "series_ausente" };
  if (isEmpty(config.sourceName)) return { basis: "sem_base_financeira", reason: "fonte_ausente" };
  if (isEmpty(config.sourceCutId)) return { basis: "sem_base_financeira", reason: "corte_ausente" };
  if (isEmpty(config.ruleVersion)) return { basis: "sem_base_financeira", reason: "regra_ausente" };
  if (isEmpty(config.permission))
    return { basis: "sem_base_financeira", reason: "permissao_ausente" };
  if (config.permission !== PERMISSAO_COMPRADOR_AUTORIZADO)
    return { basis: "sem_base_financeira", reason: "permissao_negada" };
  return { basis: "base_candidata", reason: "base_candidata" };
}

function overallBasis(
  statuses: OperationalFlowSeriesStatus[],
  explicitBuyerAuthorization: boolean | undefined,
): { basis: OperationalFlowBasis; reason: OperationalFlowBasisReason } {
  for (const status of statuses) {
    if (status.financialBasis !== "base_candidata") {
      return { basis: "sem_base_financeira", reason: status.reason };
    }
  }
  if (explicitBuyerAuthorization !== true) {
    return { basis: "sem_base_financeira", reason: "base_nao_autorizada" };
  }
  return { basis: "base_candidata", reason: "base_candidata" };
}

function sumBucket(
  rows: OperationalFlowCacheRow[],
  supplierCode: string,
  horizonDate: Date,
  bucket: (typeof OPERATIONAL_FLOW_BUCKETS)[number],
): { amount: number; count: number } {
  let amount = 0;
  let count = 0;
  for (const row of rows) {
    if (String(row.fornecedorCodigo ?? "").trim() !== supplierCode) continue;
    const eventDate = row.eventDate;
    if (!eventDate) continue;
    const parsed = new Date(`${eventDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) continue;
    const diffDays = Math.floor((parsed.getTime() - horizonDate.getTime()) / 86_400_000);
    if (bucket.fromDays !== null && diffDays < bucket.fromDays) continue;
    if (bucket.toDays !== null && diffDays > bucket.toDays) continue;
    amount += Number(row.valor ?? 0);
    count += 1;
  }
  return { amount, count };
}

export function buildOperationalFlowProjection(
  input: OperationalFlowInput,
): OperationalFlowProjection {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const horizonDate = input.horizonDate ?? isoDate(new Date());
  const horizonId = input.horizonId ?? `h-${horizonDate}`;
  const hp = new Date(`${horizonDate}T12:00:00`);
  const supplierCode = input.supplierCode.trim();
  const seriesInput = input.series ?? {};

  const seriesIds = [...OPERATIONAL_FLOW_SERIES];
  const statuses: OperationalFlowSeriesStatus[] = seriesIds.map((seriesId) => {
    const config = seriesInput[seriesId];
    const resolved = resolveOperationalFlowSeriesBasis(config);
    return {
      seriesId,
      sourceName: config?.sourceName ?? null,
      sourceCutId: config?.sourceCutId ?? null,
      ruleVersion: config?.ruleVersion ?? null,
      permission: config?.permission ?? null,
      financialBasis: resolved.basis,
      reason: resolved.reason,
    };
  });

  const overall = overallBasis(statuses, input.explicitBuyerAuthorization);
  const basisBySeries = new Map(statuses.map((s) => [s.seriesId, s.financialBasis]));
  const rowsBySeries: Record<OperationalFlowSeriesId, OperationalFlowCacheRow[]> = {
    vendas_realizadas:
      basisBySeries.get("vendas_realizadas") === "base_candidata" ? (input.salesRows ?? []) : [],
    entradas_financeiras_previstas:
      basisBySeries.get("entradas_financeiras_previstas") === "base_candidata"
        ? (input.forecastInflowRows ?? [])
        : [],
    compromissos_a_pagar:
      basisBySeries.get("compromissos_a_pagar") === "base_candidata"
        ? (input.commitmentRows ?? [])
        : [],
  };

  const buckets: OperationalFlowBucket[] = [];
  const lines: OperationalFlowLine[] = [];
  const totals: OperationalFlowTotals = {
    vendasRealizadasAmount: null,
    entradasFinanceirasPrevistasAmount: null,
    compromissosAPagarAmount: null,
    projectedOperationalFlowAmount: null,
    rowCount: 0,
  };

  const totalsBySeries: Record<OperationalFlowSeriesId, number> = {
    vendas_realizadas: 0,
    entradas_financeiras_previstas: 0,
    compromissos_a_pagar: 0,
  };
  let totalRowCount = 0;

  for (const bucket of OPERATIONAL_FLOW_BUCKETS) {
    const fromDate =
      bucket.fromDays === null ? bucket.fromFallback : isoDate(addDays(hp, bucket.fromDays));
    const toDate = bucket.toDays === null ? bucket.toFallback : isoDate(addDays(hp, bucket.toDays));
    buckets.push({ bucketId: bucket.id, fromDate, toDate });

    const sales =
      basisBySeries.get("vendas_realizadas") === "base_candidata"
        ? sumBucket(rowsBySeries.vendas_realizadas, supplierCode, hp, bucket)
        : null;
    const inflows =
      basisBySeries.get("entradas_financeiras_previstas") === "base_candidata"
        ? sumBucket(rowsBySeries.entradas_financeiras_previstas, supplierCode, hp, bucket)
        : null;
    const commitments =
      basisBySeries.get("compromissos_a_pagar") === "base_candidata"
        ? sumBucket(rowsBySeries.compromissos_a_pagar, supplierCode, hp, bucket)
        : null;

    const salesAmount = sales === null ? null : toAmount(sales.amount);
    const inflowsAmount = inflows === null ? null : toAmount(inflows.amount);
    const commitmentsAmount = commitments === null ? null : toAmount(commitments.amount);
    const projectedAmount =
      sales !== null && inflows !== null && commitments !== null
        ? toAmount(sales.amount + inflows.amount - commitments.amount)
        : null;

    lines.push({
      bucketId: bucket.id,
      fromDate,
      toDate,
      vendasRealizadasAmount: salesAmount,
      entradasFinanceirasPrevistasAmount: inflowsAmount,
      compromissosAPagarAmount: commitmentsAmount,
      projectedOperationalFlowAmount: projectedAmount,
    });

    if (sales !== null) {
      totalsBySeries.vendas_realizadas += sales.amount;
      totalRowCount += sales.count;
    }
    if (inflows !== null) {
      totalsBySeries.entradas_financeiras_previstas += inflows.amount;
      totalRowCount += inflows.count;
    }
    if (commitments !== null) {
      totalsBySeries.compromissos_a_pagar += commitments.amount;
      totalRowCount += commitments.count;
    }
  }

  totals.vendasRealizadasAmount =
    basisBySeries.get("vendas_realizadas") === "base_candidata"
      ? toAmount(totalsBySeries.vendas_realizadas)
      : null;
  totals.entradasFinanceirasPrevistasAmount =
    basisBySeries.get("entradas_financeiras_previstas") === "base_candidata"
      ? toAmount(totalsBySeries.entradas_financeiras_previstas)
      : null;
  totals.compromissosAPagarAmount =
    basisBySeries.get("compromissos_a_pagar") === "base_candidata"
      ? toAmount(totalsBySeries.compromissos_a_pagar)
      : null;
  totals.projectedOperationalFlowAmount =
    overall.basis === "base_candidata"
      ? toAmount(
          totalsBySeries.vendas_realizadas +
            totalsBySeries.entradas_financeiras_previstas -
            totalsBySeries.compromissos_a_pagar,
        )
      : null;
  totals.rowCount = totalRowCount;

  return {
    generatedAt,
    homologationStatus: "candidato",
    supplierCode,
    horizon: {
      horizonId,
      horizonDate,
      buckets,
    },
    internalOnly: true,
    financialBasis: overall.basis,
    reason: overall.reason,
    series: statuses,
    rows: lines,
    totals,
    writesToErp: false,
    disclaimer: DISCLAIMER_FLUXO_OPERACIONAL,
  };
}

/** Nunca produz saldo bancário nem caixa disponível: o fluxo projetado é apenas operacional. */
export function hasBankBalanceOrAvailableCash(_input: OperationalFlowInput): false {
  return false;
}
