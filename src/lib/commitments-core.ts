export const COMMITMENT_STATUSES = ["Programado", "Aberto"] as const;
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

export const COMMITMENT_BASIS = ["sem_base_financeira", "base_candidata"] as const;
export type CommitmentBasis = (typeof COMMITMENT_BASIS)[number];

export const PERMISSAO_COMPRADOR_AUTORIZADO = "comprador_autorizado";

export type CommitmentBasisReason =
  | "fonte_ausente"
  | "corte_ausente"
  | "regra_ausente"
  | "permissao_ausente"
  | "permissao_negada"
  | "base_nao_autorizada"
  | "base_candidata";

export type CommitmentCacheRow = {
  fornecedorCodigo: string;
  vencimento: string;
  valor: number;
  status: string;
};

export type CommitmentBucket = {
  bucketId: string;
  dueFrom: string;
  dueTo: string;
};

export type CommitmentAggregateLine = {
  bucketId: string;
  dueFrom: string;
  dueTo: string;
  statusProgramadoAmount: string;
  statusAbertoAmount: string;
  totalAmount: string;
  rowCount: number;
};

export type CommitmentAggregateTotals = {
  statusProgramadoAmount: string;
  statusAbertoAmount: string;
  totalAmount: string;
  rowCount: number;
};

export type CommitmentAggregateInput = {
  supplierCode: string;
  horizonId?: string;
  horizonDate?: string;
  sourceName?: string | null;
  sourceCutId?: string | null;
  ruleVersion?: string | null;
  permission?: string | null;
  explicitBuyerAuthorization?: boolean;
  rows?: CommitmentCacheRow[];
  generatedAt?: string;
};

export type CommitmentAggregateResult = {
  generatedAt: string;
  homologationStatus: "candidato";
  supplierCode: string;
  horizon: {
    horizonId: string;
    horizonDate: string;
    buckets: CommitmentBucket[];
  };
  internalOnly: true;
  financialBasis: CommitmentBasis;
  reason: CommitmentBasisReason;
  sourceName: string | null;
  sourceCutId: string | null;
  ruleVersion: string | null;
  permission: string | null;
  rows: CommitmentAggregateLine[];
  totals: CommitmentAggregateTotals;
  writesToErp: false;
  disclaimer: string;
};

export const DISCLAIMER_COMPROMISSOS =
  "Agregado de compromissos a pagar apenas. Sem reserva financeira, saldo ou custo de capital. Interno para comprador autorizado; nunca exposto a fornecedor ou AppCom.";

/** Faixas por dias até o vencimento relativas à data de horizonte (inclusive). */
export const COMPROMISSO_BUCKETS: readonly {
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

export function resolveCommitmentBasis(input: CommitmentAggregateInput): {
  basis: CommitmentBasis;
  reason: CommitmentBasisReason;
} {
  if (isEmpty(input.sourceName)) return { basis: "sem_base_financeira", reason: "fonte_ausente" };
  if (isEmpty(input.sourceCutId)) return { basis: "sem_base_financeira", reason: "corte_ausente" };
  if (isEmpty(input.ruleVersion)) return { basis: "sem_base_financeira", reason: "regra_ausente" };
  if (isEmpty(input.permission))
    return { basis: "sem_base_financeira", reason: "permissao_ausente" };
  if (input.permission !== PERMISSAO_COMPRADOR_AUTORIZADO)
    return { basis: "sem_base_financeira", reason: "permissao_negada" };
  if (input.explicitBuyerAuthorization !== true)
    return { basis: "sem_base_financeira", reason: "base_nao_autorizada" };
  return { basis: "base_candidata", reason: "base_candidata" };
}

export function buildAggregateResult(input: CommitmentAggregateInput): CommitmentAggregateResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const horizonDate = input.horizonDate ?? isoDate(new Date());
  const horizonId = input.horizonId ?? `h-${horizonDate}`;
  const hp = new Date(`${horizonDate}T12:00:00`);
  const { basis, reason } = resolveCommitmentBasis(input);
  const supplierCode = input.supplierCode.trim();

  const rowsIn = input.rows ?? [];
  const buckets: CommitmentBucket[] = [];
  const lines: CommitmentAggregateLine[] = [];

  for (const bucket of COMPROMISSO_BUCKETS) {
    const dueFrom =
      bucket.fromDays === null ? bucket.fromFallback : isoDate(addDays(hp, bucket.fromDays));
    const dueTo = bucket.toDays === null ? bucket.toFallback : isoDate(addDays(hp, bucket.toDays));
    const bucketId = bucket.id;
    buckets.push({ bucketId, dueFrom, dueTo });

    let programado = 0;
    let aberto = 0;
    let rowCount = 0;
    for (const row of rowsIn) {
      if (String(row.fornecedorCodigo ?? "").trim() !== supplierCode) continue;
      if (!COMMITMENT_STATUSES.includes(row.status as CommitmentStatus)) continue;
      const due = row.vencimento;
      if (!due) continue;
      const dueDate = new Date(`${due}T12:00:00`);
      const diffDays = Math.floor((dueDate.getTime() - hp.getTime()) / 86_400_000);
      if (bucket.fromDays !== null && diffDays < bucket.fromDays) continue;
      if (bucket.toDays !== null && diffDays > bucket.toDays) continue;
      const valor = Number(row.valor ?? 0);
      if (row.status === "Programado") programado += valor;
      else if (row.status === "Aberto") aberto += valor;
      rowCount += 1;
    }

    lines.push({
      bucketId,
      dueFrom,
      dueTo,
      statusProgramadoAmount: toAmount(programado),
      statusAbertoAmount: toAmount(aberto),
      totalAmount: toAmount(programado + aberto),
      rowCount,
    });
  }

  const totals: CommitmentAggregateTotals = {
    statusProgramadoAmount: toAmount(
      lines.reduce((acc, l) => acc + Number(l.statusProgramadoAmount), 0),
    ),
    statusAbertoAmount: toAmount(lines.reduce((acc, l) => acc + Number(l.statusAbertoAmount), 0)),
    totalAmount: toAmount(lines.reduce((acc, l) => acc + Number(l.totalAmount), 0)),
    rowCount: lines.reduce((acc, l) => acc + l.rowCount, 0),
  };

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
    financialBasis: basis,
    reason,
    sourceName: input.sourceName ?? null,
    sourceCutId: input.sourceCutId ?? null,
    ruleVersion: input.ruleVersion ?? null,
    permission: input.permission ?? null,
    rows: lines,
    totals,
    writesToErp: false,
    disclaimer: DISCLAIMER_COMPROMISSOS,
  };
}

/** Nunca produz reserva, saldo ou custo de capital: o agregado é só soma de compromissos. */
export function hasReserveOrBalanceOrCostOfCapital(_input: CommitmentAggregateInput): false {
  return false;
}
