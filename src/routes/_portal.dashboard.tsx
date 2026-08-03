import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Package,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { PortalLayout } from "@/components/portal-layout";
import { brl, numero } from "@/lib/format";
import {
  estoque,
  lojas,
  produtoPorSku,
  statusEstoque,
  vendas,
  vendasMensais,
} from "@/lib/mock-data";

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
        content: "Visão geral de vendas, estoque e financeiro do fornecedor.",
      },
    ],
  }),
  component: Dashboard,
});

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

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

function Painel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
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

  const vendasPorLoja = useMemo(
    () =>
      lojas.map((loja) => ({
        nome: loja.nome.replace(" - Líder", " ·"),
        valor: vendas
          .filter((v) => v.lojaId === loja.id)
          .reduce((acc, v) => acc + v.quantidade * v.valorUnitario, 0),
      })),
    [],
  );

  const faturamentoPeriodo = vendasPorLoja.reduce((acc, l) => acc + l.valor, 0);
  const volumePeriodo = vendas.reduce((acc, v) => acc + v.quantidade, 0);
  const rupturas = estoque.filter((e) => statusEstoque(e) !== "Confortável");
  const skusEmRisco = new Set(rupturas.map((r) => r.sku)).size;
  const lojasEmRisco = new Set(rupturas.map((r) => r.lojaId)).size;

  const alertas = [
    {
      tom: "danger" as const,
      icone: AlertTriangle,
      titulo: "Ruptura de estoque",
      texto: `${skusEmRisco} produtos abaixo do mínimo em ${lojasEmRisco} lojas.`,
      destino: "/estoque" as const,
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
      texto: `Previsão de ${brl(124500)} liberada para amanhã.`,
      destino: "/financeiro" as const,
    },
  ];

  return (
    <PortalLayout titulo="Dashboard" descricao="Visão geral da sua operação com o Grupo Líder">
      <div className="grid gap-4 lg:grid-cols-6">
        {/* Destaque principal */}
        <Painel className="lg:col-span-4">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
                Faturamento sell-out · 45 dias
              </p>
              <p className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">
                {brl(faturamentoPeriodo)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {numero(volumePeriodo)} unidades vendidas · ticket médio{" "}
                {brl(faturamentoPeriodo / volumePeriodo)}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-success/40 bg-success-soft/40 px-3 py-1.5 text-xs font-semibold text-success">
              <TrendingUp className="size-4" /> Tendência de alta
            </div>
          </div>

          <div className="mt-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vendasMensais} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="ember" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  formatter={(v: number) => brl(v)}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#ember)"
                />
              </AreaChart>
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
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tons[alerta.tom].icon}`}>
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
          <p className="font-display text-base font-semibold">Participação por loja</p>
          <p className="text-xs text-muted-foreground">Últimos 45 dias</p>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vendasPorLoja}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                >
                  {vendasPorLoja.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
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
            {vendasPorLoja.map((loja, i) => (
              <div key={loja.nome} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: CORES[i % CORES.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{loja.nome}</span>
                <span className="font-semibold">{brl(loja.valor)}</span>
              </div>
            ))}
          </div>
        </Painel>

        {/* Métricas compactas */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          <Painel>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Volume vendido
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{numero(volumePeriodo)} un</p>
            <p className="mt-1 text-xs text-muted-foreground">Todas as lojas</p>
          </Painel>
          <Painel>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              SKUs monitorados
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{estoque.length}</p>
            <p className="mt-1 text-xs text-danger">{skusEmRisco} em risco de ruptura</p>
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
            {rupturas.map((linha) => (
              <div
                key={`${linha.sku}-${linha.lojaId}`}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">{linha.sku}</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {produtoPorSku(linha.sku).descricao}
                </span>
                <span className="text-xs text-muted-foreground">
                  {lojas.find((l) => l.id === linha.lojaId)?.nome}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    statusEstoque(linha) === "Ruptura"
                      ? "bg-danger/20 text-danger"
                      : "bg-warning/20 text-warning"
                  }`}
                >
                  {linha.estoqueAtual} / mín {linha.estoqueMinimo}
                </span>
              </div>
            ))}
          </div>
        </Painel>
      </div>
    </PortalLayout>
  );
}
