import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Filter, GraduationCap, MapPinned, ShieldCheck } from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/context/portal-context";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { fetchAgendaPromotoresSegmentada } from "@/api";

type Level = "N1_CRITICO" | "N2_ALTO" | "N3_MEDIO" | "N4_BASICO";
type AgendaRow = {
  fornecedor_codigo: string;
  loja_id: string;
  cidade?: string | null;
  classe_logistica?: string;
  max_visitas_por_dia?: number;
  dias_de_rota_estimados_mes?: number;
  nivel: Level;
  unidades_periodo: number;
  movimentos_periodo: number;
  skus_ativos: number;
  horas_recomendadas_dia: number;
  visitas_recomendadas_semana?: number;
  visitas_recomendadas_mes?: number;
  carteira_promotor?: number;
  promotores_periodo_recomendados?: number;
  cluster?: string | null;
  carga_trabalho_horas_rota_mes?: number;
  periodos_base_rota?: number;
  motivo: string;
  minutos_servico_visita?: number;
  tipo_atividade?: string;
  objetivo_atendimento?: string;
  familias_produto_ativas?: number;
  modulos_treinamento_ciclo?: number;
};
type VisitEvent = {
  date: number;
  periodId: string;
  periodLabel: string;
  row: AgendaRow;
  sequence: number;
  fullDay?: boolean;
};
type RouteStore = {
  loja_id: string;
  cidade?: string | null;
  carteira_promotor?: number;
  promotores_periodo_recomendados?: number;
  visitas_recomendadas_mes?: number;
  skus_ativos?: number;
  na_agenda: boolean;
};
type AgendaReport = {
  generated_at?: string;
  period_reference: string;
  agenda: AgendaRow[];
  design?: {
    scheduling_policy?: {
      work_periods?: Array<{ id: string; rotulo: string }>;
      exclusive_period_groups?: Array<{ id: string; lojas: string[] }>;
      clusters?: Array<{ id: string; lojas: string[] }>;
      max_regular_tasks_per_period?: number;
      alternate_stores_by_promoter?: boolean;
      avoid_consecutive_route_days?: boolean;
      avoid_different_cities_same_period?: boolean;
      working_weekdays?: number[];
      recurring_holidays?: string[];
      movable_holidays?: string[];
      metropolitan_cities?: string[];
    };
  };
};
type ControlRow = {
  fornecedor_codigo: string;
  descricao_fornecedor: string;
  segmentos_ativos?: string[];
  segmento_principal?: string;
  modelo_atendimento?: string;
  modelo_atendimento_rotulo?: string;
  objetivo_atendimento?: string;
  metrica_dimensionamento?: string;
  skus_catalogo_ativos?: number;
  familias_produto_ativas?: number;
  duracao_sessao_minutos?: number | null;
  sessoes_treinamento_loja_mes?: number;
  ciclo_reciclagem_dias?: number | null;
  modulos_treinamento_ciclo?: number;
  trilhas_treinamento?: string[];
  equipes_treinamento_estimadas?: number;
  venda_media_mensal?: number;
  itens_movimentados_mes?: number;
  itens_por_promotor_observado?: number | null;
  itens_por_promotor_recomendado?: number | null;
  promotores_observados?: number;
  visitas_observadas?: number;
  visitas_medias_mes_planejadas?: number;
  cadencia_media_semanal_planejada?: number;
  lojas_alvo_calibrado?: number;
  visitas_planejadas_mes?: number;
  necessidade_operacional_horas_mes?: number;
  dias_uteis_planejamento_mes?: number;
  horas_agendaveis_por_promotor_mes?: number;
  jornada_agendavel_horas_semana?: number;
  jornada_legal_horas_semana?: number;
  folgas_legais_semana?: number;
  regra_jornada_legal?: string;
  promotores_necessarios_recomendados?: number;
  teto_promotores_fornecedor?: number;
  periodos_base_planejados_mes?: number;
  periodos_capacidade_por_promotor_mes?: number;
  periodos_reforco_compartilhado_mes?: number;
  periodos_trabalho_em_equipe_mes?: number;
  reforco_simultaneo_maximo_promotores?: number;
  skus_ativos_media_loja?: number;
  skus_ativos_maximo_loja?: number;
  promotores_operacionais_teoricos?: number;
  promotores_financeiros_minimo?: number;
  promotores_financeiros_maximo?: number;
  capacidade_visitas_financeira_mes?: number;
  capacidade_horas_financeira_mes?: number;
  horas_alocadas_lojas_prioritarias?: number;
  lojas_prioritarias_quantidade?: number;
  custo_mensal_referencia_financeiro?: number;
  venda_alvo_carteira_promotor?: number;
  lojas_fora_capacidade_quantidade?: number;
  lojas_prioritarias?: Array<{
    loja_id: string;
    cidade?: string | null;
    cluster?: string | null;
    carteira_promotor?: number;
    promotores_periodo_recomendados?: number;
    periodos_base_rota?: number;
    carga_trabalho_horas_rota_mes?: number;
    visitas_recomendadas_mes?: number;
    horas_recomendadas_mes?: number;
    skus_ativos?: number;
    cluster_referencia?: string | null;
    minutos_servico_visita?: number;
    tipo_atividade?: string;
    objetivo_atendimento?: string;
    familias_produto_ativas?: number;
    modulos_treinamento_ciclo?: number;
  }>;
  carteiras_promotores?: Array<{
    carteira: number;
    venda_media_mensal: number;
    percentual_meta_50_sm: number;
    horas_totais: number;
    horas_modelo_anterior?: number;
    periodos_base?: number;
    periodos_trabalho_equipe?: number;
    visitas_mes: number;
    unidades_rota: Array<{
      id: string;
      lojas: Array<{ loja_id: string; promotores_periodo_recomendados?: number }>;
    }>;
  }>;
  horas_observadas?: number;
  lojas_com_presenca?: number;
};
export const Route = createFileRoute("/_portal/agenda-promotores")({ component: AgendaPromotores });
const nivelLabel: Record<Level, string> = {
  N1_CRITICO: "N1 · Crítico",
  N2_ALTO: "N2 · Alto",
  N3_MEDIO: "N3 · Médio",
  N4_BASICO: "N4 · Básico",
};
const routeLabel = (value: string) =>
  value.startsWith("CLUSTER_")
    ? `Cluster ${value.slice("CLUSTER_".length)}`
    : value.replace("LOJA_", "Loja ");
const consultiveModels = new Set([
  "CONSULTORIA_TECNICA",
  "CONSULTORIA_VENDAS",
  "CONSULTORIA_TECNICA_E_VENDAS",
  "HIBRIDO",
]);

function AgendaPromotores() {
  const { usuarioInterno, codigoFornecedorAtivo } = usePortal();
  const [report, setReport] = useState<AgendaReport | null>(null);
  const [controlRows, setControlRows] = useState<ControlRow[]>([]);
  const [fornecedor, setFornecedor] = useState(() =>
    normalizarCodigoFornecedor(codigoFornecedorAtivo),
  );
  const [filtro, setFiltro] = useState("");
  const [nivel, setNivel] = useState("TODOS");
  const [ordenacao, setOrdenacao] = useState("nivel");
  useEffect(() => {
    let ativo = true;
    const codigo = normalizarCodigoFornecedor(codigoFornecedorAtivo);
    if (!codigo) return;
    const agenda = fetchAgendaPromotoresSegmentada({ data: { fornecedorCodigo: codigo } })
      .then((data) => {
        if (ativo) {
          setReport(data as AgendaReport);
          setControlRows(data.fornecedorControle ? [data.fornecedorControle as ControlRow] : []);
        }
      })
      .catch((error) => console.error("Erro ao carregar agenda de promotores:", error));
    void agenda;
    setFornecedor(normalizarCodigoFornecedor(codigoFornecedorAtivo));
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, usuarioInterno]);
  const rows = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const filtered = (report?.agenda ?? []).filter((row) => {
      const text = !q || `${row.loja_id} ${row.motivo}`.toLowerCase().includes(q);
      const level =
        nivel === "TODOS_AB"
          ? row.nivel === "N1_CRITICO" || row.nivel === "N2_ALTO"
          : nivel === "TODOS" || row.nivel === nivel;
      return (
        (!fornecedor || normalizarCodigoFornecedor(row.fornecedor_codigo) === fornecedor) &&
        text &&
        level
      );
    });
    const rank: Record<Level, number> = { N1_CRITICO: 0, N2_ALTO: 1, N3_MEDIO: 2, N4_BASICO: 3 };
    return filtered.sort((a, b) => {
      if (ordenacao === "nivel")
        return rank[a.nivel] - rank[b.nivel] || b.unidades_periodo - a.unidades_periodo;
      if (ordenacao === "skus") return b.skus_ativos - a.skus_ativos;
      if (ordenacao === "unidades") return b.unidades_periodo - a.unidades_periodo;
      if (ordenacao === "visitas")
        return (b.visitas_recomendadas_mes ?? 0) - (a.visitas_recomendadas_mes ?? 0);
      if (ordenacao === "horas") return b.horas_recomendadas_dia - a.horas_recomendadas_dia;
      return a.loja_id.localeCompare(b.loja_id, undefined, { numeric: true });
    });
  }, [filtro, fornecedor, nivel, ordenacao, report]);
  const fornecedorControle = controlRows.find(
    (row) => normalizarCodigoFornecedor(row.fornecedor_codigo) === fornecedor,
  );
  const atendimentoConsultivo = consultiveModels.has(fornecedorControle?.modelo_atendimento ?? "");
  const alocacaoPorLoja = useMemo(
    () =>
      new Map(
        (fornecedorControle?.lojas_prioritarias ?? []).map((row) => [String(row.loja_id), row]),
      ),
    [fornecedorControle],
  );
  const lojasPrioritarias = useMemo(() => new Set(alocacaoPorLoja.keys()), [alocacaoPorLoja]);
  const rowsPlanejadas = useMemo(
    () =>
      fornecedorControle
        ? rows
            .filter((row) => lojasPrioritarias.has(String(row.loja_id)))
            .map((row) => {
              const allocation = alocacaoPorLoja.get(String(row.loja_id));
              const monthlyVisits = Number(
                allocation?.visitas_recomendadas_mes ?? row.visitas_recomendadas_mes ?? 0,
              );
              const monthlyHours = Number(allocation?.horas_recomendadas_mes ?? 0);
              return {
                ...row,
                carteira_promotor: allocation?.carteira_promotor,
                promotores_periodo_recomendados: allocation?.promotores_periodo_recomendados ?? 1,
                cluster: allocation?.cluster,
                cluster_referencia: allocation?.cluster_referencia,
                carga_trabalho_horas_rota_mes: allocation?.carga_trabalho_horas_rota_mes,
                periodos_base_rota: allocation?.periodos_base_rota,
                minutos_servico_visita: allocation?.minutos_servico_visita,
                tipo_atividade: allocation?.tipo_atividade,
                objetivo_atendimento: allocation?.objetivo_atendimento,
                familias_produto_ativas: allocation?.familias_produto_ativas,
                modulos_treinamento_ciclo: allocation?.modulos_treinamento_ciclo,
                visitas_recomendadas_mes: monthlyVisits,
                visitas_recomendadas_semana: Number((monthlyVisits / 4.33).toFixed(2)),
                horas_recomendadas_dia:
                  Number(allocation?.carga_trabalho_horas_rota_mes || 0) > 0 && monthlyVisits > 0
                    ? Number(
                        (
                          Number(allocation?.carga_trabalho_horas_rota_mes || 0) / monthlyVisits
                        ).toFixed(2),
                      )
                    : monthlyHours > 0
                      ? Number((monthlyHours / monthlyVisits).toFixed(2))
                      : row.horas_recomendadas_dia,
              };
            })
        : rows,
    [alocacaoPorLoja, fornecedorControle, lojasPrioritarias, rows],
  );
  const routeGroups = useMemo(() => {
    const allocationByStore = new Map(
      (fornecedorControle?.lojas_prioritarias ?? []).map((loja) => [String(loja.loja_id), loja]),
    );
    const cityByStore = new Map<string, string | null>();
    for (const row of report?.agenda ?? []) {
      const storeId = String(row.loja_id);
      if (!cityByStore.has(storeId) || (!cityByStore.get(storeId) && row.cidade)) {
        cityByStore.set(storeId, row.cidade ?? null);
      }
    }
    const toRouteStore = (storeId: string): RouteStore => {
      const allocation = allocationByStore.get(storeId);
      return {
        loja_id: storeId,
        cidade: allocation?.cidade ?? cityByStore.get(storeId) ?? null,
        carteira_promotor: allocation?.carteira_promotor,
        promotores_periodo_recomendados: allocation?.promotores_periodo_recomendados,
        visitas_recomendadas_mes: allocation?.visitas_recomendadas_mes,
        skus_ativos: allocation?.skus_ativos,
        na_agenda: Boolean(allocation),
      };
    };
    const policyClusters = report?.design?.scheduling_policy?.clusters ?? [];
    const clusteredStoreIds = new Set(
      policyClusters.flatMap((cluster) => cluster.lojas.map(String)),
    );
    const sortStores = (stores: RouteStore[]) =>
      [...stores].sort((a, b) =>
        String(a.loja_id).localeCompare(String(b.loja_id), undefined, { numeric: true }),
      );
    return {
      clusters: policyClusters
        .map((cluster) => ({
          id: cluster.id,
          lojas: sortStores(cluster.lojas.map((storeId) => toRouteStore(String(storeId)))),
        }))
        .sort((a, b) =>
          routeLabel(a.id).localeCompare(routeLabel(b.id), undefined, { numeric: true }),
        ),
      individuais: sortStores(
        [...cityByStore.keys()]
          .filter((storeId) => !clusteredStoreIds.has(storeId))
          .map(toRouteStore),
      ),
    };
  }, [fornecedorControle, report]);
  const calendar = useMemo(() => {
    const reference = report?.period_reference ?? new Date().toISOString().slice(0, 7);
    const [year, month] = reference.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const events = new Map<number, VisitEvent[]>();
    const scheduling = report?.design?.scheduling_policy;
    const workPeriods = scheduling?.work_periods?.length
      ? scheduling.work_periods
      : [
          { id: "MANHA", rotulo: "08h–12h" },
          { id: "TARDE", rotulo: "14h–18h" },
        ];
    const exclusiveGroups = scheduling?.exclusive_period_groups ?? [
      { id: "ROTA_11_28_33", lojas: ["33", "11", "28"] },
      { id: "ROTA_5_12", lojas: ["12", "5"] },
    ];
    const clusters = scheduling?.clusters ?? [];
    const maxRegularTasks = Number(scheduling?.max_regular_tasks_per_period || 2);
    const workingWeekdays = new Set(scheduling?.working_weekdays ?? [1, 2, 3, 4, 5]);
    const recurringHolidays = new Set(scheduling?.recurring_holidays ?? []);
    const movableHolidays = new Set(scheduling?.movable_holidays ?? []);
    const operationalDays = Array.from({ length: daysInMonth }, (_, index) => index + 1).filter(
      (day) => {
        const date = new Date(year, month - 1, day);
        const iso = `${reference}-${String(day).padStart(2, "0")}`;
        return (
          workingWeekdays.has(date.getDay()) &&
          !recurringHolidays.has(iso.slice(5)) &&
          !movableHolidays.has(iso)
        );
      },
    );
    const slotState = operationalDays.flatMap((date, operationalIndex) =>
      workPeriods.map((period) => ({
        date,
        operationalIndex,
        periodId: period.id,
        periodLabel: period.rotulo,
        usedPromoters: 0,
        portfolioUsage: new Map<
          number,
          { count: number; exclusive: boolean; cities: Set<string> }
        >(),
      })),
    );
    const clusterByStore = new Map<string, string>();
    for (const cluster of clusters) {
      for (const storeId of cluster.lojas) clusterByStore.set(String(storeId), cluster.id);
    }
    for (const group of exclusiveGroups) {
      for (const storeId of group.lojas) {
        if (!clusterByStore.has(String(storeId))) clusterByStore.set(String(storeId), group.id);
      }
    }
    const routeRows = new Map<string, AgendaRow[]>();
    for (const row of rowsPlanejadas) {
      const portfolio = Number(row.carteira_promotor || 1);
      const routeId = atendimentoConsultivo
        ? `LOJA_${row.loja_id}`
        : row.cluster || clusterByStore.get(String(row.loja_id)) || `LOJA_${row.loja_id}`;
      const key = `${portfolio}::${routeId}`;
      const list = routeRows.get(key) || [];
      list.push(row);
      routeRows.set(key, list);
    }
    type CalendarTask = {
      routeKey: string;
      portfolio: number;
      exclusive: boolean;
      fullDay: boolean;
      teamSize: number;
      cityKeys: string[];
      visits: Array<{ row: AgendaRow; sequence: number }>;
    };
    const routeTasksByPortfolio = new Map<
      number,
      Array<{ routeKey: string; tasks: CalendarTask[] }>
    >();
    for (const [routeKey, route] of routeRows) {
      const portfolio = Number(route[0]?.carteira_promotor || 1);
      const clustered =
        !atendimentoConsultivo &&
        route.some((row) => Boolean(row.cluster || clusterByStore.has(String(row.loja_id))));
      const fullDay = route.some((row) => row.classe_logistica === "REMOTA");
      const maxVisits = Math.max(
        0,
        ...route.map((row) => Number(row.visitas_recomendadas_mes || 0)),
      );
      const routeTasks: CalendarTask[] = [];
      for (let sequence = 0; sequence < maxVisits; sequence += 1) {
        const visits = route
          .filter((row) => Number(row.visitas_recomendadas_mes || 0) > sequence)
          .map((row) => ({ row, sequence: sequence + 1 }));
        if (!visits.length) continue;
        const teamSize = Math.max(
          1,
          ...visits.map(({ row }) => Number(row.promotores_periodo_recomendados || 1)),
        );
        routeTasks.push({
          routeKey,
          portfolio,
          exclusive: clustered || fullDay || teamSize > 1,
          fullDay,
          teamSize,
          cityKeys: [
            ...new Set(
              visits
                .map(({ row }) =>
                  String(row.cidade || "")
                    .trim()
                    .toUpperCase(),
                )
                .filter(Boolean),
            ),
          ],
          visits,
        });
      }
      const queues = routeTasksByPortfolio.get(portfolio) || [];
      queues.push({ routeKey, tasks: routeTasks });
      routeTasksByPortfolio.set(portfolio, queues);
    }
    const tasks: CalendarTask[] = [];
    const alternateStores = scheduling?.alternate_stores_by_promoter ?? true;
    for (const queues of routeTasksByPortfolio.values()) {
      const maxQueueLength = Math.max(0, ...queues.map((queue) => queue.tasks.length));
      for (let round = 0; round < maxQueueLength; round += 1) {
        const roundTasks = queues
          .map((queue, queueIndex) => ({
            task: queue.tasks[round],
            queueIndex,
          }))
          .filter((entry): entry is { task: CalendarTask; queueIndex: number } =>
            Boolean(entry.task),
          );
        roundTasks.sort(
          (a, b) =>
            Number(b.task.fullDay) - Number(a.task.fullDay) ||
            b.task.teamSize - a.task.teamSize ||
            Number(b.task.exclusive) - Number(a.task.exclusive) ||
            ((a.queueIndex + round) % queues.length) - ((b.queueIndex + round) % queues.length),
        );
        tasks.push(...roundTasks.map((entry) => entry.task));
      }
    }
    if (!alternateStores) {
      tasks.sort(
        (a, b) =>
          Number(b.fullDay) - Number(a.fullDay) ||
          b.teamSize - a.teamSize ||
          Number(b.exclusive) - Number(a.exclusive),
      );
    }
    const fixedPromoters = Math.max(
      1,
      Number(fornecedorControle?.promotores_necessarios_recomendados || 1),
    );
    const sharedReinforcement =
      Number(fornecedorControle?.periodos_reforco_compartilhado_mes || 0) > 0
        ? Math.max(0, Number(fornecedorControle?.reforco_simultaneo_maximo_promotores || 0))
        : 0;
    const teamCapacity = fixedPromoters + sharedReinforcement;
    const routeDates = new Set<string>();
    const lastRouteOperationalDay = new Map<string, number>();
    const lastPortfolioOperationalDay = new Map<number, number>();
    const avoidConsecutiveRouteDays = scheduling?.avoid_consecutive_route_days ?? true;
    const avoidDifferentCitiesSamePeriod = scheduling?.avoid_different_cities_same_period ?? true;
    let rotatedTasks = 0;
    let consecutiveFallbacks = 0;
    let sameDayFallbacks = 0;
    const canReserve = (slot: (typeof slotState)[number], task: (typeof tasks)[number]) => {
      const usage = slot.portfolioUsage.get(task.portfolio);
      if (task.exclusive && usage) return false;
      if (!task.exclusive && usage?.exclusive) return false;
      if (!task.exclusive && (usage?.count || 0) >= maxRegularTasks) return false;
      if (!task.exclusive && usage && avoidDifferentCitiesSamePeriod) {
        const sameCityOnly =
          task.cityKeys.length > 0 &&
          usage.cities.size > 0 &&
          task.cityKeys.every((city) => usage.cities.has(city));
        if (!sameCityOnly) return false;
      }
      const increment = usage ? Math.max(0, task.teamSize - 1) : task.teamSize;
      return slot.usedPromoters + increment <= teamCapacity;
    };
    const reserve = (slot: (typeof slotState)[number], task: (typeof tasks)[number]) => {
      const usage = slot.portfolioUsage.get(task.portfolio);
      const increment = usage ? Math.max(0, task.teamSize - 1) : task.teamSize;
      slot.usedPromoters += increment;
      slot.portfolioUsage.set(task.portfolio, {
        count: (usage?.count || 0) + 1,
        exclusive: Boolean(usage?.exclusive || task.exclusive),
        cities: new Set([...(usage?.cities || []), ...task.cityKeys]),
      });
      for (const visit of task.visits) {
        const list = events.get(slot.date) || [];
        list.push({
          date: slot.date,
          periodId: slot.periodId,
          periodLabel: slot.periodLabel,
          row: visit.row,
          sequence: visit.sequence,
          fullDay: task.fullDay,
        });
        events.set(slot.date, list);
      }
    };
    let cursor = 0;
    let unscheduledTasks = 0;
    for (const task of tasks) {
      let chosenIndexes: number[] = [];
      const isPreferredGap = (slot: (typeof slotState)[number]) => {
        const lastDay = lastRouteOperationalDay.get(task.routeKey);
        return (
          !avoidConsecutiveRouteDays || lastDay === undefined || slot.operationalIndex > lastDay + 1
        );
      };
      if (task.fullDay) {
        const dayCandidates = operationalDays
          .map((day) => {
            const indexes = slotState
              .map((slot, index) => ({ slot, index }))
              .filter(({ slot }) => slot.date === day)
              .map(({ index }) => index);
            return { day, indexes };
          })
          .filter(
            ({ day, indexes }) =>
              !routeDates.has(`${task.routeKey}::${day}`) &&
              indexes.length === workPeriods.length &&
              indexes.every((index) => canReserve(slotState[index], task)),
          );
        const lastPortfolioDay = lastPortfolioOperationalDay.get(task.portfolio);
        const differentDayCandidates = dayCandidates.filter(
          ({ indexes }) =>
            lastPortfolioDay === undefined ||
            slotState[indexes[0]].operationalIndex !== lastPortfolioDay,
        );
        const dayPool = differentDayCandidates.length ? differentDayCandidates : dayCandidates;
        const preferredDays = dayPool.filter(({ indexes }) =>
          isPreferredGap(slotState[indexes[0]]),
        );
        const selectedDay = (preferredDays.length ? preferredDays : dayPool)[0];
        if (selectedDay) chosenIndexes = selectedDay.indexes;
      } else {
        const candidates: number[] = [];
        for (let offset = 0; offset < slotState.length; offset += 1) {
          const index = (cursor + offset) % slotState.length;
          const slot = slotState[index];
          if (routeDates.has(`${task.routeKey}::${slot.date}`)) continue;
          if (canReserve(slot, task)) candidates.push(index);
        }
        const lastPortfolioDay = lastPortfolioOperationalDay.get(task.portfolio);
        const differentDayCandidates = candidates.filter(
          (index) =>
            lastPortfolioDay === undefined ||
            slotState[index].operationalIndex !== lastPortfolioDay,
        );
        const candidatePool = differentDayCandidates.length ? differentDayCandidates : candidates;
        const preferred = candidatePool.filter((index) => isPreferredGap(slotState[index]));
        if (preferred.length) chosenIndexes = [preferred[0]];
        else if (candidatePool.length) chosenIndexes = [candidatePool[0]];
      }
      if (!chosenIndexes.length) {
        unscheduledTasks += 1;
        continue;
      }
      for (const index of chosenIndexes) reserve(slotState[index], task);
      const chosenSlot = slotState[chosenIndexes[0]];
      routeDates.add(`${task.routeKey}::${chosenSlot.date}`);
      const previousPortfolioDay = lastPortfolioOperationalDay.get(task.portfolio);
      if (
        previousPortfolioDay !== undefined &&
        previousPortfolioDay === chosenSlot.operationalIndex
      ) {
        sameDayFallbacks += 1;
      }
      lastPortfolioOperationalDay.set(task.portfolio, chosenSlot.operationalIndex);
      const previousDay = lastRouteOperationalDay.get(task.routeKey);
      if (previousDay !== undefined && chosenSlot.operationalIndex > previousDay + 1) {
        rotatedTasks += 1;
      } else if (previousDay !== undefined && chosenSlot.operationalIndex === previousDay + 1) {
        consecutiveFallbacks += 1;
      }
      lastRouteOperationalDay.set(task.routeKey, chosenSlot.operationalIndex);
      cursor = (chosenIndexes.at(-1)! + 1) % slotState.length;
    }
    return {
      label: `${String(month).padStart(2, "0")}/${year}`,
      daysInMonth,
      firstDayOffset,
      events,
      workPeriods,
      operationalDays: operationalDays.length,
      operationalDayNumbers: new Set(operationalDays),
      unscheduledTasks,
      teamCapacity,
      rotationEnabled: Boolean(alternateStores && avoidConsecutiveRouteDays),
      cityConflictEnabled: avoidDifferentCitiesSamePeriod,
      rotatedTasks,
      consecutiveFallbacks,
      sameDayFallbacks,
    };
  }, [atendimentoConsultivo, fornecedorControle, report, rowsPlanejadas]);
  const money = (value?: number) =>
    (value ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  return (
    <PortalLayout
      titulo="Agenda de Promotores"
      descricao="Agenda própria por fornecedor, loja e nível de atendimento."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> Administração interna · recomendação sem obrigação
          externa
        </div>
        {fornecedorControle ? (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 text-sm font-semibold">Controle do fornecedor</div>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 text-sm">
              {atendimentoConsultivo ? (
                <GraduationCap className="size-5 text-blue-700" />
              ) : (
                <CalendarClock className="size-5 text-emerald-700" />
              )}
              <Badge variant={atendimentoConsultivo ? "default" : "secondary"}>
                {fornecedorControle.modelo_atendimento_rotulo ?? "Modelo não classificado"}
              </Badge>
              <span className="text-muted-foreground">
                {(fornecedorControle.segmentos_ativos ?? []).join(" · ") ||
                  "Segmento ainda não identificado"}
              </span>
              <span className="basis-full text-xs text-muted-foreground">
                {fornecedorControle.objetivo_atendimento}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1850px] text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Código</th>
                    <th className="p-2">Fornecedor</th>
                    <th className="p-2">Venda média/mês</th>
                    <th className="p-2">Promotores possíveis</th>
                    <th className="p-2">Lojas atendidas</th>
                    <th className="p-2">Lojas fora da capacidade</th>
                    <th className="p-2">Venda-alvo/carteira</th>
                    <th className="p-2">Horas disponíveis/mês</th>
                    <th className="p-2">Horas alocadas/mês</th>
                    <th className="p-2">Custo referência/mês</th>
                    <th className="p-2">Itens movimentados/mês</th>
                    <th className="p-2">Itens/promotor observado</th>
                    <th className="p-2">Itens/promotor recomendado</th>
                    <th className="p-2">Visitas observadas</th>
                    <th className="p-2">Média planejada/loja/mês</th>
                    <th className="p-2">Cadência planejada/semana</th>
                    <th className="p-2">Lojas-alvo</th>
                    <th className="p-2">Visitas planejadas/mês</th>
                    <th className="p-2">Horas necessárias/mês</th>
                    <th className="p-2">Promotores necessários</th>
                    <th className="p-2">Reforço/períodos</th>
                    <th className="p-2">Trabalho em equipe/períodos</th>
                    <th className="p-2">Períodos base</th>
                    <th className="p-2">SKUs médios/loja</th>
                    <th className="p-2">Máx. SKUs/loja</th>
                    <th className="p-2">Promotores presentes</th>
                    <th className="p-2">Horas observadas</th>
                    <th className="p-2">Lojas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-2 font-mono">{fornecedorControle.fornecedor_codigo}</td>
                    <td className="p-2 font-medium">{fornecedorControle.descricao_fornecedor}</td>
                    <td className="p-2">{money(fornecedorControle.venda_media_mensal)}</td>
                    <td className="p-2 font-semibold">
                      {fornecedorControle.promotores_financeiros_minimo ?? "—"}–
                      {fornecedorControle.promotores_financeiros_maximo ?? "—"}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.lojas_prioritarias_quantidade ?? "—"}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.lojas_fora_capacidade_quantidade ?? "—"}
                    </td>
                    <td className="p-2">
                      {money(fornecedorControle.venda_alvo_carteira_promotor)}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.capacidade_horas_financeira_mes?.toFixed(2) ?? "—"}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.horas_alocadas_lojas_prioritarias?.toFixed(2) ?? "—"}
                    </td>
                    <td className="p-2">
                      {money(fornecedorControle.custo_mensal_referencia_financeiro)}
                    </td>
                    <td className="p-2">
                      {(fornecedorControle.itens_movimentados_mes ?? 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.itens_por_promotor_observado == null
                        ? "—"
                        : Math.round(
                            fornecedorControle.itens_por_promotor_observado,
                          ).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.itens_por_promotor_recomendado == null
                        ? "—"
                        : Math.round(
                            fornecedorControle.itens_por_promotor_recomendado,
                          ).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2">{fornecedorControle.visitas_observadas ?? "—"}</td>
                    <td className="p-2">
                      {(fornecedorControle.visitas_medias_mes_planejadas ?? 0).toFixed(2)}
                    </td>
                    <td className="p-2">
                      {(fornecedorControle.cadencia_media_semanal_planejada ?? 0).toFixed(2)}x
                    </td>
                    <td className="p-2">{fornecedorControle.lojas_alvo_calibrado ?? "—"}</td>
                    <td className="p-2">{fornecedorControle.visitas_planejadas_mes ?? "—"}</td>
                    <td className="p-2">
                      {(fornecedorControle.necessidade_operacional_horas_mes ?? 0).toFixed(2)}
                    </td>
                    <td className="p-2 font-semibold">
                      {fornecedorControle.promotores_necessarios_recomendados ?? "—"}
                    </td>
                    <td className="p-2 font-semibold">
                      {fornecedorControle.periodos_reforco_compartilhado_mes ?? 0}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.periodos_trabalho_em_equipe_mes ?? 0}
                    </td>
                    <td className="p-2">
                      {fornecedorControle.periodos_base_planejados_mes ?? 0}/
                      {fornecedorControle.periodos_capacidade_por_promotor_mes ?? 0} por promotor
                    </td>
                    <td className="p-2">
                      {(fornecedorControle.skus_ativos_media_loja ?? 0).toFixed(1)}
                    </td>
                    <td className="p-2">{fornecedorControle.skus_ativos_maximo_loja ?? 0}</td>
                    <td className="p-2">{fornecedorControle.promotores_observados ?? "—"}</td>
                    <td className="p-2">{(fornecedorControle.horas_observadas ?? 0).toFixed(2)}</td>
                    <td className="p-2">{fornecedorControle.lojas_com_presenca ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Fornecedor: </span>
            <strong>{fornecedor || "Todos os fornecedores"}</strong>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer text-left transition hover:border-primary"
            onClick={() => setOrdenacao("loja")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setOrdenacao("loja");
            }}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Referência · clique para ordenar por loja
              </p>
              <p className="mt-1 text-2xl font-semibold">{report?.period_reference ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {report?.generated_at
                  ? `Atualizada em ${new Date(report.generated_at).toLocaleString("pt-BR", {
                      timeZone: "America/Belem",
                    })}`
                  : "Atualização ainda não informada"}
              </p>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer text-left transition hover:border-primary"
            onClick={() => setOrdenacao("loja")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setOrdenacao("loja");
            }}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Fornecedor · clique para ordenar por loja
              </p>
              <p className="mt-1 text-2xl font-semibold">{fornecedor || "Todos"}</p>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer text-left transition hover:border-primary"
            onClick={() => setOrdenacao("visitas")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setOrdenacao("visitas");
            }}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {atendimentoConsultivo
                  ? "Equipes/lojas no plano · clique para ordenar por sessões"
                  : "Lojas prioritárias · clique para ordenar por visitas"}
              </p>
              <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer text-left transition hover:border-primary"
            onClick={() => setOrdenacao("horas")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setOrdenacao("horas");
            }}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                {atendimentoConsultivo
                  ? "Carga consultiva/mês · clique para ordenar por esforço"
                  : "Carga total da equipe/mês · clique para ordenar por esforço"}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {(fornecedorControle?.necessidade_operacional_horas_mes ?? 0).toFixed(2)}h
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {fornecedor ? (
              <>
                Fornecedor selecionado: <strong>{fornecedor}</strong>
              </>
            ) : usuarioInterno ? (
              <>
                Visão interna: <strong>todos os fornecedores</strong>
              </>
            ) : (
              <>
                Fornecedor: <strong>{codigoFornecedorAtivo || "não identificado"}</strong>
              </>
            )}
          </div>
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filtrar loja ou motivo"
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 py-2 text-sm"
            value={nivel}
            onChange={(event) => setNivel(event.target.value)}
          >
            <option value="TODOS_AB">Somente A/B (N1/N2)</option>
            <option value="TODOS">Todos os níveis</option>
            <option value="N1_CRITICO">N1 · Crítico</option>
            <option value="N2_ALTO">N2 · Alto</option>
            <option value="N3_MEDIO">N3 · Médio</option>
            <option value="N4_BASICO">N4 · Básico</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 py-2 text-sm"
            value={ordenacao}
            onChange={(event) => setOrdenacao(event.target.value)}
          >
            <option value="nivel">Ordenar por nível</option>
            <option value="skus">Ordenar por SKUs</option>
            <option value="unidades">Ordenar por unidades</option>
            <option value="visitas">Ordenar por visitas</option>
            <option value="horas">Ordenar por horas</option>
            <option value="loja">Ordenar por loja</option>
          </select>
        </div>
        <Tabs defaultValue="planilha" className="w-full">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="planilha">Planilha</TabsTrigger>
            <TabsTrigger value="calendario">Calendário de visitas</TabsTrigger>
            {atendimentoConsultivo ? (
              <TabsTrigger value="plano-consultivo">Plano consultivo</TabsTrigger>
            ) : null}
            <TabsTrigger value="clusters">Clusters e rotas</TabsTrigger>
            <TabsTrigger value="agendas-promotores">
              Agendas dos {atendimentoConsultivo ? "consultores" : "promotores"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="planilha">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3">Loja</th>
                    <th className="p-3">
                      {atendimentoConsultivo ? "Agenda do consultor" : "Agenda do promotor"}
                    </th>
                    <th className="p-3">Cidade</th>
                    <th className="p-3">Logística</th>
                    <th className="p-3">Nível de atendimento</th>
                    <th className="p-3">
                      {atendimentoConsultivo ? "Sessões/semana" : "Visitas/semana"}
                    </th>
                    <th className="p-3">{atendimentoConsultivo ? "Sessões/mês" : "Visitas/mês"}</th>
                    <th className="p-3">Máx./dia</th>
                    <th className="p-3">Dias de rota/mês</th>
                    <th className="p-3">
                      {atendimentoConsultivo ? "Duração/sessão" : "Carga da rota/visita"}
                    </th>
                    <th className="p-3">Equipe/período</th>
                    <th className="p-3">{atendimentoConsultivo ? "Famílias" : "SKUs"}</th>
                    <th className="p-3">{atendimentoConsultivo ? "Modelo" : "Unidades"}</th>
                    <th className="p-3">{atendimentoConsultivo ? "Objetivo" : "Motivo"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsPlanejadas.slice(0, 250).map((row) => (
                    <tr key={`${row.fornecedor_codigo}-${row.loja_id}`} className="border-t">
                      <td className="p-3">{row.loja_id}</td>
                      <td className="p-3">
                        {alocacaoPorLoja.has(String(row.loja_id))
                          ? `${atendimentoConsultivo ? "Consultor" : "Promotor"} ${alocacaoPorLoja.get(String(row.loja_id))?.carteira_promotor}${
                              alocacaoPorLoja.get(String(row.loja_id))?.cluster
                                ? ` · ${routeLabel(
                                    String(alocacaoPorLoja.get(String(row.loja_id))?.cluster),
                                  )}`
                                : ""
                            }`
                          : "Fora da capacidade-base"}
                      </td>
                      <td className="p-3">{row.cidade || "—"}</td>
                      <td className="p-3">
                        {row.classe_logistica === "GEOGRAFIA_PENDENTE"
                          ? "Pendente"
                          : row.classe_logistica || "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant={row.nivel === "N1_CRITICO" ? "destructive" : "default"}>
                          {nivelLabel[row.nivel]}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold">
                        {row.visitas_recomendadas_semana ?? "—"}
                      </td>
                      <td className="p-3">{row.visitas_recomendadas_mes ?? "—"}</td>
                      <td className="p-3">{row.max_visitas_por_dia ?? "—"}</td>
                      <td className="p-3">{row.dias_de_rota_estimados_mes ?? "—"}</td>
                      <td className="p-3">
                        {atendimentoConsultivo
                          ? `${row.minutos_servico_visita ?? fornecedorControle?.duracao_sessao_minutos ?? 0} min`
                          : `${row.horas_recomendadas_dia.toFixed(2)}h`}
                      </td>
                      <td className="p-3">{row.promotores_periodo_recomendados ?? 1}</td>
                      <td className="p-3">
                        {atendimentoConsultivo
                          ? (row.familias_produto_ativas ??
                            fornecedorControle?.familias_produto_ativas ??
                            0)
                          : row.skus_ativos}
                      </td>
                      <td className="p-3">
                        {atendimentoConsultivo
                          ? fornecedorControle?.modelo_atendimento_rotulo
                          : row.unidades_periodo}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {atendimentoConsultivo
                          ? (row.objetivo_atendimento ?? fornecedorControle?.objetivo_atendimento)
                          : row.motivo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="calendario">
            <div className="rounded-xl border p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {atendimentoConsultivo ? "Sessões consultivas" : "Visitas previstas"} —{" "}
                    {calendar.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {calendar.operationalDays} dias úteis · equipe disponível de até{" "}
                    {calendar.teamCapacity} por período · sábados, domingos e feriados sem agenda
                    regular
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {calendar.rotationEnabled
                      ? `Rodízio ativo: intercala as rotas e evita repetir a mesma loja ou cluster em dias úteis consecutivos quando houver outra alternativa.${calendar.consecutiveFallbacks > 0 || calendar.sameDayFallbacks > 0 ? ` Exceções inevitáveis: ${calendar.consecutiveFallbacks} repetição(ões) em dias consecutivos e ${calendar.sameDayFallbacks} concentração(ões) no mesmo dia.` : ""}`
                      : "Rodízio entre lojas desativado para este planejamento."}
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    {calendar.cityConflictEnabled
                      ? "Regra geográfica: o mesmo promotor não atende cidades diferentes no mesmo período."
                      : "Regra geográfica entre cidades desativada para este planejamento."}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Passe o mouse sobre uma visita para ver o motivo
                </span>
              </div>
              {calendar.unscheduledTasks > 0 ? (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {calendar.unscheduledTasks} blocos de{" "}
                  {atendimentoConsultivo ? "treinamento" : "visita"} não couberam na capacidade
                  legal do mês e precisam de reforço ou reprogramação.
                </div>
              ) : null}
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
                <div className="bg-muted p-2 text-xs font-semibold">Seg</div>
                <div className="bg-muted p-2 text-xs font-semibold">Ter</div>
                <div className="bg-muted p-2 text-xs font-semibold">Qua</div>
                <div className="bg-muted p-2 text-xs font-semibold">Qui</div>
                <div className="bg-muted p-2 text-xs font-semibold">Sex</div>
                <div className="bg-muted p-2 text-xs font-semibold">Sáb</div>
                <div className="bg-muted p-2 text-xs font-semibold">Dom</div>
                {Array.from(
                  { length: calendar.firstDayOffset + calendar.daysInMonth },
                  (_, index) => {
                    const day = index - calendar.firstDayOffset + 1;
                    const events = day > 0 ? calendar.events.get(day) || [] : [];
                    return (
                      <div
                        key={index}
                        className={`min-h-40 bg-background p-1 ${day < 1 ? "bg-muted/20" : ""}`}
                      >
                        <div className="mb-1 text-xs font-semibold text-muted-foreground">
                          {day > 0 ? day : ""}
                        </div>
                        <div className="space-y-1.5">
                          {day > 0 && !calendar.operationalDayNumbers.has(day) ? (
                            <div className="rounded border bg-muted/40 p-2 text-center text-[10px] text-muted-foreground">
                              Folga ou feriado
                            </div>
                          ) : null}
                          {day > 0 && calendar.operationalDayNumbers.has(day)
                            ? calendar.workPeriods.map((period) => {
                                const periodEvents = events.filter(
                                  (event) => event.periodId === period.id,
                                );
                                return (
                                  <div key={period.id} className="rounded border bg-muted/20 p-1">
                                    <div className="mb-1 text-[9px] font-semibold text-muted-foreground">
                                      {period.rotulo}
                                    </div>
                                    <div className="space-y-1">
                                      {periodEvents.map((event) => (
                                        <div
                                          key={`${event.periodId}-${event.row.fornecedor_codigo}-${event.row.loja_id}-${event.sequence}`}
                                          title={`${event.row.objetivo_atendimento ?? event.row.motivo} | ${event.periodLabel} | ${atendimentoConsultivo ? "Sessão" : "Visita"} ${event.sequence}/${event.row.visitas_recomendadas_mes ?? "—"}`}
                                          className={`cursor-help truncate rounded px-1.5 py-1 text-[10px] ${event.row.nivel === "N1_CRITICO" ? "bg-red-100 text-red-900" : event.row.nivel === "N2_ALTO" ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"}`}
                                        >
                                          {atendimentoConsultivo ? "Treinamento" : "Loja"}{" "}
                                          {event.row.loja_id}
                                          {event.row.cidade ? ` · ${event.row.cidade}` : ""}
                                          {event.row.carteira_promotor
                                            ? ` · C${event.row.carteira_promotor}`
                                            : ""}
                                          {(event.row.promotores_periodo_recomendados ?? 1) > 1
                                            ? ` · equipe ${event.row.promotores_periodo_recomendados}`
                                            : ""}
                                          {event.fullDay ? " · dia inteiro" : ""}
                                        </div>
                                      ))}
                                      {!periodEvents.length ? (
                                        <span className="text-[9px] text-muted-foreground">
                                          Livre
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })
                            : null}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </TabsContent>
          {atendimentoConsultivo ? (
            <TabsContent value="plano-consultivo">
              <div className="space-y-5 rounded-xl border p-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-blue-950">
                  <div className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 size-6 shrink-0" />
                    <div>
                      <h3 className="font-semibold">Plano de capacitação das equipes de loja</h3>
                      <p className="mt-1 text-sm leading-relaxed">
                        Neste modelo, o promotor atua como consultor. A visita é uma sessão de
                        treinamento, demonstração e reciclagem do conhecimento dos atendentes; não é
                        calculada como reposição individual de cada SKU.
                      </p>
                      {(fornecedorControle?.segmentos_ativos ?? []).includes("FARMALIDER") ? (
                        <p className="mt-2 text-xs">
                          Na FarmaLíder, o conteúdo deve usar material aprovado e respeitar a
                          responsabilidade técnica do farmacêutico, sem substituir orientação
                          profissional.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Modelo</div>
                    <div className="mt-1 font-semibold">
                      {fornecedorControle?.modelo_atendimento_rotulo}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Famílias ativas</div>
                    <div className="mt-1 text-xl font-semibold">
                      {fornecedorControle?.familias_produto_ativas ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Módulos por ciclo</div>
                    <div className="mt-1 text-xl font-semibold">
                      {fornecedorControle?.modulos_treinamento_ciclo ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Reciclagem</div>
                    <div className="mt-1 text-xl font-semibold">
                      {fornecedorControle?.ciclo_reciclagem_dias ?? 90} dias
                    </div>
                  </div>
                </div>

                <section>
                  <h3 className="font-semibold">Trilha recomendada</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Os módulos são alternados ao longo do ciclo para evitar repetir sempre o mesmo
                    conteúdo.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(fornecedorControle?.trilhas_treinamento ?? []).map((track, index) => (
                      <div
                        key={track}
                        className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-800">
                          {index + 1}
                        </span>
                        <span>{track}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="mb-3">
                    <h3 className="font-semibold">Sessões planejadas por loja</h3>
                    <p className="text-sm text-muted-foreground">
                      Uma equipe estimada por loja até que a quantidade real de atendentes seja
                      cadastrada. O responsável da loja deve registrar presença e dúvidas ao final
                      da sessão.
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="p-3">Loja</th>
                          <th className="p-3">Cidade</th>
                          <th className="p-3">Consultor</th>
                          <th className="p-3">Sessões/mês</th>
                          <th className="p-3">Duração</th>
                          <th className="p-3">Famílias</th>
                          <th className="p-3">Objetivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsPlanejadas.map((row) => (
                          <tr
                            key={`training-${row.fornecedor_codigo}-${row.loja_id}`}
                            className="border-t"
                          >
                            <td className="p-3 font-medium">Loja {row.loja_id}</td>
                            <td className="p-3">{row.cidade || "—"}</td>
                            <td className="p-3">Consultor {row.carteira_promotor ?? "—"}</td>
                            <td className="p-3">{row.visitas_recomendadas_mes ?? 0}</td>
                            <td className="p-3">
                              {row.minutos_servico_visita ??
                                fornecedorControle?.duracao_sessao_minutos ??
                                0}{" "}
                              min
                            </td>
                            <td className="p-3">
                              {row.familias_produto_ativas ??
                                fornecedorControle?.familias_produto_ativas ??
                                0}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {row.objetivo_atendimento ?? fornecedorControle?.objetivo_atendimento}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </TabsContent>
          ) : null}
          <TabsContent value="clusters">
            <div className="space-y-5 rounded-xl border p-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-950">
                <div className="flex items-start gap-3">
                  <MapPinned className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <h3 className="font-semibold">Como funcionam os clusters</h3>
                    <p className="mt-1 leading-relaxed">
                      {atendimentoConsultivo
                        ? "No modelo consultivo, o cluster é uma referência de deslocamento e proximidade. Cada loja mantém sua própria sessão de treinamento, porque as equipes e as dúvidas são diferentes; as lojas do cluster não são comprimidas em uma única sessão."
                        : "Cluster é um grupo de lojas próximas atendido na mesma rota. As vendas, os SKUs e o deslocamento dessas lojas são analisados em conjunto para definir a frequência e o tamanho da equipe. O cluster não representa um promotor por loja: a equipe percorre as lojas agrupadas dentro do período planejado. As lojas que não pertencem a um cluster aparecem como rotas individuais."}
                    </p>
                  </div>
                </div>
              </div>

              <section>
                <div className="mb-3">
                  <h3 className="font-semibold">Clusters da rede</h3>
                  <p className="text-sm text-muted-foreground">
                    Composição completa dos {routeGroups.clusters.length} agrupamentos e indicação
                    das lojas presentes na agenda atual do fornecedor.
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {routeGroups.clusters.map((cluster) => {
                    const routeVisits = Math.max(
                      0,
                      ...cluster.lojas
                        .filter((loja) => loja.na_agenda)
                        .map((loja) => loja.visitas_recomendadas_mes ?? 0),
                    );
                    const maxTeam = Math.max(
                      1,
                      ...cluster.lojas
                        .filter((loja) => loja.na_agenda)
                        .map((loja) => loja.promotores_periodo_recomendados ?? 1),
                    );
                    const activeStores = cluster.lojas.filter((loja) => loja.na_agenda);
                    const cities = [
                      ...new Set(cluster.lojas.map((loja) => loja.cidade).filter(Boolean)),
                    ];
                    return (
                      <div key={cluster.id} className="rounded-lg border bg-background p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold">{routeLabel(cluster.id)}</h4>
                            <p className="text-xs text-muted-foreground">
                              {cities.join(" · ") || "Cidade não informada"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary">{cluster.lojas.length} lojas</Badge>
                            <Badge variant="outline">{activeStores.length} na sua agenda</Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md bg-muted/40 p-2">
                            <span className="block text-xs text-muted-foreground">
                              Visitas da rota/mês
                            </span>
                            <strong>{activeStores.length ? routeVisits : "—"}</strong>
                          </div>
                          <div className="rounded-md bg-muted/40 p-2">
                            <span className="block text-xs text-muted-foreground">
                              Equipe por período
                            </span>
                            <strong>{activeStores.length ? `Até ${maxTeam}` : "—"}</strong>
                          </div>
                        </div>
                        <div className="mt-3 divide-y rounded-md border">
                          {cluster.lojas.map((loja) => (
                            <div
                              key={loja.loja_id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                            >
                              <span className="font-medium">Loja {loja.loja_id}</span>
                              <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                {loja.cidade || "Cidade não informada"}
                                {loja.na_agenda ? (
                                  <Badge variant="default">
                                    Agenda {loja.carteira_promotor ?? "—"}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Fora da agenda atual</Badge>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!routeGroups.clusters.length ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum cluster foi configurado para a rede.
                  </p>
                ) : null}
              </section>

              <section>
                <div className="mb-3">
                  <h3 className="font-semibold">Lojas com rota individual</h3>
                  <p className="text-sm text-muted-foreground">
                    {routeGroups.individuais.length} lojas da rede não pertencem a clusters e são
                    planejadas separadamente.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3">Loja</th>
                        <th className="p-3">Cidade</th>
                        <th className="p-3">Agenda do promotor</th>
                        <th className="p-3">Visitas/mês</th>
                        <th className="p-3">SKUs</th>
                        <th className="p-3">Equipe/período</th>
                        <th className="p-3">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routeGroups.individuais.map((loja) => (
                        <tr key={loja.loja_id} className="border-t">
                          <td className="p-3 font-medium">Loja {loja.loja_id}</td>
                          <td className="p-3">{loja.cidade || "—"}</td>
                          <td className="p-3">Promotor {loja.carteira_promotor ?? "—"}</td>
                          <td className="p-3">{loja.visitas_recomendadas_mes ?? "—"}</td>
                          <td className="p-3">{loja.skus_ativos ?? "—"}</td>
                          <td className="p-3">
                            {loja.na_agenda ? (loja.promotores_periodo_recomendados ?? 1) : "—"}
                          </td>
                          <td className="p-3">
                            {loja.na_agenda ? (
                              <Badge variant="default">Na agenda atual</Badge>
                            ) : (
                              <Badge variant="outline">Fora da agenda atual</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!routeGroups.individuais.length ? (
                  <p className="rounded-b-lg border border-t-0 p-4 text-sm text-muted-foreground">
                    Todas as lojas cadastradas na rede pertencem a clusters.
                  </p>
                ) : null}
              </section>
            </div>
          </TabsContent>
          <TabsContent value="agendas-promotores">
            <div className="rounded-xl border p-4">
              <div className="mb-4">
                <h3 className="font-semibold">
                  Agendas individuais dos {atendimentoConsultivo ? "consultores" : "promotores"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {atendimentoConsultivo
                    ? "Cada agenda reúne as lojas, sessões e módulos atribuídos ao mesmo consultor."
                    : "Cada agenda reúne as lojas e os clusters atribuídos ao mesmo promotor fixo."}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(fornecedorControle?.carteiras_promotores ?? [])
                  .filter((carteira) => carteira.unidades_rota.length > 0)
                  .map((carteira) => {
                    const maxTeam = Math.max(
                      1,
                      ...carteira.unidades_rota.flatMap((unit) =>
                        unit.lojas.map((loja) => loja.promotores_periodo_recomendados ?? 1),
                      ),
                    );
                    return (
                      <div
                        key={carteira.carteira}
                        className="rounded-lg border bg-background p-4 text-sm"
                      >
                        <div className="font-semibold">
                          Agenda do {atendimentoConsultivo ? "consultor" : "promotor"}{" "}
                          {carteira.carteira}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {money(carteira.venda_media_mensal)} de venda na agenda ·{" "}
                          {carteira.percentual_meta_50_sm.toFixed(1)}% da referência financeira
                        </div>
                        <div className="mt-2 font-medium">
                          Carga total da equipe: {carteira.horas_totais.toFixed(2)} horas
                        </div>
                        <div className="mt-1">
                          {carteira.periodos_base ?? 0} períodos-base ·{" "}
                          {carteira.periodos_trabalho_equipe ?? 0} períodos em equipe · equipe de
                          até {maxTeam}
                        </div>
                        <div className="mt-1">
                          {carteira.visitas_mes} visitas ·{" "}
                          {carteira.unidades_rota.reduce((sum, unit) => sum + unit.lojas.length, 0)}{" "}
                          lojas
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {carteira.unidades_rota.map((unit) => routeLabel(unit.id)).join(" · ")}
                        </div>
                      </div>
                    );
                  })}
              </div>
              {!fornecedorControle?.carteiras_promotores?.some(
                (carteira) => carteira.unidades_rota.length > 0,
              ) ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma agenda individual disponível para este fornecedor.
                </p>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          <CalendarClock className="mr-1 inline size-3" />
          A/B é proxy operacional N1/N2; a curva ABC real depende de vendas por SKU. A presença será
          reconciliada quando houver chave de loja compatível.
        </p>
      </div>
    </PortalLayout>
  );
}
