import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  Upload,
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
import * as XLSX from "xlsx";
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
  const { fornecedor, codigoFornecedorAtivo } = usePortal();

  // Tabs state
  const [activeTab, setActiveTab] = useState("atual");

  // Filtering states
  const [linha, setLinha] = useState("todas");
  const [comprador, setComprador] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtrosTabela, setFiltrosTabela] = useState<Record<string, string>>({});
  const [ordenacaoTabela, setOrdenacaoTabela] = useState<{ campo: string; asc: boolean }>({ campo: "descricao", asc: true });

  // Edit/Proposal states
  const [modoEdicao, setModoEdicao] = useState(false);
  const [propostasInput, setPropostasInput] = useState<Record<string, string>>({}); // sku -> proposed unit price string
  const [justificativa, setJustificativa] = useState("");
  const [submetendo, setSubmetendo] = useState(false);

  // Proposal History states
  const [historico, setHistorico] = useState<PropostaPrecoDB[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [arquivoTabela, setArquivoTabela] = useState<string | null>(null);
  const [itensImportados, setItensImportados] = useState<Array<{ sku: string; descricao: string; precoAtual: number; precoProposto: number }>>([]);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [enviandoTabela, setEnviandoTabela] = useState(false);

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

  const processarTabelaExcel = async (arquivo: File) => {
    setArquivoTabela(arquivo.name); setItensImportados([]); setErrosImportacao([]);
    try {
      const workbook = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const achar = (linha: Record<string, unknown>, nomes: string[]) => Object.entries(linha).find(([chave]) => nomes.includes(normalizar(chave)))?.[1];
      const porCodigo = new Map(listaItens.flatMap((item) => [[String(item.sku), item], [String(item.codigo), item]]));
      const importados: Array<{ sku: string; descricao: string; precoAtual: number; precoProposto: number }> = []; const erros: string[] = []; const vistos = new Set<string>();
      linhas.forEach((linha, indice) => {
        const codigo = String(achar(linha, ["codigo", "codigoproduto", "skuproduto", "sku"]) ?? "").trim();
        const bruto = String(achar(linha, ["precoproposto", "preconovo", "preco", "valor"]) ?? "").replace(/[^0-9,.-]/g, "");
        const preco = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
        const item = porCodigo.get(codigo) ?? porCodigo.get(codigo.replace(/^0+/, ""));
        if (!codigo && !bruto) return;
        if (!item) { erros.push(`Linha ${indice + 2}: produto ${codigo || "(sem código)"} não encontrado.`); return; }
        if (vistos.has(item.sku)) { erros.push(`Linha ${indice + 2}: produto ${codigo} duplicado.`); return; }
        if (!(preco > 0)) { erros.push(`Linha ${indice + 2}: preço proposto inválido.`); return; }
        vistos.add(item.sku); importados.push({ sku: item.sku, descricao: item.descricao, precoAtual: item.cmvUnit, precoProposto: preco });
      });
      setItensImportados(importados); setErrosImportacao(erros);
    } catch { setErrosImportacao(["Não foi possível ler o arquivo. Use o modelo Excel."]); }
  };

  const baixarModeloTabela = () => {
    const planilha = XLSX.utils.json_to_sheet([{ "Código do produto": "", "Descrição": "", "Preço proposto": "", "Unidade": "UN", "Observação": "" }]);
    const arquivo = XLSX.write({ Sheets: { "Tabela de preços": planilha }, SheetNames: ["Tabela de preços"] }, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([arquivo], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const link = document.createElement("a"); link.href = url; link.download = "modelo-tabela-precos.xlsx"; link.click(); URL.revokeObjectURL(url);
  };

  const exportarTabelaAtual = () => {
    const linhas = listaItens.map((item) => ({ "Código do produto": item.sku, "Descrição": item.descricao, "Preço atual": item.cmvUnit, "Preço proposto": "", "Unidade": "UN", "Observação": "" }));
    const planilha = XLSX.utils.json_to_sheet(linhas); const arquivo = XLSX.write({ Sheets: { "Tabela de preços": planilha }, SheetNames: ["Tabela de preços"] }, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([arquivo], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const link = document.createElement("a"); link.href = url; link.download = `tabela-precos-${codigoFornecedorAtivo}.xlsx`; link.click(); URL.revokeObjectURL(url);
  };

  const enviarTabelaImportada = async () => {
    if (!itensImportados.length) return; setEnviandoTabela(true);
    try { await submitPropostaPreco({ data: { fornecedorCodigo: codigoFornecedorAtivo, justificativa: `Tabela importada: ${arquivoTabela || "arquivo Excel"}`, itens: itensImportados } }); setItensImportados([]); setArquivoTabela(null); setErrosImportacao(["Tabela enviada para análise com sucesso."]); }
    catch (error) { setErrosImportacao([error instanceof Error ? error.message : "Não foi possível enviar a tabela."]); } finally { setEnviandoTabela(false); }
  };

  // Dynamic filter options
  const linhas = useMemo(() => {
    return Array.from(new Set(listaItens.map((item) => item.linha).filter(Boolean))).sort();
  }, [listaItens]);

  const compradores = useMemo(() => {
    return Array.from(new Set(listaItens.map((item) => item.compradorNome).filter(Boolean))).sort();
  }, [listaItens]);

  // Apply filters
  const filtrados = useMemo(() => {
    const resultados = listaItens.filter((item) => {
      const matchLinha = linha === "todas" || item.linha === linha;
      const matchComprador = comprador === "todos" || item.compradorNome === comprador;
      const textoBusca = busca.toLowerCase().trim();
      const matchBusca = !textoBusca || [item.sku, item.codigo, item.descricao, item.ean, item.linha, item.compradorNome].some((valor) => valor.toLowerCase().includes(textoBusca));
      const valores: Record<string, string> = {
        codigo: item.codigo,
        descricao: item.descricao,
        ean: item.ean,
        embalagem: `${item.embalagemCompra} ${item.tipoEmbalagemCompra}`,
        custo: String(item.cmvUnit),
        custoEmbalagem: String(item.precoCompraEmbalagem),
        comprador: item.compradorNome,
        linha: item.linha,
      };
      const matchColunas = Object.entries(filtrosTabela).every(([campo, valor]) => !valor.trim() || (valores[campo] ?? "").toLowerCase().includes(valor.toLowerCase().trim()));
      return matchLinha && matchComprador && matchBusca && matchColunas;
    });
    return [...resultados].sort((a, b) => {
      const valoresA: Record<string, string | number> = { codigo: a.codigo, descricao: a.descricao, ean: a.ean, embalagem: a.embalagemCompra, custo: a.cmvUnit, custoEmbalagem: a.precoCompraEmbalagem, comprador: a.compradorNome, linha: a.linha };
      const valoresB: Record<string, string | number> = { codigo: b.codigo, descricao: b.descricao, ean: b.ean, embalagem: b.embalagemCompra, custo: b.cmvUnit, custoEmbalagem: b.precoCompraEmbalagem, comprador: b.compradorNome, linha: b.linha };
      const valorA = valoresA[ordenacaoTabela.campo] ?? "";
      const valorB = valoresB[ordenacaoTabela.campo] ?? "";
      const comparacao = typeof valorA === "number" && typeof valorB === "number" ? valorA - valorB : String(valorA).localeCompare(String(valorB), "pt-BR", { numeric: true, sensitivity: "base" });
      return ordenacaoTabela.asc ? comparacao : -comparacao;
    });
  }, [listaItens, linha, comprador, busca, filtrosTabela, ordenacaoTabela]);

  const alternarOrdenacaoTabela = (campo: string) => {
    setOrdenacaoTabela((atual) => ({ campo, asc: atual.campo === campo ? !atual.asc : true }));
  };

  const cabecalhoTabela = (campo: string, titulo: string, placeholder: string, className = "") => (
    <TableHead className={className}>
      <div className="flex min-w-[110px] items-center gap-1">
        <Input value={filtrosTabela[campo] ?? ""} onChange={(event) => setFiltrosTabela((atual) => ({ ...atual, [campo]: event.target.value }))} placeholder={placeholder} className="h-7 min-w-0 flex-1 text-xs" aria-label={`Buscar ${titulo}`} disabled={modoEdicao} />
        <button type="button" className="shrink-0 text-muted-foreground" onClick={() => alternarOrdenacaoTabela(campo)} aria-label={`Ordenar ${titulo}`}>
          {ordenacaoTabela.campo === campo ? (ordenacaoTabela.asc ? "↑" : "↓") : "↕"}
        </button>
      </div>
    </TableHead>
  );

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

          <Card className="shadow-panel">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Importar tabela de preços</CardTitle><p className="mt-1 text-sm text-muted-foreground">Exporte a tabela, preencha o preço proposto no Excel e importe novamente para conferência.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportarTabelaAtual}><Download className="mr-2 size-4" />Exportar tabela atual</Button><Button type="button" variant="outline" onClick={baixarModeloTabela}><Download className="mr-2 size-4" />Baixar modelo vazio</Button></div></div>
            </CardHeader>
            <CardContent className="space-y-3"><div className="flex flex-wrap items-center gap-3"><Input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const arquivo = event.target.files?.[0]; if (arquivo) void processarTabelaExcel(arquivo); }} className="max-w-md" /><Upload className="size-4 text-muted-foreground" /></div>{arquivoTabela && <p className="text-xs text-muted-foreground">Arquivo: {arquivoTabela} · {numero(itensImportados.length)} itens válidos</p>}{errosImportacao.length > 0 && <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">{errosImportacao.map((erro, indice) => <p key={indice}>{erro}</p>)}</div>}{itensImportados.length > 0 && <><div className="max-h-48 overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Preço atual</TableHead><TableHead className="text-right">Preço proposto</TableHead></TableRow></TableHeader><TableBody>{itensImportados.map((item) => <TableRow key={item.sku}><TableCell className="font-mono">{item.sku}</TableCell><TableCell>{item.descricao}</TableCell><TableCell className="text-right">{brl(item.precoAtual)}</TableCell><TableCell className="text-right font-semibold">{brl(item.precoProposto)}</TableCell></TableRow>)}</TableBody></Table></div><Button type="button" onClick={() => void enviarTabelaImportada()} disabled={enviandoTabela}>{enviandoTabela ? "Enviando..." : "Enviar tabela para análise"}</Button></>}</CardContent>
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
                      {cabecalhoTabela("codigo", "código do produto", "Código", "w-[150px]")}
                      {cabecalhoTabela("descricao", "descrição", "Descrição", "min-w-[240px]")}
                      {cabecalhoTabela("ean", "EAN", "EAN")}
                      {cabecalhoTabela("embalagem", "embalagem", "Embalagem", "text-center")}
                      {cabecalhoTabela("custo", "preço de compra unitário", "Preço unit.", "text-right")}
                      {cabecalhoTabela("custoEmbalagem", "preço da embalagem", "Preço emb.", "text-right")}
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
                      {cabecalhoTabela("comprador", "comprador", "Comprador")}
                      {cabecalhoTabela("linha", "linha", "Linha")}
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
