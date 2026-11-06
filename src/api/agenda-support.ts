import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { db } from "../server/db";
import { exec, spawn } from "child_process";
import { readFileSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { getStartContext } from "@tanstack/start-storage-context";
import { permitirRequisicao } from "../server/request-guard";
import {
  deriveDailyRouteCandidates,
  operationalDaysForPolicy,
  parseDailyAllocationKey,
} from "./agenda-daily-allocation";

const RMS_REFRESH_PYTHON = "/home/administrador/deepseek-env/bin/python3";
const RMS_REFRESH_SCRIPT = "/home/administrador/rms/scripts/apply_portal_refresh_fornecedor.py";

type RelatorioCache = { mtimeMs: number; data: Record<string, unknown> };
const relatoriosCache = new Map<string, RelatorioCache>();

export function lerRelatorioPortal(nome: string): Record<string, unknown> {
  const caminho = resolve(process.cwd(), "public", "data", nome);
  const mtimeMs = statSync(caminho).mtimeMs;
  const atual = relatoriosCache.get(caminho);
  if (atual?.mtimeMs === mtimeMs) return atual.data;
  const data = JSON.parse(readFileSync(caminho, "utf8")) as Record<string, unknown>;
  relatoriosCache.set(caminho, { mtimeMs, data });
  return data;
}

const PRESENCE_VISITS_REPORT_PATH =
  process.env.PRESENCE_VISITS_REPORT ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/reports/promotores-visitas-pseudonimizadas.json";
const PRESENCE_SUPPLIER_MAP_PATH =
  process.env.PRESENCE_SUPPLIER_MAP ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/reports/de-para-presenca-fornecedor-cnpj-aprovado.json";
const PRESENCE_SUPPLIER_OVERRIDES_PATH =
  process.env.PRESENCE_SUPPLIER_OVERRIDES ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/config/promoter-presence-overrides.json";
const PROMOTER_SIZING_SIMULATION_PATH =
  process.env.PROMOTER_SIZING_SIMULATION ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/reports/promotores-porte-simulacao.json";
const PROMOTER_NAMES_REPORT_PATH =
  process.env.PROMOTER_NAMES_REPORT ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/reports/promotores-nomes-interno.json";
const PROMOTER_STATUS_REPORT_PATH =
  process.env.PROMOTER_STATUS_REPORT ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/reports/promotores-status-operacional.json";
const PROMOTER_STATUS_RUNNER_PATH =
  process.env.PROMOTER_STATUS_RUNNER ||
  "/home/administrador/maoadc-projects/celulas-disponibilidade-appcom/src/run-promotores-status.mjs";
const PROMOTER_STATUS_RUN_STATE_PATH =
  process.env.PROMOTER_STATUS_RUN_STATE ||
  resolve(dirname(PROMOTER_STATUS_REPORT_PATH), "promotores-status-operacional-run.json");

const TOKENS_NOME_EMPRESA_IGNORADOS = new Set([
  "A",
  "AS",
  "E",
  "DA",
  "DAS",
  "DE",
  "DO",
  "DOS",
  "LTDA",
  "LTD",
  "SA",
  "S",
  "CIA",
  "COMPANHIA",
  "IND",
  "INDUSTRIA",
  "INDUSTRIAL",
  "COM",
  "COMERCIO",
  "COMERCIAL",
  "DISTRIBUIDORA",
  "DISTRIBUIDOR",
  "BRASIL",
]);

export function fornecedorNomeCorresponde(origem: unknown, cadastro: unknown): boolean {
  const normalizar = (value: unknown) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  const origemNormalizada = normalizar(origem);
  const cadastroNormalizado = normalizar(cadastro);
  if (!origemNormalizada || !cadastroNormalizado) return false;
  const compactOrigem = origemNormalizada.replace(/ /g, "");
  const compactCadastro = cadastroNormalizado.replace(/ /g, "");
  if (
    compactOrigem === compactCadastro ||
    compactOrigem.includes(compactCadastro) ||
    compactCadastro.includes(compactOrigem)
  )
    return true;
  const tokensOrigem = new Set(
    origemNormalizada
      .split(" ")
      .filter((token) => token.length >= 3 && !TOKENS_NOME_EMPRESA_IGNORADOS.has(token)),
  );
  const tokensCadastro = new Set(
    cadastroNormalizado
      .split(" ")
      .filter((token) => token.length >= 3 && !TOKENS_NOME_EMPRESA_IGNORADOS.has(token)),
  );
  if (!tokensOrigem.size || !tokensCadastro.size) return false;
  const intersecao = [...tokensOrigem].filter((token) => tokensCadastro.has(token)).length;
  const minimo = Math.min(2, Math.min(tokensOrigem.size, tokensCadastro.size));
  return intersecao >= Math.max(1, minimo);
}

const PRESENCE_CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

function normalizarPeriodoPresenca(periodo?: string | null): string {
  return periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) ? periodo : PRESENCE_CURRENT_PERIOD;
}

function caminhoRelatorioPresenca(periodo?: string | null): string {
  const referencia = normalizarPeriodoPresenca(periodo);
  if (referencia === PRESENCE_CURRENT_PERIOD) return PRESENCE_VISITS_REPORT_PATH;
  return resolve(
    dirname(PRESENCE_VISITS_REPORT_PATH),
    `promotores-visitas-pseudonimizadas-${referencia}.json`,
  );
}

export function lerRelatorioPresencaInterno(
  periodo?: string | null,
): Record<string, unknown> | null {
  const caminhoRelatorio = caminhoRelatorioPresenca(periodo);
  try {
    const mtimeMs = statSync(caminhoRelatorio).mtimeMs;
    const atual = relatoriosCache.get(caminhoRelatorio);
    if (atual?.mtimeMs === mtimeMs) return atual.data;
    const data = JSON.parse(readFileSync(caminhoRelatorio, "utf8")) as Record<string, unknown>;
    relatoriosCache.set(caminhoRelatorio, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

function lerMapaFornecedorPresencaInterno(): Record<string, unknown> | null {
  try {
    const mtimeMs = statSync(PRESENCE_SUPPLIER_MAP_PATH).mtimeMs;
    const atual = relatoriosCache.get(PRESENCE_SUPPLIER_MAP_PATH);
    const data =
      atual?.mtimeMs === mtimeMs
        ? atual.data
        : (JSON.parse(readFileSync(PRESENCE_SUPPLIER_MAP_PATH, "utf8")) as Record<string, unknown>);
    if (!atual || atual.mtimeMs !== mtimeMs)
      relatoriosCache.set(PRESENCE_SUPPLIER_MAP_PATH, { mtimeMs, data });
    const supplierMap = data["supplier_map"];
    return supplierMap && typeof supplierMap === "object" && !Array.isArray(supplierMap)
      ? (supplierMap as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function lerOverridesFornecedorPresencaInterno(): Record<string, unknown> | null {
  try {
    const mtimeMs = statSync(PRESENCE_SUPPLIER_OVERRIDES_PATH).mtimeMs;
    const atual = relatoriosCache.get(PRESENCE_SUPPLIER_OVERRIDES_PATH);
    const data =
      atual?.mtimeMs === mtimeMs
        ? atual.data
        : (JSON.parse(readFileSync(PRESENCE_SUPPLIER_OVERRIDES_PATH, "utf8")) as Record<
            string,
            unknown
          >);
    if (!atual || atual.mtimeMs !== mtimeMs)
      relatoriosCache.set(PRESENCE_SUPPLIER_OVERRIDES_PATH, { mtimeMs, data });
    const overrides = data["supplier_map_overrides"];
    return overrides && typeof overrides === "object" && !Array.isArray(overrides)
      ? (overrides as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function lerSimulacaoPortePromotoresInterno(): Record<string, unknown> | null {
  try {
    const mtimeMs = statSync(PROMOTER_SIZING_SIMULATION_PATH).mtimeMs;
    const atual = relatoriosCache.get(PROMOTER_SIZING_SIMULATION_PATH);
    if (atual?.mtimeMs === mtimeMs) return atual.data;
    const data = JSON.parse(readFileSync(PROMOTER_SIZING_SIMULATION_PATH, "utf8")) as Record<
      string,
      unknown
    >;
    relatoriosCache.set(PROMOTER_SIZING_SIMULATION_PATH, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

export function lerPromotoresNomesInterno(): Record<string, unknown> | null {
  try {
    const mtimeMs = statSync(PROMOTER_NAMES_REPORT_PATH).mtimeMs;
    const atual = relatoriosCache.get(PROMOTER_NAMES_REPORT_PATH);
    if (atual?.mtimeMs === mtimeMs) return atual.data;
    const data = JSON.parse(readFileSync(PROMOTER_NAMES_REPORT_PATH, "utf8")) as Record<
      string,
      unknown
    >;
    relatoriosCache.set(PROMOTER_NAMES_REPORT_PATH, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

export function lerStatusPromotoresInterno(): Record<string, unknown> | null {
  try {
    const mtimeMs = statSync(PROMOTER_STATUS_REPORT_PATH).mtimeMs;
    const atual = relatoriosCache.get(PROMOTER_STATUS_REPORT_PATH);
    if (atual?.mtimeMs === mtimeMs) return atual.data;
    const data = JSON.parse(readFileSync(PROMOTER_STATUS_REPORT_PATH, "utf8")) as Record<
      string,
      unknown
    >;
    relatoriosCache.set(PROMOTER_STATUS_REPORT_PATH, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

export function lerStatusPromotoresExecucaoInterno(): Record<string, unknown> {
  let report: Record<string, unknown> | null = null;
  let run: Record<string, unknown> | null = null;
  try {
    report = lerJsonRelatorio(PROMOTER_STATUS_REPORT_PATH);
  } catch {
    report = null;
  }
  try {
    run = lerJsonRelatorio(PROMOTER_STATUS_RUN_STATE_PATH);
  } catch {
    run = null;
  }
  const summary = report?.summary;
  return {
    status: report ? "DISPONIVEL" : run?.status || "AGUARDA_EXECUCAO",
    gerado_em: report?.generated_at ?? null,
    data_referencia: report?.data_referencia ?? null,
    resumo: summary && typeof summary === "object" ? summary : null,
    execucao: run,
  };
}

function lerJsonRelatorio(caminho: string): Record<string, unknown> {
  const mtimeMs = statSync(caminho).mtimeMs;
  const atual = relatoriosCache.get(caminho);
  if (atual?.mtimeMs === mtimeMs) return atual.data;
  const data = JSON.parse(readFileSync(caminho, "utf8")) as Record<string, unknown>;
  relatoriosCache.set(caminho, { mtimeMs, data });
  return data;
}

export function iniciarAtualizacaoStatusPromotoresInterno() {
  const child = spawn(process.execPath, [PROMOTER_STATUS_RUNNER_PATH, "--force"], {
    cwd: dirname(PROMOTER_STATUS_RUNNER_PATH),
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();
  return {
    status: "INICIADA",
    iniciado_em: new Date().toISOString(),
  };
}

/**
 * A agenda só pode usar cadastro ativo quando a validade conhecida ainda não
 * venceu. A checagem no servidor mantém o bloqueio mesmo se o relatório foi
 * gerado por uma versão antiga do extrator.
 */
export function promotorDisponivelParaAgenda(row: Record<string, unknown>): boolean {
  if (row.disponivel_agenda === false) return false;

  const validade = String(row.validade ?? "").trim();
  if (!validade) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return false;

  const dataReferencia = new Date().toISOString().slice(0, 10);
  return validade >= dataReferencia;
}

export function obterMapaFornecedorPresenca(
  relatorio: Record<string, unknown>,
): Record<string, unknown> {
  const mapaBase =
    lerMapaFornecedorPresencaInterno() ||
    ((relatorio["supplier_map"] && typeof relatorio["supplier_map"] === "object"
      ? relatorio["supplier_map"]
      : {}) as Record<string, unknown>);
  const overrides = lerOverridesFornecedorPresencaInterno();
  if (!overrides) return mapaBase;

  // Exceções operacionais já autorizadas complementam o de-para exato por CNPJ.
  // Os identificadores continuam pseudonimizados e não substituem o mapa oficial.
  const mapa = { ...mapaBase };
  for (const [codigo, valor] of Object.entries(overrides)) {
    const ids = Array.isArray(valor) ? valor.map((item) => String(item || "")).filter(Boolean) : [];
    if (!ids.length) continue;
    const atuais = Array.isArray(mapa[codigo])
      ? (mapa[codigo] as unknown[]).map((item) => String(item || "")).filter(Boolean)
      : [];
    mapa[codigo] = [...new Set([...atuais, ...ids])];
  }
  return mapa;
}

export function idsFornecedorPresenca(
  mapa: Record<string, unknown>,
  fornecedorCodigo: string,
): string[] {
  const valor = mapa[fornecedorCodigo];
  if (Array.isArray(valor)) {
    return valor.map((item) => String(item || "")).filter(Boolean);
  }
  return valor ? [String(valor)] : [];
}

export type AgendaPromotorAssignment = {
  route_key: string;
  sequence: number;
  date: number;
  period_id: string;
  store_ids: string[];
  promotor_id?: string | null;
  promotor_nome?: string | null;
  promotor_ids?: string[];
  promotor_nomes?: string[];
};

type AgendaPromotorEdit = {
  versao: number;
  assignments: AgendaPromotorAssignment[];
  total_visitas: number;
  horas_planejadas: number;
  atualizado_em: string;
};

export function garantirTabelasEdicaoAgenda() {
  // Mantém a criação idempotente também quando a API é executada em um worker
  // que ainda não recarregou o módulo de banco após uma atualização.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agenda_promotor_edicoes (
        fornecedorCodigo TEXT NOT NULL,
        periodo TEXT NOT NULL,
        versao INTEGER NOT NULL DEFAULT 1,
        assignmentsJson TEXT NOT NULL,
        atualizadoEm TEXT NOT NULL,
        atualizadoPor TEXT NOT NULL,
        PRIMARY KEY (fornecedorCodigo, periodo)
      );
      CREATE TABLE IF NOT EXISTS agenda_promotor_edicoes_historico (
        id TEXT PRIMARY KEY,
        fornecedorCodigo TEXT NOT NULL,
        periodo TEXT NOT NULL,
        versao INTEGER NOT NULL,
        assignmentsJson TEXT NOT NULL,
        criadoEm TEXT NOT NULL,
        criadoPor TEXT NOT NULL
      );
    `);
  } catch {
    // O schema principal já tenta criar as tabelas; uma falha aqui não deve
    // esconder a agenda de leitura.
  }
}

export function lerEdicaoAgendaPromotor(
  fornecedorCodigo: string,
  periodo: string,
): AgendaPromotorEdit | null {
  garantirTabelasEdicaoAgenda();
  try {
    const row = db
      .prepare(
        `SELECT versao, assignmentsJson, atualizadoEm
         FROM agenda_promotor_edicoes
         WHERE fornecedorCodigo = ? AND periodo = ?`,
      )
      .get(fornecedorCodigo, periodo) as
      { versao?: number; assignmentsJson?: string; atualizadoEm?: string } | undefined;
    if (!row?.assignmentsJson) return null;
    const parsed = JSON.parse(row.assignmentsJson) as unknown;
    if (!Array.isArray(parsed)) return null;
    return {
      versao: Number(row.versao || 1),
      assignments: parsed as AgendaPromotorAssignment[],
      total_visitas: 0,
      horas_planejadas: 0,
      atualizado_em: String(row.atualizadoEm || ""),
    };
  } catch {
    return null;
  }
}

export function normalizarAssignmentAgenda(value: unknown): AgendaPromotorAssignment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const routeKey = String(row.route_key ?? "").trim();
  const periodId = String(row.period_id ?? "").trim();
  const sequence = Number(row.sequence);
  const date = Number(row.date);
  const storeIds = Array.isArray(row.store_ids)
    ? [...new Set(row.store_ids.map((item) => String(item).trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )
    : [];
  if (!routeKey || !periodId || !Number.isInteger(sequence) || sequence < 1) return null;
  if (!Number.isInteger(date) || date < 1 || date > 31 || !storeIds.length) return null;
  return {
    route_key: routeKey,
    sequence,
    date,
    period_id: periodId,
    store_ids: storeIds,
    promotor_id: String(row.promotor_id ?? "").trim() || null,
    promotor_nome: String(row.promotor_nome ?? "").trim() || null,
    promotor_ids: Array.isArray(row.promotor_ids)
      ? [...new Set(row.promotor_ids.map((item) => String(item).trim()).filter(Boolean))]
      : String(row.promotor_id ?? "").trim()
        ? [String(row.promotor_id).trim()]
        : [],
    promotor_nomes: Array.isArray(row.promotor_nomes)
      ? [...new Set(row.promotor_nomes.map((item) => String(item).trim()).filter(Boolean))]
      : String(row.promotor_nome ?? "").trim()
        ? [String(row.promotor_nome).trim()]
        : [],
  };
}

function cidadeAgendaKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function geografiaCidadeAgenda(
  value: unknown,
  metropolitanCities: Set<string>,
): "CAPITAL_METROPOLITANA" | "INTERIOR" | null {
  const cidade = cidadeAgendaKey(value);
  if (!cidade) return null;
  return metropolitanCities.has(cidade) ? "CAPITAL_METROPOLITANA" : "INTERIOR";
}

export function validarECalcularAgendaPromotor(
  fornecedorCodigo: string,
  periodo: string,
  assignments: AgendaPromotorAssignment[],
  agendaRelatorio: Record<string, unknown>,
  fornecedorControle: Record<string, unknown> | undefined,
  allowedPromoterIds: string[] = [],
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
    throw new Error("Período inválido. Use o formato AAAA-MM.");
  }
  if (String(agendaRelatorio.period_reference ?? "") !== periodo) {
    throw new Error("A edição deve usar o período de referência da agenda publicada.");
  }
  const design = (agendaRelatorio.design ?? {}) as Record<string, unknown>;
  const policy = (design.scheduling_policy ?? {}) as Record<string, unknown>;
  const workPeriods = Array.isArray(policy.work_periods)
    ? (policy.work_periods as Array<Record<string, unknown>>)
        .map((item) => ({
          id: String(item.id ?? ""),
          rotulo: String(item.rotulo ?? item.id ?? ""),
          minutos: Number(item.minutos ?? 0) || undefined,
        }))
        .filter((item) => item.id)
    : [
        { id: "MANHA", rotulo: "08h–12h" },
        { id: "TARDE", rotulo: "14h–18h" },
      ];
  const periodIds = new Set(workPeriods.map((item) => item.id));
  const periodsByWeekday = (policy.periods_by_weekday ?? {}) as Record<string, unknown>;
  const periodIdsForWeekday = (weekday: number) => {
    const configured = Array.isArray(periodsByWeekday[String(weekday)])
      ? (periodsByWeekday[String(weekday)] as unknown[])
          .map(String)
          .filter((id) => periodIds.has(id))
      : workPeriods.map((item) => item.id);
    return configured.length ? configured : workPeriods.map((item) => item.id);
  };
  const periodMinutesById = (policy.period_minutes_by_id ?? {}) as Record<string, unknown>;
  const periodMinutesForId = (periodId: string) =>
    Math.max(
      1,
      Number(
        periodMinutesById[periodId] ??
          workPeriods.find((item) => item.id === periodId)?.minutos ??
          periodMinutes,
      ),
    );
  const [year, month] = periodo.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const periodMinutes = Math.max(1, Number(policy.period_minutes ?? 240));
  const legalWeeklyHours = Math.max(
    1,
    Number(policy.legal_weekly_hours ?? policy.schedulable_weekly_hours ?? 40),
  );
  const schedulableWeeklyHours = Math.max(
    1,
    Number(policy.schedulable_weekly_hours ?? legalWeeklyHours),
  );
  const weeklyCapacityPeriods = Math.max(
    1,
    Math.floor((schedulableWeeklyHours * 60) / periodMinutes),
  );
  const weekKeyForDay = (day: number) => {
    const date = new Date(year, month - 1, day);
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return [
      monday.getFullYear(),
      String(monday.getMonth() + 1).padStart(2, "0"),
      String(monday.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const weekdays = new Set(
    (Array.isArray(policy.agenda_weekdays) ? policy.agenda_weekdays : policy.working_weekdays) as
      number[] | undefined,
  );
  if (!weekdays.size) [1, 2, 3, 4, 5].forEach((day) => weekdays.add(day));
  const recurringHolidays = new Set(
    Array.isArray(policy.recurring_holidays) ? policy.recurring_holidays.map(String) : [],
  );
  const movableHolidays = new Set(
    Array.isArray(policy.movable_holidays) ? policy.movable_holidays.map(String) : [],
  );
  const operationalDays = new Set(operationalDaysForPolicy(periodo, policy));
  const rows = Array.isArray(agendaRelatorio.agenda)
    ? (agendaRelatorio.agenda as Array<Record<string, unknown>>).filter(
        (row) =>
          normalizarCodigoFornecedor(String(row.fornecedor_codigo ?? "")) === fornecedorCodigo,
      )
    : [];
  const allocations = Array.isArray(fornecedorControle?.lojas_prioritarias)
    ? (fornecedorControle?.lojas_prioritarias as Array<Record<string, unknown>>)
    : [];
  const allocationByStore = new Map(allocations.map((row) => [String(row.loja_id ?? ""), row]));
  const clusters = Array.isArray(policy.clusters)
    ? (policy.clusters as Array<Record<string, unknown>>)
    : [];
  const exclusiveGroups = Array.isArray(policy.exclusive_period_groups)
    ? (policy.exclusive_period_groups as Array<Record<string, unknown>>)
    : [];
  const clusterByStore = new Map<string, string>();
  for (const cluster of [...clusters, ...exclusiveGroups]) {
    const id = String(cluster.id ?? "");
    const stores = Array.isArray(cluster.lojas) ? cluster.lojas : [];
    if (!id) continue;
    for (const store of stores) {
      const storeId = String(store);
      if (!clusterByStore.has(storeId)) clusterByStore.set(storeId, id);
    }
  }
  const metropolitanCities = new Set(
    (Array.isArray(policy.metropolitan_cities)
      ? policy.metropolitan_cities
      : ["BELEM", "ANANINDEUA", "ICOARACI"]
    )
      .map(cidadeAgendaKey)
      .filter(Boolean),
  );
  const storeMetaById = new Map<
    string,
    {
      cidade: string;
      geografia: "CAPITAL_METROPOLITANA" | "INTERIOR" | null;
      cluster: string | null;
    }
  >();
  for (const row of rows) {
    const storeId = String(row.loja_id ?? "");
    if (!storeId) continue;
    const allocation = allocationByStore.get(storeId);
    const cidade = String(allocation?.cidade ?? row.cidade ?? "").trim();
    const cluster = String(
      clusterByStore.get(storeId) ?? allocation?.cluster ?? row.cluster ?? "",
    ).trim();
    storeMetaById.set(storeId, {
      cidade,
      geografia: geografiaCidadeAgenda(cidade, metropolitanCities),
      cluster: cluster || null,
    });
  }
  const promoterGeography = new Map<string, "CAPITAL_METROPOLITANA" | "INTERIOR">();
  const promoterPeriodRoutes = new Map<
    string,
    { routeIdentities: Set<string>; geographies: Set<string> }
  >();
  const routeConstraintForStores = (storeIds: string[], routeKey: string) => {
    const meta = storeIds.map((storeId) => storeMetaById.get(String(storeId))).filter(Boolean);
    const geographies = new Set(meta.map((item) => item?.geografia).filter(Boolean));
    const geography =
      geographies.size === 1
        ? ([...geographies][0] as "CAPITAL_METROPOLITANA" | "INTERIOR")
        : geographies.size > 1
          ? "MISTA"
          : null;
    const routeId = String(routeKey).split("::").slice(1).join("::");
    const cluster = meta.find((item) => item?.cluster)?.cluster ?? null;
    return {
      geography,
      routeIdentity: routeId.startsWith("CLUSTER_") ? routeId : cluster || routeId,
    };
  };
  const registrarRestricoesPromotor = (
    promoterIds: string[],
    date: number,
    periodIds: string[],
    storeIds: string[],
    routeKey: string,
  ) => {
    const constraint = routeConstraintForStores(storeIds, routeKey);
    if (constraint.geography === "MISTA") {
      throw new Error(
        "Uma carteira não pode misturar capital/metropolitana e interior na mesma rota.",
      );
    }
    for (const promoterId of promoterIds) {
      if (constraint.geography) {
        const previous = promoterGeography.get(promoterId);
        if (previous && previous !== constraint.geography) {
          throw new Error(
            `O promotor ${promoterId} não pode alternar entre capital/metropolitana e interior na mesma agenda.`,
          );
        }
        promoterGeography.set(promoterId, constraint.geography);
      }
      for (const periodId of periodIds) {
        const key = `${promoterId}::${date}::${periodId}`;
        const current = promoterPeriodRoutes.get(key);
        if (
          current &&
          [...current.routeIdentities].some((route) => route !== constraint.routeIdentity)
        ) {
          throw new Error(
            `O promotor ${promoterId} não pode atender cluster/loja fora da rota no mesmo período.`,
          );
        }
        const next = current ?? {
          routeIdentities: new Set<string>(),
          geographies: new Set<string>(),
        };
        next.routeIdentities.add(constraint.routeIdentity);
        if (constraint.geography) next.geographies.add(constraint.geography);
        promoterPeriodRoutes.set(key, next);
      }
    }
  };
  const routeRows = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const storeId = String(row.loja_id ?? "");
    const allocation = allocationByStore.get(storeId);
    if (allocations.length && !allocation) continue;
    const portfolio = Number(allocation?.carteira_promotor ?? row.carteira_promotor ?? 1);
    const routeId = String(
      clusterByStore.get(storeId) ?? allocation?.cluster ?? row.cluster ?? `LOJA_${storeId}`,
    );
    const routeKey = `${portfolio}::${routeId}`;
    const list = routeRows.get(routeKey) ?? [];
    list.push({ ...row, allocation });
    routeRows.set(routeKey, list);
  }
  const dailyLaneCount = Math.max(
    1,
    Number(fornecedorControle?.promotores_necessarios_recomendados || 1),
    allowedPromoterIds.length,
  );
  const portfolioGeography = Object.fromEntries(
    (Array.isArray(fornecedorControle?.carteiras_promotores)
      ? (fornecedorControle?.carteiras_promotores as Array<Record<string, unknown>>)
      : []
    )
      .filter((carteira) => carteira.geografia)
      .map((carteira) => [String(carteira.carteira), carteira.geografia]),
  );
  const dailyRoutes = deriveDailyRouteCandidates(
    rows,
    allocations,
    policy,
    dailyLaneCount,
    portfolioGeography,
  );
  const expected = new Map<
    string,
    {
      route_key: string;
      sequence: number;
      store_ids: string[];
      teamSize: number;
      exclusive: boolean;
      fullDay: boolean;
      portfolio: number;
      cities: string[];
    }
  >();
  let totalVisits = 0;
  let plannedHours = 0;
  for (const [routeKey, route] of routeRows) {
    const maxVisits = Math.max(
      0,
      ...route.map((row) =>
        Number(
          (row.allocation as Record<string, unknown> | undefined)?.visitas_recomendadas_mes ??
            row.visitas_recomendadas_mes ??
            0,
        ),
      ),
    );
    for (let sequence = 1; sequence <= maxVisits; sequence += 1) {
      const visits = route.filter(
        (row) =>
          Number(
            (row.allocation as Record<string, unknown> | undefined)?.visitas_recomendadas_mes ??
              row.visitas_recomendadas_mes ??
              0,
          ) >= sequence,
      );
      if (!visits.length) continue;
      const storeIds = visits
        .map((row) => String(row.loja_id ?? ""))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const teamSize = Math.max(
        1,
        ...visits.map((row) =>
          Number(
            (row.allocation as Record<string, unknown> | undefined)
              ?.promotores_periodo_recomendados ??
              row.promotores_periodo_recomendados ??
              1,
          ),
        ),
      );
      const exclusive =
        !routeKey.includes("::LOJA_") ||
        teamSize > 1 ||
        visits.some((row) => row.classe_logistica === "REMOTA");
      const fullDay = visits.some((row) => row.classe_logistica === "REMOTA");
      const cities = [
        ...new Set(
          visits
            .map((row) =>
              String(
                (row.allocation as Record<string, unknown> | undefined)?.cidade ?? row.cidade ?? "",
              )
                .trim()
                .toUpperCase(),
            )
            .filter(Boolean),
        ),
      ];
      expected.set(`${routeKey}::${sequence}`, {
        route_key: routeKey,
        sequence,
        store_ids: storeIds,
        teamSize,
        exclusive,
        fullDay,
        portfolio: Number(routeKey.split("::", 1)[0] || 1),
        cities,
      });
      totalVisits += visits.length;
      plannedHours += visits.reduce((sum, row) => {
        const allocation = row.allocation as Record<string, unknown> | undefined;
        const hours = Number(allocation?.horas_recomendadas_mes ?? row.horas_recomendadas_mes ?? 0);
        const visitsForStore = Number(
          allocation?.visitas_recomendadas_mes ?? row.visitas_recomendadas_mes ?? 0,
        );
        return (
          sum +
          (visitsForStore > 0
            ? hours / visitsForStore
            : Number(row.tempo_visita_recomendado_min ?? 0) / 60)
        );
      }, 0);
    }
  }
  const coreAssignments = assignments.filter(
    (assignment) => !parseDailyAllocationKey(assignment.route_key),
  );
  if (coreAssignments.length !== expected.size) {
    throw new Error(
      `A agenda deve manter ${expected.size} blocos de visita, sem incluir ou remover blocos.`,
    );
  }
  const seen = new Set<string>();
  const promoterDayCoverage = new Set<string>();
  const slotUsage = new Map<
    string,
    {
      usedPromoters: number;
      portfolios: Map<number, { count: number; exclusive: boolean; cities: Set<string> }>;
    }
  >();
  const routeDates = new Set<string>();
  const weeklyPortfolioPeriods = new Map<string, number>();
  const maxRegularTasks = Number(policy.max_regular_tasks_per_period || 2);
  const fixedPromoters = Math.max(
    1,
    Number(fornecedorControle?.promotores_necessarios_recomendados || 1),
  );
  const sharedReinforcement =
    Number(fornecedorControle?.periodos_reforco_compartilhado_mes || 0) > 0
      ? Math.max(0, Number(fornecedorControle?.reforco_simultaneo_maximo_promotores || 0))
      : 0;
  const capacity = fixedPromoters + sharedReinforcement;
  for (const assignment of assignments) {
    const key = `${assignment.route_key}::${assignment.sequence}`;
    const expectedTask = expected.get(key);
    const dailyKey = parseDailyAllocationKey(assignment.route_key);
    if (dailyKey) {
      if (assignment.sequence !== 1 || assignment.date !== dailyKey.day) {
        throw new Error("A alocação diária precisa permanecer no dia para o qual foi criada.");
      }
      if (!operationalDays.has(dailyKey.day)) {
        throw new Error(`O dia ${dailyKey.day} não é um dia operacional do período.`);
      }
      const candidate = dailyRoutes.get(dailyKey.portfolio);
      if (!candidate || assignment.store_ids.join("|") !== candidate.storeIds.join("|")) {
        throw new Error(
          "A alocação diária deve manter uma loja ou cluster real da carteira, sem criar uma rota nova.",
        );
      }
      if (!periodIds.has(assignment.period_id)) {
        throw new Error(`Período de trabalho inválido: ${assignment.period_id}.`);
      }
      const weekday = new Date(year, month - 1, assignment.date).getDay();
      if (!periodIdsForWeekday(weekday).includes(assignment.period_id)) {
        throw new Error(
          `O período ${assignment.period_id} não está disponível neste dia da semana.`,
        );
      }
      const dailyIds = assignment.promotor_ids?.length
        ? assignment.promotor_ids
        : assignment.promotor_id
          ? [assignment.promotor_id]
          : [];
      if (!dailyIds.length) {
        throw new Error("Cada alocação diária precisa identificar o promotor responsável.");
      }
      if (dailyIds.length > 1) {
        throw new Error("A alocação diária deve ter um único promotor responsável.");
      }
      const candidateRoute = candidate.routeKey;
      registrarRestricoesPromotor(
        dailyIds,
        assignment.date,
        [assignment.period_id],
        candidate.storeIds,
        candidateRoute,
      );
      for (const id of dailyIds) promoterDayCoverage.add(`${id}::${assignment.date}`);
      continue;
    }
    if (!expectedTask || seen.has(key))
      throw new Error("A agenda contém um bloco desconhecido ou duplicado.");
    seen.add(key);
    if (!operationalDays.has(assignment.date))
      throw new Error(`O dia ${assignment.date} não é um dia operacional do período.`);
    if (!periodIds.has(assignment.period_id))
      throw new Error(`Período de trabalho inválido: ${assignment.period_id}.`);
    const assignmentWeekday = new Date(year, month - 1, assignment.date).getDay();
    if (!periodIdsForWeekday(assignmentWeekday).includes(assignment.period_id))
      throw new Error(`O período ${assignment.period_id} não está disponível neste dia da semana.`);
    const routeDateKey = `${assignment.route_key}::${assignment.date}`;
    if (routeDates.has(routeDateKey)) {
      throw new Error("A mesma rota/cluster não pode receber duas visitas no mesmo dia.");
    }
    routeDates.add(routeDateKey);
    if (assignment.store_ids.join("|") !== expectedTask.store_ids.join("|"))
      throw new Error(
        `O bloco ${routeLabelForApi(expectedTask.route_key)} ${expectedTask.sequence} deve manter todas as lojas do cluster/rota.`,
      );
    const assignedPromoterIds = assignment.promotor_ids?.length
      ? assignment.promotor_ids
      : assignment.promotor_id
        ? [assignment.promotor_id]
        : [];
    for (const id of assignedPromoterIds) promoterDayCoverage.add(`${id}::${assignment.date}`);
    if (assignedPromoterIds.length > expectedTask.teamSize) {
      throw new Error(
        `O bloco ${routeLabelForApi(expectedTask.route_key)} admite até ${expectedTask.teamSize} promotor(es) simultâneo(s).`,
      );
    }
    const availablePeriodsForAssignment = periodIdsForWeekday(assignmentWeekday);
    const periodsToCheck = expectedTask.fullDay
      ? availablePeriodsForAssignment
      : [assignment.period_id];
    registrarRestricoesPromotor(
      assignedPromoterIds,
      assignment.date,
      periodsToCheck,
      expectedTask.store_ids,
      expectedTask.route_key,
    );
    const weekKey = weekKeyForDay(assignment.date);
    const weeklyKey = `${expectedTask.portfolio}::${weekKey}`;
    const weeklyIncrement =
      expectedTask.teamSize *
      periodsToCheck.reduce(
        (sum, periodId) => sum + periodMinutesForId(periodId) / periodMinutes,
        0,
      );
    const weeklyUsed = (weeklyPortfolioPeriods.get(weeklyKey) || 0) + weeklyIncrement;
    if (weeklyUsed > weeklyCapacityPeriods) {
      throw new Error(
        "O promotor " +
          expectedTask.portfolio +
          " excede " +
          legalWeeklyHours +
          "h na semana iniciada em " +
          weekKey +
          ".",
      );
    }
    weeklyPortfolioPeriods.set(weeklyKey, weeklyUsed);
    for (const slotPeriodId of periodsToCheck) {
      const slotKey = `${assignment.date}::${slotPeriodId}`;
      const slot = slotUsage.get(slotKey) ?? {
        usedPromoters: 0,
        portfolios: new Map(),
      };
      const usage = slot.portfolios.get(expectedTask.portfolio);
      if (expectedTask.exclusive && usage)
        throw new Error("Uma rota exclusiva não pode compartilhar o mesmo período com outra rota.");
      if (!expectedTask.exclusive && usage?.exclusive)
        throw new Error("Uma rota exclusiva já ocupa esse período.");
      if (!expectedTask.exclusive && (usage?.count ?? 0) >= maxRegularTasks)
        throw new Error("O limite de rotas regulares no período foi excedido.");
      const increment = usage ? Math.max(0, expectedTask.teamSize - 1) : expectedTask.teamSize;
      if (slot.usedPromoters + increment > capacity)
        throw new Error("A capacidade de promotores do período foi excedida.");
      if (
        !expectedTask.exclusive &&
        usage &&
        expectedTask.cities.length &&
        usage.cities.size &&
        !expectedTask.cities.every((city) => usage.cities.has(city))
      )
        throw new Error("Rotas de cidades diferentes não podem compartilhar o mesmo período.");
      slot.usedPromoters += increment;
      slot.portfolios.set(expectedTask.portfolio, {
        count: (usage?.count ?? 0) + 1,
        exclusive: Boolean(usage?.exclusive || expectedTask.exclusive),
        cities: new Set([...(usage?.cities ?? []), ...expectedTask.cities]),
      });
      slotUsage.set(slotKey, slot);
    }
  }
  if (seen.size !== expected.size)
    throw new Error("Existem blocos da agenda que não foram informados.");
  if (allowedPromoterIds.length) {
    for (const promoterId of allowedPromoterIds) {
      for (const day of operationalDays) {
        if (!promoterDayCoverage.has(`${promoterId}::${day}`)) {
          throw new Error(
            `O promotor ${promoterId} ficou sem loja alocada no dia ${String(day).padStart(2, "0")}. ` +
              "A agenda só pode ser salva quando todos trabalham em todos os dias operacionais.",
          );
        }
      }
    }
  }
  return { totalVisits, plannedHours: Number(plannedHours.toFixed(2)) };
}

function routeLabelForApi(routeKey: string) {
  const routeId = routeKey.split("::").slice(1).join("::");
  return routeId.startsWith("CLUSTER_")
    ? `Cluster ${routeId.slice(8)}`
    : routeId.replace("LOJA_", "Loja ");
}

export function iniciarCargaRmsAssincrona(codigo: string) {
  const comando = `LD_LIBRARY_PATH=/home/administrador/instantclient_19_25 ${RMS_REFRESH_PYTHON} ${RMS_REFRESH_SCRIPT} --codigo ${codigo} --json`;
  exec(comando, { maxBuffer: 20 * 1024 * 1024 }, (erro, stdout, stderr) => {
    if (erro) {
      console.error(`Carga RMS assíncrona falhou para ${codigo}:`, erro, stderr);
      return;
    }
    console.log(`Carga RMS assíncrona concluída para ${codigo}:`, stdout, stderr);
  });
  return true;
}

export function exigirLimite(escopo: string, maximo: number, janelaMs: number) {
  const request = getStartContext().request;
  const resultado = permitirRequisicao(request, escopo, { maximo, janelaMs });
  if (!resultado.permitido) {
    throw new Error(`Muitas tentativas. Aguarde ${resultado.retryAfterSegundos} segundos.`);
  }
}
