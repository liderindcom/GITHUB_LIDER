export const HOMOLOGATION_STATUSES = [
  "candidato",
  "aguarda_aceite",
  "restrito",
  "bloqueado",
] as const;
export type HomologationStatus = (typeof HOMOLOGATION_STATUSES)[number];

export const PACKAGE_STATUSES = [
  "rascunho",
  "cotado",
  "solicitado",
  "em_analise",
  "aprovado",
  "recusado",
  "cancelado",
  "expirado",
  "liquidado_parcial",
  "liquidado",
] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export const FINANCIAL_BASIS = ["sem_base_financeira", "base_candidata"] as const;
export type FinancialBasis = (typeof FINANCIAL_BASIS)[number];

export const EVIDENCE_ENTITY_TYPES = [
  "financial_policy",
  "negotiable_package",
  "anticipation_quote",
  "anticipation_request",
] as const;
export type EvidenceEntityType = (typeof EVIDENCE_ENTITY_TYPES)[number];

export const PERMISSAO_CONCEDIDA = "concedida";

export type MissingBasisReason =
  | "fonte_ausente"
  | "corte_ausente"
  | "regra_ausente"
  | "permissao_ausente"
  | "permissao_negada"
  | "base_nao_autorizada";

export type ConsultiveReason = MissingBasisReason | "base_candidata";

export type NegotiablePackageLine = {
  titleId: string;
  documentNumber?: string | null;
  dueDate?: string | null;
  amountOpen: string;
};

export type EvidenceEnvelope = {
  envelopeId: string;
  entityType: EvidenceEntityType;
  entityId: string;
  sourceName: string | null;
  sourceCutId: string | null;
  ruleVersion: string | null;
  permission: string | null;
  evidenceHash: string | null;
  homologationStatus: HomologationStatus;
  createdAt: string;
};

export type NegotiablePackageTotals = {
  gross: string | null;
  discount: string | null;
  net: string | null;
  titleCount: number;
};

export type NegotiablePackage = {
  packageId: string;
  supplierId: string;
  policyVersion: string | null;
  status: PackageStatus;
  financialBasis: FinancialBasis;
  automaticEmission: false;
  automaticBlock: false;
  writesToErp: false;
  createdAt: string;
  updatedAt: string;
  lines: NegotiablePackageLine[];
  totals: NegotiablePackageTotals | null;
  evidenceEnvelope: EvidenceEnvelope;
  disclaimer: string;
};

export type ConsultiveInput = {
  supplierId?: string;
  sourceName?: string | null;
  sourceCutId?: string | null;
  ruleVersion?: string | null;
  permission?: string | null;
  policyVersion?: string | null;
  explicitCandidateBasis?: boolean;
  lines?: NegotiablePackageLine[];
};

export type ConsultiveResult = {
  basis: FinancialBasis;
  reason: ConsultiveReason;
  package: NegotiablePackage;
  allowedTransitions: PackageStatus[];
  automaticEmission: false;
  automaticBlock: false;
  writesToErp: false;
  generatedAt: string;
  disclaimer: string;
};

const TRANSITIONS: Readonly<Record<PackageStatus, readonly PackageStatus[]>> = {
  rascunho: ["cotado", "cancelado"],
  cotado: ["solicitado", "expirado", "cancelado"],
  solicitado: ["em_analise", "cancelado"],
  em_analise: ["aprovado", "recusado", "cancelado"],
  aprovado: ["liquidado_parcial", "cancelado"],
  recusado: [],
  cancelado: [],
  expirado: [],
  liquidado_parcial: ["liquidado"],
  liquidado: [],
};

const SENSITIVE_TRANSITIONS: readonly PackageStatus[] = [
  "solicitado",
  "aprovado",
  "recusado",
  "cancelado",
];

export const AUTOMATIC_FINANCIAL_ACTIONS = ["emitir", "bloquear"] as const;
export type AutomaticFinancialAction = (typeof AUTOMATIC_FINANCIAL_ACTIONS)[number];

const DISCLAIMER =
  "Resposta consultiva. Sem base financeira por padrao quando fonte, corte, regra ou permissao estiver ausente. Nenhuma emissao ou bloqueio automatico e executado.";

function isEmpty(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export function resolveConsultiveBasis(input: ConsultiveInput): {
  basis: FinancialBasis;
  reason: ConsultiveReason;
} {
  if (isEmpty(input.sourceName)) return { basis: "sem_base_financeira", reason: "fonte_ausente" };
  if (isEmpty(input.sourceCutId)) return { basis: "sem_base_financeira", reason: "corte_ausente" };
  if (isEmpty(input.ruleVersion)) return { basis: "sem_base_financeira", reason: "regra_ausente" };
  if (isEmpty(input.permission))
    return { basis: "sem_base_financeira", reason: "permissao_ausente" };
  if (input.permission !== PERMISSAO_CONCEDIDA)
    return { basis: "sem_base_financeira", reason: "permissao_negada" };
  if (input.explicitCandidateBasis !== true)
    return { basis: "sem_base_financeira", reason: "base_nao_autorizada" };
  return { basis: "base_candidata", reason: "base_candidata" };
}

export function allowedTransitions(status: PackageStatus): PackageStatus[] {
  return [...TRANSITIONS[status]];
}

export function canTransition(
  from: PackageStatus,
  to: PackageStatus,
  context?: { explicitAction?: boolean },
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (SENSITIVE_TRANSITIONS.includes(to) && context?.explicitAction !== true) return false;
  return true;
}

export function isAutomaticFinancialActionAllowed(_action: AutomaticFinancialAction): false {
  return false;
}

export function buildEvidenceEnvelope(
  input: ConsultiveInput,
  entityId: string,
  entityType: EvidenceEntityType = "negotiable_package",
  createdAt = new Date().toISOString(),
): EvidenceEnvelope {
  return {
    envelopeId: crypto.randomUUID(),
    entityType,
    entityId,
    sourceName: input.sourceName ?? null,
    sourceCutId: input.sourceCutId ?? null,
    ruleVersion: input.ruleVersion ?? null,
    permission: input.permission ?? null,
    evidenceHash: null,
    homologationStatus: "candidato",
    createdAt,
  };
}

export function buildNegotiablePackage(
  input: ConsultiveInput,
  packageId = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): NegotiablePackage {
  const { basis } = resolveConsultiveBasis(input);
  return {
    packageId,
    supplierId: input.supplierId ?? "00000000-0000-0000-0000-000000000000",
    policyVersion: input.policyVersion ?? null,
    status: basis === "base_candidata" ? "cotado" : "rascunho",
    financialBasis: basis,
    automaticEmission: false,
    automaticBlock: false,
    writesToErp: false,
    createdAt,
    updatedAt: createdAt,
    lines: input.lines ?? [],
    totals: null,
    evidenceEnvelope: buildEvidenceEnvelope(input, packageId, "negotiable_package", createdAt),
    disclaimer: DISCLAIMER,
  };
}

export function buildConsultiveResult(input: ConsultiveInput): ConsultiveResult {
  const pkg = buildNegotiablePackage(input);
  const { reason } = resolveConsultiveBasis(input);
  return {
    basis: pkg.financialBasis,
    reason,
    package: pkg,
    allowedTransitions: allowedTransitions(pkg.status),
    automaticEmission: false,
    automaticBlock: false,
    writesToErp: false,
    generatedAt: pkg.createdAt,
    disclaimer: DISCLAIMER,
  };
}
