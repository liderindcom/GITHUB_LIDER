import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Package,
  PackagePlus,
  PiggyBank,
  Search,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { PortalLayout } from "@/components/portal-layout";
import { usePortal } from "@/context/portal-context";
import {
  fetchAtualizacaoDadosFornecedor,
  fetchComprasAno,
  fetchVendasPorLoja,
  type AtualizacaoDadosFornecedorDB,
  type ComprasAnoDB,
  type VendasPorLojaDB,
} from "@/api";
import { Input } from "@/components/ui/input";
import { filtroMercadologicoAtivo } from "@/lib/filtro-mercadologico";
import { brl, dataBR, dataHoraBR, numero, percentual } from "@/lib/format";
import {
  codigoProdutoComDigito,
  estoque,
  estoqueMinimoCalculado,
  faturasDoFornecedor,
  lojas,
  nomeLoja,
  nomeLojaPorLocal,
  produtos,
  produtoPorSku,
  statusEstoque,
} from "@/lib/mock-data";
import { mesFechadoIso, rotuloMesAno } from "@/lib/pedidos-janela";
import { calcularSugestoesCompraCdam } from "@/lib/sugestao-compra";
import { lojaForaRelatorioVendas } from "@/lib/lojas-excluidas-vendas";

export const Route = createFileRoute("/_portal/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do Fornecedor | Grupo Líder" },
      {
        name: "description",
        content: "Alertas de ruptura, agendamentos pendentes e previsão de pagamentos.",
      },
      { property: "og:title", content: "Dashboard do Fornecedor | Grupo Líder" },
      {
        property: "og:description",
        content: "Visão geral das compras do Grupo Líder, estoque e financeiro do fornecedor.",
      },
    ],
  }),
  component: Dashboard,
});

const MESES_CURTO = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const tons = {
  danger: {
    wrap: "border-danger/40 bg-danger-soft/40 hover:border-danger",
    icon: "bg-danger/20 text-danger",
  },
  warning: {
    wrap: "border-warning/40 bg-warning-soft/30 hover:border-warning",
    icon: "bg-warning/20 text-warning",
  },
  success: {
    wrap: "border-success/40 bg-success-soft/30 hover:border-success",
    icon: "bg-success/20 text-success",
  },
};

function TooltipPedidoEntrega({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const pedido = Number(
    payload.find((p) => p.dataKey === "pedido" || p.name === "Pedido do Líder")?.value ?? 0,
  );
  const entregue = Number(
    payload.find((p) => p.dataKey === "entregue" || p.name === "Entregue")?.value ?? 0,
  );
  const diferenca = pedido - entregue;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-semibold">{label}</p>
      <p>Pedido do Líder: {brl(pedido)}</p>
      <p>Entregue: {brl(entregue)}</p>
      <p className={diferenca > 0 ? "font-semibold text-danger" : "font-semibold text-success"}>
        Diferença: {brl(diferenca)}
      </p>
    </div>
  );
}

function Painel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={`glow-ember rounded-3xl border border-border bg-card/70 p-5 shadow-panel backdrop-blur-xl transition-transform hover:-translate-y-0.5 ${className}`}
    >
      {children}
    </section>
  );
}

function alertaDaCarga(dados: AtualizacaoDadosFornecedorDB | null): string | null {
  if (!dados) return "carga sem registro";
  // A execução global pode ter falhas parciais. O alerta do Dashboard deve
  // refletir o fornecedor selecionado, sem penalizar quem concluiu com sucesso.
  if (dados.status === "FALHA") return "carga com falha";
  if (dados.status !== "SUCESSO" && dados.execucaoStatus === "FALHA") {
    return "carga com falha";
  }
  if (dados.execucaoStatus === "INICIADO") {
    const inicio = dados.execucaoInicioEm ? new Date(dados.execucaoInicioEm).getTime() : 0;
    if (!inicio || Date.now() - inicio > 2 * 60 * 60 * 1000) return "carga travada";
    return "carga em andamento";
  }
  if (!dados.ultimoSucessoEm) return "carga sem sucesso registrado";
  const sucesso = new Date(dados.ultimoSucessoEm).getTime();
  if (!sucesso || Date.now() - sucesso > 26 * 60 * 60 * 1000) return "carga atrasada";
  return null;
}

function Dashboard() {
  const navigate = useNavigate();
  const { fornecedor, codigoFornecedorAtivo, dadosFornecedorVersao, filtroMercadologico } =
    usePortal();
  const ateMesPadrao = mesFechadoIso();
  const [comprasAno, setComprasAno] = useState<ComprasAnoDB | null>(null);
  const [vendasPorLoja, setVendasPorLoja] = useState<VendasPorLojaDB | null>(null);
  const [atualizacaoDados, setAtualizacaoDados] = useState<AtualizacaoDadosFornecedorDB | null>(
    null,
  );
  const [buscaLoja, setBuscaLoja] = useState("");
  const alertaCarga = alertaDaCarga(atualizacaoDados);
  const mixAtivo = filtroMercadologicoAtivo(filtroMercadologico);
  const rotuloMix = [
    filtroMercadologico.segmento,
    filtroMercadologico.departamento,
    filtroMercadologico.secao,
    filtroMercadologico.grupo,
    filtroMercadologico.subgrupo,
    filtroMercadologico.comprador,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    let ativo = true;
    fetchComprasAno({
      data: {
        fornecedorCodigo: codigoFornecedorAtivo,
        ano: Number(ateMesPadrao.slice(0, 4)),
        filtro: filtroMercadologico,
      },
    })
      .then((dados) => {
        if (ativo) setComprasAno(dados);
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setComprasAno(null);
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, ateMesPadrao, dadosFornecedorVersao, filtroMercadologico]);

  useEffect(() => {
    let ativo = true;
    fetchVendasPorLoja({
      data: {
        fornecedorCodigo: codigoFornecedorAtivo,
        filtro: filtroMercadologico,
      },
    })
      .then((dados) => {
        if (ativo) setVendasPorLoja(dados);
      })
      .catch((err) => {
        console.error("Erro ao carregar vendas por loja:", err);
        if (ativo) setVendasPorLoja(null);
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, dadosFornecedorVersao, filtroMercadologico]);

  useEffect(() => {
    let ativo = true;
    fetchAtualizacaoDadosFornecedor({ data: codigoFornecedorAtivo })
      .then((dados) => {
        if (ativo) setAtualizacaoDados(dados);
      })
      .catch((err) => {
        console.error("Erro ao carregar a data da atualização dos dados:", err);
        if (ativo) setAtualizacaoDados(null);
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, dadosFornecedorVersao]);

  const pedidoAno = comprasAno?.pedido ?? 0;
  const entregueAno = comprasAno?.entregue ?? 0;
  const perdaAno = comprasAno?.perda ?? 0;
  const pedidosAno = comprasAno?.documentos ?? 0;
  const pedidosEmAberto = comprasAno?.documentosEmAberto ?? 0;
  const fillRatePct = pedidoAno > 0 ? (entregueAno / pedidoAno) * 100 : 100;
  const ateMes = comprasAno?.ateMes ?? ateMesPadrao;
  const ano = comprasAno?.ano ?? Number(ateMes.slice(0, 4));
  const mesLimite = Number(ateMes.slice(5, 7)) || 12;
  const rotuloAte = rotuloMesAno(ateMes);

  const comprasMensais = useMemo(() => {
    const porMes = MESES_CURTO.map((rotulo) => ({
      mes: `${rotulo}/${String(ano).slice(2)}`,
      pedido: 0,
      entregue: 0,
      perda: 0,
    }));
    for (const item of comprasAno?.meses ?? []) {
      const mes = Number((item.mes || "").slice(5, 7));
      if (mes >= 1 && mes <= mesLimite) {
        const ponto = porMes[mes - 1];
        if (ponto) {
          ponto.pedido += Number(item.pedido || 0);
          ponto.entregue += Number(item.entregue || 0);
          ponto.perda += Number(item.perda || 0);
        }
      }
    }
    return porMes;
  }, [comprasAno, ano, mesLimite]);

  const vendasLojasResumo = useMemo(() => {
    const porLoja = new Map<
      string,
      { lojaId: string; nome: string; faturamento: number; quantidade: number }
    >();
    for (const loja of lojas.filter(
      (item) => item.tipo !== "D" && !lojaForaRelatorioVendas(item.id),
    )) {
      porLoja.set(loja.id, { lojaId: loja.id, nome: loja.nome, faturamento: 0, quantidade: 0 });
    }
    const idsPorReferencia = new Map<string, string>();
    for (const loja of lojas) {
      idsPorReferencia.set(loja.id, loja.id);
      idsPorReferencia.set(loja.idLocal, loja.id);
    }
    for (const linha of vendasPorLoja?.linhas ?? []) {
      const lojaId = idsPorReferencia.get(String(linha.lojaId)) ?? String(linha.lojaId);
      const atual = porLoja.get(lojaId) ?? {
        lojaId,
        nome: nomeLoja(String(linha.lojaId)),
        faturamento: 0,
        quantidade: 0,
      };
      atual.faturamento += Number(linha.faturamento || 0);
      atual.quantidade += Number(linha.quantidade || 0);
      porLoja.set(lojaId, atual);
    }
    return [...porLoja.values()].sort(
      (a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [vendasPorLoja]);

  const vendasLojasFiltradas = useMemo(() => {
    const termo = buscaLoja.trim().toLowerCase();
    if (!termo) return vendasLojasResumo;
    return vendasLojasResumo.filter((loja) =>
      `${loja.nome} ${loja.lojaId}`.toLowerCase().includes(termo),
    );
  }, [buscaLoja, vendasLojasResumo]);
  const faturamentoPorLoja = vendasLojasResumo.reduce((acc, loja) => acc + loja.faturamento, 0);
  const quantidadePorLoja = vendasLojasResumo.reduce((acc, loja) => acc + loja.quantidade, 0);
  const rupturas = estoque.filter((e) => statusEstoque(e) !== "Confortável");
  const skusMonitorados = new Set(estoque.map((e) => e.sku)).size;
  const lojasComEstoque = new Set(estoque.map((e) => e.lojaId)).size;
  const skusEmRisco = new Set(rupturas.map((r) => r.sku)).size;
  const lojasEmRisco = new Set(rupturas.map((r) => r.lojaId)).size;
  const rupturasPorSku = useMemo(() => {
    const porSku = new Map<string, { sku: string; descricao: string; lojas: number }>();
    rupturas
      .filter((linha) => statusEstoque(linha) === "Ruptura")
      .forEach((linha) => {
        const atual = porSku.get(linha.sku);
        if (atual) {
          atual.lojas += 1;
          return;
        }
        porSku.set(linha.sku, {
          sku: linha.sku,
          descricao: produtoPorSku(linha.sku).descricao,
          lojas: 1,
        });
      });
    return Array.from(porSku.values()).sort(
      (a, b) => b.lojas - a.lojas || a.descricao.localeCompare(b.descricao),
    );
  }, [rupturas, dadosFornecedorVersao, fornecedor.codigo]);
  const produtosComRuptura = rupturasPorSku;
  const lojasEmRuptura = new Set(
    rupturas.filter((linha) => statusEstoque(linha) === "Ruptura").map((linha) => linha.lojaId),
  ).size;
  const topStars = useMemo(
    () =>
      produtos
        .filter((produto) => produto.classeTopStar === "Aa")
        .map((produto) => ({
          sku: produto.sku,
          descricao: produto.descricao,
          emRuptura: rupturas.some(
            (linha) => linha.sku === produto.sku && statusEstoque(linha) === "Ruptura",
          ),
        }))
        .sort(
          (a, b) =>
            Number(b.emRuptura) - Number(a.emRuptura) || a.descricao.localeCompare(b.descricao),
        ),
    [rupturas, dadosFornecedorVersao, fornecedor.codigo],
  );
  const sugestoesCompra = useMemo(() => {
    void dadosFornecedorVersao;
    return calcularSugestoesCompraCdam("30").filter((linha) => linha.sugestaoCompra > 0);
  }, [dadosFornecedorVersao]);
  const compradoresSugestao = new Set(sugestoesCompra.map((linha) => linha.comprador));
  const embalagensSugeridas = sugestoesCompra.reduce(
    (acc, linha) => acc + linha.quantidadeEmbalagens,
    0,
  );
  const valorSugerido = sugestoesCompra.reduce((acc, linha) => acc + linha.valorSugerido, 0);

  const titulosAbertos = faturasDoFornecedor().filter((f) => f.status === "A vencer");
  const proximoPagamento = [...titulosAbertos].sort((a, b) =>
    a.dataPagamento.localeCompare(b.dataPagamento),
  )[0];
  const alertaFinanceiro = proximoPagamento
    ? `Previsão de ${brl(proximoPagamento.valorLiquido)} em ${dataBR(proximoPagamento.dataPagamento)} (${fornecedor.cadastroFinanceiro.prazoTipo ?? "cadastro"}).`
    : "Sem notas em aberto do fornecedor para o Grupo Líder.";

  const alertas = [
    {
      tom: "danger" as const,
      icone: AlertTriangle,
      titulo: "Ruptura de estoque",
      texto: `${skusEmRisco} produtos abaixo do mínimo em ${lojasEmRisco} lojas.`,
      destino: "/estoque" as const,
    },
    {
      tom: sugestoesCompra.length > 0 ? ("warning" as const) : ("success" as const),
      icone: PackagePlus,
      titulo: "Pedido sugerido",
      texto:
        sugestoesCompra.length > 0
          ? `${numero(embalagensSugeridas)} embalagens para ${fornecedor.nome} · ${compradoresSugestao.size} comprador(es) · ${brl(valorSugerido)} · inclui lead time médio.`
          : "Sem sugestão de compra CDAM para os Best Sellers no momento.",
      destino: "/sugestao-compra" as const,
    },
    {
      tom: "warning" as const,
      icone: CalendarClock,
      titulo: "Notas fiscais",
      texto: "2 NF-e aguardando agendamento logístico.",
      destino: "/logistica" as const,
    },
    {
      tom: "success" as const,
      icone: PiggyBank,
      titulo: "Financeiro",
      texto: alertaFinanceiro,
      destino: "/financeiro" as const,
    },
  ];

  return (
    <PortalLayout
      titulo={
        <span className="inline-flex min-w-0 items-baseline gap-2">
          <span>Dashboard</span>
          <span className="truncate font-sans text-xs font-medium text-muted-foreground sm:text-sm">
            · Última atualização:{" "}
            {atualizacaoDados?.ultimoSucessoEm
              ? dataHoraBR(atualizacaoDados.ultimoSucessoEm)
              : "indisponível"}
          </span>
          {alertaCarga ? (
            <span className="truncate font-sans text-xs font-semibold text-warning sm:text-sm">
              · {alertaCarga}
            </span>
          ) : null}
        </span>
      }
      descricao={
        mixAtivo
          ? `Visão geral · mix ${rotuloMix}`
          : "Visão geral da sua operação com o Grupo Líder"
      }
    >
      <div className="grid gap-4 lg:grid-cols-6">
        {/* Destaque principal */}
        <Painel className="lg:col-span-4">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-danger">
                Deixou de entregar · até {rotuloAte}
              </p>
              <p className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">
                {brl(perdaAno)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                O Líder pediu {brl(pedidoAno)}. Entregue {brl(entregueAno)}. Pedido aberto e parcial
                entram pelo que faltou. {numero(pedidosEmAberto)} de {numero(pedidosAno)} pedido
                {pedidosAno === 1 ? "" : "s"} ainda incompleto
                {pedidosEmAberto === 1 ? "" : "s"}.
              </p>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                perdaAno > 0
                  ? "border-danger/40 bg-danger-soft/40 text-danger"
                  : "border-success/40 bg-success-soft/40 text-success"
              }`}
            >
              <TrendingUp className="size-4" /> Entregue {percentual(fillRatePct)}
            </div>
          </div>

          <div className="mt-6 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comprasMensais}
                barGap={0}
                barCategoryGap="28%"
                margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              >
                <XAxis dataKey="mes" interval={0} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  content={<TooltipPedidoEntrega />}
                />
                <Legend />
                <Bar
                  dataKey="pedido"
                  name="Pedido do Líder"
                  fill="var(--chart-1)"
                  radius={[3, 0, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="entregue"
                  name="Entregue"
                  fill="var(--chart-2)"
                  radius={[0, 3, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Painel>

        {/* Alertas acionáveis */}
        <div className="grid gap-4 lg:col-span-2">
          {alertas.map((alerta) => (
            <button
              key={alerta.titulo}
              onClick={() => navigate({ to: alerta.destino })}
              className={`group flex items-start gap-3 rounded-3xl border p-4 text-left backdrop-blur transition-all hover:-translate-y-0.5 ${tons[alerta.tom].wrap}`}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl ${tons[alerta.tom].icon}`}
              >
                <alerta.icone className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold">{alerta.titulo}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{alerta.texto}</p>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))}
        </div>

        {/* Vendas por loja */}
        <Painel className="lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-semibold">Vendas por loja</p>
              <p className="text-xs text-muted-foreground">
                Sell-out dos últimos {vendasPorLoja?.dias ?? 30} dias · clique em uma loja para
                detalhar
              </p>
            </div>
            <a href="/vendas-loja" className="text-xs font-semibold text-primary hover:underline">
              Ver análise
            </a>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={buscaLoja}
                onChange={(event) => setBuscaLoja(event.target.value)}
                placeholder="Buscar loja..."
                className="h-9 pl-9"
              />
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{brl(faturamentoPorLoja)}</span> ·{" "}
              {numero(Math.round(quantidadePorLoja))} un
            </div>
          </div>
          <div className="mt-3 max-h-[22rem] overflow-auto rounded-2xl border border-border">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-border bg-muted/95 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Loja</span>
              <span className="text-right">Venda</span>
              <span className="text-right">Un.</span>
            </div>
            {vendasLojasFiltradas.map((loja) => (
              <a
                key={loja.lojaId}
                href={`/vendas-loja?loja=${encodeURIComponent(loja.lojaId)}`}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border/70 px-3 py-2.5 text-xs transition-colors last:border-0 hover:bg-muted/50"
              >
                <span className="min-w-0 truncate font-medium" title={loja.nome}>
                  {loja.nome}
                </span>
                <span className="text-right font-semibold">{brl(loja.faturamento)}</span>
                <span className="min-w-[3.5rem] text-right text-muted-foreground">
                  {numero(Math.round(loja.quantidade))}
                </span>
              </a>
            ))}
            {!vendasLojasFiltradas.length ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                Nenhuma loja encontrada.
              </p>
            ) : null}
          </div>
        </Painel>

        {/* Indicadores operacionais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          <Painel>
            <button
              type="button"
              onClick={() => navigate({ to: "/estoque" })}
              className="w-full text-left"
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Produtos com ruptura
              </p>
              <p className="mt-1 font-display text-3xl font-bold text-danger">
                {produtosComRuptura.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lojasEmRuptura} loja{lojasEmRuptura === 1 ? "" : "s"} afetada
                {lojasEmRuptura === 1 ? "" : "s"}
              </p>
              <div className="mt-3 space-y-1.5">
                {produtosComRuptura.slice(0, 3).map((item) => (
                  <div key={item.sku} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium">{item.descricao}</span>
                    <span className="shrink-0 text-danger">
                      {item.lojas} loja{item.lojas === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
                {!produtosComRuptura.length ? (
                  <p className="text-xs text-success">Nenhum SKU em ruptura na base atual.</p>
                ) : null}
              </div>
            </button>
          </Painel>
          <Painel>
            <button
              type="button"
              onClick={() => navigate({ to: "/itens" })}
              className="w-full text-left"
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Top Star do fornecedor
              </p>
              <p className="mt-1 font-display text-3xl font-bold">{topStars.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                itens estrategicos classificados como Aa
              </p>
              <div className="mt-3 space-y-1.5">
                {topStars.slice(0, 3).map((item) => (
                  <div key={item.sku} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium">
                      Top Star - {item.descricao}
                    </span>
                    <span
                      className={item.emRuptura ? "shrink-0 text-danger" : "shrink-0 text-success"}
                    >
                      {item.emRuptura ? "Ruptura" : "Monitorar"}
                    </span>
                  </div>
                ))}
                {!topStars.length ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum Top Star classificado para este fornecedor.
                  </p>
                ) : null}
              </div>
            </button>
          </Painel>
        </div>

        {/* Posições críticas */}
        <Painel className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-primary" />
            <p className="font-display text-base font-semibold">Posições críticas</p>
          </div>
          <p className="text-xs text-muted-foreground">Itens que exigem reposição imediata</p>
          <div className="mt-4 space-y-2">
            {rupturas.slice(0, 6).map((linha) => (
              <div
                key={`${linha.sku}-${linha.lojaId}`}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {codigoProdutoComDigito(linha.sku)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {produtoPorSku(linha.sku).descricao}
                </span>
                <span className="text-xs text-muted-foreground">
                  {nomeLojaPorLocal(linha.lojaId)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    statusEstoque(linha) === "Ruptura"
                      ? "bg-danger/20 text-danger"
                      : "bg-warning/20 text-warning"
                  }`}
                >
                  {linha.estoqueAtual} / mín {estoqueMinimoCalculado(linha.sku, linha.lojaId)}
                </span>
              </div>
            ))}
            {rupturas.length > 6 && (
              <p className="text-center text-[0.7rem] text-muted-foreground mt-2 font-medium">
                + {rupturas.length - 6} itens em atenção ou ruptura. Acompanhe todos no menu
                Estoque.
              </p>
            )}
          </div>
        </Painel>
      </div>
    </PortalLayout>
  );
}
