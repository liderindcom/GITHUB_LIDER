import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  Filter,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  aprovarPreferenciaCalculoPromotor,
  fetchControlePromotoresResumo,
  fetchStatusPromotoresExecucao,
  fetchPreferenciasCalculoPromotoresAdmin,
  forcarAtualizacaoStatusPromotores,
} from "@/api";
import type { PreferenciaCalculoPromotor } from "@/api";
import { PortalLayout } from "@/components/portal-layout";
import { usePortal } from "@/context/portal-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_portal/controle-promotores")({
  head: () => ({
    meta: [
      { title: "Análise de Promotores | Portal do Fornecedor" },
      {
        name: "description",
        content: "Triagem administrativa de necessidade e cobertura de promotores por fornecedor.",
      },
    ],
  }),
  component: ControlePromotores,
});

type Supplier = {
  fornecedor_codigo: string;
  fornecedor_codigo_exibicao?: string;
  descricao_fornecedor: string;
  segmentos_ativos?: string[];
  compradores_ativos?: string[];
  departamentos_ativos?: Array<{
    codigo?: string | number | null;
    descricao?: string | null;
    segmento?: string | null;
    skus?: number | null;
  }>;
  modelo_atendimento?: string;
  modelo_atendimento_rotulo?: string;
  promotores_observados?: number;
  promotores_observados_relatorio?: number;
  promotores_status_disponivel?: boolean;
  promotores_status_total?: number | null;
  promotores_status_ativos?: number | null;
  promotores_status_sem_presenca_mes_anterior?: number | null;
  promotores_status_fora_do_sistema?: number | null;
  promotores_status_gerado_em?: string | null;
  promotores_status_data_referencia?: string | null;
  promotores_necessarios_recomendados?: number;
  horas_observadas?: number;
  lojas_com_presenca?: number;
  visitas_observadas?: number;
  visitas_planejadas_mes?: number;
  necessidade_operacional_horas_mes?: number;
  necessidade_operacional_fte?: number;
  promotores_necessarios_calculados?: number;
  promotores_observados_adotados?: number;
  promotores_necessarios_sem_teto?: number;
  promotores_operacionais_geografia?: number;
  promotores_geografia_capital?: number;
  promotores_geografia_interior?: number;
  unidades_interior_acima_30_sm?: number;
  venda_minima_unidade_interior?: number;
  salarios_minimos_por_unidade_interior?: number;
  itens_movimentados_mes?: number;
  unidades_medias_por_loja?: number;
  skus_medios_por_loja?: number;
  movimentos_medios_por_loja?: number;
  dias_uteis_planejamento_mes?: number;
  horas_agendaveis_por_promotor_mes?: number;
  periodos_base_planejados_mes?: number;
  periodos_trabalho_em_equipe_mes?: number;
  reforco_simultaneo_maximo_promotores?: number;
  jornada_legal_horas_semana?: number;
  meses_com_venda?: number;
  periodo?: string;
  metrica_dimensionamento?: string;
  regra_dimensionamento?: string;
  carga_operacional_alta?: boolean;
  venda_media_mensal?: number;
};

type StatusFiltro = "sem-equipe" | "abaixo" | "adequada";
type Ordenacao = "deficit" | "necessidade" | "venda" | "cobertura";
type StatusPromotoresExecucao = {
  status?: string;
  gerado_em?: string | null;
  data_referencia?: string | null;
  resumo?: { total?: number; por_status?: Record<string, number> } | null;
};

const situacoes: Array<{ valor: StatusFiltro; rotulo: string }> = [
  { valor: "sem-equipe", rotulo: "Sem promotor" },
  { valor: "abaixo", rotulo: "Abaixo do necessário" },
  { valor: "adequada", rotulo: "Cobertura adequada" },
];

type SupplierRow = Supplier & {
  necessidade: number;
  presentes: number;
  deficit: number;
  cobertura: number | null;
  status: "sem-equipe" | "abaixo" | "adequada";
};

const numero = (valor: number | null | undefined) => (Number.isFinite(valor) ? Number(valor) : 0);

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const percentual = (valor: number | null) =>
  valor === null ? "—" : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

const horas = (valor: number) =>
  `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;

const decimal = (valor: number, casas = 1) =>
  valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const mediaDiaria = (valor: number, dias: number) => (dias > 0 ? valor / dias : 0);

const ocupacao = (row: Supplier | null | undefined) => {
  if (!row) return null;
  const necessidade = numero(row.promotores_necessarios_recomendados);
  const carga = numero(row.necessidade_operacional_horas_mes);
  const capacidade = numero(row.horas_agendaveis_por_promotor_mes);
  if (necessidade <= 0 || capacidade <= 0) return null;
  return (carga / (necessidade * capacidade)) * 100;
};

const inteiroStatus = (valor: number | null | undefined, disponivel?: boolean) =>
  disponivel && valor != null ? Math.max(0, Math.round(valor)).toLocaleString("pt-BR") : "—";

const dataHora = (valor: string | null | undefined) => {
  if (!valor) return "—";
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const dataReferencia = (valor: string | null | undefined) => {
  if (!valor) return "—";
  const [ano, mes] = valor.split("-");
  return ano && mes ? `${mes}/${ano}` : valor;
};

const compradoresDaLinha = (row: Supplier) =>
  row.compradores_ativos?.length ? row.compradores_ativos : ["Sem comprador"];

const escaparHtml = (valor: string | number) =>
  String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const departamentoExcluido = (valor: string) =>
  /PADARIA|FAST\s*FOOD|FASTFOOD|FOOD\s*SERVICE|FOODSERVICE/.test(
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleUpperCase(),
  );

function fornecedorExcluido(row: Supplier) {
  if (departamentoExcluido(row.descricao_fornecedor)) return true;
  return (row.departamentos_ativos ?? []).some((departamento) => {
    const codigo = String(departamento.codigo ?? "").replace(/\D/g, "");
    return (
      codigo === "105" ||
      departamentoExcluido(
        `${departamento.codigo ?? ""} ${departamento.descricao ?? ""} ${departamento.segmento ?? ""}`,
      )
    );
  });
}

function enriquecer(row: Supplier): SupplierRow {
  const necessidade = Math.max(0, Math.round(numero(row.promotores_necessarios_recomendados)));
  const presentes = Math.max(0, Math.round(numero(row.promotores_observados)));
  const deficit = Math.max(0, necessidade - presentes);
  const cobertura = necessidade > 0 ? Math.min(100, (presentes / necessidade) * 100) : null;
  const status =
    presentes === 0 && necessidade > 0 ? "sem-equipe" : deficit > 0 ? "abaixo" : "adequada";

  return { ...row, necessidade, presentes, deficit, cobertura, status };
}

function statusLabel(status: SupplierRow["status"]) {
  if (status === "sem-equipe") return "Sem promotor";
  if (status === "abaixo") return "Abaixo do necessário";
  return "Cobertura adequada";
}

function statusVariant(status: SupplierRow["status"]) {
  if (status === "sem-equipe" || status === "abaixo") return "destructive" as const;
  return "secondary" as const;
}

function Kpi({
  titulo,
  valor,
  detalhe,
  icone: Icon,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: typeof Users;
  destaque?: boolean;
}) {
  return (
    <Card
      className={destaque ? "border-destructive/30 bg-destructive/5 shadow-panel" : "shadow-panel"}
    >
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight">{valor}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function CalculoMetrica({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-base font-semibold">{valor}</p>
      {detalhe ? <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

function ControlePromotores() {
  const { usuarioInterno } = usePortal();
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [detalhesCalculo, setDetalhesCalculo] = useState<SupplierRow | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusFiltro[]>([]);
  const [modelo, setModelo] = useState("todos");
  const [segmento, setSegmento] = useState("todos");
  const [comprador, setComprador] = useState("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("deficit");
  const [pagina, setPagina] = useState(1);
  const [preferencias, setPreferencias] = useState<PreferenciaCalculoPromotor[]>([]);
  const [salvandoPreferencia, setSalvandoPreferencia] = useState<string | null>(null);
  const [statusExecucao, setStatusExecucao] = useState<StatusPromotoresExecucao | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const porPagina = 25;

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void fetchControlePromotoresResumo()
      .then((data) => {
        if (ativo) {
          setRows((data as Supplier[]).filter((row) => !fornecedorExcluido(row)).map(enriquecer));
        }
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a análise de promotores.",
        );
        setRows([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const carregarStatusExecucao = useCallback(async () => {
    if (usuarioInterno?.role !== "admin") return;
    try {
      const data = await fetchStatusPromotoresExecucao({});
      setStatusExecucao(data as StatusPromotoresExecucao);
    } catch (error) {
      console.error("Erro ao carregar status da extração de promotores:", error);
    }
  }, [usuarioInterno?.role]);

  useEffect(() => {
    void carregarStatusExecucao();
  }, [carregarStatusExecucao]);

  const forcarAtualizacaoStatus = useCallback(async () => {
    setAtualizandoStatus(true);
    try {
      await forcarAtualizacaoStatusPromotores({});
      toast.success("Atualização de promotores iniciada.", {
        description: "O relatório será atualizado em segundo plano.",
      });
      await carregarStatusExecucao();
      window.setTimeout(() => void carregarStatusExecucao(), 3000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível iniciar a atualização.",
      );
    } finally {
      setAtualizandoStatus(false);
    }
  }, [carregarStatusExecucao]);

  useEffect(() => {
    let ativo = true;
    void fetchPreferenciasCalculoPromotoresAdmin()
      .then((data) => {
        if (ativo) setPreferencias(data as PreferenciaCalculoPromotor[]);
      })
      .catch(() => {
        if (ativo) setPreferencias([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const decidirPreferencia = async (preferencia: PreferenciaCalculoPromotor, aprovada: boolean) => {
    setSalvandoPreferencia(preferencia.fornecedorCodigo);
    try {
      const data = await aprovarPreferenciaCalculoPromotor({
        data: {
          fornecedorCodigo: preferencia.fornecedorCodigo,
          periodicidade: preferencia.periodicidade,
          aprovada,
        },
      });
      const atualizada = data as PreferenciaCalculoPromotor;
      setPreferencias((atuais) =>
        atuais.map((item) =>
          item.fornecedorCodigo === atualizada.fornecedorCodigo ? atualizada : item,
        ),
      );
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Não foi possível atualizar a periodicidade.",
      );
    } finally {
      setSalvandoPreferencia(null);
    }
  };

  const segmentos = useMemo(
    () => [...new Set(rows.flatMap((row) => row.segmentos_ativos ?? []))].sort(),
    [rows],
  );
  const modelos = useMemo(
    () =>
      [
        ...new Set(
          rows.map(
            (row) => row.modelo_atendimento_rotulo ?? row.modelo_atendimento ?? "Não classificado",
          ),
        ),
      ].sort(),
    [rows],
  );
  const compradores = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => compradoresDaLinha(row)))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [rows],
  );

  const linhasFiltradas = useMemo(() => {
    const consulta = busca.trim().toLocaleLowerCase();
    const resultado = rows
      .filter((row) => status.length === 0 || status.includes(row.status))
      .filter(
        (row) =>
          modelo === "todos" ||
          (row.modelo_atendimento_rotulo ?? row.modelo_atendimento ?? "Não classificado") ===
            modelo,
      )
      .filter((row) => segmento === "todos" || (row.segmentos_ativos ?? []).includes(segmento))
      .filter((row) => comprador === "todos" || compradoresDaLinha(row).includes(comprador))
      .filter((row) =>
        !consulta
          ? true
          : `${row.fornecedor_codigo} ${row.fornecedor_codigo_exibicao ?? ""} ${row.descricao_fornecedor} ${(row.segmentos_ativos ?? []).join(" ")} ${compradoresDaLinha(row).join(" ")}`
              .toLocaleLowerCase()
              .includes(consulta),
      );

    return resultado.sort((a, b) => {
      if (ordenacao === "necessidade")
        return b.necessidade - a.necessidade || b.deficit - a.deficit;
      if (ordenacao === "venda") return numero(b.venda_media_mensal) - numero(a.venda_media_mensal);
      if (ordenacao === "cobertura") return (a.cobertura ?? 0) - (b.cobertura ?? 0);
      return b.deficit - a.deficit || b.necessidade - a.necessidade;
    });
  }, [busca, comprador, modelo, ordenacao, rows, segmento, status]);

  useEffect(() => {
    setPagina(1);
  }, [busca, comprador, modelo, ordenacao, segmento, status]);

  const resumo = useMemo(() => {
    const fornecedoresComNecessidade = rows.filter((row) => row.necessidade > 0).length;
    const semEquipe = rows.filter((row) => row.status === "sem-equipe").length;
    const abaixo = rows.filter((row) => row.status === "abaixo").length;
    const necessidade = rows.reduce((total, row) => total + row.necessidade, 0);
    const presentes = rows.reduce((total, row) => total + row.presentes, 0);
    const deficit = rows.reduce((total, row) => total + row.deficit, 0);
    return { fornecedoresComNecessidade, semEquipe, abaixo, necessidade, presentes, deficit };
  }, [rows]);

  const totalPaginas = Math.max(1, Math.ceil(linhasFiltradas.length / porPagina));
  const linhasPagina = linhasFiltradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  const coberturaGeral =
    resumo.necessidade > 0 ? (resumo.presentes / resumo.necessidade) * 100 : null;
  const statusOperacional = useMemo(() => {
    const linhasComFonte = rows.filter((row) => row.promotores_status_disponivel);
    if (!linhasComFonte.length) return null;
    const primeira = linhasComFonte[0];
    if (!primeira) return null;
    return {
      geradoEm: primeira.promotores_status_gerado_em,
      dataReferencia: primeira.promotores_status_data_referencia,
      fornecedoresComFonte: linhasComFonte.length,
      semPresenca: linhasComFonte.reduce(
        (total, row) => total + numero(row.promotores_status_sem_presenca_mes_anterior),
        0,
      ),
      foraDoSistema: linhasComFonte.reduce(
        (total, row) => total + numero(row.promotores_status_fora_do_sistema),
        0,
      ),
    };
  }, [rows]);
  const resumoStatusPromotores = statusExecucao?.resumo?.por_status ?? {};
  const semPresencaAnterior =
    Number(
      statusOperacional?.semPresenca ?? resumoStatusPromotores.SEM_PRESENCA_MES_ANTERIOR ?? 0,
    ) + Number(resumoStatusPromotores.DIVERGENTE ?? 0);
  const statusCardDisponivel = Boolean(
    statusOperacional || statusExecucao?.status === "DISPONIVEL",
  );

  const imprimirRelacao = () => {
    const janela = window.open("", "_blank", "width=1400,height=900");
    if (!janela) {
      window.print();
      return;
    }

    const filtros = [
      segmento !== "todos" ? `Segmento: ${segmento}` : "Todos os segmentos",
      comprador !== "todos" ? `Comprador: ${comprador}` : "Todos os compradores",
      status.length > 0
        ? `Situação: ${status.map((item) => statusLabel(item)).join(", ")}`
        : "Todas as situações",
    ].join(" · ");
    const linhasImpressao = linhasFiltradas
      .map(
        (row) => `<tr>
          <td><strong>${escaparHtml(row.descricao_fornecedor)}</strong><br><small>${escaparHtml(row.fornecedor_codigo_exibicao ?? row.fornecedor_codigo)}</small></td>
          <td>${escaparHtml((row.segmentos_ativos ?? []).join(" · ") || "—")}<br><small>${escaparHtml(row.modelo_atendimento_rotulo ?? row.modelo_atendimento ?? "Não classificado")}</small></td>
          <td>${escaparHtml(compradoresDaLinha(row).join(", "))}</td>
          <td class="num">${escaparHtml(moeda(numero(row.venda_media_mensal)))}</td>
          <td class="num">${escaparHtml(moeda(mediaDiaria(numero(row.venda_media_mensal), numero(row.dias_uteis_planejamento_mes))))}</td>
          <td class="num">${escaparHtml(decimal(mediaDiaria(numero(row.itens_movimentados_mes), numero(row.dias_uteis_planejamento_mes)), 0))}</td>
          <td class="num">${escaparHtml(decimal(numero(row.skus_medios_por_loja), 0))}</td>
          <td class="num">${escaparHtml(horas(numero(row.necessidade_operacional_horas_mes)))}</td>
          <td class="num">${numero(row.promotores_necessarios_calculados).toLocaleString("pt-BR")}</td>
          <td class="num">${row.presentes}</td>
          <td class="num">${row.necessidade}</td>
          <td class="num">${numero(row.reforco_simultaneo_maximo_promotores).toLocaleString("pt-BR")}</td>
          <td class="num">${escaparHtml(percentual(row.cobertura))}</td>
          <td>${escaparHtml(statusLabel(row.status))}</td>
        </tr>`,
      )
      .join("");

    janela.document
      .write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise de Promotores</title><style>
      @page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17261b;font-size:9px;margin:0}h1{font-size:20px;margin:0 0 4px}p{color:#526257;margin:0 0 14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd8cd;padding:5px 4px;text-align:left;vertical-align:top}th{background:#edf4ee;font-size:8px;text-transform:uppercase;letter-spacing:.03em}td.num{text-align:right;white-space:nowrap}small{color:#526257;font-family:monospace}</style></head><body><h1>Análise de Promotores · memória de cálculo</h1><p>${escaparHtml(filtros)} · ${linhasFiltradas.length} fornecedor(es) · médias diárias usam os dias úteis do período.</p><table><thead><tr><th>Fornecedor</th><th>Segmento / modelo</th><th>Comprador</th><th>Venda mensal</th><th>Venda/dia</th><th>Itens/dia</th><th>SKUs/loja</th><th>Carga h/mês</th><th>Calculados</th><th>Ativos</th><th>Recomendados</th><th>Pico simultâneo</th><th>Cobertura</th><th>Situação</th></tr></thead><tbody>${linhasImpressao || '<tr><td colspan="14">Nenhum fornecedor encontrado para os filtros selecionados.</td></tr>'}</tbody></table></body></html>`);
    janela.document.close();
    janela.focus();
    janela.setTimeout(() => {
      janela.print();
      janela.close();
    }, 250);
  };

  const alternarSituacao = (valor: StatusFiltro) => {
    setStatus((atual) =>
      atual.includes(valor) ? atual.filter((item) => item !== valor) : [...atual, valor],
    );
  };

  const rotuloSituacao =
    status.length === 0
      ? "Todas as situações"
      : status.length === 1
        ? statusLabel(status[0] ?? "adequada")
        : `${status.length} situações selecionadas`;

  const detalheDias = numero(detalhesCalculo?.dias_uteis_planejamento_mes);
  const detalheVendaDiaria = mediaDiaria(numero(detalhesCalculo?.venda_media_mensal), detalheDias);
  const detalheItensDiarios = mediaDiaria(
    numero(detalhesCalculo?.itens_movimentados_mes),
    detalheDias,
  );
  const detalheCargaPorPromotor =
    numero(detalhesCalculo?.promotores_necessarios_recomendados) > 0
      ? numero(detalhesCalculo?.necessidade_operacional_horas_mes) /
        numero(detalhesCalculo?.promotores_necessarios_recomendados)
      : 0;
  const detalheOcupacao = ocupacao(detalhesCalculo);

  return (
    <PortalLayout
      titulo="Análise de Promotores"
      descricao="Encontre rapidamente os fornecedores sem equipe ou abaixo da cobertura recomendada."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" /> Somente usuários administrativos · necessidade estimada
          pela agenda e pelo mix
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi
            titulo="Fornecedores analisados"
            valor={rows.length.toLocaleString("pt-BR")}
            detalhe={`${resumo.fornecedoresComNecessidade} com necessidade de cobertura`}
            icone={ClipboardList}
          />
          <Kpi
            titulo="Sem promotor"
            valor={resumo.semEquipe.toLocaleString("pt-BR")}
            detalhe="Necessidade maior que zero e nenhum ativo no período anterior"
            icone={AlertTriangle}
            destaque
          />
          <Kpi
            titulo="Abaixo do necessário"
            valor={resumo.abaixo.toLocaleString("pt-BR")}
            detalhe={`${resumo.deficit} promotor(es) de déficit agregado`}
            icone={TrendingDown}
            destaque
          />
          <Kpi
            titulo="Cobertura atual"
            valor={percentual(coberturaGeral)}
            detalhe={`${resumo.presentes} ativos no período anterior de ${resumo.necessidade} recomendados`}
            icone={Users}
          />
          <Kpi
            titulo="Visitas planejadas"
            valor={rows
              .reduce((total, row) => total + numero(row.visitas_planejadas_mes), 0)
              .toLocaleString("pt-BR")}
            detalhe="Cadência mensal da agenda"
            icone={CalendarDays}
          />
        </div>

        {statusCardDisponivel ? (
          <Card className="border-primary/20 bg-primary/5 shadow-panel">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-muted-foreground">
              <div>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <RefreshCw className="size-4 text-primary" />
                  Status operacional dos promotores
                </div>
                <p className="mt-1">
                  Cadastro: <strong className="text-foreground">sislider.dbo.Promotores</strong> ·
                  presença do mês anterior: <strong className="text-foreground">Fluig</strong>.
                  Período de referência:{" "}
                  {dataReferencia(
                    statusOperacional?.dataReferencia ?? statusExecucao?.data_referencia,
                  )}{" "}
                  · {statusOperacional?.fornecedoresComFonte ?? 0}/{rows.length} fornecedores
                  conciliados.
                </p>
                <p className="mt-2">
                  Último snapshot:{" "}
                  {dataHora(statusOperacional?.geradoEm ?? statusExecucao?.gerado_em)} ·{" "}
                  {Number(statusExecucao?.resumo?.total ?? 0).toLocaleString("pt-BR")} cadastrados ·{" "}
                  {Number(resumoStatusPromotores.ATIVO ?? 0).toLocaleString("pt-BR")} com presença ·{" "}
                  {semPresencaAnterior.toLocaleString("pt-BR")} sem presença anterior ·{" "}
                  {Number(statusOperacional?.foraDoSistema ?? 0).toLocaleString("pt-BR")} fora do
                  sistema
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void forcarAtualizacaoStatus()}
                disabled={usuarioInterno?.role !== "admin" || atualizandoStatus}
              >
                <RefreshCw className={atualizandoStatus ? "animate-spin" : undefined} />
                {atualizandoStatus ? "Iniciando..." : "Atualizar agora"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {preferencias.length ? (
          <Card className="border-amber-300/70 bg-amber-50/50 shadow-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Solicitações de periodicidade</CardTitle>
              <CardDescription>
                A aprovação congela somente a publicação do fornecedor no modo mensal. O modo diário
                continua recalculando no ciclo de atualização. Uma agenda já publicada não é apagada
                pela troca de preferência.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {preferencias.map((preferencia) => (
                <div
                  key={preferencia.fornecedorCodigo}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {preferencia.fornecedorNome || "Fornecedor sem nome"} ·{" "}
                      <span className="font-mono text-xs">{preferencia.fornecedorCodigo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {preferencia.periodicidade === "MENSAL" ? "Cálculo mensal" : "Cálculo diário"}{" "}
                      ·{" "}
                      {preferencia.status === "PENDENTE"
                        ? "aguarda aprovação"
                        : preferencia.status === "APROVADA"
                          ? "aprovado"
                          : preferencia.status === "REJEITADA"
                            ? "rejeitado"
                            : "sem solicitação"}
                      {preferencia.observacao ? ` · ${preferencia.observacao}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={preferencia.status === "APROVADA" ? "secondary" : "default"}
                      disabled={
                        usuarioInterno?.role !== "admin" ||
                        salvandoPreferencia === preferencia.fornecedorCodigo
                      }
                      onClick={() => void decidirPreferencia(preferencia, true)}
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        usuarioInterno?.role !== "admin" ||
                        salvandoPreferencia === preferencia.fornecedorCodigo
                      }
                      onClick={() => void decidirPreferencia(preferencia, false)}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="controle-promotores-busca">Buscar fornecedor</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="controle-promotores-busca"
                  className="pl-9"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Nome, código ou segmento..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between font-normal"
                  >
                    <span className="truncate">{rotuloSituacao}</span>
                    <Filter className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="z-50 w-[260px] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Filtrar por situação</p>
                    {status.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setStatus([])}
                      >
                        Limpar
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {situacoes.map((situacao) => {
                      const id = `controle-promotores-situacao-${situacao.valor}`;
                      return (
                        <div key={situacao.valor} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={status.includes(situacao.valor)}
                            onCheckedChange={() => alternarSituacao(situacao.valor)}
                          />
                          <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                            {situacao.rotulo}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os segmentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os segmentos</SelectItem>
                  {segmentos.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comprador</Label>
              <Select value={comprador} onValueChange={setComprador}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os compradores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os compradores</SelectItem>
                  {compradores.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <Select value={ordenacao} onValueChange={(value) => setOrdenacao(value as Ordenacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deficit">Maior déficit primeiro</SelectItem>
                  <SelectItem value="necessidade">Maior necessidade</SelectItem>
                  <SelectItem value="venda">Maior venda média</SelectItem>
                  <SelectItem value="cobertura">Menor cobertura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label>Modelo de atendimento</Label>
              <Select value={modelo} onValueChange={setModelo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os modelos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os modelos</SelectItem>
                  {modelos.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {erro ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-5 text-sm text-destructive">{erro}</CardContent>
          </Card>
        ) : null}

        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Fornecedores que precisam de cobertura</CardTitle>
                <CardDescription>
                  A necessidade é a recomendação mensal do modelo de atendimento. Ativos são os
                  promotores com presença no mês anterior; os demais ficam identificados por
                  situação. Padaria e Food Service não entram nesta análise.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={imprimirRelacao}
                  disabled={carregando}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="size-3.5" /> Imprimir relação
                </button>
                <Badge variant="outline" className="gap-1">
                  <Filter className="size-3" />{" "}
                  {carregando ? "Atualizando..." : `${linhasFiltradas.length} fornecedor(es)`}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Segmento / modelo</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead className="text-right">Venda mensal</TableHead>
                  <TableHead className="text-right">Necessários</TableHead>
                  <TableHead className="text-right">Ativos no período anterior</TableHead>
                  <TableHead className="text-right">Sem presença anterior</TableHead>
                  <TableHead className="text-right">Fora do sistema</TableHead>
                  <TableHead className="text-right">Déficit</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead className="text-right">Visitas/mês</TableHead>
                  <TableHead className="text-right">Horas necessárias</TableHead>
                  <TableHead>Memória</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasPagina.map((row) => (
                  <TableRow key={row.fornecedor_codigo}>
                    <TableCell>
                      <div className="max-w-[18rem] truncate font-medium">
                        {row.descricao_fornecedor}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {row.fornecedor_codigo_exibicao ?? row.fornecedor_codigo}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[15rem] truncate text-xs">
                        {(row.segmentos_ativos ?? []).join(" · ") || "—"}
                      </div>
                      <div className="max-w-[15rem] truncate text-[10px] text-muted-foreground">
                        {row.modelo_atendimento_rotulo ??
                          row.modelo_atendimento ??
                          "Não classificado"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[14rem] truncate text-xs">
                        {compradoresDaLinha(row).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {moeda(numero(row.venda_media_mensal))}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{row.necessidade}</TableCell>
                    <TableCell className="text-right">{row.presentes}</TableCell>
                    <TableCell className="text-right">
                      {inteiroStatus(
                        row.promotores_status_sem_presenca_mes_anterior,
                        row.promotores_status_disponivel,
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {inteiroStatus(
                        row.promotores_status_fora_do_sistema,
                        row.promotores_status_disponivel,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {row.deficit || "—"}
                    </TableCell>
                    <TableCell className="text-right">{percentual(row.cobertura)}</TableCell>
                    <TableCell className="text-right">
                      {numero(row.visitas_planejadas_mes).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {horas(numero(row.necessidade_operacional_horas_mes))}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2 text-xs"
                        onClick={() => setDetalhesCalculo(row)}
                      >
                        <Eye className="size-3.5" /> Ver cálculo
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {linhasPagina.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="py-8 text-center text-muted-foreground">
                      Nenhum fornecedor encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Exibindo {linhasFiltradas.length ? (pagina - 1) * porPagina + 1 : 0}–
            {Math.min(pagina * porPagina, linhasFiltradas.length)} de {linhasFiltradas.length}
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-1.5 disabled:opacity-50"
              disabled={pagina === 1}
              onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
            >
              Anterior
            </button>
            <button
              className="rounded-md border px-3 py-1.5 disabled:opacity-50"
              disabled={pagina === totalPaginas}
              onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
            >
              Próxima
            </button>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5 shadow-panel">
          <CardContent className="flex gap-3 pt-5 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Use primeiro os filtros <strong className="text-foreground">Sem promotor</strong> e{" "}
              <strong className="text-foreground">Abaixo do necessário</strong>. A recomendação é um
              sinal de planejamento: confirme a contratação, a escala e a presença no sistema de
              acessos antes de tomar uma decisão comercial.
            </p>
          </CardContent>
        </Card>

        <Dialog
          open={Boolean(detalhesCalculo)}
          onOpenChange={(aberto) => !aberto && setDetalhesCalculo(null)}
        >
          <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
            {detalhesCalculo ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calculator className="size-5 text-primary" /> Memória de cálculo ·{" "}
                    {detalhesCalculo.descricao_fornecedor}
                  </DialogTitle>
                  <DialogDescription>
                    Código{" "}
                    {detalhesCalculo.fornecedor_codigo_exibicao ??
                      detalhesCalculo.fornecedor_codigo}
                    {" · período "}
                    {detalhesCalculo.periodo ?? "não informado"}. Os valores mostram a origem da
                    recomendação, sem esconder o piso de equipe observado.
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(detalhesCalculo.status)}>
                    {statusLabel(detalhesCalculo.status)}
                  </Badge>
                  {detalhesCalculo.carga_operacional_alta ? (
                    <Badge variant="outline">Carga operacional alta</Badge>
                  ) : null}
                  <Badge variant="outline">
                    Histórico: {numero(detalhesCalculo.meses_com_venda)} mês(es) de vendas
                  </Badge>
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Demanda utilizada</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <CalculoMetrica
                      titulo="Venda média mensal"
                      valor={moeda(numero(detalhesCalculo.venda_media_mensal))}
                      detalhe={moeda(detalheVendaDiaria) + " por dia útil"}
                    />
                    <CalculoMetrica
                      titulo="Itens movimentados"
                      valor={numero(detalhesCalculo.itens_movimentados_mes).toLocaleString("pt-BR")}
                      detalhe={decimal(detalheItensDiarios, 0) + " itens por dia útil"}
                    />
                    <CalculoMetrica
                      titulo="SKUs médios por loja"
                      valor={decimal(numero(detalhesCalculo.skus_medios_por_loja), 0)}
                      detalhe={
                        decimal(numero(detalhesCalculo.movimentos_medios_por_loja), 0) +
                        " movimentos médios"
                      }
                    />
                    <CalculoMetrica
                      titulo="Visitas planejadas"
                      valor={numero(detalhesCalculo.visitas_planejadas_mes).toLocaleString("pt-BR")}
                      detalhe={
                        numero(detalhesCalculo.dias_uteis_planejamento_mes).toLocaleString(
                          "pt-BR",
                        ) + " dias úteis no período"
                      }
                    />
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Carga e capacidade</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <CalculoMetrica
                      titulo="Carga operacional"
                      valor={horas(numero(detalhesCalculo.necessidade_operacional_horas_mes))}
                      detalhe={horas(detalheCargaPorPromotor) + " por promotor recomendado"}
                    />
                    <CalculoMetrica
                      titulo="Capacidade por promotor"
                      valor={horas(numero(detalhesCalculo.horas_agendaveis_por_promotor_mes))}
                      detalhe={
                        numero(detalhesCalculo.jornada_legal_horas_semana).toLocaleString("pt-BR") +
                        "h semanais legais informadas"
                      }
                    />
                    <CalculoMetrica
                      titulo="Ocupação da equipe recomendada"
                      valor={percentual(detalheOcupacao)}
                      detalhe="Carga operacional ÷ capacidade disponível"
                    />
                    <CalculoMetrica
                      titulo="Reforço simultâneo máximo"
                      valor={numero(
                        detalhesCalculo.reforco_simultaneo_maximo_promotores,
                      ).toLocaleString("pt-BR")}
                      detalhe={
                        numero(detalhesCalculo.periodos_trabalho_em_equipe_mes).toLocaleString(
                          "pt-BR",
                        ) + " período(s) de trabalho em equipe"
                      }
                    />
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Decisão da recomendação</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <CalculoMetrica
                      titulo="Necessidade calculada"
                      valor={numero(
                        detalhesCalculo.promotores_necessarios_calculados,
                      ).toLocaleString("pt-BR")}
                      detalhe="Demanda, cadência, SKUs, unidades e geografia"
                    />
                    <CalculoMetrica
                      titulo="Equipe ativa no período anterior"
                      valor={numero(detalhesCalculo.promotores_observados).toLocaleString("pt-BR")}
                      detalhe="Presença canônica conciliada"
                    />
                    <CalculoMetrica
                      titulo="Piso adotado"
                      valor={numero(detalhesCalculo.promotores_observados_adotados).toLocaleString(
                        "pt-BR",
                      )}
                      detalhe="Não reduz equipe observada sem validação"
                    />
                    <CalculoMetrica
                      titulo="Recomendação final"
                      valor={numero(
                        detalhesCalculo.promotores_necessarios_recomendados,
                      ).toLocaleString("pt-BR")}
                      detalhe="Maior entre cálculo operacional e piso adotado"
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <CalculoMetrica
                      titulo="Carteiras capital/metropolitana"
                      valor={numero(detalhesCalculo.promotores_geografia_capital).toLocaleString(
                        "pt-BR",
                      )}
                      detalhe="Não compartilham carteira com o interior"
                    />
                    <CalculoMetrica
                      titulo="Carteiras interior"
                      valor={numero(detalhesCalculo.promotores_geografia_interior).toLocaleString(
                        "pt-BR",
                      )}
                      detalhe={`${numero(detalhesCalculo.unidades_interior_acima_30_sm).toLocaleString("pt-BR")} unidade(s) acima de ${numero(detalhesCalculo.salarios_minimos_por_unidade_interior) || 30} SM com reserva própria`}
                    />
                    <CalculoMetrica
                      titulo="Piso por unidade interior"
                      valor={moeda(numero(detalhesCalculo.venda_minima_unidade_interior))}
                      detalhe="Venda mensal mínima para reservar um promotor"
                    />
                  </div>
                </section>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Como ler este resultado</p>
                  <p className="mt-1">
                    A carga é convertida em horas de trabalho. A equipe necessária é comparada com a
                    presença efetivamente observada; quando o fornecedor já possui uma equipe
                    comprovada maior, ela permanece como piso até que exista evidência para uma
                    revisão. O deslocamento só entra quando há transição entre lojas na agenda.
                  </p>
                  <p className="mt-2 text-xs">
                    Métrica: {detalhesCalculo.metrica_dimensionamento ?? "não informada"}. Histórico
                    disponível: {numero(detalhesCalculo.meses_com_venda)} mês(es); anos de
                    relacionamento do fornecedor ainda não estão disponíveis nessa fonte e não são
                    usados como multiplicador automático.
                  </p>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </PortalLayout>
  );
}
