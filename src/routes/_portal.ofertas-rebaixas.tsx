import { createFileRoute } from "@tanstack/react-router";
import { Percent, Tag, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataBR, percentual, numero } from "@/lib/format";
import { fetchOfertasIntelider, fetchProdutos, fetchVendas, submitSolicitacaoRebaixa, type OfertasInteliderDB } from "@/api";
import { usePortal } from "@/context/portal-context";
import { segmentoIntelider } from "@/lib/acordo-acesso";
import { lojas } from "@/lib/mock-data";

const lojasDisponiveis = lojas.filter((loja) => loja.tipo === "L" && !["291", "308", "399", "159", "213", "345", "353"].includes(loja.idLocal));

export const Route = createFileRoute("/_portal/ofertas-rebaixas")({
  head: () => ({
    meta: [
      { title: "Ofertas e Rebaixas | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhe as rebaixas de preço ativas e ofertas de validade praticadas nas lojas do Grupo Líder.",
      },
      { property: "og:title", content: "Ofertas e Rebaixas | Portal do Fornecedor" },
      {
        property: "og:description",
        content: "Acompanhe as rebaixas de preço ativas e ofertas de validade praticadas nas lojas do Grupo Líder.",
      },
    ],
  }),
  component: OfertasRebaixasPage,
});

function OfertasRebaixasPage() {
  const { codigoFornecedorAtivo, dadosFornecedorVersao } = usePortal();
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<OfertasInteliderDB | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [titulo, setTitulo] = useState("REBAIXA");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [periodoCalendario, setPeriodoCalendario] = useState<DateRange>({});
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [lojasAberta, setLojasAberta] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState("");
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroDescricao, setFiltroDescricao] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [filtroPreco, setFiltroPreco] = useState("");
  const [tiposDesconto, setTiposDesconto] = useState<Record<string, "R$" | "%">>({});
  const [valoresDesconto, setValoresDesconto] = useState<Record<string, string>>({});
  const [ordenacao, setOrdenacao] = useState<{ campo: "codigo" | "descricao" | "segmento" | "preco"; asc: boolean }>({ campo: "descricao", asc: true });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setErro(null);
    fetchOfertasIntelider({ data: codigoFornecedorAtivo })
      .then((payload) => {
        if (ativo) setDados(payload);
      })
      .catch((err) => {
        console.error("Erro ao carregar ofertas Intelider:", err);
        if (ativo) setErro("Não foi possível carregar as ofertas Intelider.");
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, dadosFornecedorVersao]);

  useEffect(() => {
    fetchProdutos({ data: codigoFornecedorAtivo }).then(setProdutos).catch(() => setProdutos([]));
    fetchVendas({ data: codigoFornecedorAtivo }).then(setVendas).catch(() => setVendas([]));
  }, [codigoFornecedorAtivo, dadosFornecedorVersao]);

  const rebaixas = dados?.rebaixas ?? [];
  const ofertasValidade = dados?.validade ?? [];


  const rebaixasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return rebaixas.filter(
      (r) =>
        r.sku.toLowerCase().includes(termo) ||
        r.descricao.toLowerCase().includes(termo) ||
        r.lojaNome.toLowerCase().includes(termo) ||
        r.responsabilidade.toLowerCase().includes(termo)
    );
  }, [busca, rebaixas]);

  const periodoValido = /^\d{4}-\d{2}-\d{2}$/.test(dataInicio) && /^\d{4}-\d{2}-\d{2}$/.test(dataFim) && dataFim >= dataInicio;
  const diasRebaixa = dataInicio && dataFim ? Math.max(1, Math.round((new Date(`${dataFim}T00:00:00`).getTime() - new Date(`${dataInicio}T00:00:00`).getTime()) / 86400000) + 1) : 0;
  const previsaoProduto = (sku: string, tipo: "R$" | "%", valorDesconto: number) => {
    const vendasSku = vendas.filter((v) => String(v.sku) === sku);
    const diasComVenda = new Set(vendasSku.map((v) => String(v.data))).size;
    const mediaDiaria = diasComVenda ? vendasSku.reduce((total, v) => total + Number(v.quantidade ?? 0), 0) / diasComVenda : 0;
    const quantidade = mediaDiaria * 1.2 * diasRebaixa;
    const produto = produtos.find((p) => String(p.sku ?? p.codigoProdutoRms ?? "") === sku);
    const preco = Number(produto?.precoTabela ?? 0);
    const reembolsoUnitario = tipo === "%" ? (preco * valorDesconto) / 100 : valorDesconto;
    return { mediaDiaria, quantidade, total: Math.max(0, reembolsoUnitario * quantidade) };
  };

  const produtosFiltrados = useMemo(() => {
    const codigo = filtroCodigo.toLowerCase();
    const descricao = filtroDescricao.toLowerCase();
    const segmento = filtroSegmento.toLowerCase();
    const preco = filtroPreco.replace(",", ".");
    return produtos.filter((p) => {
      const sku = String(p.sku ?? p.codigoProdutoRms ?? "").toLowerCase();
      const desc = String(p.descricao ?? "").toLowerCase();
      const seg = String(p.departamento ?? p.categoria ?? "OUTROS").toLowerCase();
      const valor = String(Number(p.precoTabela ?? 0));
      return sku.includes(codigo) && desc.includes(descricao) && seg.includes(segmento) && (!preco || valor.includes(preco));
    }).sort((a, b) => {
      const av = ordenacao.campo === "codigo" ? String(a.sku ?? a.codigoProdutoRms ?? "") : ordenacao.campo === "descricao" ? String(a.descricao ?? "") : ordenacao.campo === "segmento" ? String(a.departamento ?? a.categoria ?? "OUTROS") : Number(a.precoTabela ?? 0);
      const bv = ordenacao.campo === "codigo" ? String(b.sku ?? b.codigoProdutoRms ?? "") : ordenacao.campo === "descricao" ? String(b.descricao ?? "") : ordenacao.campo === "segmento" ? String(b.departamento ?? b.categoria ?? "OUTROS") : Number(b.precoTabela ?? 0);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" });
      return ordenacao.asc ? cmp : -cmp;
    });
  }, [produtos, filtroCodigo, filtroDescricao, filtroSegmento, filtroPreco, ordenacao]);

  const itensComRebaixa = useMemo(() => produtos.filter((p) => {
    const sku = String(p.sku ?? p.codigoProdutoRms ?? "");
    return (Number((valoresDesconto[sku] ?? "0").replace(",", ".")) || 0) > 0;
  }), [produtos, valoresDesconto]);

  const totalEstimadoRebaixa = useMemo(() => itensComRebaixa.reduce((total, p) => {
    const sku = String(p.sku ?? p.codigoProdutoRms ?? "");
    const tipo = tiposDesconto[sku] ?? "R$";
    const valor = Number((valoresDesconto[sku] ?? "0").replace(",", ".")) || 0;
    return total + previsaoProduto(sku, tipo, valor).total;
  }, 0), [itensComRebaixa, tiposDesconto, valoresDesconto, vendas, dataInicio, dataFim]);

  const ofertasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return ofertasValidade.filter(
      (o) =>
        o.sku.toLowerCase().includes(termo) ||
        o.descricao.toLowerCase().includes(termo) ||
        o.lojaNome.toLowerCase().includes(termo) ||
        o.status.toLowerCase().includes(termo)
    );
  }, [busca, ofertasValidade]);

  return (
    <PortalLayout
      titulo="Ofertas e Rebaixas"
      descricao="Acompanhe as rebaixas de preço vigentes e as ofertas especiais de validade praticadas na rede Grupo Líder."
    >
      <div className="space-y-4">
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        <p className="text-xs text-muted-foreground">
          Fonte: Intelider{dados?.atualizadoEm ? ` · carga ${dados.atualizadoEm}` : " · aguardando carga"}.
          Sem registro Intelider, nenhum dado demonstrativo é exibido.
        </p>
        {/* Barra de Filtro Unificada */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por SKU, descrição ou loja..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Componente de Abas */}
        <Tabs defaultValue="rebaixas" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="rebaixas" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Rebaixas em Andamento ({rebaixasFiltradas.length})
            </TabsTrigger>
            <TabsTrigger value="validade" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Ofertas Validade ({ofertasFiltradas.length})
            </TabsTrigger>
            <TabsTrigger value="solicitar" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Solicitar rebaixa
            </TabsTrigger>
          </TabsList>

          {/* Aba de Rebaixas */}
          <TabsContent value="rebaixas" className="mt-4">
            <Card className="shadow-panel border-none">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  Margem Garantida & Rebaixas de Preço
                </CardTitle>
                <CardDescription>
                  A previsão usa a venda média diária acrescida de 20% durante o período da rebaixa; não representa cobrança realizada.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px] pl-6">SKU</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Preço Anterior</TableHead>
                        <TableHead className="text-right">Preço Oferta</TableHead>
                        <TableHead className="text-right">Desconto</TableHead>
                        <TableHead className="text-center">Período</TableHead>
                        <TableHead>Tipo Acordo</TableHead>
                        <TableHead className="text-right">Venda prevista</TableHead>
                        <TableHead className="text-right pr-6">Reembolso estimado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rebaixasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            Nenhuma rebaixa encontrada para o filtro informado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rebaixasFiltradas.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono font-medium pl-6">{item.sku}</TableCell>
                            <TableCell>{item.descricao}</TableCell>
                            <TableCell>{item.lojaNome}</TableCell>
                            <TableCell className="text-right">{brl(item.precoNormal)}</TableCell>
                            <TableCell className="text-right text-primary font-semibold">
                              {brl(item.precoOferta)}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              {percentual(item.descontoPercentual)}
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono whitespace-nowrap">
                              {item.dataInicio ? dataBR(item.dataInicio) : "—"} - {item.dataFim ? dataBR(item.dataFim) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {item.responsabilidade === "fornecedor" ? "Reembolso fornecedor" : item.responsabilidade === "lider" ? "Líder" : "A confirmar"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{numero(item.quantidadeVendida)}</TableCell>
                            <TableCell className="text-right font-mono text-primary font-semibold pr-6">
                              {brl(item.reembolsoEstimado)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Ofertas Validade */}
          <TabsContent value="validade" className="mt-4">
            <Card className="shadow-panel border-none">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Ofertas Validade (Combate ao Desperdício)
                </CardTitle>
                <CardDescription>
                  Produtos em oferta especial com vencimento próximo para acelerar o giro de estoque nas lojas.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px] pl-6">SKU</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Preço Normal</TableHead>
                        <TableHead className="text-right">Preço Oferta</TableHead>
                        <TableHead className="text-right">Qtd. Inicial</TableHead>
                        <TableHead className="text-right">Qtd. Vendida</TableHead>
                        <TableHead className="text-right">Estoque Atual</TableHead>
                        <TableHead className="text-center">Vencimento</TableHead>
                        <TableHead className="text-center">Período Oferta</TableHead>
                        <TableHead className="pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ofertasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                            Nenhuma oferta de validade encontrada para o filtro informado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        ofertasFiltradas.map((item) => {
                          const estoqueAtual = Math.max(0, item.quantidadeInicial - item.quantidadeVendida);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono font-medium pl-6">{item.sku}</TableCell>
                              <TableCell>{item.descricao}</TableCell>
                              <TableCell>{item.lojaNome}</TableCell>
                              <TableCell className="text-right">{brl(item.precoNormal)}</TableCell>
                              <TableCell className="text-right text-primary font-semibold">
                                {brl(item.precoOferta)}
                              </TableCell>
                              <TableCell className="text-right font-mono">{numero(item.quantidadeInicial)}</TableCell>
                              <TableCell className="text-right font-mono text-green-600 font-semibold">{numero(item.quantidadeVendida)}</TableCell>
                              <TableCell className={`text-right font-mono font-semibold ${estoqueAtual > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                {estoqueAtual > 0 ? numero(estoqueAtual) : "Esgotado"}
                              </TableCell>
                              <TableCell className="text-center font-mono text-red-600 font-semibold">
                                {item.dataVencimento ? dataBR(item.dataVencimento) : "—"}
                              </TableCell>
                              <TableCell className="text-center text-sm font-mono whitespace-nowrap">
                                {item.dataInicio ? dataBR(item.dataInicio) : "—"} - {item.dataFim ? dataBR(item.dataFim) : "—"}
                              </TableCell>
                              <TableCell className="pr-6">
                                <Badge
                                  className={`border-0 ${
                                    item.status === "Ativa"
                                      ? "bg-success-soft text-success"
                                      : item.status === "Próxima ao Fim"
                                        ? "bg-warning-soft text-warning"
                                        : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {item.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="solicitar" className="mt-4">
            <Card className="shadow-panel border-none">
              <CardHeader>
                <CardTitle>Solicitar rebaixa</CardTitle>
                <CardDescription>Fornecedor e comprador são identificados automaticamente. O envio segue para análise do diretor do segmento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da oferta" />
                  <div className="relative">
                    <Button type="button" variant="outline" className="h-10 w-full justify-between text-left text-xs" onClick={() => setPeriodoAberto((v) => !v)}>
                      <span>{periodoValido ? `${dataInicio.split("-").reverse().join("/")} até ${dataFim.split("-").reverse().join("/")}` : periodoCalendario.from ? "Escolha a data final" : "Escolher período"}</span><span>▾</span>
                    </Button>
                    {periodoAberto ? <div className="absolute left-0 top-11 z-40 rounded-md border bg-popover p-2 shadow-lg">
                      <Calendar mode="range" numberOfMonths={2} selected={periodoCalendario} defaultMonth={periodoCalendario.from ?? new Date()} onSelect={(range) => { const proximo = range ?? {}; setPeriodoCalendario(proximo); if (proximo.from && proximo.to) { const paraIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; setDataInicio(paraIso(proximo.from)); setDataFim(paraIso(proximo.to)); setPeriodoAberto(false); } else { setDataInicio(""); setDataFim(""); } }} />
                      <div className="flex items-center justify-between border-t px-2 pt-2 text-xs text-muted-foreground"><span>{periodoCalendario.from ? `Início: ${periodoCalendario.from.toLocaleDateString("pt-BR")}` : "Selecione a data inicial"}</span><span>{periodoCalendario.to ? `Final: ${periodoCalendario.to.toLocaleDateString("pt-BR")}` : "Selecione a data final"}</span></div>
                    </div> : null}
                  </div>
                  <div className="relative"><Button type="button" variant="outline" disabled={!periodoValido} className="h-10 w-full justify-between text-left text-xs" onClick={() => setLojasAberta((v) => !v)}>{periodoValido ? `${lojasSelecionadas.length || "Nenhuma"} filial(is)` : "Informe o período"}<span>⌄</span></Button>{lojasAberta && periodoValido ? <div className="absolute left-0 top-11 z-30 w-[min(34rem,calc(100vw-3rem))] rounded-md border bg-popover p-3 shadow-lg"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Filiais da rebaixa</span><Button type="button" variant="outline" size="sm" onClick={() => setLojasSelecionadas(lojasSelecionadas.length === lojasDisponiveis.length ? [] : lojasDisponiveis.map((l) => l.idLocal))}>{lojasSelecionadas.length === lojasDisponiveis.length ? "Limpar todas" : "Selecionar todas as lojas"}</Button></div><Input value={buscaLoja} onChange={(e) => setBuscaLoja(e.target.value)} placeholder="Buscar filial por código ou nome..." className="mb-2 h-8 text-xs" /><div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">{lojasDisponiveis.filter((loja) => `${loja.idLocal} ${loja.nome}`.toLowerCase().includes(buscaLoja.toLowerCase())).map((loja) => <button type="button" key={loja.idLocal} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => setLojasSelecionadas((v) => v.includes(loja.idLocal) ? v.filter((x) => x !== loja.idLocal) : [...v, loja.idLocal])}><span>{loja.idLocal} · {loja.nome}</span>{lojasSelecionadas.includes(loja.idLocal) ? <span className="font-bold text-primary">✓</span> : null}</button>)}</div><p className="mt-2 text-xs text-muted-foreground">Selecione todas ou apenas as filiais desejadas.</p></div> : null}</div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-primary/5 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Estimativa baseada na venda prevista e no desconto informado. Não é cobrança.</p>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Valor previsto da rebaixa</p><p className="text-xl font-bold text-primary">{brl(totalEstimadoRebaixa)}</p></div>
                </div>
                <div className="max-h-[420px] max-w-full overflow-x-auto overflow-y-auto rounded-md border">
                  <Table className="min-w-[990px] table-fixed text-xs">
                    <TableHeader><TableRow className="bg-muted/40">
                      <TableHead className="w-[100px] px-1 text-center"><div className="flex items-center gap-1"><Input value={filtroCodigo} onChange={(e) => setFiltroCodigo(e.target.value)} placeholder="Código" className="h-7 w-full text-center text-xs" /><button type="button" className="text-muted-foreground" onClick={() => setOrdenacao((o) => ({ campo: "codigo", asc: o.campo === "codigo" ? !o.asc : true }))} aria-label="Ordenar código">↕</button></div></TableHead>
                      <TableHead className="w-[220px] px-1 text-center"><div className="flex items-center gap-1"><Input value={filtroDescricao} onChange={(e) => setFiltroDescricao(e.target.value)} placeholder="Descrição" className="h-7 w-full text-left text-xs" /><button type="button" className="text-muted-foreground" onClick={() => setOrdenacao((o) => ({ campo: "descricao", asc: o.campo === "descricao" ? !o.asc : true }))} aria-label="Ordenar descrição">↕</button></div></TableHead>
                      <TableHead className="w-[110px] px-1 text-center"><div className="flex items-center gap-1"><Input value={filtroSegmento} onChange={(e) => setFiltroSegmento(e.target.value)} placeholder="Segmento" className="h-7 w-full text-center text-xs" /><button type="button" className="text-muted-foreground" onClick={() => setOrdenacao((o) => ({ campo: "segmento", asc: o.campo === "segmento" ? !o.asc : true }))} aria-label="Ordenar segmento">↕</button></div></TableHead>
                      <TableHead className="w-[125px] px-1 text-center">Comprador</TableHead>
                      <TableHead className="w-[125px] px-1 text-center"><div className="flex items-center gap-1"><Input value={filtroPreco} onChange={(e) => setFiltroPreco(e.target.value)} placeholder="Preço vigente" className="h-7 w-full text-center text-xs" /><button type="button" className="text-muted-foreground" onClick={() => setOrdenacao((o) => ({ campo: "preco", asc: o.campo === "preco" ? !o.asc : true }))} aria-label="Ordenar preço vigente">↕</button></div></TableHead>
                      <TableHead className="w-[85px] px-1 text-center">Tipo desconto</TableHead>
                      <TableHead className="w-[110px] px-1 text-center">Valor desconto</TableHead>
                      <TableHead className="w-[115px] px-1 text-center">Oferta</TableHead><TableHead className="w-[85px] px-1 text-center">Venda</TableHead><TableHead className="w-[115px] px-1 text-center">Previsão rebaixa</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{produtosFiltrados.map((p) => { const sku = String(p.sku ?? p.codigoProdutoRms ?? ""); const tipo = tiposDesconto[sku] ?? "R$"; const valor = Number((valoresDesconto[sku] ?? "0").replace(",", ".")) || 0; const preco = Number(p.precoTabela ?? 0); const comprador = p.compradorNome || p.compradorCodigo || "Não cadastrado"; const unidadeVenda = p.unidadeVenda || p.tipoUnidadeVenda || p.unidade || "UN"; const precoOferta = tipo === "%" ? preco - (preco * valor) / 100 : preco - valor; return <TableRow key={sku} className="whitespace-nowrap">
                      <TableCell className="max-w-[125px] truncate px-1 text-center font-mono">{sku}</TableCell><TableCell className="max-w-[260px] truncate px-1 text-left" title={p.descricao}>{p.descricao}</TableCell><TableCell className="max-w-[150px] truncate px-1 text-center">{p.departamento || p.categoria || "OUTROS"}</TableCell><TableCell className="max-w-[125px] truncate px-1 text-center" title={comprador}>{comprador}</TableCell><TableCell className="px-1 text-center whitespace-nowrap">{brl(preco)}</TableCell>
                      <TableCell className="px-1 text-center"><select disabled={!periodoValido} value={tipo} onChange={(e) => setTiposDesconto((v) => ({ ...v, [sku]: e.target.value as "R$" | "%" }))} className="h-8 w-full rounded-md border bg-background px-1 text-center text-xs"><option value="R$">R$</option><option value="%">%</option></select></TableCell>
                      <TableCell className="px-1 text-center"><Input disabled={!periodoValido} value={valoresDesconto[sku] ?? "0"} onChange={(e) => setValoresDesconto((v) => ({ ...v, [sku]: e.target.value }))} inputMode="decimal" className="h-8 w-full text-center text-xs" /></TableCell>
                      <TableCell className={`px-1 text-center whitespace-nowrap font-semibold ${precoOferta < 0 ? "text-destructive" : "text-primary"}`}>{brl(precoOferta)}</TableCell><TableCell className="px-1 text-center font-mono">{numero(Math.round(previsaoProduto(sku, tipo, valor).quantidade))} {unidadeVenda}</TableCell><TableCell className="px-1 text-center font-mono font-semibold text-primary">{brl(previsaoProduto(sku, tipo, valor).total)}</TableCell>
                    </TableRow>; })}</TableBody>
                  </Table>
                </div>
                <Button disabled={enviando || !periodoValido || !itensComRebaixa.length || !lojasSelecionadas.length} onClick={async () => { setEnviando(true); try { await submitSolicitacaoRebaixa({ data: { titulo, dataInicio, dataFim, segmentos: [...new Set(itensComRebaixa.map((p) => segmentoIntelider(p.departamentoCodigo, p.departamento)))], lojas: lojasSelecionadas, itens: itensComRebaixa.map((p) => ({ sku: p.sku, descricao: p.descricao, precoVigente: p.precoTabela, compradorCodigo: p.compradorCodigo, compradorNome: p.compradorNome, tipoDesconto: tiposDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "R$", valorDesconto: Number((valoresDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "0").replace(",", ".")), vendaMediaDiaria: previsaoProduto(String(p.sku ?? p.codigoProdutoRms), tiposDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "R$", Number((valoresDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "0").replace(",", "."))).mediaDiaria, quantidadePrevista: previsaoProduto(String(p.sku ?? p.codigoProdutoRms), tiposDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "R$", Number((valoresDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "0").replace(",", "."))).quantidade, reembolsoEstimado: previsaoProduto(String(p.sku ?? p.codigoProdutoRms), tiposDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "R$", Number((valoresDesconto[String(p.sku ?? p.codigoProdutoRms)] ?? "0").replace(",", "."))).total })) } }); setErro("Solicitação enviada para análise."); } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível enviar a solicitação."); } finally { setEnviando(false); } }}>Enviar solicitação para análise</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
