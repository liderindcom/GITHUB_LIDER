import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarClock, PiggyBank, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PortalLayout } from "@/components/portal-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, numero } from "@/lib/format";
import { estoque, lojas, produtoPorSku, statusEstoque, vendas, vendasMensais } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do Fornecedor | Grupo Líder" },
      { name: "description", content: "Alertas de ruptura, agendamentos pendentes e previsão de pagamentos." },
      { property: "og:title", content: "Dashboard do Fornecedor | Grupo Líder" },
      { property: "og:description", content: "Visão geral de vendas, estoque e financeiro do fornecedor." },
    ],
  }),
  component: Dashboard,
});

const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

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
      texto: `Atenção: ${skusEmRisco} produtos estão abaixo do estoque mínimo em ${lojasEmRisco} lojas.`,
      destino: "/estoque" as const,
    },
    {
      tom: "warning" as const,
      icone: CalendarClock,
      titulo: "Notas fiscais",
      texto: "Você possui 2 Notas Fiscais aguardando agendamento logístico.",
      destino: "/logistica" as const,
    },
    {
      tom: "success" as const,
      icone: PiggyBank,
      titulo: "Financeiro",
      texto: `Previsão de pagamento de ${brl(124500)} liberada para amanhã.`,
      destino: "/financeiro" as const,
    },
  ];

  const tons = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    success: "border-success/30 bg-success-soft text-success",
  };

  return (
    <PortalLayout titulo="Dashboard" descricao="Visão geral da sua operação com o Grupo Líder">
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {alertas.map((alerta) => (
            <button
              key={alerta.titulo}
              onClick={() => navigate({ to: alerta.destino })}
              className={`group flex items-start gap-3 rounded-xl border p-4 text-left shadow-panel transition-all hover:-translate-y-0.5 ${tons[alerta.tom]}`}
            >
              <alerta.icone className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{alerta.titulo}</p>
                <p className="mt-1 text-sm font-medium leading-snug">{alerta.texto}</p>
              </div>
              <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metrica titulo="Faturamento (45 dias)" valor={brl(faturamentoPeriodo)} detalhe="Sell-out consolidado" />
          <Metrica titulo="Volume vendido" valor={`${numero(volumePeriodo)} un`} detalhe="Todas as lojas" />
          <Metrica titulo="Ticket médio item" valor={brl(faturamentoPeriodo / volumePeriodo)} detalhe="Média ponderada" />
          <Metrica titulo="SKUs monitorados" valor={`${estoque.length} posições`} detalhe={`${skusEmRisco} em risco`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" /> Vendas mensais
              </CardTitle>
              <CardDescription>Faturamento sell-out dos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }}
                  />
                  <Bar dataKey="faturamento" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Participação por loja</CardTitle>
              <CardDescription>Proporção de vendas nos últimos 45 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={vendasPorLoja} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={90}>
                    {vendasPorLoja.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-1">
                {vendasPorLoja.map((loja, i) => (
                  <div key={loja.nome} className="flex items-center gap-2 text-xs">
                    <span className="size-2.5 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                    <span className="flex-1 truncate text-muted-foreground">{loja.nome}</span>
                    <span className="font-medium">{brl(loja.valor)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posições críticas de estoque</CardTitle>
            <CardDescription>Itens que exigem reposição imediata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rupturas.map((linha) => (
              <div
                key={`${linha.sku}-${linha.lojaId}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">{linha.sku}</span>
                <span className="flex-1 truncate font-medium">{produtoPorSku(linha.sku).descricao}</span>
                <span className="text-muted-foreground">{lojas.find((l) => l.id === linha.lojaId)?.nome}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    statusEstoque(linha) === "Ruptura"
                      ? "bg-danger-soft text-danger"
                      : "bg-warning-soft text-warning"
                  }`}
                >
                  {linha.estoqueAtual} / mín {linha.estoqueMinimo}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function Metrica({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <Card className="shadow-panel">
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{valor}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
      </CardContent>
    </Card>
  );
}
