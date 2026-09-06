import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Package,
  PackagePlus,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { PortalLayout } from "@/components/portal-layout";
import { usePortal } from "@/context/portal-context";
import { fetchComprasAno, type ComprasAnoDB } from "@/api";
import { filtroMercadologicoAtivo } from "@/lib/filtro-mercadologico";
import { brl, dataBR, numero, percentual } from "@/lib/format";
import {
  codigoProdutoComDigito,
  estoque,
  estoqueMinimoCalculado,
  faturasDoFornecedor,
  nomeLoja,
  nomeLojaPorLocal,
  produtoPorSku,
  statusEstoque,
} from "@/lib/mock-data";
import { mesFechadoIso, rotuloMesAno } from "@/lib/pedidos-janela";
import { calcularSugestoesCompraCdam } from "@/lib/sugestao-compra";

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

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
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

function Dashboard() {
  const navigate = useNavigate();
  const { fornecedor, dadosFornecedorVersao, filtroMercadologico } = usePortal();
  const ateMesPadrao = mesFechadoIso();
  const [comprasAno, setComprasAno] = useState<ComprasAnoDB | null>(null);
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
        fornecedorCodigo: fornecedor.codigo,
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
  }, [fornecedor.codigo, ateMesPadrao, dadosFornecedorVersao, filtroMercadologico]);

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

  const comprasPorLoja = useMemo(() => {
    return (comprasAno?.destinos ?? [])
      .filter((d) => Number(d.perda || 0) > 0)
      .map((d) => ({
        nome: nomeLoja(d.lojaId),
        valor: Number(d.perda || 0),
      }));
  }, [comprasAno]);

  const lojasPizza = comprasPorLoja.slice(0, 6);
  const rupturas = estoque.filter((e) => statusEstoque(e) !== "Confortável");
  const skusMonitorados = new Set(estoque.map((e) => e.sku)).size;
  const lojasComEstoque = new Set(estoque.map((e) => e.lojaId)).size;
  const skusEmRisco = new Set(rupturas.map((r) => r.sku)).size;
  const lojasEmRisco = new Set(rupturas.map((r) => r.lojaId)).size;
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
      titulo="Dashboard"
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
                O Líder pediu {brl(pedidoAno)}. Entregue {brl(entregueAno)}. Pedido aberto e
                parcial entram pelo que faltou. {numero(pedidosEmAberto)} de {numero(pedidosAno)}{" "}
                pedido{pedidosAno === 1 ? "" : "s"} ainda incompleto
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

        {/* Participação por loja */}
        <Painel className="lg:col-span-2">
          <p className="font-display text-base font-semibold">Onde faltou entregar</p>
          <p className="text-xs text-muted-foreground">Perda por destino até {rotuloAte}</p>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={lojasPizza}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                >
                  {lojasPizza.map((loja, i) => (
                    <Cell key={loja.nome} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {lojasPizza.map((loja, i) => (
              <div key={loja.nome} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: CORES[i % CORES.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{loja.nome}</span>
                <span className="font-semibold">{brl(loja.valor)}</span>
              </div>
            ))}
            {comprasPorLoja.length > lojasPizza.length ? (
              <p className="pt-1 text-[0.7rem] text-muted-foreground">
                + {comprasPorLoja.length - lojasPizza.length} destino(s)
              </p>
            ) : null}
          </div>
        </Painel>

        {/* Métricas compactas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          <Painel>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Pedido do Líder
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{brl(pedidoAno)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Entregue {brl(entregueAno)} · faltou {brl(perdaAno)}
            </p>
          </Painel>
          <Painel>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mix em loja
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{skusMonitorados}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              SKUs em {numero(lojasComEstoque)} loja{lojasComEstoque === 1 ? "" : "s"}
              {skusEmRisco > 0 ? (
                <span className="text-danger"> · {skusEmRisco} em risco de ruptura</span>
              ) : null}
            </p>
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
                + {rupturas.length - 6} itens em atenção ou ruptura. Acompanhe todos no menu Estoque.
              </p>
            )}
          </div>
        </Painel>
      </div>
    </PortalLayout>
  );
}
