import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  Search,
  Coins,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Undo2,
  Send,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useMemo, useState, useEffect, useCallback, ComponentType } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/context/portal-context";
import { brl, dataBR, numero } from "@/lib/format";
import { codigoProdutoComDigito, produtos } from "@/lib/mock-data";
import { submitPropostaPreco, fetchPropostasPrecos, type PropostaPrecoDB } from "@/api";

export const Route = createFileRoute("/_portal/preco-sistema")({
  head: () => ({
    meta: [
      { title: "Tabela de Preço (Sistema) | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Visualização detalhada da tabela de preços de custo/compra do fornecedor registrada no sistema do Grupo Líder.",
      },
      { property: "og:title", content: "Tabela de Preço (Sistema) | Portal do Fornecedor" },
    ],
  }),
  component: PrecoSistemaPage,
});

function PrecoSistemaPage() {
  const { fornecedor } = usePortal();

  // Tabs state
  const [activeTab, setActiveTab] = useState("atual");

  // Filtering states
  const [linha, setLinha] = useState("todas");
  const [comprador, setComprador] = useState("todos");
  const [busca, setBusca] = useState("");

  // Edit/Proposal states
  const [modoEdicao, setModoEdicao] = useState(false);
  const [propostasInput, setPropostasInput] = useState<Record<string, string>>({}); // sku -> proposed unit price string
  const [justificativa, setJustificativa] = useState("");
  const [submetendo, setSubmetendo] = useState(false);

  // Proposal History states
  const [historico, setHistorico] = useState<PropostaPrecoDB[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // Map products data safely
  const listaItens = useMemo(() => {
    return produtos.map((produto) => {
      const embalagem = produto.embalagemCompra || 1;
      const precoUnit = produto.cmvUnit || 0;
      return {
        sku: produto.sku,
        codigo: codigoProdutoComDigito(produto.sku),
        descricao: produto.descricao,
        ean: produto.ean || "—",
        embalagemCompra: embalagem,
        tipoEmbalagemCompra: produto.tipoEmbalagemCompra || "UN",
        cmvUnit: precoUnit,
        precoCompraEmbalagem: precoUnit * embalagem,
        compradorNome: produto.compradorNome || "Não Atribuído",
        linha: produto.linha || "Outros",
      };
    });
  }, []);

  // Fetch proposals history
  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    try {
      const dados = await fetchPropostasPrecos({ data: fornecedor.codigo });
      setHistorico(dados);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar histórico de propostas.");
    } finally {
      setCarregandoHistorico(false);
    }
  }, [fornecedor.codigo]);

  useEffect(() => {
    if (activeTab === "historico") {
      carregarHistorico();
    }
  }, [activeTab, carregarHistorico]);

  // Dynamic filter options
  const linhas = useMemo(() => {
    return Array.from(new Set(listaItens.map((item) => item.linha).filter(Boolean))).sort();
  }, [listaItens]);

  const compradores = useMemo(() => {
    return Array.from(new Set(listaItens.map((item) => item.compradorNome).filter(Boolean))).sort();
  }, [listaItens]);

  // Apply filters
  const filtrados = useMemo(() => {
    return listaItens.filter((item) => {
      const matchLinha = linha === "todas" || item.linha === linha;
      const matchComprador = comprador === "todos" || item.compradorNome === comprador;

      const textoBusca = busca.toLowerCase().trim();
      const matchBusca =
        !textoBusca ||
        item.sku.toLowerCase().includes(textoBusca) ||
        item.codigo.toLowerCase().includes(textoBusca) ||
        item.descricao.toLowerCase().includes(textoBusca) ||
        item.ean.toLowerCase().includes(textoBusca) ||
        item.linha.toLowerCase().includes(textoBusca) ||
        item.compradorNome.toLowerCase().includes(textoBusca);

      return matchLinha && matchComprador && matchBusca;
    });
  }, [listaItens, linha, comprador, busca]);

  // KPI Calculations
  const totalItens = filtrados.length;
  const custosValidos = filtrados.map((item) => item.cmvUnit).filter((c) => c > 0);

  const custoMedio = useMemo(() => {
    if (custosValidos.length === 0) return 0;
    return custosValidos.reduce((acc, curr) => acc + curr, 0) / custosValidos.length;
  }, [custosValidos]);

  const maiorCusto = useMemo(() => {
    if (custosValidos.length === 0) return 0;
    return Math.max(...custosValidos);
  }, [custosValidos]);

  const menorCusto = useMemo(() => {
    if (custosValidos.length === 0) return 0;
    return Math.min(...custosValidos);
  }, [custosValidos]);

  // Items currently being modified
  const alteradosList = useMemo(() => {
    return Object.entries(propostasInput)
      .map(([sku, value]) => {
        const item = listaItens.find((i) => i.sku === sku);
        const precoNovo = parseFloat(value.replace(",", "."));
        if (!item || isNaN(precoNovo) || precoNovo === item.cmvUnit) return null;
        return {
          sku,
          codigo: item.codigo,
          descricao: item.descricao,
          precoAtual: item.cmvUnit,
          precoProposto: precoNovo,
          percentualDelta: ((precoNovo - item.cmvUnit) / item.cmvUnit) * 100,
        };
      })
      .filter(Boolean) as {
      sku: string;
      codigo: string;
      descricao: string;
      precoAtual: number;
      precoProposto: number;
      percentualDelta: number;
    }[];
  }, [propostasInput, listaItens]);

  const handlePriceInputChange = (sku: string, value: string) => {
    setPropostasInput((prev) => ({
      ...prev,
      [sku]: value,
    }));
  };

  const limparPropostas = () => {
    setPropostasInput({});
    setJustificativa("");
  };

  const cancelarEdicao = () => {
    limparPropostas();
    setModoEdicao(false);
  };

  const submeterProposta = async () => {
    if (alteradosList.length === 0) {
      toast.error("Nenhuma alteração de preço foi feita.");
      return;
    }
    if (!justificativa.trim()) {
      toast.error("Por favor, preencha a justificativa para a alteração de preços.");
      return;
    }

    setSubmetendo(true);
    try {
      const response = await submitPropostaPreco({
        data: {
          fornecedorCodigo: fornecedor.codigo,
          justificativa: justificativa.trim(),
          itens: alteradosList.map((item) => ({
            sku: item.sku,
            descricao: item.descricao,
            precoAtual: item.precoAtual,
            precoProposto: item.precoProposto,
          })),
        },
      });

      toast.success("Proposta enviada!", {
        description: `Proposta registrada sob o lote ${response.loteId}.`,
      });
      limparPropostas();
      setModoEdicao(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao submeter proposta de preços.");
    } finally {
      setSubmetendo(false);
    }
  };

  const limparFiltros = () => {
    setLinha("todas");
    setComprador("todos");
    setBusca("");
  };

  const exportarCsv = () => {
    const cabecalho = [
      "SKU/Codigo",
      "Descricao",
      "EAN",
      "Embalagem Compra",
      "Tipo Embalagem",
      "Preco Compra Unitario (Custo)",
      "Preco Compra Embalagem",
      "Comprador",
      "Linha/Subgrupo",
    ];

    const linhasCsv = filtrados.map((item) => [
      item.codigo,
      item.descricao,
      item.ean,
      item.embalagemCompra,
      item.tipoEmbalagemCompra,
      item.cmvUnit.toFixed(2),
      item.precoCompraEmbalagem.toFixed(2),
      item.compradorNome,
      item.linha,
    ]);

    const csv = [cabecalho, ...linhasCsv]
      .map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tabela-de-precos-sistema-${fornecedor.codigo}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Dados exportados", {
      description: `${linhasCsv.length} itens exportados com sucesso em formato CSV.`,
    });
  };

  // Group history by loteId
  const historicoAgrupado = useMemo(() => {
    const grupos: Record<
      string,
      {
        loteId: string;
        criadoEm: string;
        status: string;
        justificativa: string | null;
        respostaAdmin: string | null;
        respondidoEm: string | null;
        itens: PropostaPrecoDB[];
      }
    > = {};

    for (const item of historico) {
      if (!grupos[item.loteId]) {
        grupos[item.loteId] = {
          loteId: item.loteId,
          criadoEm: item.criadoEm,
          status: item.status,
          justificativa: item.justificativa,
          respostaAdmin: item.respostaAdmin,
          respondidoEm: item.respondidoEm,
          itens: [],
        };
      }
      grupos[item.loteId].itens.push(item);
    }

    // Sort lots by creation date descending
    return Object.values(grupos).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [historico]);

  return (
    <PortalLayout
      titulo="Tabela de Preço (Sistema)"
      descricao={`Tabela vigente do Grupo Líder para ${fornecedor.nome}. O fornecedor só digita proposta de preço; nada muda no sistema até a aprovação.`}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="atual">Preços Atuais</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Propostas</TabsTrigger>
        </TabsList>

        <TabsContent value="atual" className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid gap-3 md:grid-cols-4">
            <Resumo
              titulo="Itens Cadastrados"
              valor={numero(totalItens)}
              icone={Package}
              tom="primary"
            />
            <Resumo
              titulo="Preço de Compra Médio"
              valor={brl(custoMedio)}
              icone={Coins}
              tom="primary"
            />
            <Resumo
              titulo="Maior Preço de Compra"
              valor={brl(maiorCusto)}
              icone={ArrowUpCircle}
              tom="danger"
            />
            <Resumo
              titulo="Menor Preço de Compra"
              valor={brl(menorCusto)}
              icone={ArrowDownCircle}
              tom="success"
            />
          </div>

          {/* Filters Card */}
          <Card className="shadow-panel">
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] items-end">
              <div className="space-y-2">
                <Label>Linha</Label>
                <Select value={linha} onValueChange={setLinha} disabled={modoEdicao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as linhas</SelectItem>
                    {linhas.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Comprador</Label>
                <Select value={comprador} onValueChange={setComprador} disabled={modoEdicao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os compradores</SelectItem>
                    {compradores.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="busca-preco-compra">Buscar produto</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="busca-preco-compra"
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    className="pl-9"
                    disabled={modoEdicao}
                    placeholder="Código, EAN, descrição ou comprador"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={limparFiltros}
                  disabled={modoEdicao}
                  className="flex-1"
                >
                  Limpar
                </Button>
                <Button
                  variant="outline"
                  onClick={exportarCsv}
                  disabled={modoEdicao}
                  className="flex items-center gap-1.5"
                >
                  <Download className="size-4" /> Exportar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Proposal/Edit Mode Panel */}
          {modoEdicao && (
            <Card className="border-l-4 border-l-primary bg-primary/5 shadow-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-primary">
                  <Pencil className="size-5" /> Proposta de Reajuste de Tabela
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Digite os novos preços abaixo. Isso não grava a tabela no sistema: envia uma
                  proposta para o comercial do Líder aprovar ou recusar.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="justificativa-reajuste" className="font-semibold text-sm">
                      Justificativa da Proposta <span className="text-danger">*</span>
                    </Label>
                    <Textarea
                      id="justificativa-reajuste"
                      placeholder="Descreva detalhadamente o motivo do reajuste de preço (ex: inflação de matéria-prima, aumento cambial, frete)."
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-2 min-w-[200px]">
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded border border-border">
                      <p className="font-semibold text-foreground mb-1">
                        Itens alterados: {alteradosList.length}
                      </p>
                      {alteradosList.slice(0, 3).map((a) => (
                        <p key={a.sku} className="truncate font-mono">
                          {a.codigo}: {a.percentualDelta >= 0 ? "+" : ""}
                          {a.percentualDelta.toFixed(1)}%
                        </p>
                      ))}
                      {alteradosList.length > 3 && (
                        <p className="text-[10px] text-right">
                          e mais {alteradosList.length - 3}...
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelarEdicao}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={submeterProposta}
                        disabled={submetendo || alteradosList.length === 0 || !justificativa.trim()}
                        className="flex-1 flex items-center gap-1.5"
                      >
                        <Send className="size-3.5" /> Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products Table */}
          <Card className="shadow-panel">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                {modoEdicao ? "Digitando proposta de preço" : "Catálogo Geral de Preços de Compra"}
              </CardTitle>
              {!modoEdicao && (
                <Button
                  onClick={() => setModoEdicao(true)}
                  className="flex items-center gap-1.5 size-sm h-9"
                >
                  <Pencil className="size-4" /> Propor Reajuste de Preços
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table
                containerClassName="max-h-[500px] rounded-b-lg border-t border-border"
                className="border-separate border-spacing-0"
              >
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                  <TableRow className="bg-stone-100">
                      <TableHead className="w-[120px]">Cód. Produto</TableHead>
                      <TableHead className="min-w-[240px]">Descrição</TableHead>
                      <TableHead>EAN (Cód. Barras)</TableHead>
                      <TableHead className="text-center">Embalagem</TableHead>
                      <TableHead className="text-right">Preço Compra (Unitário)</TableHead>
                      <TableHead className="text-right">Preço Compra (Embalagem)</TableHead>
                      {modoEdicao && (
                        <>
                          <TableHead className="text-right text-primary font-bold">
                            Novo Unitário
                          </TableHead>
                          <TableHead className="text-right text-muted-foreground font-semibold">
                            Novo Embalagem
                          </TableHead>
                          <TableHead className="text-center w-[80px]">Delta</TableHead>
                        </>
                      )}
                      <TableHead>Comprador</TableHead>
                      <TableHead>Linha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((item) => {
                      const valueInput = propostasInput[item.sku] ?? "";
                      const precoNovo = parseFloat(valueInput.replace(",", "."));
                      const isEdited = !isNaN(precoNovo) && precoNovo !== item.cmvUnit;
                      const percentualDelta = isEdited
                        ? ((precoNovo - item.cmvUnit) / item.cmvUnit) * 100
                        : 0;
                      const novoEmbalagem = isEdited ? precoNovo * item.embalagemCompra : 0;

                      return (
                        <TableRow
                          key={item.sku}
                          className={`hover:bg-muted/30 ${isEdited ? "bg-primary/5" : ""}`}
                        >
                          <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                          <TableCell className="font-medium text-sm">{item.descricao}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.ean}
                          </TableCell>
                          <TableCell className="text-center text-xs font-semibold">
                            {item.embalagemCompra} {item.tipoEmbalagemCompra}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-muted-foreground">
                            {brl(item.cmvUnit)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-muted-foreground">
                            {item.embalagemCompra > 1 ? brl(item.precoCompraEmbalagem) : "—"}
                          </TableCell>
                          {modoEdicao && (
                            <>
                              <TableCell className="text-right py-1.5">
                                <Input
                                  value={valueInput}
                                  onChange={(e) => handlePriceInputChange(item.sku, e.target.value)}
                                  placeholder={item.cmvUnit.toFixed(2)}
                                  className="h-8 text-right font-semibold font-mono w-[90px] ml-auto border-primary/40 focus:border-primary"
                                />
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary font-mono text-sm py-1.5">
                                {isEdited ? brl(novoEmbalagem) : "—"}
                              </TableCell>
                              <TableCell className="text-center py-1.5">
                                {isEdited ? (
                                  <span
                                    className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${percentualDelta >= 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
                                  >
                                    {percentualDelta >= 0 ? "+" : ""}
                                    {percentualDelta.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs font-mono">—</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-sm text-muted-foreground">
                            {item.compradorNome}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.linha}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtrados.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={modoEdicao ? 11 : 8}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          Nenhum item cadastrado ou encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card className="shadow-panel">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Histórico de Propostas Enviadas
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Veja o status e as respostas das propostas de reajuste de preço de custo enviadas
                  para o Grupo Líder.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={carregarHistorico}
                disabled={carregandoHistorico}
                className="h-8 text-xs flex items-center gap-1"
              >
                <Clock className="size-3.5" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {carregandoHistorico ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Carregando histórico...
                </div>
              ) : historicoAgrupado.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  Nenhuma proposta de reajuste de preço foi enviada até o momento.
                </div>
              ) : (
                <div className="space-y-4">
                  {historicoAgrupado.map((lote) => {
                    const statusText =
                      lote.status === "aprovado"
                        ? "Aprovado"
                        : lote.status === "rejeitado"
                          ? "Recusado"
                          : "Pendente";
                    const statusColor =
                      lote.status === "aprovado"
                        ? "bg-success/10 text-success border-success/30"
                        : lote.status === "rejeitado"
                          ? "bg-danger/10 text-danger border-danger/30"
                          : "bg-warning/10 text-warning border-warning/30";
                    const StatusIcon =
                      lote.status === "aprovado"
                        ? CheckCircle
                        : lote.status === "rejeitado"
                          ? XCircle
                          : Clock;

                    return (
                      <div
                        key={lote.loteId}
                        className="border border-border rounded-lg overflow-hidden shadow-sm"
                      >
                        {/* Lote Header */}
                        <div className="bg-muted/40 p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <h4 className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                              {lote.loteId}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                              Enviado em{" "}
                              {new Date(lote.criadoEm.replace(" ", "T") + "Z").toLocaleString(
                                "pt-BR",
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor}`}
                            >
                              <StatusIcon className="size-3.5" /> {statusText}
                            </span>
                          </div>
                        </div>

                        {/* Lote Content */}
                        <div className="p-4 space-y-3">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Justificativa do Fornecedor
                              </p>
                              <p className="text-xs font-medium text-foreground bg-muted/40 p-2.5 rounded border border-border/50 min-h-[50px] italic">
                                "{lote.justificativa || "Nenhuma justificativa fornecida."}"
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Resposta do Comprador (Líder)
                              </p>
                              <div className="text-xs font-medium text-foreground bg-muted/40 p-2.5 rounded border border-border/50 min-h-[50px]">
                                {lote.status === "pendente" ? (
                                  <p className="text-muted-foreground italic flex items-center gap-1">
                                    <Clock className="size-3.5 animate-pulse" /> Aguardando análise
                                    do comprador...
                                  </p>
                                ) : (
                                  <div>
                                    <p className="font-semibold mb-1 text-foreground">
                                      {lote.status === "aprovado"
                                        ? "Aprovado por Oscar/Líder:"
                                        : "Recusado por Oscar/Líder:"}
                                    </p>
                                    <p className="italic text-muted-foreground">
                                      "{lote.respostaAdmin || "Sem comentários adicionais."}"
                                    </p>
                                    {lote.respondidoEm && (
                                      <p className="text-[9px] text-right text-muted-foreground mt-1.5">
                                        Respondido em:{" "}
                                        {new Date(
                                          lote.respondidoEm.replace(" ", "T") + "Z",
                                        ).toLocaleString("pt-BR")}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Items Table inside Lote */}
                          <div className="border border-border rounded overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 h-8">
                                  <TableHead className="py-1 text-xs">Cód. Produto</TableHead>
                                  <TableHead className="py-1 text-xs">Descrição</TableHead>
                                  <TableHead className="py-1 text-xs text-right">
                                    Preço de Custo Anterior
                                  </TableHead>
                                  <TableHead className="py-1 text-xs text-right text-primary font-bold">
                                    Novo Preço Proposto
                                  </TableHead>
                                  <TableHead className="py-1 text-xs text-center w-[80px]">
                                    Delta
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lote.itens.map((p) => {
                                  const pctDelta =
                                    ((p.precoProposto - p.precoAtual) / p.precoAtual) * 100;
                                  return (
                                    <TableRow key={p.id} className="h-9 hover:bg-muted/20">
                                      <TableCell className="py-1 font-mono text-[10px]">
                                        {codigoProdutoComDigito(p.sku)}
                                      </TableCell>
                                      <TableCell className="py-1 text-xs font-semibold">
                                        {p.descricao}
                                      </TableCell>
                                      <TableCell className="py-1 text-right text-xs font-mono text-muted-foreground">
                                        {brl(p.precoAtual)}
                                      </TableCell>
                                      <TableCell className="py-1 text-right text-xs font-mono text-primary font-bold">
                                        {brl(p.precoProposto)}
                                      </TableCell>
                                      <TableCell className="py-1 text-center font-mono">
                                        <span
                                          className={`text-[10px] font-bold px-1 py-0.2 rounded ${pctDelta >= 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
                                        >
                                          {pctDelta >= 0 ? "+" : ""}
                                          {pctDelta.toFixed(1)}%
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}

function Resumo({
  titulo,
  valor,
  icone: Icone,
  tom = "primary",
}: {
  titulo: string;
  valor: string;
  icone: ComponentType<{ className?: string }>;
  tom?: "primary" | "success" | "danger";
}) {
  const cor =
    tom === "danger" ? "text-danger" : tom === "success" ? "text-success" : "text-primary";

  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="font-display text-2xl font-bold">{valor}</p>
        </div>
        <Icone className={`size-5 ${cor}`} />
      </CardContent>
    </Card>
  );
}
