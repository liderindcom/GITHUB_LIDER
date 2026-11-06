import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Filter,
  GraduationCap,
  MapPinned,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/context/portal-context";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { nomeLoja } from "@/lib/mock-data";
import {
  fetchAgendaPromotoresSegmentada,
  fetchPreferenciaCalculoPromotor,
  criarAgendaCluster,
  salvarAgendaCluster,
  solicitarPreferenciaCalculoPromotor,
  salvarAgendaPromotoresEdicao,
} from "@/api";
import type {
  AgendaCluster,
  PreferenciaCalculoPromotor,
  PeriodicidadeCalculoPromotor,
} from "@/api";
import { toast } from "sonner";
import {
  dailyAllocationKey,
  deriveDailyRouteCandidates,
  parseDailyAllocationKey,
  periodsForPolicyDate,
} from "@/api/agenda-daily-allocation";

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
  tempo_visita_recomendado_min?: number;
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
  routeKey?: string;
  portfolio?: number;
  promoterName?: string | null;
  fullDay?: boolean;
  splitDay?: boolean;
};
type AgendaAssignment = {
  route_key: string;
  sequence: number;
  date: number;
  period_id: string;
  store_ids: string[];
  promotor_id?: string | null;
  promotor_nome?: string | null;
  promotor_ids?: string[];
  promotor_nomes?: string[];
  alocacao_diaria?: boolean;
};
type AgendaEditReport = {
  versao: number;
  assignments: AgendaAssignment[];
  total_visitas: number;
  horas_planejadas: number;
  atualizado_em: string;
};
type CalendarTaskSummary = {
  routeKey: string;
  sequence: number;
  store_ids: string[];
  rows: AgendaRow[];
  fullDay: boolean;
  splitDay?: boolean;
  dailyAllocation?: boolean;
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
  fornecedorControle?: ControlRow | null;
  equipe?: Array<{
    promotor_id?: string;
    nome?: string;
    nome_cracha?: string | null;
    fornecedor_nome_origem?: string;
    validade?: string | null;
    validade_status?: string;
    disponivel_agenda?: boolean;
    status_operacional?: "ATIVO" | "SEM_PRESENCA_MES_ANTERIOR" | "DIVERGENTE" | "FORA_DO_SISTEMA";
    mes_anterior?: string;
    mes_atual?: string;
    corte_mes_atual?: string;
    entradas_mes_anterior?: number;
    entradas_mes_atual?: number;
    ultima_entrada_mes_anterior?: string | null;
    ultima_entrada_mes_atual?: string | null;
  }>;
  simulacaoPorte?: SizingSimulation | null;
  presenca?: PresenceReport | null;
  agendaEdicao?: AgendaEditReport | null;
  design?: {
    geography_policy?: {
      regional_split_day_pairs?: Array<{ id: string; stores: string[]; periodos?: string[] }>;
    };
    scheduling_policy?: {
      work_periods?: Array<{ id: string; rotulo: string; minutos?: number }>;
      exclusive_period_groups?: Array<{ id: string; lojas: string[] }>;
      clusters?: Array<{ id: string; nome?: string; lojas: string[] }>;
      max_regular_tasks_per_period?: number;
      alternate_stores_by_promoter?: boolean;
      avoid_consecutive_route_days?: boolean;
      avoid_different_cities_same_period?: boolean;
      working_weekdays?: number[];
      agenda_weekdays?: number[];
      periods_by_weekday?: Record<string, string[]>;
      period_minutes?: number;
      period_minutes_by_id?: Record<string, number>;
      schedulable_weekly_hours?: number;
      legal_weekly_hours?: number;
      legal_weekly_days_off?: number;
      legal_workweek_rule?: string;
      recurring_holidays?: string[];
      movable_holidays?: string[];
      metropolitan_cities?: string[];
      daily_allocation_policy?: {
        enabled?: boolean;
        one_store_every_operational_day?: boolean;
      };
      distribution_policy?: {
        dia_reposicao_pos_fim_semana?: number;
        dias_pico_vendas?: number[];
        periodo_preferencial_pico?: string;
        janela_inicio_mes_dias?: number;
        peso_dias?: Record<string, number>;
        peso_inicio_mes?: number;
        peso_meio_mes?: number;
      };
    };
  };
};
type SizingSimulation = {
  venda_media_mensal?: number;
  venda_referencia_controle_atual?: number;
  venda_base_modelo?: string | null;
  vendas_periodos_utilizados?: string[];
  modelo_atendimento_atual?: string | null;
  modelo_porte_simulado?: "COBERTURA_BAIXO" | "TRANSICAO_HIBRIDO" | "OPERACIONAL_ALTO" | string;
  faixa_transicao?: boolean;
  lojas_referencia?: number;
  visitas_demanda_atual?: number;
  visitas_planejadas_atual?: number;
  visitas_propostas_simulacao?: number;
  visitas_propostas_por_loja?: number;
  diferenca_vs_planejado?: number;
  promotores_necessarios_calculados?: number | null;
  promotores_necessarios_recomendados?: number | null;
  promotores_observados_adotados?: number | null;
  porte_rede_lojas_grandes?: number | null;
  porte_rede_lojas_medias?: number | null;
  porte_rede_lojas_pequenas?: number | null;
  porte_rede_periodos_adicionais?: number | null;
  visitas_realizadas_validas?: number;
  lojas_com_realizado_valido?: number;
  unidades_medias_por_loja?: number;
  skus_medios_por_loja?: number;
  movimentos_medios_por_loja?: number;
  periodos_presenca_validos?: string[];
  confianca_calibracao?: string;
};
type PresenceStoreSummary = {
  fornecedor_id?: string;
  loja_id?: string;
  loja_codigo?: string | null;
  visitas?: number;
  visitas_validas?: number;
  visitas_suspeitas_duracao?: number;
  promotores_distintos?: number;
  duracao_total_minutos?: number;
  duracao_media_minutos?: number | null;
  duracao_media_bruta_minutos?: number | null;
  ultima_data?: string | null;
};
type PresenceQuality = {
  visitas_exportadas?: number;
  visitas_suspeitas_duracao?: number;
  limite_duracao_operacional_minutos?: number;
  [key: string]: number | undefined;
};
type PresenceReport = {
  status: "DISPONIVEL" | "AGUARDA_EXTRACAO" | "AGUARDA_DE_PARA" | string;
  motivo?: string | null;
  period_reference?: string | null;
  window?: { inicio?: string; fim?: string; dias?: number } | null;
  quality?: PresenceQuality | null;
  fornecedor_id?: string | null;
  by_store?: PresenceStoreSummary[];
  visits?: Array<{
    visita_id?: string;
    data?: string;
    periodo?: string;
    fornecedor_id?: string;
    loja_id?: string;
    loja_codigo?: string | null;
    promotor_id?: string;
    promotor_cadastro_id?: string | null;
    promotor_nome?: string | null;
    duracao_minutos?: number;
    duracao_status?: string;
  }>;
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
  promotores_observados_adotados?: number;
  promotores_necessarios_calculados?: number;
  promotores_necessarios_sem_teto?: number;
  promotores_cadastro_historico?: number;
  promotores_cadastro_ativos?: number;
  promotores_cadastro_vigentes?: number;
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
  promotores_financeiros_base?: number;
  promotores_operacionais_geografia?: number;
  promotores_geografia_capital?: number;
  promotores_geografia_interior?: number;
  unidades_interior_acima_30_sm?: number;
  venda_minima_unidade_interior?: number;
  salarios_minimos_por_unidade_interior?: number;
  salario_minimo_referencia?: number;
  salarios_minimos_por_promotor_politica?: number;
  venda_minima_primeiro_promotor?: number;
  elegivel_dimensionamento_economico?: boolean;
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
    geografia?: "CAPITAL_METROPOLITANA" | "INTERIOR" | "MISTA" | null;
    venda_media_mensal: number;
    percentual_meta_80_sm: number;
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
  presenca_periodo_referencia?: string;
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
const routeMeta = (routeKey?: string | null) => {
  const routeId = String(routeKey ?? "")
    .split("::")
    .slice(1)
    .join("::");
  const isCluster = routeId.startsWith("CLUSTER_");
  const isExclusiveRoute = routeId.startsWith("ROTA_");
  const isDailyAllocation = routeId.startsWith("ALOCACAO_DIARIA_");
  return {
    label: isDailyAllocation ? "Alocação diária" : routeLabel(routeId || "LOJA_—"),
    kind: isDailyAllocation
      ? "Alocação diária"
      : isCluster
        ? "Cluster"
        : isExclusiveRoute
          ? "Rota exclusiva"
          : "Loja",
    isCluster,
    cardClass: isDailyAllocation
      ? "border-emerald-300 bg-emerald-100 text-emerald-950"
      : isCluster
        ? "border-violet-300 bg-violet-100 text-violet-950"
        : isExclusiveRoute
          ? "border-cyan-300 bg-cyan-100 text-cyan-950"
          : "border-slate-200 bg-slate-50 text-slate-900",
    badgeClass: isDailyAllocation
      ? "bg-emerald-200 text-emerald-950"
      : isCluster
        ? "bg-violet-200 text-violet-950"
        : isExclusiveRoute
          ? "bg-cyan-200 text-cyan-950"
          : "bg-slate-200 text-slate-800",
  };
};
const promoterForRoute = (routeKey?: string | null, promoter?: number | null) => {
  const direct = Number(promoter);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const routePortfolio = Number(String(routeKey ?? "").split("::")[0]);
  return Number.isFinite(routePortfolio) && routePortfolio > 0 ? routePortfolio : null;
};
const promoterLabel = (routeKey?: string | null, promoter?: number | null) => {
  const value = promoterForRoute(routeKey, promoter);
  return value ? `Promotor ${value}` : "Promotor não definido";
};
const cidadeAgendaKey = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const geografiaCidadeAgenda = (
  value: unknown,
  metropolitanCities: Set<string>,
): "CAPITAL_METROPOLITANA" | "INTERIOR" | null => {
  const cidade = cidadeAgendaKey(value);
  if (!cidade) return null;
  return metropolitanCities.has(cidade) ? "CAPITAL_METROPOLITANA" : "INTERIOR";
};
const escaparHtml = (value: string | number) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const periodoPresencaAtual = () => new Date().toISOString().slice(0, 7);
const formatarDataPresenca = (value?: string | null) => {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
};
const formatarMesPresenca = (periodo: string) => {
  const [ano, mes] = periodo.split("-");
  return ano && mes ? `${mes}/${ano}` : periodo;
};
const formatarDataHora = (value?: string | null) => {
  if (!value) return "—";
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return formatarDataPresenca(value);
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const formatarDuracaoPresenca = (minutos?: number | null) => {
  const valor = Number(minutos);
  if (!Number.isFinite(valor) || valor <= 0) return "—";
  if (valor < 60) return `${Math.round(valor)} min`;
  const totalMinutos = Math.round(valor);
  const horas = Math.floor(totalMinutos / 60);
  const minutosRestantes = totalMinutos % 60;
  return minutosRestantes ? `${horas}h ${minutosRestantes}min` : `${horas}h`;
};
const tempoVisitaMinutos = (row?: AgendaRow | null) => {
  if (!row) return 0;
  const minutos = Number(row.tempo_visita_recomendado_min ?? row.minutos_servico_visita ?? 0);
  if (Number.isFinite(minutos) && minutos > 0) return Math.round(minutos);
  const horas = Number(row.horas_recomendadas_dia ?? 0);
  return Number.isFinite(horas) && horas > 0 ? Math.round(horas * 60) : 0;
};
const formatarTempoVisita = (row?: AgendaRow | null) =>
  formatarDuracaoPresenca(tempoVisitaMinutos(row));
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
  const [periodoPresenca, setPeriodoPresenca] = useState(periodoPresencaAtual);
  const [filtroSuspeitas, setFiltroSuspeitas] = useState("");
  const [filtro, setFiltro] = useState("");
  const [nivel, setNivel] = useState("TODOS");
  const [ordenacao, setOrdenacao] = useState("nivel");
  const [calendarioPromotorFiltro, setCalendarioPromotorFiltro] = useState("TODOS");
  const [supervisorPromotorFiltro, setSupervisorPromotorFiltro] = useState("TODOS");
  const [editandoAgenda, setEditandoAgenda] = useState(false);
  const [draftAssignments, setDraftAssignments] = useState<AgendaAssignment[]>([]);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [mensagemAgenda, setMensagemAgenda] = useState<string | null>(null);
  const [preferenciaCalculo, setPreferenciaCalculo] = useState<PreferenciaCalculoPromotor | null>(
    null,
  );
  const [periodicidadeSolicitada, setPeriodicidadeSolicitada] =
    useState<PeriodicidadeCalculoPromotor>("DIARIO");
  const [salvandoPeriodicidade, setSalvandoPeriodicidade] = useState(false);
  const [clusterEditor, setClusterEditor] = useState<{
    modo: "novo" | "edicao";
    id?: string;
    nome: string;
    lojas: string[];
  } | null>(null);
  const [salvandoCluster, setSalvandoCluster] = useState(false);
  const [mensagemCluster, setMensagemCluster] = useState<string | null>(null);
  const promotoresDisponiveis = useMemo(
    () =>
      (report?.equipe ?? [])
        .filter((item) => item.disponivel_agenda !== false && item.promotor_id)
        .map((item) => String(item.promotor_id)),
    [report?.equipe],
  );
  useEffect(() => {
    let ativo = true;
    const codigo = normalizarCodigoFornecedor(codigoFornecedorAtivo);
    if (!codigo) return;
    const agenda = fetchAgendaPromotoresSegmentada({
      data: {
        fornecedorCodigo: codigo,
        periodo: usuarioInterno ? periodoPresenca : null,
      },
    })
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
  }, [codigoFornecedorAtivo, periodoPresenca, usuarioInterno]);
  useEffect(() => {
    const codigo = normalizarCodigoFornecedor(codigoFornecedorAtivo);
    if (!codigo) return;
    let ativo = true;
    void fetchPreferenciaCalculoPromotor({ data: codigo })
      .then((data) => {
        if (!ativo) return;
        const preferencia = data as PreferenciaCalculoPromotor;
        setPreferenciaCalculo(preferencia);
        setPeriodicidadeSolicitada(preferencia.periodicidade);
      })
      .catch(() => {
        if (ativo) setPreferenciaCalculo(null);
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo]);
  const salvarPeriodicidade = useCallback(async () => {
    setSalvandoPeriodicidade(true);
    try {
      const data = await solicitarPreferenciaCalculoPromotor({
        data: { periodicidade: periodicidadeSolicitada },
      });
      setPreferenciaCalculo(data as PreferenciaCalculoPromotor);
      toast.success("Solicitação registrada.", {
        description:
          periodicidadeSolicitada === "MENSAL"
            ? "O modo mensal será aplicado após aprovação administrativa e no próximo ciclo de publicação."
            : "O modo diário será aplicado após aprovação administrativa e no próximo ciclo de publicação.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar a solicitação.",
      );
    } finally {
      setSalvandoPeriodicidade(false);
    }
  }, [periodicidadeSolicitada]);
  useEffect(() => {
    if (!supervisorPromotorFiltro.startsWith("NOME:")) return;
    const nome = supervisorPromotorFiltro.slice(5);
    const aindaDisponivel = (report?.equipe ?? []).some(
      (item) => item.nome === nome && item.disponivel_agenda !== false,
    );
    if (!aindaDisponivel) setSupervisorPromotorFiltro("TODOS");
  }, [report?.equipe, supervisorPromotorFiltro]);
  useEffect(() => {
    if (!calendarioPromotorFiltro.startsWith("NOME:")) return;
    const nome = calendarioPromotorFiltro.slice(5);
    const aindaDisponivel = (report?.equipe ?? []).some(
      (item) => item.nome === nome && item.disponivel_agenda !== false,
    );
    if (!aindaDisponivel) setCalendarioPromotorFiltro("TODOS");
  }, [calendarioPromotorFiltro, report?.equipe]);
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
  const agendaRowsFornecedor = useMemo(
    () =>
      (report?.agenda ?? []).filter(
        (row) => !fornecedor || normalizarCodigoFornecedor(row.fornecedor_codigo) === fornecedor,
      ),
    [fornecedor, report],
  );
  const fornecedorControle = controlRows.find(
    (row) => normalizarCodigoFornecedor(row.fornecedor_codigo) === fornecedor,
  );
  const agendaPresencaPorLoja = useMemo(
    () => new Map((report?.agenda ?? []).map((row) => [String(row.loja_id), row])),
    [report],
  );
  const visitasSuspeitas = useMemo(() => {
    const query = filtroSuspeitas.trim().toLowerCase();
    return (report?.presenca?.visits ?? [])
      .filter((visit) => visit.duracao_status === "SUSPEITA_DURACAO")
      .filter((visit) => {
        if (!query) return true;
        return `${visit.promotor_nome ?? ""} ${visit.promotor_cadastro_id ?? ""} ${visit.promotor_id ?? ""} ${visit.loja_codigo ?? ""} ${visit.loja_id ?? ""} ${visit.data ?? ""}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const byDate = String(b.data ?? "").localeCompare(String(a.data ?? ""));
        return byDate || Number(b.duracao_minutos ?? 0) - Number(a.duracao_minutos ?? 0);
      });
  }, [filtroSuspeitas, report]);
  const suspeitasPorPromotor = useMemo(() => {
    const agrupadas = new Map<
      string,
      {
        promotorId: string;
        promotorNome?: string | null;
        visitas: number;
        lojas: Set<string>;
        maiorDuracao?: number;
        ultimaData?: string;
      }
    >();
    for (const visit of report?.presenca?.visits ?? []) {
      if (visit.duracao_status !== "SUSPEITA_DURACAO") continue;
      const promotorId = String(
        visit.promotor_cadastro_id ?? visit.promotor_id ?? "não identificado",
      );
      const atual = agrupadas.get(promotorId) ?? {
        promotorId,
        promotorNome: visit.promotor_nome ?? null,
        visitas: 0,
        lojas: new Set<string>(),
      };
      if (!atual.promotorNome && visit.promotor_nome) atual.promotorNome = visit.promotor_nome;
      atual.visitas += 1;
      atual.lojas.add(String(visit.loja_codigo ?? visit.loja_id ?? "não identificada"));
      atual.maiorDuracao = Math.max(atual.maiorDuracao ?? 0, Number(visit.duracao_minutos ?? 0));
      if (!atual.ultimaData || String(visit.data ?? "") > atual.ultimaData) {
        atual.ultimaData = visit.data;
      }
      agrupadas.set(promotorId, atual);
    }
    return [...agrupadas.values()]
      .map((item) => ({ ...item, lojasQuantidade: item.lojas.size }))
      .sort((a, b) => b.visitas - a.visitas || b.maiorDuracao! - a.maiorDuracao!);
  }, [report]);
  const promotoresSuspeitasVisiveis = useMemo(() => {
    const query = filtroSuspeitas.trim().toLowerCase();
    if (!query) return suspeitasPorPromotor;
    const promotoresEncontrados = new Set(
      (report?.presenca?.visits ?? [])
        .filter((visit) => visit.duracao_status === "SUSPEITA_DURACAO")
        .filter((visit) =>
          `${visit.promotor_nome ?? ""} ${visit.promotor_cadastro_id ?? ""} ${visit.promotor_id ?? ""} ${visit.loja_codigo ?? ""} ${visit.loja_id ?? ""} ${visit.data ?? ""}`
            .toLowerCase()
            .includes(query),
        )
        .map((visit) =>
          String(visit.promotor_cadastro_id ?? visit.promotor_id ?? "não identificado"),
        ),
    );
    return suspeitasPorPromotor.filter((item) => promotoresEncontrados.has(item.promotorId));
  }, [filtroSuspeitas, report, suspeitasPorPromotor]);
  const periodosPresenca = useMemo(() => {
    const atual = periodoPresencaAtual();
    const [ano, mes] = atual.split("-").map(Number);
    return Array.from({ length: 6 }, (_, indice) => {
      const data = new Date(Date.UTC(ano, mes - 1 - indice, 1));
      const periodo = data.toISOString().slice(0, 7);
      return {
        periodo,
        rotulo:
          indice === 0
            ? `Mês atual · ${formatarMesPresenca(periodo)}`
            : `Mês fechado · ${formatarMesPresenca(periodo)}`,
      };
    });
  }, []);
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
        ? agendaRowsFornecedor
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
        : agendaRowsFornecedor,
    [agendaRowsFornecedor, alocacaoPorLoja, fornecedorControle, lojasPrioritarias],
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
          nome: cluster.nome,
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
  const calendarBase = useMemo(() => {
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
    const periodsByWeekday = scheduling?.periods_by_weekday ?? {};
    const periodsForWeekday = (weekday: number) => {
      const ids = periodsByWeekday[String(weekday)];
      const configured = Array.isArray(ids)
        ? workPeriods.filter((period) => ids.includes(period.id))
        : workPeriods;
      return configured.length ? configured : workPeriods;
    };
    const exclusiveGroups = scheduling?.exclusive_period_groups ?? [
      { id: "ROTA_11_28_33", lojas: ["33", "11", "28"] },
      { id: "ROTA_5_12", lojas: ["12", "5"] },
    ];
    const clusters = scheduling?.clusters ?? [];
    const regionalSplitPairs = report?.design?.geography_policy?.regional_split_day_pairs ?? [];
    const regionalSplitPairForRoute = (route: AgendaRow[]) =>
      regionalSplitPairs.find((pair) => {
        const routeStores = new Set(route.map((row) => String(row.loja_id)));
        return (pair.stores || []).every((storeId) => routeStores.has(String(storeId)));
      });
    const maxRegularTasks = Number(scheduling?.max_regular_tasks_per_period || 2);
    const workingWeekdays = new Set(
      scheduling?.agenda_weekdays ?? scheduling?.working_weekdays ?? [1, 2, 3, 4, 5],
    );
    const recurringHolidays = new Set(scheduling?.recurring_holidays ?? []);
    const movableHolidays = new Set(scheduling?.movable_holidays ?? []);
    const distribution = scheduling?.distribution_policy ?? {};
    const dayWeights = distribution.peso_dias ?? {};
    const peakWeekdays = new Set(distribution.dias_pico_vendas ?? [4, 5, 6]);
    const replenishmentWeekday = Number(distribution.dia_reposicao_pos_fim_semana ?? 1);
    const preferredPeakPeriod = distribution.periodo_preferencial_pico ?? "MANHA";
    const earlyMonthDays = Math.max(1, Number(distribution.janela_inicio_mes_dias ?? 10));
    const earlyMonthWeight = Number(distribution.peso_inicio_mes ?? 1.3);
    const middleMonthWeight = Number(distribution.peso_meio_mes ?? 0.85);
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
    const periodMinutes = Math.max(1, Number(scheduling?.period_minutes || 240));
    const periodMinutesForId = (periodId: string) =>
      Math.max(
        1,
        Number(
          scheduling?.period_minutes_by_id?.[periodId] ??
            workPeriods.find((period) => period.id === periodId)?.minutos ??
            periodMinutes,
        ),
      );
    const legalWeeklyHours = Math.max(
      1,
      Number(scheduling?.legal_weekly_hours ?? scheduling?.schedulable_weekly_hours ?? 40),
    );
    const schedulableWeeklyHours = Math.max(
      1,
      Number(scheduling?.schedulable_weekly_hours ?? legalWeeklyHours),
    );
    const weeklyCapacityPeriods = Math.max(
      1,
      Math.floor((schedulableWeeklyHours * 60) / periodMinutes),
    );
    const weekKeyForDay = (day: number) => {
      const date = new Date(year, month - 1, day);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    };
    const weekKeyByDay = new Map(operationalDays.map((day) => [day, weekKeyForDay(day)]));
    const weekKeys = [...new Set(operationalDays.map((day) => weekKeyByDay.get(day)!))];
    const slotState = operationalDays.flatMap((date, operationalIndex) =>
      periodsForWeekday(new Date(year, month - 1, date).getDay()).map((period) => ({
        date,
        operationalIndex,
        periodId: period.id,
        periodLabel: period.rotulo,
        usedPromoters: 0,
        portfolioUsage: new Map<
          number,
          { count: number; exclusive: boolean; cities: Set<string> }
        >(),
        promoterUsage: new Map<string, { routeKeys: Set<string>; geographies: Set<string> }>(),
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
    const metropolitanCities = new Set(
      (scheduling?.metropolitan_cities ?? ["BELEM", "ANANINDEUA", "ICOARACI"]).map(cidadeAgendaKey),
    );
    const portfolioGeography = Object.fromEntries(
      (fornecedorControle?.carteiras_promotores ?? [])
        .filter((carteira) => carteira.geografia)
        .map((carteira) => [String(carteira.carteira), carteira.geografia]),
    );
    const promoterIdForPortfolio = (portfolio: number) =>
      promotoresDisponiveis[portfolio - 1] ?? null;
    const routeRows = new Map<string, AgendaRow[]>();
    for (const row of rowsPlanejadas) {
      const portfolio = Number(row.carteira_promotor || 1);
      const routeId = atendimentoConsultivo
        ? `LOJA_${row.loja_id}`
        : clusterByStore.get(String(row.loja_id)) || row.cluster || `LOJA_${row.loja_id}`;
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
      cityKeysByPeriod?: Record<string, string[]>;
      visitsByPeriod?: Record<string, Array<{ row: AgendaRow; sequence: number }>>;
      visits: Array<{ row: AgendaRow; sequence: number }>;
      splitDay?: boolean;
      geografia?: "CAPITAL_METROPOLITANA" | "INTERIOR" | "MISTA" | null;
      targetOperationalIndex: number;
    };
    const routeTasksByPortfolio = new Map<
      number,
      Array<{ routeKey: string; tasks: CalendarTask[] }>
    >();
    const routeCount = Math.max(1, routeRows.size);
    let routeOrdinal = 0;
    for (const [routeKey, route] of routeRows) {
      const routePosition = routeOrdinal;
      routeOrdinal += 1;
      const portfolio = Number(route[0]?.carteira_promotor || 1);
      const clustered =
        !atendimentoConsultivo &&
        route.some((row) => Boolean(row.cluster || clusterByStore.has(String(row.loja_id))));
      const fullDay = route.some((row) => row.classe_logistica === "REMOTA");
      const routeGeographies = new Set(
        route.map((row) => geografiaCidadeAgenda(row.cidade, metropolitanCities)).filter(Boolean),
      );
      const routeGeography =
        routeGeographies.size > 1
          ? "MISTA"
          : (([...routeGeographies][0] ?? null) as "CAPITAL_METROPOLITANA" | "INTERIOR" | null);
      const portfolioExpectedGeography =
        portfolioGeography[String(portfolio)] === "INTERIOR" ||
        portfolioGeography[String(portfolio)] === "CAPITAL_METROPOLITANA"
          ? portfolioGeography[String(portfolio)]
          : null;
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
        const splitPair = regionalSplitPairForRoute(route);
        const splitDay = Boolean(
          splitPair && visits.length >= 2 && (splitPair.periodos || []).length >= 2,
        );
        const visitsByPeriod = splitDay
          ? workPeriods.reduce<Record<string, Array<{ row: AgendaRow; sequence: number }>>>(
              (acc, period, periodIndex) => {
                acc[period.id] = visits.filter(
                  (_, visitIndex) => visitIndex % workPeriods.length === periodIndex,
                );
                return acc;
              },
              {},
            )
          : undefined;
        const cityKeysByPeriod = splitDay
          ? Object.fromEntries(
              Object.entries(visitsByPeriod || {}).map(([periodId, periodVisits]) => [
                periodId,
                [
                  ...new Set(
                    periodVisits
                      .map(({ row }) =>
                        String(row.cidade || "")
                          .trim()
                          .toUpperCase(),
                      )
                      .filter(Boolean),
                  ),
                ],
              ]),
            )
          : undefined;
        const teamSize = Math.max(
          1,
          ...visits.map(({ row }) => Number(row.promotores_periodo_recomendados || 1)),
        );
        const targetOperationalIndex =
          maxVisits > 1
            ? Math.round(
                ((sequence * routeCount + routePosition) * (operationalDays.length - 1)) /
                  Math.max(1, maxVisits * routeCount - 1),
              )
            : routeCount > 1
              ? Math.round((routePosition * (operationalDays.length - 1)) / (routeCount - 1))
              : Math.floor(operationalDays.length / 2);
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
          cityKeysByPeriod,
          visitsByPeriod,
          visits,
          splitDay,
          geografia:
            routeGeography &&
            portfolioExpectedGeography &&
            routeGeography !== portfolioExpectedGeography
              ? "MISTA"
              : (routeGeography ?? portfolioExpectedGeography),
          targetOperationalIndex: Math.max(
            0,
            Math.min(operationalDays.length - 1, targetOperationalIndex),
          ),
        });
      }
      const queues = routeTasksByPortfolio.get(portfolio) || [];
      queues.push({ routeKey, tasks: routeTasks });
      routeTasksByPortfolio.set(portfolio, queues);
    }
    const taskPriorityRow = (task: CalendarTask) =>
      [...task.visits]
        .map(({ row }) => row)
        .sort(
          (a, b) =>
            (({ N1_CRITICO: 0, N2_ALTO: 1, N3_MEDIO: 2, N4_BASICO: 3 })[a.nivel] ?? 9) -
              ({ N1_CRITICO: 0, N2_ALTO: 1, N3_MEDIO: 2, N4_BASICO: 3 }[b.nivel] ?? 9) ||
            Number(b.unidades_periodo || 0) - Number(a.unidades_periodo || 0),
        )[0];
    const slotScore = (slot: (typeof slotState)[number], task: CalendarTask) => {
      const weekday = new Date(year, month - 1, slot.date).getDay();
      const phaseWeight =
        slot.date <= earlyMonthDays
          ? earlyMonthWeight
          : slot.date <= Math.min(daysInMonth, earlyMonthDays * 2)
            ? middleMonthWeight
            : 1;
      const baseDayWeight = Number(dayWeights[String(weekday)] ?? 1);
      const priorityRow = taskPriorityRow(task);
      const priorityLevel = priorityRow?.nivel;
      const peakMorningBonus =
        peakWeekdays.has(weekday) &&
        slot.periodId === preferredPeakPeriod &&
        (priorityLevel === "N1_CRITICO" || priorityLevel === "N2_ALTO")
          ? 1.35
          : 1;
      const replenishmentBonus = weekday === replenishmentWeekday ? 1.12 : 1;
      const pattern = [replenishmentWeekday, 4, 5, 6];
      const sequence = Number(task.visits[0]?.sequence || 1);
      const patternBonus = pattern[(sequence - 1) % pattern.length] === weekday ? 1.18 : 1;
      return baseDayWeight * phaseWeight * peakMorningBonus * replenishmentBonus * patternBonus;
    };
    const dayLoad = (date: number) => (events.get(date) ?? []).length;
    const dayHasWork = (date: number) => dayLoad(date) > 0;
    const periodLoad = (slot: (typeof slotState)[number]) => slot.usedPromoters;
    const weekLoad = (date: number) =>
      weekKeyByDay.get(date) ? weeklyTotalLoad.get(weekKeyByDay.get(date)!) || 0 : 0;
    const targetDistance = (index: number, task: CalendarTask) =>
      Math.abs(slotState[index].operationalIndex - task.targetOperationalIndex);
    const orderCandidates = (candidates: number[], task: CalendarTask) =>
      [...candidates].sort(
        (a, b) =>
          Number(dayHasWork(slotState[a].date)) - Number(dayHasWork(slotState[b].date)) ||
          periodLoad(slotState[a]) - periodLoad(slotState[b]) ||
          dayLoad(slotState[a].date) - dayLoad(slotState[b].date) ||
          weekLoad(slotState[a].date) - weekLoad(slotState[b].date) ||
          targetDistance(a, task) - targetDistance(b, task) ||
          slotScore(slotState[b], task) - slotScore(slotState[a], task) ||
          Math.abs(slotState[a].operationalIndex - cursor) -
            Math.abs(slotState[b].operationalIndex - cursor) ||
          a - b,
      );
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
      promotoresDisponiveis.length,
    );
    const sharedReinforcement =
      Number(fornecedorControle?.periodos_reforco_compartilhado_mes || 0) > 0
        ? Math.max(0, Number(fornecedorControle?.reforco_simultaneo_maximo_promotores || 0))
        : 0;
    const teamCapacity = fixedPromoters + sharedReinforcement;
    const weeklyTeamCapacityPeriods = teamCapacity * weeklyCapacityPeriods;
    const routeDates = new Set<string>();
    const lastRouteOperationalDay = new Map<string, number>();
    const lastPortfolioOperationalDay = new Map<number, number>();
    const weeklyTotalLoad = new Map<string, number>();
    const weeklyPortfolioLoad = new Map<string, number>();
    const avoidConsecutiveRouteDays = scheduling?.avoid_consecutive_route_days ?? true;
    const avoidDifferentCitiesSamePeriod = scheduling?.avoid_different_cities_same_period ?? true;
    let rotatedTasks = 0;
    let consecutiveFallbacks = 0;
    let sameDayFallbacks = 0;
    const taskVisitsForPeriod = (task: (typeof tasks)[number], periodId: string) =>
      task.splitDay ? task.visitsByPeriod?.[periodId] || [] : task.visits;
    const taskTeamSizeForPeriod = (task: (typeof tasks)[number], periodId: string) =>
      Math.max(
        1,
        ...taskVisitsForPeriod(task, periodId).map(({ row }) =>
          Number(row.promotores_periodo_recomendados || 1),
        ),
      );
    const taskCitiesForPeriod = (task: (typeof tasks)[number], periodId: string) =>
      task.splitDay ? task.cityKeysByPeriod?.[periodId] || [] : task.cityKeys;
    const canReserve = (
      slot: (typeof slotState)[number],
      task: (typeof tasks)[number],
      ignoreWeeklyCapacity = false,
    ) => {
      const usage = slot.portfolioUsage.get(task.portfolio);
      const promoterId = promoterIdForPortfolio(task.portfolio);
      const promoterUsage = promoterId ? slot.promoterUsage.get(promoterId) : undefined;
      if (task.geografia === "MISTA") return false;
      if (promoterUsage) {
        if (
          [...promoterUsage.routeKeys].some((routeKey) => routeKey !== task.routeKey) ||
          (task.geografia &&
            [...promoterUsage.geographies].some((geografia) => geografia !== task.geografia))
        )
          return false;
      }
      if (task.exclusive && usage) return false;
      if (!task.exclusive && usage?.exclusive) return false;
      if (!task.exclusive && (usage?.count || 0) >= maxRegularTasks) return false;
      if (!task.exclusive && usage && avoidDifferentCitiesSamePeriod) {
        const sameCityOnly =
          taskCitiesForPeriod(task, slot.periodId).length > 0 &&
          usage.cities.size > 0 &&
          taskCitiesForPeriod(task, slot.periodId).every((city) => usage.cities.has(city));
        if (!sameCityOnly) return false;
      }
      const teamSize = taskTeamSizeForPeriod(task, slot.periodId);
      const periodUnits = periodMinutesForId(slot.periodId) / periodMinutes;
      const increment = usage ? Math.max(0, teamSize - 1) : teamSize;
      const weekKey = weekKeyByDay.get(slot.date);
      const portfolioWeekKey = `${task.portfolio}::${weekKey}`;
      if (
        !ignoreWeeklyCapacity &&
        weekKey &&
        (weeklyPortfolioLoad.get(portfolioWeekKey) || 0) + teamSize * periodUnits >
          weeklyCapacityPeriods
      ) {
        return false;
      }
      return slot.usedPromoters + increment <= teamCapacity;
    };
    const canReserveIndexes = (indexes: number[], task: (typeof tasks)[number]) => {
      const weeklyIncrements = new Map<string, number>();
      for (const index of indexes) {
        const slot = slotState[index];
        if (!canReserve(slot, task, true)) return false;
        const weekKey = weekKeyByDay.get(slot.date);
        if (!weekKey) return false;
        const portfolioWeekKey = `${task.portfolio}::${weekKey}`;
        const increment =
          taskTeamSizeForPeriod(task, slot.periodId) *
          (periodMinutesForId(slot.periodId) / periodMinutes);
        weeklyIncrements.set(
          portfolioWeekKey,
          (weeklyIncrements.get(portfolioWeekKey) || 0) + increment,
        );
      }
      return [...weeklyIncrements.entries()].every(
        ([key, increment]) =>
          (weeklyPortfolioLoad.get(key) || 0) + increment <= weeklyCapacityPeriods,
      );
    };
    const reserve = (slot: (typeof slotState)[number], task: (typeof tasks)[number]) => {
      const usage = slot.portfolioUsage.get(task.portfolio);
      const teamSize = taskTeamSizeForPeriod(task, slot.periodId);
      const periodVisits = taskVisitsForPeriod(task, slot.periodId);
      const periodCities = taskCitiesForPeriod(task, slot.periodId);
      const increment = usage ? Math.max(0, teamSize - 1) : teamSize;
      const periodUnits = periodMinutesForId(slot.periodId) / periodMinutes;
      const weekKey = weekKeyByDay.get(slot.date);
      if (weekKey) {
        const portfolioWeekKey = `${task.portfolio}::${weekKey}`;
        weeklyPortfolioLoad.set(
          portfolioWeekKey,
          (weeklyPortfolioLoad.get(portfolioWeekKey) || 0) + teamSize * periodUnits,
        );
        weeklyTotalLoad.set(weekKey, (weeklyTotalLoad.get(weekKey) || 0) + teamSize * periodUnits);
      }
      slot.usedPromoters += increment;
      slot.portfolioUsage.set(task.portfolio, {
        count: (usage?.count || 0) + 1,
        exclusive: Boolean(usage?.exclusive || task.exclusive),
        cities: new Set([...(usage?.cities || []), ...periodCities]),
      });
      const promoterId = promoterIdForPortfolio(task.portfolio);
      if (promoterId) {
        const promoterUsage = slot.promoterUsage.get(promoterId) ?? {
          routeKeys: new Set<string>(),
          geographies: new Set<string>(),
        };
        promoterUsage.routeKeys.add(task.routeKey);
        if (task.geografia) promoterUsage.geographies.add(task.geografia);
        slot.promoterUsage.set(promoterId, promoterUsage);
      }
      for (const visit of periodVisits) {
        const list = events.get(slot.date) || [];
        list.push({
          date: slot.date,
          periodId: slot.periodId,
          periodLabel: slot.periodLabel,
          row: visit.row,
          sequence: visit.sequence,
          routeKey: task.routeKey,
          portfolio: task.portfolio,
          fullDay: task.fullDay,
          splitDay: task.splitDay,
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
              indexes.length ===
                periodsForWeekday(new Date(year, month - 1, day).getDay()).length &&
              canReserveIndexes(indexes, task),
          );
        const lastPortfolioDay = lastPortfolioOperationalDay.get(task.portfolio);
        const differentDayCandidates = dayCandidates.filter(
          ({ indexes }) =>
            lastPortfolioDay === undefined ||
            slotState[indexes[0]].operationalIndex !== lastPortfolioDay,
        );
        const dayPool = differentDayCandidates.length ? differentDayCandidates : dayCandidates;
        const uncoveredDays = dayPool.filter(({ day }) => !dayHasWork(day));
        const preferredDays = dayPool.filter(({ indexes }) =>
          isPreferredGap(slotState[indexes[0]]),
        );
        const scoredDays = (
          uncoveredDays.length ? uncoveredDays : preferredDays.length ? preferredDays : dayPool
        ).sort(
          (a, b) =>
            Number(dayHasWork(a.day)) - Number(dayHasWork(b.day)) ||
            weekLoad(a.day) - weekLoad(b.day) ||
            targetDistance(a.indexes[0], task) - targetDistance(b.indexes[0], task) ||
            dayLoad(a.day) - dayLoad(b.day) ||
            slotScore(slotState[b.indexes[0]], task) - slotScore(slotState[a.indexes[0]], task) ||
            a.day - b.day,
        );
        const selectedDay = scoredDays[0];
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
        const uncovered = candidatePool.filter(
          (index) => !dayHasWork(slotState[index].date) || periodLoad(slotState[index]) === 0,
        );
        const preferred = candidatePool.filter((index) => isPreferredGap(slotState[index]));
        const scored = orderCandidates(
          uncovered.length ? uncovered : preferred.length ? preferred : candidatePool,
          task,
        );
        if (scored.length) chosenIndexes = [scored[0]];
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
    const dailyAllocationEnabled =
      scheduling?.daily_allocation_policy?.enabled !== false &&
      scheduling?.daily_allocation_policy?.one_store_every_operational_day !== false;
    const dailyTaskCatalog: CalendarTaskSummary[] = [];
    const dailyRoutes: Map<number, { portfolio: number; routeKey: string; storeIds: string[] }> =
      dailyAllocationEnabled
        ? deriveDailyRouteCandidates(
            rowsPlanejadas as unknown as Array<Record<string, unknown>>,
            (fornecedorControle?.lojas_prioritarias ?? []) as unknown as Array<
              Record<string, unknown>
            >,
            (scheduling ?? {}) as unknown as Record<string, unknown>,
            fixedPromoters,
            portfolioGeography,
          )
        : new Map<number, { portfolio: number; routeKey: string; storeIds: string[] }>();
    const portfolioDates = new Set<string>();
    for (const baseEvents of events.values()) {
      for (const event of baseEvents) {
        const portfolio = Number(
          event.portfolio ?? String(event.routeKey ?? "1::").split("::", 1)[0] ?? 1,
        );
        portfolioDates.add(`${portfolio}::${event.date}`);
      }
    }
    if (dailyAllocationEnabled) {
      for (const [portfolio, candidate] of dailyRoutes.entries()) {
        const sourceRows = candidate.storeIds
          .map((storeId) => rowsPlanejadas.find((row) => String(row.loja_id) === storeId))
          .filter((row): row is AgendaRow => Boolean(row));
        if (!sourceRows.length) continue;
        const dailyRows = sourceRows.map((row) => ({
          ...row,
          tipo_atividade: "ALOCACAO_DIARIA_OPERACIONAL",
          objetivo_atendimento:
            "Alocação diária obrigatória: execução, estoque, exposição e disponibilidade na loja.",
          motivo: "Alocação diária operacional",
        }));
        for (const day of operationalDays) {
          if (portfolioDates.has(`${portfolio}::${day}`)) continue;
          const period = periodsForPolicyDate(
            reference,
            day,
            (scheduling ?? {}) as unknown as Record<string, unknown>,
          )[0];
          if (!period) continue;
          const routeKey = dailyAllocationKey(portfolio, day);
          for (const row of dailyRows) {
            const list = events.get(day) ?? [];
            list.push({
              date: day,
              periodId: period.id,
              periodLabel: period.rotulo,
              row,
              sequence: 1,
              routeKey,
              portfolio,
              fullDay: false,
              splitDay: false,
            });
            events.set(day, list);
          }
          dailyTaskCatalog.push({
            routeKey,
            sequence: 1,
            store_ids: candidate.storeIds,
            rows: dailyRows,
            fullDay: false,
            splitDay: false,
            dailyAllocation: true,
          });
          portfolioDates.add(`${portfolio}::${day}`);
        }
      }
    }
    const weeklyLoadSummary = weekKeys.map((weekKey) => {
      const usedPeriods = weeklyTotalLoad.get(weekKey) || 0;
      return {
        weekKey,
        usedPeriods,
        capacityPeriods: weeklyTeamCapacityPeriods,
        usedHours: Number(((usedPeriods * periodMinutes) / 60).toFixed(2)),
        capacityHours: Number((teamCapacity * legalWeeklyHours).toFixed(2)),
        utilizationPercent: Number(
          ((usedPeriods / Math.max(1, weeklyTeamCapacityPeriods)) * 100).toFixed(1),
        ),
      };
    });
    const promoterWeeklyLoads = Array.from({ length: teamCapacity }, (_, index) => ({
      promoter: index + 1,
      weeks: weekKeys.map((weekKey) => {
        const usedPeriods = weeklyPortfolioLoad.get(`${index + 1}::${weekKey}`) || 0;
        return {
          weekKey,
          usedPeriods,
          usedHours: Number(((usedPeriods * periodMinutes) / 60).toFixed(2)),
          capacityPeriods: weeklyCapacityPeriods,
          capacityHours: legalWeeklyHours,
        };
      }),
    }));
    return {
      label: `${String(month).padStart(2, "0")}/${year}`,
      daysInMonth,
      firstDayOffset,
      events,
      taskCatalog: [
        ...tasks.map((task) => ({
          routeKey: task.routeKey,
          sequence: Number(task.visits[0]?.sequence || 1),
          store_ids: task.visits
            .map(({ row }) => String(row.loja_id))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          rows: task.visits.map(({ row }) => row),
          fullDay: task.fullDay,
          splitDay: task.splitDay,
          dailyAllocation: false,
        })),
        ...dailyTaskCatalog,
      ],
      workPeriods,
      operationalDays: operationalDays.length,
      operationalDayNumbers: new Set(operationalDays),
      agendaWeekdays: [...workingWeekdays],
      distributionPolicy: distribution,
      unscheduledTasks,
      teamCapacity,
      legalWeeklyHours,
      weeklyCapacityPeriods,
      weeklyLoadSummary,
      promoterWeeklyLoads,
      rotationEnabled: Boolean(alternateStores && avoidConsecutiveRouteDays),
      cityConflictEnabled: avoidDifferentCitiesSamePeriod,
      rotatedTasks,
      consecutiveFallbacks,
      sameDayFallbacks,
      dailyAllocationEnabled,
      dailyAllocationTasks: dailyTaskCatalog.length,
    };
  }, [
    atendimentoConsultivo,
    fornecedorControle,
    promotoresDisponiveis.length,
    report,
    rowsPlanejadas,
  ]);
  const nomearAssignments = useCallback(
    (assignments: AgendaAssignment[]) => {
      const equipe = new Map(
        (report?.equipe ?? []).map((item) => [String(item.promotor_id ?? ""), item]),
      );
      const taskByKey = new Map(
        calendarBase.taskCatalog.map((task) => [`${task.routeKey}::${task.sequence}`, task]),
      );
      const metropolitanCities = new Set(
        (report?.design?.scheduling_policy?.metropolitan_cities ?? [
          "BELEM",
          "ANANINDEUA",
          "ICOARACI",
        ]).map(cidadeAgendaKey),
      );
      const periodMinutes = new Map(
        calendarBase.workPeriods.map((period) => [
          period.id,
          Math.max(1, Number(period.minutos ?? report?.design?.scheduling_policy?.period_minutes ?? 240)),
        ]),
      );
      const periodIds = (assignment: AgendaAssignment, task?: CalendarTaskSummary) =>
        task?.fullDay
          ? calendarBase.workPeriods.map((period) => period.id)
          : [assignment.period_id];
      const weekKeyForDay = (day: number) => {
        const [year, month] = String(report?.period_reference ?? "").split("-").map(Number);
        if (!year || !month) return String(day);
        const date = new Date(year, month - 1, day);
        const monday = new Date(date);
        monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      };
      type UsoPromotor = {
        geographies: Set<string>;
        ocupacoes: Array<{
          date: number;
          periods: Set<string>;
          routeKey: string;
        }>;
        weeklyMinutes: Map<string, number>;
      };
      const usoPorPromotor = new Map<string, UsoPromotor>();
      const periodsOverlap = (left: Set<string>, right: Set<string>) =>
        [...left].some((period) => right.has(period));
      const detailsFor = (assignment: AgendaAssignment) => {
        const task = taskByKey.get(`${assignment.route_key}::${assignment.sequence}`);
        const rows = (task?.rows ?? []).filter((row) =>
          assignment.store_ids.includes(String(row.loja_id)),
        );
        const geographies = new Set(
          rows
            .map((row) => geografiaCidadeAgenda(row.cidade, metropolitanCities))
            .filter((value): value is string => Boolean(value)),
        );
        const periods = new Set(periodIds(assignment, task));
        const durationMinutes = rows.reduce((sum, row) => sum + tempoVisitaMinutos(row), 0);
        const periodCapacity = [...periods].reduce(
          (sum, period) => sum + (periodMinutes.get(period) ?? 240),
          0,
        );
        return {
          task,
          geography: geographies.size === 1 ? [...geographies][0] : geographies.size ? "MISTA" : null,
          periods,
          durationMinutes,
          periodCapacity,
        };
      };
      const resultado = assignments.map((assignment) => ({
        ...assignment,
        store_ids: [...assignment.store_ids],
        promotor_ids: assignment.promotor_ids?.length
          ? [...assignment.promotor_ids]
          : assignment.promotor_id
            ? [assignment.promotor_id]
            : [],
        promotor_nomes: assignment.promotor_nomes?.length
          ? [...assignment.promotor_nomes]
          : assignment.promotor_nome
            ? [assignment.promotor_nome]
            : [],
      }));
      const sorted = [...resultado].sort(
        (a, b) =>
          a.date - b.date ||
          a.period_id.localeCompare(b.period_id) ||
          a.route_key.localeCompare(b.route_key) ||
          a.sequence - b.sequence,
      );
      for (const assignment of sorted) {
        const details = detailsFor(assignment);
        const daily = parseDailyAllocationKey(assignment.route_key);
        const portfolio = daily?.portfolio ?? Number(String(assignment.route_key).split("::", 1)[0] || 0);
        const preferredId = portfolio > 0 ? promotoresDisponiveis[portfolio - 1] : null;
        const requestedIds = [
          ...(assignment.promotor_ids ?? []),
          ...(assignment.promotor_id ? [assignment.promotor_id] : []),
        ].map(String);
        // Sem o promotor da carteira, o bloco fica pendente. Nunca reutilizamos
        // Andreia (ou qualquer outro nome) como um rodízio artificial entre
        // capital, interior, clusters e períodos incompatíveis.
        const candidateIds = [
          ...(preferredId ? [preferredId] : []),
          ...requestedIds,
          ...(portfolio > 0 ? [] : promotoresDisponiveis),
        ].filter((id, index, all) => id && all.indexOf(id) === index);
        const targetCount = Math.max(
          1,
          ...(details.task?.rows ?? []).map((row) => Number(row.promotores_periodo_recomendados || 1)),
        );
        const workloadPerPromoter = details.durationMinutes / targetCount;
        if (
          !candidateIds.length ||
          details.geography === "MISTA" ||
          (details.durationMinutes > 0 && details.durationMinutes > details.periodCapacity * targetCount)
        ) {
          assignment.promotor_id = null;
          assignment.promotor_nome = null;
          continue;
        }
        const selected: string[] = [];
        for (const id of candidateIds) {
          if (selected.length >= targetCount) break;
          if (portfolio > 0 && !preferredId) continue;
          if (portfolio > 0 && preferredId !== id) continue;
          const uso = usoPorPromotor.get(id) ?? {
            geographies: new Set<string>(),
            ocupacoes: [],
            weeklyMinutes: new Map<string, number>(),
          };
          if (
            details.geography &&
            [...uso.geographies].some((geography) => geography !== details.geography)
          )
            continue;
          if (
            uso.ocupacoes.some(
              (ocupacao) =>
                ocupacao.date === assignment.date &&
                periodsOverlap(ocupacao.periods, details.periods),
            )
          )
            continue;
          const weekKey = weekKeyForDay(assignment.date);
          const weeklyMinutes =
            (uso.weeklyMinutes.get(weekKey) ?? 0) + workloadPerPromoter;
          if (weeklyMinutes > calendarBase.legalWeeklyHours * 60) continue;
          selected.push(id);
          usoPorPromotor.set(id, uso);
        }
        if (!selected.length) {
          assignment.promotor_id = null;
          assignment.promotor_nome = null;
          continue;
        }
        const weekKey = weekKeyForDay(assignment.date);
        for (const id of selected) {
          const uso = usoPorPromotor.get(id)!;
          if (details.geography) uso.geographies.add(details.geography);
          uso.ocupacoes.push({ date: assignment.date, periods: details.periods, routeKey: assignment.route_key });
          uso.weeklyMinutes.set(
            weekKey,
            (uso.weeklyMinutes.get(weekKey) ?? 0) + workloadPerPromoter,
          );
        }
        const nomes = selected
          .map((id) => equipe.get(id)?.nome)
          .filter((nome): nome is string => Boolean(nome));
        assignment.promotor_ids = selected;
        assignment.promotor_id = selected[0] ?? null;
        assignment.promotor_nomes = nomes;
        assignment.promotor_nome = nomes[0] ?? null;
      }
      return resultado;
    },
    [calendarBase, promotoresDisponiveis, report?.design?.scheduling_policy, report?.equipe, report?.period_reference],
  );
  const baseAssignments = useMemo(() => {
    const grouped = new Map<string, AgendaAssignment>();
    for (const events of calendarBase.events.values()) {
      for (const event of events) {
        const routeKey = event.routeKey ?? `1::LOJA_${event.row.loja_id}`;
        if (parseDailyAllocationKey(routeKey)) continue;
        const key = `${routeKey}::${event.sequence}`;
        const current = grouped.get(key) ?? {
          route_key: routeKey,
          sequence: event.sequence,
          date: event.date,
          period_id: event.periodId,
          store_ids: [],
        };
        if (!grouped.has(key)) {
          current.date = event.date;
          current.period_id = event.periodId;
        }
        if (!current.store_ids.includes(String(event.row.loja_id))) {
          current.store_ids.push(String(event.row.loja_id));
          current.store_ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }
        grouped.set(key, current);
      }
    }
    const sorted = [...grouped.values()].sort(
      (a, b) =>
        a.date - b.date ||
        a.period_id.localeCompare(b.period_id) ||
        a.route_key.localeCompare(b.route_key),
    );
    return sorted;
  }, [calendarBase]);
  const persistedAssignments = report?.agendaEdicao?.assignments ?? [];
  const rawCoreAssignments = useMemo(() => {
    const persistedCore = persistedAssignments.filter(
      (assignment) => !parseDailyAllocationKey(assignment.route_key),
    );
    return persistedCore.length ? persistedCore : baseAssignments;
  }, [baseAssignments, persistedAssignments]);
  const rawDailyAssignments = useMemo(() => {
    const persistedDaily = persistedAssignments.filter((assignment) =>
      Boolean(parseDailyAllocationKey(assignment.route_key)),
    );
    if (persistedDaily.length) return persistedDaily;
    return calendarBase.taskCatalog
      .filter((task) => task.dailyAllocation)
      .map((task) => {
        const parsed = parseDailyAllocationKey(task.routeKey);
        return {
          route_key: task.routeKey,
          sequence: task.sequence,
          date: parsed?.day ?? 1,
          period_id:
            periodsForPolicyDate(
              report?.period_reference ?? "",
              parsed?.day ?? 1,
              (report?.design?.scheduling_policy ?? {}) as unknown as Record<string, unknown>,
            )[0]?.id ??
            calendarBase.workPeriods[0]?.id ??
            "DIA",
          store_ids: [...task.store_ids],
          alocacao_diaria: true,
        } satisfies AgendaAssignment;
      });
  }, [
    calendarBase,
    persistedAssignments,
    report?.design,
    report?.period_reference,
  ]);
  // Os blocos principais e as alocações diárias compartilham a mesma reserva
  // nominal. Assim, uma única Andreia não aparece simultaneamente em dois
  // horários apenas porque os blocos vieram de catálogos diferentes.
  const namedAssignments = useMemo(
    () => nomearAssignments([...rawCoreAssignments, ...rawDailyAssignments]),
    [nomearAssignments, rawCoreAssignments, rawDailyAssignments],
  );
  const coreAssignments = useMemo(
    () => namedAssignments.filter((assignment) => !parseDailyAllocationKey(assignment.route_key)),
    [namedAssignments],
  );
  const generatedDailyAssignments = useMemo(
    () => namedAssignments.filter((assignment) => Boolean(parseDailyAllocationKey(assignment.route_key))),
    [namedAssignments],
  );
  const editableAssignments = useMemo(() => {
    const assignedKeys = new Set(
      [...coreAssignments, ...generatedDailyAssignments].map(
        (assignment) => `${assignment.route_key}::${assignment.sequence}`,
      ),
    );
    const firstDay = [...calendarBase.operationalDayNumbers][0] ?? 1;
    const firstPeriod = calendarBase.workPeriods[0]?.id ?? "MANHA";
    const pending = calendarBase.taskCatalog
      .filter((task) => !assignedKeys.has(`${task.routeKey}::${task.sequence}`))
      .map((task) => ({
        route_key: task.routeKey,
        sequence: task.sequence,
        date: firstDay,
        period_id: firstPeriod,
        store_ids: [...task.store_ids],
      }));
    return [...coreAssignments, ...generatedDailyAssignments, ...pending];
  }, [coreAssignments, generatedDailyAssignments, calendarBase]);
  const activeAssignments = editandoAgenda
    ? draftAssignments
    : [...coreAssignments, ...generatedDailyAssignments];
  const agendaBlocosSemPromotor = useMemo(
    () =>
      activeAssignments.filter(
        (assignment) =>
          !(assignment.promotor_ids?.length || assignment.promotor_id),
      ).length,
    [activeAssignments],
  );
  const agendaNominalResumo = useMemo(() => {
    const equipe = new Map(
      (report?.equipe ?? []).map((item) => [String(item.promotor_id ?? ""), item]),
    );
    const porPromotor = new Map<string, { blocos: number; lojas: Set<string> }>();
    for (const assignment of activeAssignments) {
      const ids = assignment.promotor_ids?.length
        ? assignment.promotor_ids
        : assignment.promotor_id
          ? [assignment.promotor_id]
          : [];
      for (const id of ids) {
        const normalizedId = String(id).trim();
        if (!normalizedId) continue;
        const atual = porPromotor.get(normalizedId) ?? { blocos: 0, lojas: new Set<string>() };
        atual.blocos += 1;
        for (const loja of assignment.store_ids) atual.lojas.add(String(loja));
        porPromotor.set(normalizedId, atual);
      }
    }
    return [...porPromotor.entries()]
      .map(([id, dados]) => ({
        id,
        nome: String(equipe.get(id)?.nome ?? id),
        nomeCracha: String(equipe.get(id)?.nome_cracha ?? "").trim(),
        blocos: dados.blocos,
        lojas: dados.lojas.size,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [activeAssignments, report?.equipe]);
  const calendar = useMemo(() => {
    if (!activeAssignments.length) return calendarBase;
    const taskByKey = new Map(
      calendarBase.taskCatalog.map((task) => [`${task.routeKey}::${task.sequence}`, task]),
    );
    const baseEventsByKey = new Map<string, VisitEvent[]>();
    for (const baseEvents of calendarBase.events.values()) {
      for (const event of baseEvents) {
        const key = `${event.routeKey ?? `1::LOJA_${event.row.loja_id}`}::${event.sequence}`;
        const list = baseEventsByKey.get(key) ?? [];
        list.push(event);
        baseEventsByKey.set(key, list);
      }
    }
    const events = new Map<number, VisitEvent[]>();
    for (const assignment of activeAssignments) {
      const key = `${assignment.route_key}::${assignment.sequence}`;
      const scheduledEvents = baseEventsByKey.get(key) ?? [];
      const task = taskByKey.get(key);
      const sourceEvents = scheduledEvents.length
        ? scheduledEvents
        : (task?.rows ?? []).flatMap((row) => {
            const periods = task?.fullDay
              ? calendarBase.workPeriods
              : calendarBase.workPeriods.filter((period) => period.id === assignment.period_id);
            return periods.map((period) => ({
              date: assignment.date,
              periodId: period.id,
              periodLabel: period.rotulo,
              row,
              sequence: assignment.sequence,
              routeKey: assignment.route_key,
              portfolio: promoterForRoute(assignment.route_key, row.carteira_promotor) ?? 0,
              promoterName: assignment.promotor_nome,
              fullDay: Boolean(task?.fullDay),
              splitDay: task?.splitDay,
            }));
          });
      for (const event of sourceEvents) {
        const nomes = assignment.promotor_nomes?.length
          ? assignment.promotor_nomes
          : assignment.promotor_nome
            ? [assignment.promotor_nome]
            : [null];
        for (const promoterName of nomes) {
          const moved = {
            ...event,
            date: assignment.date,
            periodId: event.fullDay ? event.periodId : assignment.period_id,
            periodLabel: event.fullDay
              ? event.periodLabel
              : (calendarBase.workPeriods.find((period) => period.id === assignment.period_id)
                  ?.rotulo ?? assignment.period_id),
            promoterName,
          };
          const list = events.get(moved.date) ?? [];
          list.push(moved);
          events.set(moved.date, list);
        }
      }
    }
    return { ...calendarBase, events };
  }, [activeAssignments, calendarBase]);
  const supervisaoEvents = useMemo(() => {
    const todos = [...calendar.events.values()].flatMap((items) => items);
    if (supervisorPromotorFiltro === "TODOS") return todos;
    if (supervisorPromotorFiltro.startsWith("NOME:")) {
      const nome = supervisorPromotorFiltro.slice(5);
      return todos.filter((event) => event.promoterName === nome);
    }
    const portfolio = Number(supervisorPromotorFiltro.slice(9));
    return todos.filter(
      (event) => Number(event.portfolio ?? event.row.carteira_promotor) === portfolio,
    );
  }, [calendar.events, supervisorPromotorFiltro]);
  const calendarioEvents = useMemo(() => {
    if (calendarioPromotorFiltro === "TODOS") return calendar.events;
    const nome = calendarioPromotorFiltro.startsWith("NOME:")
      ? calendarioPromotorFiltro.slice(5)
      : "";
    const filtered = new Map<number, VisitEvent[]>();
    for (const [day, events] of calendar.events.entries()) {
      const dayEvents = events.filter((event) => event.promoterName === nome);
      if (dayEvents.length) filtered.set(day, dayEvents);
    }
    return filtered;
  }, [calendar.events, calendarioPromotorFiltro]);
  const editTasks = useMemo(() => {
    const taskByKey = new Map(
      calendarBase.taskCatalog.map((task) => [`${task.routeKey}::${task.sequence}`, task]),
    );
    return activeAssignments
      .map((assignment) => {
        const task = taskByKey.get(`${assignment.route_key}::${assignment.sequence}`);
        return {
          assignment,
          stores: task?.rows ?? [],
          routeKey: assignment.route_key,
        };
      })
      .sort(
        (a, b) =>
          a.assignment.date - b.assignment.date ||
          a.routeKey.localeCompare(b.routeKey) ||
          a.assignment.sequence - b.assignment.sequence,
      );
  }, [activeAssignments, calendarBase.taskCatalog]);
  const canEditAgenda = Boolean(report?.period_reference && calendarBase.taskCatalog.length);
  const horasAgenda =
    report?.agendaEdicao?.horas_planejadas ??
    fornecedorControle?.horas_alocadas_lojas_prioritarias ??
    0;
  const cadastroPromotores = useMemo(() => {
    const idsObservados = new Set(
      (report?.presenca?.visits ?? [])
        .map((visit) => String(visit.promotor_id ?? "").trim())
        .filter(Boolean),
    );
    return {
      historico: Number(fornecedorControle?.promotores_cadastro_historico ?? 0),
      ativos: Number(fornecedorControle?.promotores_cadastro_ativos ?? 0),
      vigentes: Number(fornecedorControle?.promotores_cadastro_vigentes ?? 0),
      observados: Number(fornecedorControle?.promotores_observados ?? idsObservados.size),
      idsObservados: [...idsObservados].sort(),
      equipe: report?.equipe ?? [],
      possuiStatusOperacional: (report?.equipe ?? []).some((promotor) =>
        Boolean(promotor.status_operacional),
      ),
    };
  }, [fornecedorControle, report]);
  const execucaoVisitas = useMemo(() => {
    const planejadas = [...calendar.events.values()].flatMap((events) => events);
    const realizadas = report?.presenca?.visits ?? [];
    const realizadasPorChave = new Set(
      realizadas.map(
        (visit) =>
          `${String(visit.data ?? "").slice(0, 10)}::${String(visit.loja_codigo ?? visit.loja_id ?? "")}`,
      ),
    );
    return planejadas
      .map((event) => {
        const data = `${report?.period_reference ?? ""}-${String(event.date).padStart(2, "0")}`;
        const loja = String(event.row.loja_id);
        const chave = `${data}::${loja}`;
        const realizada = realizadasPorChave.has(chave);
        return { event, data, realizada };
      })
      .sort(
        (a, b) =>
          a.data.localeCompare(b.data) ||
          a.event.row.loja_id.localeCompare(b.event.row.loja_id, undefined, { numeric: true }),
      );
  }, [calendar, report]);
  const execucaoResumo = useMemo(() => {
    const planejadas = execucaoVisitas.length;
    const realizadas = execucaoVisitas.filter((item) => item.realizada).length;
    const suspeitas = Number(report?.presenca?.quality?.visitas_suspeitas_duracao ?? 0);
    return { planejadas, realizadas, pendentes: Math.max(0, planejadas - realizadas), suspeitas };
  }, [execucaoVisitas, report]);
  const iniciarEdicaoAgenda = () => {
    setMensagemAgenda(null);
    const sourceAssignments: AgendaAssignment[] = persistedAssignments.length
      ? persistedAssignments
      : (editableAssignments as AgendaAssignment[]);
    const assignments: AgendaAssignment[] = sourceAssignments.map((assignment) => ({
      ...assignment,
      store_ids: [...assignment.store_ids],
      promotor_ids: assignment.promotor_ids?.length
        ? [...assignment.promotor_ids]
        : assignment.promotor_id
          ? [assignment.promotor_id]
          : [],
      promotor_nomes: assignment.promotor_nomes?.length
        ? [...assignment.promotor_nomes]
        : assignment.promotor_nome
          ? [assignment.promotor_nome]
          : [],
    }));
    const vinculados = new Set(assignments.flatMap((assignment) => assignment.promotor_ids ?? []));
    const faltantes = promotoresDisponiveis.filter((id) => !vinculados.has(id));
    let faltanteIndex = 0;
    for (const assignment of assignments) {
      if (faltanteIndex >= faltantes.length) break;
      if ((assignment.promotor_ids ?? []).length) continue;
      const id = faltantes[faltanteIndex++];
      if (!id) break;
      const cadastro = (report?.equipe ?? []).find((item) => String(item.promotor_id) === id);
      assignment.promotor_ids = [id];
      assignment.promotor_id = id;
      assignment.promotor_nomes = cadastro?.nome ? [cadastro.nome] : [];
      assignment.promotor_nome = cadastro?.nome ?? null;
    }
    setDraftAssignments(assignments);
    if (faltanteIndex < faltantes.length) {
      setMensagemAgenda(
        `${faltantes.length - faltanteIndex} promotor(es) ficaram sem bloco: a capacidade de visitas do período é menor que a equipe disponível.`,
      );
    }
    setEditandoAgenda(true);
  };
  const alterarDiaAgenda = (key: string, date: number) => {
    setDraftAssignments((current) =>
      current.map((assignment) =>
        `${assignment.route_key}::${assignment.sequence}` === key
          ? { ...assignment, date }
          : assignment,
      ),
    );
  };
  const alterarPromotorAgenda = (key: string, promotorIds: string[]) => {
    const promotores = (report?.equipe ?? []).filter((item) =>
      promotorIds.includes(item.promotor_id ?? ""),
    );
    setDraftAssignments((current) =>
      current.map((assignment) =>
        `${assignment.route_key}::${assignment.sequence}` === key
          ? {
              ...assignment,
              promotor_id: promotorIds[0] ?? null,
              promotor_nome: promotores[0]?.nome ?? null,
              promotor_ids: promotorIds,
              promotor_nomes: promotores.map((item) => item.nome ?? ""),
            }
          : assignment,
      ),
    );
  };
  const salvarEdicaoAgenda = async () => {
    if (!report?.period_reference || !fornecedor) return;
    const alocados = new Set(
      draftAssignments.flatMap((assignment) => assignment.promotor_ids ?? []),
    );
    const semBloco = promotoresDisponiveis.filter((id) => !alocados.has(id));
    if (semBloco.length) {
      setMensagemAgenda(
        `${semBloco.length} promotor(es) ainda estão sem bloco nominal. A agenda não pode ser salva até que todos tenham pelo menos uma alocação.`,
      );
      return;
    }
    setSalvandoAgenda(true);
    setMensagemAgenda(null);
    try {
      const saved = await salvarAgendaPromotoresEdicao({
        data: {
          fornecedorCodigo: fornecedor,
          periodo: report.period_reference,
          assignments: draftAssignments,
        },
      });
      const agendaEdicao = saved as unknown as AgendaEditReport;
      setReport((current) => (current ? { ...current, agendaEdicao } : current));
      setEditandoAgenda(false);
      setMensagemAgenda("Agenda salva. O total de visitas, lojas e horas foi preservado.");
    } catch (error) {
      setMensagemAgenda(
        error instanceof Error ? error.message : "Não foi possível salvar a agenda.",
      );
    } finally {
      setSalvandoAgenda(false);
    }
  };
  const lojasDisponiveisParaCluster = useMemo(() => {
    const lojas = [
      ...routeGroups.clusters.flatMap((cluster) => cluster.lojas),
      ...routeGroups.individuais,
    ];
    return [...new Map(lojas.map((loja) => [loja.loja_id, loja])).values()].sort((a, b) =>
      String(a.loja_id).localeCompare(String(b.loja_id), undefined, { numeric: true }),
    );
  }, [routeGroups]);
  const abrirEdicaoCluster = (cluster: { id: string; nome?: string; lojas: RouteStore[] }) => {
    setMensagemCluster(null);
    setClusterEditor({
      modo: "edicao",
      id: cluster.id,
      nome: cluster.nome || routeLabel(cluster.id),
      lojas: cluster.lojas.map((loja) => String(loja.loja_id)),
    });
  };
  const abrirCriadorCluster = () => {
    setMensagemCluster(null);
    setClusterEditor({ modo: "novo", nome: "", lojas: [] });
  };
  const alternarLojaCluster = (lojaId: string) => {
    setClusterEditor((current) => {
      if (!current) return current;
      const lojas = current.lojas.includes(lojaId)
        ? current.lojas.filter((item) => item !== lojaId)
        : [...current.lojas, lojaId].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
          );
      return { ...current, lojas };
    });
  };
  const salvarConfiguracaoCluster = async () => {
    if (!clusterEditor) return;
    setSalvandoCluster(true);
    setMensagemCluster(null);
    try {
      const response =
        clusterEditor.modo === "novo"
          ? await criarAgendaCluster({
              data: { nome: clusterEditor.nome, lojas: clusterEditor.lojas },
            })
          : await salvarAgendaCluster({
              data: {
                id: clusterEditor.id || "",
                nome: clusterEditor.nome,
                lojas: clusterEditor.lojas,
              },
            });
      if (!fornecedor) throw new Error("Fornecedor não selecionado.");
      const atualizado = await fetchAgendaPromotoresSegmentada({
        data: {
          fornecedorCodigo: fornecedor,
          periodo: usuarioInterno ? periodoPresenca : null,
        },
      });
      setReport(atualizado as AgendaReport);
      setControlRows(
        atualizado.fornecedorControle ? [atualizado.fornecedorControle as ControlRow] : [],
      );
      setClusterEditor(null);
      const salvo = (response as { cluster?: AgendaCluster }).cluster;
      setMensagemCluster(
        `${salvo?.nome || clusterEditor.nome} salvo. A agenda foi recalculada com a nova composição.`,
      );
    } catch (error) {
      setMensagemCluster(
        error instanceof Error ? error.message : "Não foi possível salvar o cluster.",
      );
    } finally {
      setSalvandoCluster(false);
    }
  };
  const money = (value?: number) =>
    (value ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  const imprimirAgendaMensal = () => {
    const janela = window.open("", "_blank", "width=1500,height=1000");
    if (!janela) {
      window.print();
      return;
    }
    const [ano, mes] = String(report?.period_reference ?? "")
      .split("-")
      .map(Number);
    const nomeFornecedor = fornecedorControle?.descricao_fornecedor || fornecedor || "Fornecedor";
    const linhas: string[] = [];
    for (let day = 1; day <= calendar.daysInMonth; day += 1) {
      const dataLabel = `${String(day).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
      const weekday = new Date(ano, mes - 1, day).toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      if (!calendar.operationalDayNumbers.has(day)) {
        linhas.push(
          `<tr class="off"><td>${dataLabel}</td><td>${escaparHtml(weekday)}</td><td colspan="8">Folga, domingo ou feriado</td></tr>`,
        );
        continue;
      }
      for (const period of calendar.workPeriods) {
        const periodEvents = (calendar.events.get(day) ?? []).filter(
          (event) => event.periodId === period.id,
        );
        const grupos = new Map<string, VisitEvent[]>();
        for (const event of periodEvents) {
          const key = `${event.routeKey ?? `1::LOJA_${event.row.loja_id}`}::${event.sequence}`;
          const grupo = grupos.get(key) ?? [];
          grupo.push(event);
          grupos.set(key, grupo);
        }
        if (!grupos.size) {
          linhas.push(
            `<tr class="free"><td>${dataLabel}</td><td>${escaparHtml(weekday)}</td><td>${escaparHtml(period.rotulo)}</td><td colspan="7">Livre</td></tr>`,
          );
          continue;
        }
        for (const events of grupos.values()) {
          const first = events[0];
          const meta = routeMeta(first.routeKey);
          const lojas = [...new Set(events.map((event) => event.row.loja_id))]
            .map((id) => `${nomeLoja(id)} (${id})`)
            .join(" · ");
          const cidades = [
            ...new Set(events.map((event) => event.row.cidade).filter(Boolean)),
          ].join(" · ");
          const tempos = [
            ...new Map(
              events.map((event) => [
                String(event.row.loja_id),
                `${event.row.loja_id}: ${formatarTempoVisita(event.row)}`,
              ]),
            ).values(),
          ].join(" · ");
          const classe = meta.isCluster
            ? "cluster"
            : meta.kind === "Rota exclusiva"
              ? "exclusive"
              : "store";
          linhas.push(
            `<tr class="${classe}"><td>${dataLabel}</td><td>${escaparHtml(weekday)}</td><td>${escaparHtml(period.rotulo)}</td><td><strong>${escaparHtml(meta.kind)}</strong><br>${escaparHtml(meta.label)}</td><td>${escaparHtml(first.promoterName ?? "Sem promotor nominal")}</td><td>${escaparHtml(lojas)}</td><td>${escaparHtml(cidades || "—")}</td><td>${escaparHtml(tempos)}</td><td>${first.sequence}/${first.row.visitas_recomendadas_mes ?? "—"}</td><td>${escaparHtml(first.row.objetivo_atendimento ?? first.row.motivo)}</td></tr>`,
          );
        }
      }
    }
    janela.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Agenda mensal — ${escaparHtml(nomeFornecedor)}</title><style>
      @page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17261b;font-size:9px;margin:0}h1{font-size:20px;margin:0 0 4px}p{color:#526257;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd8cd;padding:5px 4px;text-align:left;vertical-align:top}th{background:#edf4ee;font-size:8px;text-transform:uppercase;letter-spacing:.03em}td:nth-child(1),td:nth-child(3),td:nth-child(5),td:nth-child(8),td:nth-child(9){white-space:nowrap}.cluster{background:#ede9fe}.exclusive{background:#cffafe}.store{background:#f8fafc}.free{color:#64748b;background:#f8fafc}.off{color:#64748b;background:#f1f5f9}small{color:#526257}</style></head><body><h1>Agenda mensal de promotores</h1><p><strong>${escaparHtml(nomeFornecedor)}</strong> · Período ${escaparHtml(calendar.label)} · ${calendar.operationalDays} dias operacionais · capacidade semanal ${calendar.legalWeeklyHours}h por promotor</p><table><thead><tr><th>Data</th><th>Dia</th><th>Período</th><th>Cluster/rota</th><th>Promotor</th><th>Lojas</th><th>Cidade</th><th>Tempo na loja</th><th>Visita</th><th>Objetivo/motivo</th></tr></thead><tbody>${linhas.join("")}</tbody></table><p style="margin-top:12px">A duração prevista é a permanência operacional por loja; “Sem promotor nominal” indica falta de equipe compatível. Clusters são destacados em violeta e rotas exclusivas em ciano.</p></body></html>`,
    );
    janela.document.close();
    janela.focus();
    janela.onload = () => janela.print();
  };
  const imprimirAgendaSupervisor = () => {
    if (supervisorPromotorFiltro === "TODOS") return;
    const janela = window.open("", "_blank", "width=1500,height=1000");
    if (!janela) {
      window.print();
      return;
    }
    const [ano, mes] = String(report?.period_reference ?? "")
      .split("-")
      .map(Number);
    const nomeFornecedor = fornecedorControle?.descricao_fornecedor || fornecedor || "Fornecedor";
    const filtroNome = supervisorPromotorFiltro.startsWith("NOME:")
      ? supervisorPromotorFiltro.slice(5)
      : "";
    const tituloAgenda = filtroNome
      ? `Agenda de ${filtroNome}`
      : `Agenda da carteira operacional ${supervisorPromotorFiltro.slice(9)}`;
    const linhas: string[] = [];
    for (let day = 1; day <= calendar.daysInMonth; day += 1) {
      const dataLabel = `${String(day).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
      const weekday = new Date(ano, mes - 1, day).toLocaleDateString("pt-BR", {
        weekday: "long",
      });
      const dayEvents = supervisaoEvents.filter((event) => event.date === day);
      if (!calendar.operationalDayNumbers.has(day)) {
        linhas.push(
          `<tr class="off"><td>${dataLabel}</td><td>${escaparHtml(weekday)}</td><td>Folga</td><td colspan="7">Domingo ou feriado sem agenda regular</td></tr>`,
        );
        continue;
      }
      const grupos = new Map<string, VisitEvent[]>();
      for (const event of dayEvents) {
        const route = event.routeKey ?? `1::LOJA_${event.row.loja_id}`;
        const key = `${route}::${event.sequence}::${event.fullDay ? "DIA_INTEIRO" : event.periodId}`;
        const grupo = grupos.get(key) ?? [];
        grupo.push(event);
        grupos.set(key, grupo);
      }
      if (!grupos.size) {
        linhas.push(
          `<tr class="free"><td>${dataLabel}</td><td>${escaparHtml(weekday)}</td><td>Sem alocação</td><td colspan="7">Nenhuma visita vinculada ao promotor neste dia</td></tr>`,
        );
        continue;
      }
      for (const events of grupos.values()) {
        const first = events[0];
        const meta = routeMeta(first.routeKey);
        const promotores = [
          ...new Set(events.map((event) => event.promoterName).filter(Boolean)),
        ].join(" · ");
        const lojas = [...new Set(events.map((event) => event.row.loja_id))]
          .map((id) => `${nomeLoja(id)} (${id})`)
          .join(" · ");
        const cidades = [...new Set(events.map((event) => event.row.cidade).filter(Boolean))].join(
          " · ",
        );
        const tempos = [
          ...new Map(
            events.map((event) => [
              String(event.row.loja_id),
              `${event.row.loja_id}: ${formatarTempoVisita(event.row)}`,
            ]),
          ).values(),
        ].join(" · ");
        const periodo = first.fullDay
          ? "Dia inteiro"
          : first.periodLabel ||
            calendar.workPeriods.find((item) => item.id === first.periodId)?.rotulo ||
            first.periodId;
        const classe = meta.isCluster
          ? "cluster"
          : meta.kind === "Rota exclusiva"
            ? "exclusive"
            : meta.kind === "Alocação diária"
              ? "daily"
              : "store";
        linhas.push(
          `<tr class="${classe}"><td>${dataLabel}</td><td>${escaparHtml(weekday)}</td><td>${escaparHtml(periodo)}</td><td><strong>${escaparHtml(meta.kind)}</strong><br>${escaparHtml(meta.label)}</td><td>${escaparHtml(promotores || "Sem promotor nominal")}</td><td>${escaparHtml(lojas)}</td><td>${escaparHtml(cidades || "—")}</td><td>${escaparHtml(tempos)}</td><td>${first.sequence}/${first.row.visitas_recomendadas_mes ?? "—"}</td><td>${escaparHtml(first.row.objetivo_atendimento ?? first.row.motivo)}</td></tr>`,
        );
      }
    }
    janela.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(tituloAgenda)} — ${escaparHtml(calendar.label)}</title><style>
      @page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17261b;font-size:9px;margin:0}h1{font-size:20px;margin:0 0 4px}p{color:#526257;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd8cd;padding:5px 4px;text-align:left;vertical-align:top}th{background:#edf4ee;font-size:8px;text-transform:uppercase;letter-spacing:.03em}td:nth-child(1),td:nth-child(3),td:nth-child(8),td:nth-child(9){white-space:nowrap}.cluster{background:#ede9fe}.exclusive{background:#cffafe}.daily{background:#dcfce7}.store{background:#f8fafc}.free{color:#92400e;background:#fffbeb}.off{color:#64748b;background:#f1f5f9}small{color:#526257}</style></head><body><h1>${escaparHtml(tituloAgenda)}</h1><p><strong>${escaparHtml(nomeFornecedor)}</strong> · Período ${escaparHtml(calendar.label)} · ${calendar.operationalDays} dias operacionais · agenda individual para entrega ao promotor</p><table><thead><tr><th>Data</th><th>Dia</th><th>Período</th><th>Cluster/rota</th><th>Promotor</th><th>Lojas</th><th>Cidade</th><th>Tempo na loja</th><th>Visita</th><th>Objetivo/motivo</th></tr></thead><tbody>${linhas.join("")}</tbody></table><p style="margin-top:12px">A duração prevista é a permanência operacional por loja; “Sem promotor nominal” indica falta de equipe compatível. Clusters em violeta, rotas exclusivas em ciano e alocações diárias em verde.</p></body></html>`,
    );
    janela.document.close();
    janela.focus();
    janela.onload = () => janela.print();
  };
  return (
    <PortalLayout
      titulo="Agenda de Promotores"
      descricao="Agenda própria por fornecedor, loja e nível de atendimento."
    >
      <div className="space-y-6">
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
              <span className="basis-full text-xs text-blue-700">
                Dimensionamento pela demanda completa da agenda (vendas, unidades, SKUs, movimentos,
                frequência e geografia). A equipe observada em{" "}
                {fornecedorControle.presenca_periodo_referencia
                  ? formatarMesPresenca(fornecedorControle.presenca_periodo_referencia)
                  : "mês fechado"}{" "}
                é adotada como piso operacional quando supera a necessidade calculada.
              </span>
              <span className="basis-full text-xs text-amber-700">
                Piso econômico: {fornecedorControle.salarios_minimos_por_promotor_politica ?? 80}{" "}
                salários mínimos por promotor; custo de referência entre R$ 2.500 e R$ 3.000. Abaixo
                do piso, a necessidade financeira calculada é zero.
              </span>
              <span className="basis-full text-xs text-violet-700">
                Separação geográfica: {fornecedorControle.promotores_geografia_capital ?? 0}{" "}
                carteira(s) para capital/metropolitana e{" "}
                {fornecedorControle.promotores_geografia_interior ?? 0} para interior. As{" "}
                {fornecedorControle.unidades_interior_acima_30_sm ?? 0} unidade(s) interior acima de{" "}
                {fornecedorControle.salarios_minimos_por_unidade_interior ?? 30} salários mínimos
                recebem reserva própria.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1700px] text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Código</th>
                    <th className="p-2">Fornecedor</th>
                    <th className="p-2">Venda média/mês</th>
                    <th className="p-2">Lojas atendidas</th>
                    <th className="p-2">Lojas fora da capacidade</th>
                    <th className="p-2">Venda-alvo/carteira (80 SM)</th>
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
        ) : null}
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
        <Tabs defaultValue="calendario" className="w-full">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="cadastro-promotores">1. Equipe e alocação</TabsTrigger>
            <TabsTrigger value="execucao-promotores">3. Execução</TabsTrigger>
            <TabsTrigger value="planilha">Planilha</TabsTrigger>
            <TabsTrigger value="calendario">Calendário de visitas</TabsTrigger>
            {atendimentoConsultivo ? (
              <TabsTrigger value="plano-consultivo">Plano consultivo</TabsTrigger>
            ) : null}
            <TabsTrigger value="clusters">Clusters e rotas</TabsTrigger>
            <TabsTrigger value="agendas-promotores">
              Agendas dos {atendimentoConsultivo ? "consultores" : "promotores"}
            </TabsTrigger>
            {usuarioInterno?.role === "admin" ? (
              <TabsTrigger value="conciliacao-presenca">Conciliação de presença</TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="cadastro-promotores">
            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">Equipe e alocação operacional</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Consulta somente leitura da equipe vinculada ao fornecedor. O fornecedor vê
                  somente seus próprios promotores; documentos e dados de contato não são exibidos.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Histórico", cadastroPromotores.historico],
                  ["Ativos", cadastroPromotores.ativos],
                  ["Vigentes", cadastroPromotores.vigentes],
                  ["Observados no período", cadastroPromotores.observados],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Number(value).toLocaleString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border bg-background p-3 text-sm">
                <div className="font-medium">Vínculo com a agenda</div>
                <p className="mt-1 text-muted-foreground">
                  A agenda publicada usa carteiras/promotores operacionais e rotas. O cadastro
                  individual continua sendo alterado na origem de RH; esta tela apenas vincula a
                  equipe autorizada à agenda.
                </p>
              </div>
              {cadastroPromotores.equipe.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3">Promotor</th>
                        <th className="p-3">Nome de crachá</th>
                        <th className="p-3">ID</th>
                        <th className="p-3">Validade</th>
                        {cadastroPromotores.possuiStatusOperacional ? (
                          <th className="p-3">Situação</th>
                        ) : null}
                        <th className="p-3">Agenda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cadastroPromotores.equipe.map((promotor) => (
                        <tr key={`${promotor.promotor_id}-${promotor.nome}`} className="border-t">
                          <td className="p-3 font-medium">{promotor.nome}</td>
                          <td className="p-3">{promotor.nome_cracha || "—"}</td>
                          <td className="p-3 font-mono text-xs">{promotor.promotor_id}</td>
                          <td className="p-3">{formatarDataPresenca(promotor.validade)}</td>
                          {cadastroPromotores.possuiStatusOperacional ? (
                            <td className="p-3">
                              {promotor.status_operacional === "FORA_DO_SISTEMA" ? (
                                <Badge variant="destructive">Fora do sistema</Badge>
                              ) : promotor.status_operacional === "SEM_PRESENCA_MES_ANTERIOR" ||
                                promotor.status_operacional === "DIVERGENTE" ? (
                                <Badge variant="outline">Sem presença no mês anterior</Badge>
                              ) : (
                                <Badge variant="default">Ativo</Badge>
                              )}
                            </td>
                          ) : null}
                          <td className="p-3">
                            {promotor.disponivel_agenda === false ? (
                              <Badge variant="outline">Fora da validade</Badge>
                            ) : (
                              <Badge variant="default">Disponível</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  Nenhum nome foi conciliado com o fornecedor nesta sessão. Verifique o vínculo
                  nominal do cadastro RM.
                </div>
              )}
              {cadastroPromotores.idsObservados.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3">ID pseudonimizado</th>
                        <th className="p-3">Presença no período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cadastroPromotores.idsObservados.map((id) => (
                        <tr key={id} className="border-t">
                          <td className="p-3 font-mono text-xs">{id}</td>
                          <td className="p-3">Identificado na extração de presença</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  Ainda não há presença conciliada para listar identificadores no período.
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="execucao-promotores">
            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">3. Execução das visitas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comparação entre a agenda publicada e a presença real extraída para o período
                  selecionado.
                </p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <CalendarClock className="size-4 text-primary" />
                      Periodicidade do cálculo da agenda
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                      Diário recalcula a demanda na publicação de cada dia. Mensal congela a agenda
                      aprovada durante o período e só troca o plano no próximo ciclo fechado. A
                      mudança passa por aprovação administrativa e não apaga a agenda já publicada.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Situação atual:{" "}
                      <strong className="text-foreground">
                        {preferenciaCalculo?.status === "APROVADA"
                          ? preferenciaCalculo.periodicidade === "MENSAL"
                            ? "Mensal aprovado"
                            : "Diário aprovado"
                          : preferenciaCalculo?.status === "PENDENTE"
                            ? "Solicitação pendente"
                            : "Diário padrão"}
                      </strong>
                      {preferenciaCalculo?.aprovadoEm
                        ? ` · aprovado em ${formatarDataHora(preferenciaCalculo.aprovadoEm)}`
                        : null}
                    </p>
                  </div>
                  <div className="flex min-w-[230px] flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="text-xs font-medium text-muted-foreground">
                      Solicitar modo
                      <select
                        className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
                        value={periodicidadeSolicitada}
                        onChange={(event) =>
                          setPeriodicidadeSolicitada(
                            event.target.value as PeriodicidadeCalculoPromotor,
                          )
                        }
                      >
                        <option value="DIARIO">Diário</option>
                        <option value="MENSAL">Mensal</option>
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void salvarPeriodicidade()}
                      disabled={salvandoPeriodicidade}
                    >
                      {salvandoPeriodicidade ? "Enviando…" : "Enviar solicitação"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Planejadas", execucaoResumo.planejadas],
                  ["Realizadas", execucaoResumo.realizadas],
                  ["Pendentes", execucaoResumo.pendentes],
                  ["Suspeitas", execucaoResumo.suspeitas],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {Number(value).toLocaleString("pt-BR")}
                    </div>
                  </div>
                ))}
              </div>
              {!report?.presenca ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  A presença ainda não está disponível para esta sessão/período.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Período</th>
                        <th className="p-3">Loja</th>
                        <th className="p-3">Rota</th>
                        <th className="p-3">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {execucaoVisitas.slice(0, 300).map(({ event, data, realizada }) => (
                        <tr
                          key={`${data}-${event.routeKey}-${event.sequence}-${event.row.loja_id}`}
                          className="border-t"
                        >
                          <td className="p-3">{formatarDataPresenca(data)}</td>
                          <td className="p-3">{event.periodLabel}</td>
                          <td className="p-3">
                            {nomeLoja(event.row.loja_id)} · {event.row.loja_id}
                          </td>
                          <td className="p-3">
                            {routeLabel(
                              String(event.routeKey ?? "")
                                .split("::")
                                .slice(1)
                                .join("::") || `LOJA_${event.row.loja_id}`,
                            )}
                          </td>
                          <td
                            className={`p-3 font-medium ${realizada ? "text-emerald-700" : "text-amber-700"}`}
                          >
                            {realizada ? "Realizada" : "Pendente de presença"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="supervisao-promotores">
            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">4. Supervisão e indicadores</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visão para acompanhar cobertura, execução e qualidade do registro sem expor dados
                  pessoais.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Cobertura da agenda</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {execucaoResumo.planejadas
                      ? `${Math.round((execucaoResumo.realizadas / execucaoResumo.planejadas) * 100)}%`
                      : "—"}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Horas planejadas</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {Number(horasAgenda || 0).toFixed(1)}h
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Lojas na agenda</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {new Set(
                      editableAssignments.flatMap((item) => item.store_ids),
                    ).size.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Qualidade do registro</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {execucaoResumo.suspeitas ? "Atenção" : "Normal"}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="font-medium">Agenda individual do supervisor</div>
                    <p className="mt-1 text-muted-foreground">
                      A grade usa a mesma agenda geral e permite acompanhar um promotor por vez.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <select
                      value={supervisorPromotorFiltro}
                      onChange={(event) => setSupervisorPromotorFiltro(event.target.value)}
                      className="h-9 min-w-[260px] rounded-md border bg-background px-3 text-sm"
                      aria-label="Promotor da agenda individual"
                    >
                      <option value="TODOS">Todos os promotores</option>
                      {(report?.equipe ?? [])
                        .filter((item) => item.disponivel_agenda !== false)
                        .map((item) => (
                          <option key={item.promotor_id} value={`NOME:${item.nome}`}>
                            {item.nome} · {item.promotor_id}
                          </option>
                        ))}
                      {(fornecedorControle?.carteiras_promotores ?? []).map((carteira) => (
                        <option
                          key={`carteira-${carteira.carteira}`}
                          value={`CARTEIRA:${carteira.carteira}`}
                        >
                          Carteira operacional {carteira.carteira}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={imprimirAgendaSupervisor}
                      disabled={supervisorPromotorFiltro === "TODOS"}
                      title="Selecione um promotor ou uma carteira para imprimir a agenda individual"
                    >
                      <Printer className="size-3.5" /> Imprimir agenda individual
                    </button>
                  </div>
                </div>
                {supervisorPromotorFiltro.startsWith("NOME:") && supervisaoEvents.length === 0 ? (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                    Nenhum bloco nominal está vinculado a este promotor neste mês. A grade mostra os
                    dias livres até que o nome seja selecionado nos blocos da aba Calendário de
                    visitas e a agenda seja salva.
                  </div>
                ) : null}
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: calendar.daysInMonth }, (_, index) => index + 1).map(
                    (day) => {
                      const dayEvents = supervisaoEvents.filter((event) => event.date === day);
                      return (
                        <div key={day} className="rounded border bg-background p-2">
                          <div className="text-xs font-semibold">
                            {String(day).padStart(2, "0")}/{calendar.label}
                          </div>
                          {!dayEvents.length ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {calendar.operationalDayNumbers.has(day) ? "Livre" : "Folga/feriado"}
                            </div>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {calendar.workPeriods.map((period) => {
                                const periodEvents = dayEvents.filter(
                                  (event) => event.periodId === period.id,
                                );
                                return (
                                  <div key={period.id} className="text-[11px]">
                                    <span className="font-medium">{period.rotulo}:</span>{" "}
                                    {periodEvents.length
                                      ? periodEvents
                                          .map(
                                            (event) =>
                                              `${event.row.loja_id}${event.promoterName ? ` · ${event.promoterName}` : ""}`,
                                          )
                                          .join(" | ")
                                      : "Livre"}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-medium">Próximo passo operacional</div>
                <p className="mt-1 text-muted-foreground">
                  Use o calendário para ajustar somente os dias das rotas. A quantidade de visitas,
                  lojas, equipe e capacidade permanece protegida pela validação da API.
                </p>
              </div>
            </div>
          </TabsContent>
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
                    <th className="p-3">Tempo na loja</th>
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
                      <td className="p-3 font-medium">{formatarTempoVisita(row)}</td>
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
                    {calendar.operationalDays} dias de agenda · segunda recompõe o fim de semana;
                    quinta, sexta e sábado recebem prioridade de venda · equipe disponível de até{" "}
                    {calendar.teamCapacity} por período · sábados, domingos e feriados sem agenda
                    regular fora da política sazonal
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
                  <p className="mt-1 text-xs text-violet-700">
                    Capacidade semanal: {calendar.legalWeeklyHours}h legais por promotor; capacidade
                    produtiva planejada de {calendar.weeklyCapacityPeriods} horas-equivalentes por
                    semana. A carga é controlada por semana; blocos acima da capacidade ficam
                    pendentes.
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Alocação diária obrigatória ativa: {calendar.dailyAllocationTasks} bloco(s)
                    complementar(es) foram criados somente nos dias em que a rota calculada não
                    cobria o promotor. Cada bloco reutiliza uma loja/cluster real da carteira.
                  </p>
                  {agendaBlocosSemPromotor > 0 ? (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      {agendaBlocosSemPromotor} bloco(s) ficaram sem promotor nominal: a equipe
                      cadastrada não tem capacidade ou vínculo geográfico para assumir esses
                      horários. Eles não recebem um nome artificial e precisam de reforço ou ajuste
                      de carteira.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="text-xs text-muted-foreground">
                    Passe o mouse sobre uma visita para ver o motivo
                  </span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <select
                      value={calendarioPromotorFiltro}
                      onChange={(event) => setCalendarioPromotorFiltro(event.target.value)}
                      className="h-9 min-w-[240px] rounded-md border bg-background px-3 text-xs"
                      aria-label="Filtrar calendário por promotor"
                    >
                      <option value="TODOS">Todos os promotores</option>
                      {(report?.equipe ?? [])
                        .filter((item) => item.disponivel_agenda !== false)
                        .map((item) => (
                          <option key={item.promotor_id} value={`NOME:${item.nome}`}>
                            {item.nome} · {item.promotor_id}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={imprimirAgendaMensal}
                      disabled={!calendarBase.taskCatalog.length}
                      title="Abrir a agenda mensal pronta para impressão ou PDF"
                    >
                      <Printer className="size-3.5" /> Imprimir mês
                    </button>
                    {!editandoAgenda ? (
                      <button
                        type="button"
                        className="rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={iniciarEdicaoAgenda}
                        disabled={!canEditAgenda}
                        title={
                          canEditAgenda
                            ? "Alterar somente os dias das rotas"
                            : "A agenda precisa estar totalmente alocada para permitir edição"
                        }
                      >
                        Editar agenda
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                <span>
                  Visitas fixas:{" "}
                  <strong>
                    {report?.agendaEdicao?.total_visitas ??
                      editableAssignments
                        .filter((item) => !parseDailyAllocationKey(item.route_key))
                        .reduce((sum, item) => sum + item.store_ids.length, 0)}
                  </strong>
                </span>
                <span>
                  Lojas no plano:{" "}
                  <strong>
                    {new Set(editableAssignments.flatMap((item) => item.store_ids)).size}
                  </strong>
                </span>
                <span>
                  Horas planejadas: <strong>{Number(horasAgenda || 0).toFixed(2)}h</strong>
                </span>
                <span>
                  Alocações diárias: <strong>{calendar.dailyAllocationTasks}</strong>
                </span>
                <span className={agendaBlocosSemPromotor ? "text-amber-800" : ""}>
                  Blocos sem promotor: <strong>{agendaBlocosSemPromotor}</strong>
                </span>
                {report?.agendaEdicao ? (
                  <span className="text-muted-foreground">Versão {report.agendaEdicao.versao}</span>
                ) : null}
              </div>
              {mensagemAgenda ? (
                <div className="mb-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {mensagemAgenda}
                </div>
              ) : null}
              {usuarioInterno ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {calendar.weeklyLoadSummary.map((week) => (
                    <div key={week.weekKey} className="rounded-md border bg-violet-50/50 p-2 text-xs">
                      <div className="font-medium">Semana de {week.weekKey}</div>
                      <div className="mt-1 text-muted-foreground">
                        {week.usedHours.toFixed(1)}h de {week.capacityHours.toFixed(1)}h ·{" "}
                        {week.utilizationPercent.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {editandoAgenda ? (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-blue-950">
                        Editar dias da agenda
                      </div>
                      <p className="mt-1 max-w-3xl text-xs text-blue-900/80">
                        Escolha outro dia para cada rota. As lojas do cluster permanecem juntas e a
                        quantidade de visitas, lojas, equipe e horas não pode ser alterada.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                        onClick={() => {
                          setEditandoAgenda(false);
                          setMensagemAgenda(null);
                        }}
                        disabled={salvandoAgenda}
                      >
                        Descartar
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void salvarEdicaoAgenda()}
                        disabled={salvandoAgenda}
                      >
                        {salvandoAgenda ? "Validando…" : "Salvar agenda"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-md border bg-background">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="p-2">Rota/cluster</th>
                          <th className="p-2">Promotor</th>
                          <th className="p-2">Responsável nominal</th>
                          <th className="p-2">Lojas do bloco</th>
                          <th className="p-2">Tempo na loja</th>
                          <th className="p-2">Visita</th>
                          <th className="p-2">Dia</th>
                          <th className="p-2">Período</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editTasks.map(({ assignment, stores, routeKey }) => {
                          const assignmentKey = `${assignment.route_key}::${assignment.sequence}`;
                          const meta = routeMeta(routeKey);
                          const promoter = promoterForRoute(routeKey, stores[0]?.carteira_promotor);
                          return (
                            <tr key={assignmentKey} className="border-t">
                              <td className="p-2 font-medium">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                                  >
                                    {meta.kind}
                                  </span>
                                  <span>{meta.label}</span>
                                </div>
                              </td>
                              <td className="p-2 font-medium">
                                {promoterLabel(routeKey, promoter ?? undefined)}
                              </td>
                              <td className="p-2">
                                <select
                                  multiple
                                  size={Math.min(4, Math.max(2, (report?.equipe ?? []).length))}
                                  className="min-h-8 min-w-[220px] rounded border bg-background px-2"
                                  value={
                                    assignment.promotor_ids?.length
                                      ? assignment.promotor_ids
                                      : assignment.promotor_id
                                        ? [assignment.promotor_id]
                                        : []
                                  }
                                  onChange={(event) =>
                                    alterarPromotorAgenda(
                                      assignmentKey,
                                      [...event.target.selectedOptions].map(
                                        (option) => option.value,
                                      ),
                                    )
                                  }
                                >
                                  {(report?.equipe ?? [])
                                    .filter((item) => item.disponivel_agenda !== false)
                                    .map((item) => (
                                      <option key={item.promotor_id} value={item.promotor_id}>
                                        {item.nome} · {item.promotor_id}
                                      </option>
                                    ))}
                                </select>
                              </td>
                              <td className="p-2">
                                {stores.map((store) => store.loja_id).join(" · ")}
                              </td>
                              <td className="p-2">
                                {stores.length
                                  ? stores.map((store) => `${store.loja_id}: ${formatarTempoVisita(store)}`).join(" · ")
                                  : "—"}
                              </td>
                              <td className="p-2">#{assignment.sequence}</td>
                              <td className="p-2">
                                <select
                                  className="h-8 rounded border bg-background px-2"
                                  value={assignment.date}
                                  onChange={(event) =>
                                    alterarDiaAgenda(assignmentKey, Number(event.target.value))
                                  }
                                >
                                  {calendarBase.operationalDayNumbers.size ? (
                                    [...calendarBase.operationalDayNumbers].map((day) => (
                                      <option key={day} value={day}>
                                        {String(day).padStart(2, "0")}/{calendarBase.label}
                                      </option>
                                    ))
                                  ) : (
                                    <option value={assignment.date}>{assignment.date}</option>
                                  )}
                                </select>
                              </td>
                              <td className="p-2">{assignment.period_id}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {calendar.unscheduledTasks > 0 ? (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {calendar.unscheduledTasks} blocos de{" "}
                  {atendimentoConsultivo ? "treinamento" : "visita"} ficaram pendentes na alocação
                  automática. Use “Editar agenda” para escolher dias operacionais; a validação
                  manterá a capacidade e o total do plano.
                </div>
              ) : null}
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-[11px]">
                <span className="font-semibold text-muted-foreground">Legenda:</span>
                <span className="rounded-full bg-violet-200 px-2 py-0.5 font-medium text-violet-950">
                  Cluster
                </span>
                <span className="rounded-full bg-cyan-200 px-2 py-0.5 font-medium text-cyan-950">
                  Rota exclusiva
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-800">
                  Loja individual
                </span>
                <span className="text-muted-foreground">
                  “Sem promotor” indica que não há pessoa nominal viável para aquele bloco.
                </span>
              </div>
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
                    const events = day > 0 ? calendarioEvents.get(day) || [] : [];
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
                                      {periodEvents.map((event) => {
                                        const meta = routeMeta(
                                          event.routeKey ?? `1::LOJA_${event.row.loja_id}`,
                                        );
                                        const severityClass =
                                          event.row.nivel === "N1_CRITICO"
                                            ? "border-red-300 bg-red-100 text-red-900"
                                            : event.row.nivel === "N2_ALTO"
                                              ? "border-amber-300 bg-amber-100 text-amber-900"
                                              : "border-blue-300 bg-blue-100 text-blue-900";
                                        return (
                                          <div
                                            key={`${event.periodId}-${event.row.fornecedor_codigo}-${event.row.loja_id}-${event.sequence}`}
                                            title={`${meta.label} · ${event.promoterName ?? "Sem promotor nominal"} | ${event.row.objetivo_atendimento ?? event.row.motivo} | ${event.periodLabel} | ${atendimentoConsultivo ? "Sessão" : "Visita"} ${event.sequence}/${event.row.visitas_recomendadas_mes ?? "—"} | Permanência prevista: ${formatarTempoVisita(event.row)}`}
                                            className={`cursor-help rounded border px-1.5 py-1 text-[10px] ${meta.isCluster ? meta.cardClass : severityClass}`}
                                          >
                                            <div className="mb-0.5 flex items-center justify-between gap-1">
                                              <span
                                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${meta.badgeClass}`}
                                              >
                                                {meta.kind}
                                              </span>
                                              <span className="font-semibold">
                                                {event.promoterName ?? "Sem promotor"}
                                              </span>
                                            </div>
                                            <div className="break-words">
                                              {atendimentoConsultivo ? "Treinamento" : "Loja"}{" "}
                                              {event.row.loja_id}
                                              {event.row.cidade ? ` · ${event.row.cidade}` : ""}
                                              {` · ${formatarTempoVisita(event.row)}`}
                                              {(event.row.promotores_periodo_recomendados ?? 1) > 1
                                                ? ` · equipe ${event.row.promotores_periodo_recomendados}`
                                                : ""}
                                              {event.fullDay
                                                ? event.splitDay
                                                  ? " · rota manhã/tarde"
                                                  : " · dia inteiro"
                                                : ""}
                                            </div>
                                          </div>
                                        );
                                      })}
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

              {usuarioInterno?.role === "admin" ? (
                <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-emerald-950">Editor de clusters</h3>
                      <p className="mt-1 text-sm text-emerald-900/80">
                        Crie uma nova rota ou ajuste as lojas de um cluster. Uma loja só pode
                        pertencer a um cluster e capital/metropolitana não pode ser misturada com
                        interior.
                      </p>
                    </div>
                    <Button type="button" onClick={abrirCriadorCluster}>
                      Criar cluster
                    </Button>
                  </div>
                  {mensagemCluster ? (
                    <p className="mt-3 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-900">
                      {mensagemCluster}
                    </p>
                  ) : null}
                  {clusterEditor ? (
                    <div className="mt-4 space-y-3 rounded-lg border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-semibold">
                            {clusterEditor.modo === "novo"
                              ? "Novo cluster"
                              : `Editar ${routeLabel(clusterEditor.id || "")}`}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Selecione somente lojas da mesma geografia.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setClusterEditor(null)}
                          disabled={salvandoCluster}
                        >
                          Cancelar
                        </Button>
                      </div>
                      <Input
                        value={clusterEditor.nome}
                        onChange={(event) =>
                          setClusterEditor((current) =>
                            current ? { ...current, nome: event.target.value } : current,
                          )
                        }
                        placeholder="Nome do cluster"
                        maxLength={120}
                      />
                      <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {lojasDisponiveisParaCluster.map((loja) => (
                          <label
                            key={`cluster-store-${loja.loja_id}`}
                            className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={clusterEditor.lojas.includes(String(loja.loja_id))}
                              onChange={() => alternarLojaCluster(String(loja.loja_id))}
                            />
                            <span>
                              <strong>Loja {loja.loja_id}</strong>
                              <span className="ml-1 text-muted-foreground">
                                {loja.cidade || "cidade não informada"}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {clusterEditor.lojas.length} loja(s) selecionada(s)
                        </span>
                        <Button
                          type="button"
                          onClick={() => void salvarConfiguracaoCluster()}
                          disabled={salvandoCluster || !clusterEditor.nome.trim()}
                        >
                          {salvandoCluster ? "Salvando…" : "Salvar cluster"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

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
                            <h4 className="font-semibold">
                              {cluster.nome || routeLabel(cluster.id)}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {cities.join(" · ") || "Cidade não informada"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary">{cluster.lojas.length} lojas</Badge>
                            <Badge variant="outline">{activeStores.length} na sua agenda</Badge>
                            {usuarioInterno?.role === "admin" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => abrirEdicaoCluster(cluster)}
                              >
                                Editar
                              </Button>
                            ) : null}
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
                  Agendas por {atendimentoConsultivo ? "consultor" : "promotor"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {atendimentoConsultivo
                    ? "Cada agenda nominal reúne as lojas, sessões e módulos atribuídos ao mesmo consultor."
                    : "Cada agenda nominal reúne os blocos e as lojas atribuídos ao mesmo promotor."}
                </p>
              </div>
              {agendaNominalResumo.length ? (
                <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {agendaNominalResumo.map((promotor) => (
                    <div
                      key={promotor.id}
                      className="rounded-lg border bg-emerald-50/50 p-4 text-sm"
                    >
                      <div className="font-semibold">{promotor.nome}</div>
                      {promotor.nomeCracha && promotor.nomeCracha !== promotor.nome ? (
                        <div className="text-xs text-muted-foreground">
                          Crachá: {promotor.nomeCracha}
                        </div>
                      ) : null}
                      <div className="mt-2 text-muted-foreground">
                        {promotor.blocos} bloco(s) · {promotor.lojas} loja(s)
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Ainda não há blocos associados a um nome. Edite a agenda e selecione um promotor
                  nominal para formar as agendas individuais.
                </p>
              )}
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
                          {carteira.percentual_meta_80_sm?.toFixed(1) ?? "—"}% da referência de 80
                          SM
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
          {usuarioInterno?.role === "admin" ? (
            <TabsContent value="conciliacao-presenca">
              <div className="space-y-5 rounded-xl border p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-900">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-slate-700" />
                    <div>
                      <h3 className="font-semibold">Conciliação administrativa da presença</h3>
                      <p className="mt-1 leading-relaxed text-muted-foreground">
                        A fonte é somente leitura. O identificador do promotor é pseudonimizado e
                        nenhum nome, CPF ou horário bruto é exibido. O Portal aplica o de-para
                        aprovado por CNPJ e as exceções operacionais autorizadas; somente
                        fornecedores sem vínculo ficam pendentes para regularização.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-background p-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Período da presença
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Selecione o mês atual ou um mês já fechado.
                    </div>
                  </div>
                  <select
                    value={periodoPresenca}
                    onChange={(event) => setPeriodoPresenca(event.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    aria-label="Período da presença"
                  >
                    {periodosPresenca.map((opcao) => (
                      <option key={opcao.periodo} value={opcao.periodo}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                {!report?.presenca ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    A sessão atual não recebeu o relatório de presença. Recarregue a agenda ou
                    confirme que o usuário possui papel administrador.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Estado</div>
                        <div className="mt-1 font-semibold">
                          {report.presenca.status === "DISPONIVEL"
                            ? "Pronto para comparar"
                            : report.presenca.status === "AGUARDA_EXTRACAO"
                              ? "Aguardando extração"
                              : "Vínculo do fornecedor pendente"}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Janela</div>
                        <div className="mt-1 font-semibold">
                          {formatarDataPresenca(report.presenca.window?.inicio)} a{" "}
                          {formatarDataPresenca(report.presenca.window?.fim)}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Visitas exportadas</div>
                        <div className="mt-1 text-xl font-semibold">
                          {report.presenca.quality?.visitas_exportadas?.toLocaleString("pt-BR") ??
                            "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Lojas conciliáveis</div>
                        <div className="mt-1 text-xl font-semibold">
                          {report.presenca.by_store?.length?.toLocaleString("pt-BR") ?? "0"}
                        </div>
                      </div>
                    </div>
                    {report.presenca.motivo ? (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                        {report.presenca.motivo}
                      </div>
                    ) : null}
                    {(report.presenca.quality?.visitas_suspeitas_duracao ?? 0) > 0 ? (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                        Foram sinalizadas{" "}
                        {report.presenca.quality?.visitas_suspeitas_duracao?.toLocaleString(
                          "pt-BR",
                        )}{" "}
                        visita(s) com duração acima do limite operacional de{" "}
                        {formatarDuracaoPresenca(
                          report.presenca.quality?.limite_duracao_operacional_minutos,
                        )}
                        . Esses registros permanecem disponíveis para auditoria, mas não entram na
                        duração média válida.
                      </div>
                    ) : null}
                    {suspeitasPorPromotor.length ? (
                      <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                        <div>
                          <h3 className="font-semibold">Promotores associados às suspeitas</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Cada identificador abaixo é pseudonimizado e permite rastrear as
                            ocorrências sem expor nome ou CPF. A sinalização é um alerta de
                            qualidade do registro, não uma conclusão de irregularidade.
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                          <div>
                            <label
                              htmlFor="filtro-suspeitas"
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Buscar por promotor, loja ou data
                            </label>
                            <Input
                              id="filtro-suspeitas"
                              value={filtroSuspeitas}
                              onChange={(event) => setFiltroSuspeitas(event.target.value)}
                              placeholder="Ex.: 731b6c3276de90a8 ou loja 12"
                              className="mt-1 bg-background"
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {promotoresSuspeitasVisiveis.length.toLocaleString("pt-BR")}{" "}
                            promotor(es) com ocorrência
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-lg border bg-background">
                          <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-muted/40 text-left">
                              <tr>
                                <th className="p-3">Promotor</th>
                                <th className="p-3">Visitas suspeitas</th>
                                <th className="p-3">Lojas</th>
                                <th className="p-3">Maior duração</th>
                                <th className="p-3">Última ocorrência</th>
                              </tr>
                            </thead>
                            <tbody>
                              {promotoresSuspeitasVisiveis.map((item) => (
                                <tr key={item.promotorId} className="border-t">
                                  <td className="p-3 text-xs">
                                    {item.promotorNome
                                      ? `${item.promotorNome} · ${item.promotorId}`
                                      : `ID pseudonimizado · ${item.promotorId}`}
                                  </td>
                                  <td className="p-3 font-medium">{item.visitas}</td>
                                  <td className="p-3">{item.lojasQuantidade}</td>
                                  <td className="p-3">
                                    {formatarDuracaoPresenca(item.maiorDuracao)}
                                  </td>
                                  <td className="p-3">{formatarDataPresenca(item.ultimaData)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="overflow-x-auto rounded-lg border bg-background">
                          <table className="w-full min-w-[900px] text-sm">
                            <thead className="bg-muted/40 text-left">
                              <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3">Loja</th>
                                <th className="p-3">Promotor</th>
                                <th className="p-3">Duração registrada</th>
                                <th className="p-3">Situação</th>
                                <th className="p-3">Visita</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visitasSuspeitas.slice(0, 250).map((visit, index) => (
                                <tr
                                  key={
                                    visit.visita_id ?? `${visit.data}-${visit.promotor_id}-${index}`
                                  }
                                  className="border-t"
                                >
                                  <td className="p-3">{formatarDataPresenca(visit.data)}</td>
                                  <td className="p-3">
                                    {visit.loja_codigo
                                      ? nomeLoja(visit.loja_codigo)
                                      : "Loja não identificada"}
                                    {visit.loja_codigo ? ` · ${visit.loja_codigo}` : ""}
                                  </td>
                                  <td className="p-3 text-xs">
                                    {visit.promotor_nome
                                      ? `${visit.promotor_nome}${visit.promotor_cadastro_id ? ` · ${visit.promotor_cadastro_id}` : ""}`
                                      : `ID pseudonimizado · ${visit.promotor_id ?? "não identificado"}`}
                                  </td>
                                  <td className="p-3 font-medium text-amber-700">
                                    {formatarDuracaoPresenca(visit.duracao_minutos)}
                                  </td>
                                  <td className="p-3">Acima do limite operacional</td>
                                  <td className="p-3 font-mono text-xs text-muted-foreground">
                                    {visit.visita_id ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {visitasSuspeitas.length > 250 ? (
                          <p className="text-xs text-muted-foreground">
                            Exibindo 250 de {visitasSuspeitas.length.toLocaleString("pt-BR")}{" "}
                            ocorrências filtradas. Use a busca para localizar um promotor ou loja
                            específica.
                          </p>
                        ) : null}
                      </section>
                    ) : null}
                    {report.presenca.by_store?.length ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[1240px] text-sm">
                          <thead className="bg-muted/40 text-left">
                            <tr>
                              <th className="p-3">Loja</th>
                              <th className="p-3">Visitas registradas</th>
                              <th className="p-3">Visitas previstas no período</th>
                              <th className="p-3">Visitas válidas</th>
                              <th className="p-3">Suspeitas</th>
                              <th className="p-3">Promotores</th>
                              <th className="p-3">Duração média válida</th>
                              <th className="p-3">Duração média registrada</th>
                              <th className="p-3">Duração prevista</th>
                              <th className="p-3">Última presença</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.presenca.by_store.map((store) => {
                              const agendaLoja = agendaPresencaPorLoja.get(
                                String(store.loja_codigo ?? ""),
                              );
                              return (
                                <tr
                                  key={`${store.fornecedor_id}-${store.loja_id}`}
                                  className="border-t"
                                >
                                  <td className="p-3">
                                    {store.loja_codigo
                                      ? nomeLoja(store.loja_codigo)
                                      : "Loja não identificada"}
                                  </td>
                                  <td className="p-3">{store.visitas ?? 0}</td>
                                  <td className="p-3">
                                    {agendaLoja?.visitas_recomendadas_mes ?? "—"}
                                  </td>
                                  <td className="p-3">
                                    {store.visitas_validas ?? store.visitas ?? 0}
                                  </td>
                                  <td className="p-3">
                                    {(store.visitas_suspeitas_duracao ?? 0) > 0 ? (
                                      <span className="font-medium text-amber-700">
                                        {store.visitas_suspeitas_duracao}
                                      </span>
                                    ) : (
                                      0
                                    )}
                                  </td>
                                  <td className="p-3">{store.promotores_distintos ?? 0}</td>
                                  <td className="p-3">
                                    {formatarDuracaoPresenca(store.duracao_media_minutos)}
                                  </td>
                                  <td className="p-3">
                                    {formatarDuracaoPresenca(store.duracao_media_bruta_minutos)}
                                  </td>
                                  <td className="p-3">
                                    {formatarDuracaoPresenca(
                                      agendaLoja?.tempo_visita_recomendado_min ??
                                        agendaLoja?.minutos_servico_visita,
                                    )}
                                  </td>
                                  <td className="p-3">{formatarDataPresenca(store.ultima_data)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </TabsContent>
          ) : null}
        </Tabs>
        <p className="text-xs text-muted-foreground">
          <CalendarClock className="mr-1 inline size-3" />
          A/B é proxy operacional N1/N2; a curva ABC real depende de vendas por SKU. A presença será
          comparada por loja quando houver chave compatível; durações suspeitas ficam fora da média
          válida.
        </p>
      </div>
    </PortalLayout>
  );
}
