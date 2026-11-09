import { createFileRoute } from "@tanstack/react-router";
import { Search, Store, TrendingUp } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchVendasPorLoja, type VendaPorLojaItemDB, type VendasPorLojaDB } from "@/api";
import { PortalLayout } from "@/components/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/context/portal-context";
import { brl, dataBR, numero, percentual } from "@/lib/format";
import { lojaForaRelatorioVendas } from "@/lib/lojas-excluidas-vendas";
import { lojas, mesmoCodigoLoja, nomeLoja } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/vendas-loja")({
  validateSearch: (search: Record<string, unknown>) => ({
    loja: typeof search["loja"] === "string" ? search["loja"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vendas por Loja | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhe faturamento, volume e evolução diária do sell-out por loja.",
      },
    ],
  }),
  component: VendasPorLojaPage,
});

type ResumoLoja = {
  lojaId: string;
  nome: string;
  faturamento: number;
  quantidade: number;
  dias: number;
  skusMaximosDia: number;
};

function eixoValor(valor: number) {
  if (Math.abs(valor) >= 1_000_000)
    return `${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(valor) >= 1_000)
    return `${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function VendasPorLojaPage() {
  const { codigoFornecedorAtivo, dadosFornecedorVersao, filtroMercadologico } = usePortal();
  const { loja: lojaInicial } = Route.useSearch();
  const [dados, setDados] = useState<VendasPorLojaDB | null>(null);
  const [dias, setDias] = useState(30);
  const [lojaSelecionada, setLojaSelecionada] = useState(lojaInicial ?? "todas");
  const [lojaExpandida, setLojaExpandida] = useState(lojaInicial ?? "todas");
  const [busca, setBusca] = useState("");
  const [itensLoja, setItensLoja] = useState<VendaPorLojaItemDB[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);

  useEffect(() => {
    setLojaSelecionada(lojaInicial ?? "todas");
    setLojaExpandida(lojaInicial ?? "todas");
  }, [lojaInicial]);

  useEffect(() => {
    let ativo = true;
    setDados(null);
    fetchVendasPorLoja({
      data: {
        fornecedorCodigo: codigoFornecedorAtivo,
        filtro: filtroMercadologico,
        dias,
      },
    })
      .then((resultado) => {
        if (ativo) setDados(resultado);
      })
      .catch((err) => {
        console.error("Erro ao carregar detalhe de vendas por loja:", err);
        if (ativo) setDados({ inicio: null, fim: null, dias, linhas: [], itens: [] });
      });
    return () => {
      ativo = false;
    };
  }, [dias, codigoFornecedorAtivo, dadosFornecedorVersao, filtroMercadologico]);

  useEffect(() => {
    let ativo = true;
    if (lojaSelecionada === "todas") {
      setItensLoja([]);
      setCarregandoItens(false);
      return () => {
        ativo = false;
      };
    }

    setItensLoja([]);
    setCarregandoItens(true);
    fetchVendasPorLoja({
      data: {
        fornecedorCodigo: codigoFornecedorAtivo,
        filtro: filtroMercadologico,
        dias,
        lojaId: lojaSelecionada,
        incluirLinhas: false,
      },
    })
      .then((resultado) => {
        if (ativo) setItensLoja(resultado.itens);
      })
      .catch((err) => {
        console.error("Erro ao carregar itens vendidos por loja:", err);
        if (ativo) setItensLoja([]);
      })
      .finally(() => {
        if (ativo) setCarregandoItens(false);
      });

    return () => {
      ativo = false;
    };
  }, [lojaSelecionada, dias, codigoFornecedorAtivo, dadosFornecedorVersao, filtroMercadologico]);

  const resumos = useMemo(() => {
    const porLoja = new Map<string, ResumoLoja>();
    const idsPorReferencia = new Map<string, string>();
    for (const loja of lojas.filter(
      (item) => item.tipo !== "D" && !lojaForaRelatorioVendas(item.id),
    )) {
      porLoja.set(loja.id, {
        lojaId: loja.id,
        nome: loja.nome,
        faturamento: 0,
        quantidade: 0,
        dias: 0,
        skusMaximosDia: 0,
      });
      idsPorReferencia.set(loja.id, loja.id);
      idsPorReferencia.set(loja.idLocal, loja.id);
    }
    for (const linha of dados?.linhas ?? []) {
      const lojaId = idsPorReferencia.get(String(linha.lojaId)) ?? String(linha.lojaId);
      const atual = porLoja.get(lojaId) ?? {
        lojaId,
        nome: nomeLoja(String(linha.lojaId)),
        faturamento: 0,
        quantidade: 0,
        dias: 0,
        skusMaximosDia: 0,
      };
      atual.faturamento += Number(linha.faturamento || 0);
      atual.quantidade += Number(linha.quantidade || 0);
      atual.dias += 1;
      atual.skusMaximosDia = Math.max(atual.skusMaximosDia, Number(linha.skus || 0));
      porLoja.set(lojaId, atual);
    }
    return [...porLoja.values()].sort(
      (a, b) => b.faturamento - a.faturamento || a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [dados]);

  const resumosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return resumos.filter(
      (linha) => !termo || `${linha.nome} ${linha.lojaId}`.toLowerCase().includes(termo),
    );
  }, [busca, resumos]);

  const linhasSelecionadas = useMemo(() => {
    const porDia = new Map<string, { data: string; faturamento: number; quantidade: number }>();
    for (const linha of dados?.linhas ?? []) {
      if (lojaSelecionada !== "todas" && !mesmoCodigoLoja(String(linha.lojaId), lojaSelecionada))
        continue;
      const atual = porDia.get(linha.data) ?? { data: linha.data, faturamento: 0, quantidade: 0 };
      atual.faturamento += Number(linha.faturamento || 0);
      atual.quantidade += Number(linha.quantidade || 0);
      porDia.set(linha.data, atual);
    }
    return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [dados, lojaSelecionada]);

  const faturamentoSelecionado = linhasSelecionadas.reduce(
    (acc, linha) => acc + linha.faturamento,
    0,
  );
  const quantidadeSelecionada = linhasSelecionadas.reduce(
    (acc, linha) => acc + linha.quantidade,
    0,
  );
  const lojaNomeSelecionada =
    lojaSelecionada === "todas" ? "Todas as lojas" : nomeLoja(lojaSelecionada);
  const faturamentoGeral = resumos.reduce((acc, linha) => acc + linha.faturamento, 0);

  return (
    <PortalLayout
      titulo="Vendas por Loja"
      descricao="Faturamento e volume do sell-out por destino, com evolução diária."
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-panel">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Venda no período
              </p>
              <p className="mt-1 font-display text-3xl font-bold">{brl(faturamentoSelecionado)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{lojaNomeSelecionada}</p>
            </CardContent>
          </Card>
          <Card className="shadow-panel">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Itens vendidos
              </p>
              <p className="mt-1 font-display text-3xl font-bold">
                {numero(Math.round(quantidadeSelecionada))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {linhasSelecionadas.length} dia(s) com venda
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-panel">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lojas com venda
              </p>
              <p className="mt-1 font-display text-3xl font-bold">
                {numero(resumos.filter((linha) => linha.faturamento > 0).length)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Janela de {dias} dias de venda</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-panel">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" /> Evolução diária
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {lojaNomeSelecionada} · {dados?.inicio ? dataBR(dados.inicio) : "—"} a{" "}
                {dados?.fim ? dataBR(dados.fim) : "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Loja do gráfico"
                value={lojaSelecionada}
                onChange={(event) => {
                  const loja = event.target.value;
                  setLojaSelecionada(loja);
                  setLojaExpandida(loja);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="todas">Todas as lojas</option>
                {resumos.map((linha) => (
                  <option key={linha.lojaId} value={linha.lojaId}>
                    {linha.nome}
                  </option>
                ))}
              </select>
              <select
                aria-label="Janela de vendas"
                value={dias}
                onChange={(event) => setDias(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={linhasSelecionadas}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="data"
                    tickFormatter={(valor) => dataBR(String(valor)).slice(0, 5)}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={(valor) => eixoValor(Number(valor))}
                    tick={{ fontSize: 10 }}
                    width={58}
                  />
                  <Tooltip
                    labelFormatter={(valor) => dataBR(String(valor))}
                    formatter={(valor, nome) => [
                      nome === "faturamento" ? brl(Number(valor)) : numero(Number(valor)),
                      nome === "faturamento" ? "Venda" : "Itens",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="faturamento"
                    name="Venda"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!linhasSelecionadas.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Não há vendas para os filtros selecionados.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-5 text-primary" /> Ranking de lojas
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique em uma linha para atualizar o gráfico e abrir os itens vendidos naquela loja.
              </p>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar loja..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Loja</th>
                    <th className="px-3 py-2 text-right">Venda</th>
                    <th className="px-3 py-2 text-right">Participação</th>
                    <th className="px-3 py-2 text-right">Itens</th>
                    <th className="px-3 py-2 text-right">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {resumosFiltrados.map((linha) => (
                    <Fragment key={linha.lojaId}>
                      <tr
                        aria-expanded={lojaExpandida === linha.lojaId}
                        className={`cursor-pointer border-t border-border/70 transition-colors hover:bg-muted/50 ${lojaSelecionada === linha.lojaId ? "bg-primary/5" : ""}`}
                        onClick={() => {
                          setLojaSelecionada(linha.lojaId);
                          setLojaExpandida((atual) =>
                            atual === linha.lojaId ? "todas" : linha.lojaId,
                          );
                        }}
                      >
                        <td className="px-3 py-2 font-medium">{linha.nome}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {brl(linha.faturamento)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {percentual(
                            faturamentoGeral > 0 ? (linha.faturamento / faturamentoGeral) * 100 : 0,
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {numero(Math.round(linha.quantidade))}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {numero(linha.dias)}
                        </td>
                      </tr>
                      {lojaExpandida === linha.lojaId ? (
                        <tr className="border-t border-border/40 bg-muted/20">
                          <td colSpan={5} className="p-0">
                            <div className="space-y-2 p-3">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Vendas totais por item · {linha.nome}
                                </p>
                                {itensLoja.length ? (
                                  <p className="text-xs text-muted-foreground">
                                    {numero(itensLoja.length)} produto(s)
                                  </p>
                                ) : null}
                              </div>
                              {carregandoItens ? (
                                <p className="py-3 text-center text-sm text-muted-foreground">
                                  Carregando itens vendidos...
                                </p>
                              ) : itensLoja.length ? (
                                <div className="overflow-auto rounded-md border border-border bg-background">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted text-left text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-2">Item</th>
                                        <th className="px-3 py-2">SKU</th>
                                        <th className="px-3 py-2 text-right">Quantidade</th>
                                        <th className="px-3 py-2 text-right">Venda</th>
                                        <th className="px-3 py-2 text-right">Dias</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itensLoja.map((item) => (
                                        <tr
                                          key={`${item.lojaId}-${item.sku}`}
                                          className="border-t border-border/70"
                                        >
                                          <td className="max-w-[22rem] px-3 py-2 font-medium">
                                            {item.descricao}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-muted-foreground">
                                            {item.sku}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {numero(Math.round(Number(item.quantidade || 0)))}
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold">
                                            {brl(Number(item.faturamento || 0))}
                                          </td>
                                          <td className="px-3 py-2 text-right text-muted-foreground">
                                            {numero(Number(item.dias || 0))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="py-3 text-center text-sm text-muted-foreground">
                                  Não há itens vendidos para esta loja nos filtros selecionados.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
