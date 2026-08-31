import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchVendasAnual, type VendasAnualDB } from "@/api";
import { PortalLayout } from "@/components/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import { brl, numero, percentual } from "@/lib/format";

export const Route = createFileRoute("/_portal/vendas-anual")({
  head: () => ({
    meta: [
      { title: "Vendas Anual | Portal do Fornecedor" },
      {
        name: "description",
        content: "Farol de sell-out do fornecedor contra o calendário do ano passado.",
      },
    ],
  }),
  component: VendasAnualPage,
});

const pontos = (valor: number | null) => {
  if (valor === null || Number.isNaN(valor)) return "—";
  const txt = `${valor >= 0 ? "+" : ""}${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
  return txt;
};

const pctOuTraco = (valor: number | null) => {
  if (valor === null) return "—";
  return percentual(valor);
};

const corDelta = (valor: number | null) => {
  if (valor === null) return "text-muted-foreground";
  if (valor >= 0) return "text-emerald-600";
  return "text-destructive";
};

function precoMedio(valor: number, volume: number) {
  if (!volume) return 0;
  return valor / volume;
}

const codigoItemComDigito = (item: {
  sku: string;
  codigoProdutoRms: string | null;
  digitoProdutoRms: string | null;
}) => {
  if (item.codigoProdutoRms && item.digitoProdutoRms) {
    return `${item.codigoProdutoRms}-${item.digitoProdutoRms}`;
  }
  return item.sku;
};

function eixoCompacto(valor: number) {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function GraficoLinha({
  titulo,
  data,
  anoBase,
  anoAtual,
  formatar,
  formatarEixo,
}: {
  titulo: string;
  data: { nome: string; base: number; atual: number }[];
  anoBase: number;
  anoAtual: number;
  formatar: (valor: number) => string;
  formatarEixo?: (valor: number) => string;
}) {
  const eixo = formatarEixo ?? formatar;
  return (
    <div className="space-y-1">
      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => eixo(Number(v))} />
            <Tooltip formatter={(v) => formatar(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="base" name={String(anoBase)} stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="atual" name={String(anoAtual)} stroke="var(--primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VendasAnualPage() {
  const { codigoFornecedorAtivo, dadosFornecedorVersao, fornecedor } = usePortal();
  const [dados, setDados] = useState<VendasAnualDB | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setErro(null);
    fetchVendasAnual({ data: codigoFornecedorAtivo })
      .then((payload) => {
        if (ativo) setDados(payload);
      })
      .catch((err) => {
        console.error(err);
        if (ativo) setErro("Não foi possível montar o farol de vendas anual.");
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, dadosFornecedorVersao]);

  const abaixo = (dados?.fornecedor?.pontos ?? 0) < 0;
  const redeAbaixo = (dados?.rede?.pontos ?? 0) < 0;

  return (
    <PortalLayout
      titulo="Vendas Anual"
      descricao="Farol da rede e realizado do fornecedor — valor, volume, seção e item."
    >
      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : !dados ? (
        <p className="text-sm text-muted-foreground">Carregando farol...</p>
      ) : (
        <div className="space-y-6">
          {!dados.temAnoAtual && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-800">
              O cache de sell-out do portal vai até {dados.cacheAte || "sem data"}. O farol do dia{" "}
              {dados.corte.dia}/{String(dados.corte.mes).padStart(2, "0")} já está calculado com o
              calendário de {dados.corte.anoBase}. O realizado de {dados.corte.anoAtual} aparece
              quando a carga do ano atual existir.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border bg-card shadow-panel lg:col-span-1">
              <CardHeader className="pb-2">
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                  Farol {dados.corte.dia}/{String(dados.corte.mes).padStart(2, "0")}/{dados.corte.anoAtual}
                </span>
                <CardTitle className="font-mono text-4xl font-bold text-primary">
                  {percentual(dados.farolPct)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Até esta data, no ano passado, o supermercado já tinha feito {percentual(dados.farolPct)} da
                venda anual de {dados.corte.anoBase}. Referência única da rede.
              </CardContent>
            </Card>

            <Card
              className={`border-border bg-card shadow-panel ${
                dados.fornecedor.pontos === null
                  ? ""
                  : abaixo
                    ? "border-l-4 border-l-destructive"
                    : "border-l-4 border-l-emerald-500"
              }`}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                    Fornecedor · {fornecedor.nome}
                  </span>
                  <CardTitle className="font-mono text-3xl font-bold">
                    {pctOuTraco(dados.fornecedor.realizadoPct)}
                  </CardTitle>
                </div>
                {dados.fornecedor.pontos !== null &&
                  (abaixo ? (
                    <TrendingDown className="size-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ))}
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className={`font-bold ${corDelta(dados.fornecedor.pontos)}`}>
                  {pontos(dados.fornecedor.pontos)} contra o farol
                </p>
                <p className="text-muted-foreground">
                  YTD {brl(dados.fornecedor.ytdAtual)} · anual {dados.corte.anoBase}{" "}
                  {brl(dados.fornecedor.anualBase)}
                </p>
              </CardContent>
            </Card>

            <Card
              className={`border-border bg-card shadow-panel ${
                dados.rede.pontos === null
                  ? ""
                  : redeAbaixo
                    ? "border-l-4 border-l-destructive"
                    : "border-l-4 border-l-emerald-500"
              }`}
            >
              <CardHeader className="pb-2">
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                  Supermercado
                </span>
                <CardTitle className="font-mono text-3xl font-bold">
                  {pctOuTraco(dados.rede.realizadoPct)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className={`font-bold ${corDelta(dados.rede.pontos)}`}>
                  {pontos(dados.rede.pontos)} contra o farol
                </p>
                <p className="text-muted-foreground">
                  YTD {brl(dados.rede.ytdAtual)} · anual {dados.corte.anoBase} {brl(dados.rede.anualBase)}
                </p>
                {redeAbaixo && dados.rede.pontos !== null && (
                  <p className="flex items-center gap-1 font-bold text-destructive">
                    <AlertTriangle className="size-3.5" /> Rede abaixo do ano passado.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card shadow-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Vendas, volume e preço médio · {dados.corte.anoBase} × {dados.corte.anoAtual}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <GraficoLinha
                titulo="Vendas (R$)"
                anoBase={dados.corte.anoBase}
                anoAtual={dados.corte.anoAtual}
                formatar={(v) => brl(v)}
                formatarEixo={eixoCompacto}
                data={dados.meses.map((m) => ({
                  nome: m.nome.slice(0, 3),
                  base: m.fornValorBase,
                  atual: m.fornValorAtual,
                }))}
              />
              <GraficoLinha
                titulo="Volume"
                anoBase={dados.corte.anoBase}
                anoAtual={dados.corte.anoAtual}
                formatar={(v) => numero(Math.round(v))}
                formatarEixo={eixoCompacto}
                data={dados.meses.map((m) => ({
                  nome: m.nome.slice(0, 3),
                  base: m.fornVolumeBase,
                  atual: m.fornVolumeAtual,
                }))}
              />
              <GraficoLinha
                titulo="Preço médio"
                anoBase={dados.corte.anoBase}
                anoAtual={dados.corte.anoAtual}
                formatar={(v) => brl(v)}
                data={dados.meses.map((m) => ({
                  nome: m.nome.slice(0, 3),
                  base: precoMedio(m.fornValorBase, m.fornVolumeBase),
                  atual: precoMedio(m.fornValorAtual, m.fornVolumeAtual),
                }))}
              />
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-panel">
            <CardHeader className="border-b border-border bg-muted/20 py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Calendário e grade mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 font-mono text-[0.7rem] uppercase tracking-wider">
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Peso {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">Farol acum.</TableHead>
                      <TableHead className="text-right">Forn. {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">Forn. {dados.corte.anoAtual}</TableHead>
                      <TableHead className="text-right">Vol. {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">Vol. {dados.corte.anoAtual}</TableHead>
                      <TableHead className="text-right">P. méd. {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">P. méd. {dados.corte.anoAtual}</TableHead>
                      <TableHead className="text-right">% valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.meses.map((m) => {
                      const cres = m.fornValorBase > 0 ? (m.fornValorAtual / m.fornValorBase - 1) * 100 : null;
                      return (
                        <TableRow key={m.mes} className={`font-mono text-xs ${m.aberto ? "bg-primary/5" : ""}`}>
                          <TableCell className="font-sans font-medium">
                            {m.nome}
                            {m.aberto ? ` · até dia ${dados.corte.dia}` : ""}
                          </TableCell>
                          <TableCell className="text-right">{percentual(m.pesoAnoPct)}</TableCell>
                          <TableCell className="text-right">{percentual(m.farolAcumPct)}</TableCell>
                          <TableCell className="text-right">{brl(m.fornValorBase)}</TableCell>
                          <TableCell className="text-right">{brl(m.fornValorAtual)}</TableCell>
                          <TableCell className="text-right">{numero(Math.round(m.fornVolumeBase))}</TableCell>
                          <TableCell className="text-right">{numero(Math.round(m.fornVolumeAtual))}</TableCell>
                          <TableCell className="text-right">{brl(precoMedio(m.fornValorBase, m.fornVolumeBase))}</TableCell>
                          <TableCell className="text-right">{brl(precoMedio(m.fornValorAtual, m.fornVolumeAtual))}</TableCell>
                          <TableCell className={`text-right font-bold ${corDelta(cres)}`}>
                            {pctOuTraco(cres)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-panel">
            <CardHeader className="border-b border-border bg-muted/20 py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Crescimento por seção
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 font-mono text-[0.7rem] uppercase tracking-wider">
                      <TableHead>Seção</TableHead>
                      <TableHead className="text-right">YTD {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">YTD {dados.corte.anoAtual}</TableHead>
                      <TableHead className="text-right">% valor</TableHead>
                      <TableHead className="text-right">Vol. {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">Vol. {dados.corte.anoAtual}</TableHead>
                      <TableHead className="text-right">% volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.secoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          Sem venda deste fornecedor no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dados.secoes.map((s) => (
                        <TableRow key={s.secao} className="font-mono text-xs">
                          <TableCell className="font-sans font-medium">{s.secao}</TableCell>
                          <TableCell className="text-right">{brl(s.valorBaseYtd)}</TableCell>
                          <TableCell className="text-right">{brl(s.valorAtual)}</TableCell>
                          <TableCell className={`text-right font-bold ${corDelta(s.crescimentoValorPct)}`}>
                            {s.crescimentoValorPct === null ? (
                              <span className="inline-flex items-center gap-1">
                                {s.valorAtual > 0 ? <TrendingUp className="size-3" /> : null}
                                {pctOuTraco(s.crescimentoValorPct)}
                              </span>
                            ) : (
                              pctOuTraco(s.crescimentoValorPct)
                            )}
                          </TableCell>
                          <TableCell className="text-right">{numero(Math.round(s.volumeBaseYtd))}</TableCell>
                          <TableCell className="text-right">{numero(Math.round(s.volumeAtual))}</TableCell>
                          <TableCell className={`text-right font-bold ${corDelta(s.crescimentoVolumePct)}`}>
                            {pctOuTraco(s.crescimentoVolumePct)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-panel">
            <CardHeader className="border-b border-border bg-muted/20 py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Itens que mais explicam o furo (ou a folga) contra o farol
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 font-mono text-[0.7rem] uppercase tracking-wider">
                      <TableHead>SKU</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Seção</TableHead>
                      <TableHead className="text-right">Anual {dados.corte.anoBase}</TableHead>
                      <TableHead className="text-right">YTD {dados.corte.anoAtual}</TableHead>
                      <TableHead className="text-right">% valor</TableHead>
                      <TableHead className="text-right">Contribuição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.itens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          Sem itens com venda no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dados.itens.map((item) => (
                        <TableRow key={item.sku} className="font-mono text-xs">
                          <TableCell className="font-bold text-primary">{codigoItemComDigito(item)}</TableCell>
                          <TableCell className="max-w-[280px] truncate font-sans">{item.descricao}</TableCell>
                          <TableCell className="font-sans text-muted-foreground">{item.secao}</TableCell>
                          <TableCell className="text-right">{brl(item.valorBase)}</TableCell>
                          <TableCell className="text-right">{brl(item.valorAtual)}</TableCell>
                          <TableCell className={`text-right font-bold ${corDelta(item.crescimentoValorPct)}`}>
                            {pctOuTraco(item.crescimentoValorPct)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${corDelta(-item.contribuicaoFuro)}`}>
                            {brl(item.contribuicaoFuro)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
