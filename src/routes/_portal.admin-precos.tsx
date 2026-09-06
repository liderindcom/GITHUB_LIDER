import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Coins,
} from "lucide-react";
import { useMemo, useState, useEffect, ComponentType } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import { fetchPropostasPrecos, responderPropostaPreco, type PropostaPrecoDB } from "@/api";

export const Route = createFileRoute("/_portal/admin-precos")({
  head: () => ({
    meta: [
      { title: "Aprovação de Preços (Admin) | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Painel de aprovação e negociação de tabelas de preços de custo enviadas por fornecedores.",
      },
      { property: "og:title", content: "Aprovação de Preços (Admin) | Portal do Fornecedor" },
    ],
  }),
  component: AdminPrecosPage,
});

function AdminPrecosPage() {
  const [propostas, setPropostas] = useState<PropostaPrecoDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [busca, setBusca] = useState("");
  const [filtrosItens, setFiltrosItens] = useState<Record<string, string>>({});
  const [ordenacaoItens, setOrdenacaoItens] = useState<{ campo: string; asc: boolean }>({ campo: "descricao", asc: true });
  const [respostasAdmin, setRespostaAdmin] = useState<Record<number, string>>({}); // id -> text input
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  // Expanded lots state (to collapse/expand lote details)
  const [expandedLots, setExpandedLots] = useState<Record<string, boolean>>({});

  const carregarPropostas = async () => {
    setCarregando(true);
    try {
      const dados = await fetchPropostasPrecos({});
      setPropostas(dados);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar propostas de preços.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPropostas();
  }, []);

  const toggleLot = (loteId: string) => {
    setExpandedLots((prev) => ({
      ...prev,
      [loteId]: !prev[loteId],
    }));
  };

  const handleResponder = async (id: number, status: "aprovado" | "rejeitado") => {
    const respostaText = (respostasAdmin[id] ?? "").trim();
    if (status === "rejeitado" && !respostaText) {
      toast.error("Por favor, digite um motivo/comentário ao recusar um preço.");
      return;
    }

    setProcessandoId(id);
    try {
      await responderPropostaPreco({
        data: {
          id,
          status,
          respostaAdmin:
            respostaText ||
            (status === "aprovado" ? "Aprovado pelo comprador." : "Recusado pelo comprador."),
        },
      });

      toast.success(status === "aprovado" ? "Preço aprovado!" : "Preço recusado.", {
        description:
          status === "aprovado"
            ? "O novo preço de custo foi ativado no sistema."
            : "A alteração foi rejeitada.",
      });

      // Clear response field and reload list
      setRespostaAdmin((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      await carregarPropostas();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar resposta.");
    } finally {
      setProcessandoId(null);
    }
  };

  const handleInputChange = (id: number, text: string) => {
    setRespostaAdmin((prev) => ({
      ...prev,
      [id]: text,
    }));
  };

  // Filter propostas by tab and search query
  const propostasFiltradas = useMemo(() => {
    return propostas.filter((p) => {
      const matchStatus =
        activeTab === "pendentes" ? p.status === "pendente" : p.status !== "pendente";

      const textoBusca = busca.toLowerCase().trim();
      const matchBusca =
        !textoBusca ||
        p.loteId.toLowerCase().includes(textoBusca) ||
        p.fornecedorCodigo.toLowerCase().includes(textoBusca) ||
        p.sku.toLowerCase().includes(textoBusca) ||
        p.descricao.toLowerCase().includes(textoBusca) ||
        (p.justificativa ?? "").toLowerCase().includes(textoBusca);

      return matchStatus && matchBusca;
    });
  }, [propostas, activeTab, busca]);

  const alternarOrdenacaoItens = (campo: string) => {
    setOrdenacaoItens((atual) => ({ campo, asc: atual.campo === campo ? !atual.asc : true }));
  };

  const itensVisiveis = (itens: PropostaPrecoDB[]) => {
    const filtrados = itens.filter((item) => {
      const valores: Record<string, string> = {
        sku: item.sku,
        descricao: item.descricao,
        atual: String(item.precoAtual),
        proposto: String(item.precoProposto),
        delta: String(((item.precoProposto - item.precoAtual) / item.precoAtual) * 100),
        status: item.status,
        resposta: item.respostaAdmin ?? "",
      };
      return Object.entries(filtrosItens).every(([campo, valor]) => !valor.trim() || (valores[campo] ?? "").toLowerCase().includes(valor.toLowerCase().trim()));
    });
    return [...filtrados].sort((a, b) => {
      const valoresA: Record<string, string | number> = { sku: a.sku, descricao: a.descricao, atual: a.precoAtual, proposto: a.precoProposto, delta: (a.precoProposto - a.precoAtual) / a.precoAtual, status: a.status, resposta: a.respostaAdmin ?? "" };
      const valoresB: Record<string, string | number> = { sku: b.sku, descricao: b.descricao, atual: b.precoAtual, proposto: b.precoProposto, delta: (b.precoProposto - b.precoAtual) / b.precoAtual, status: b.status, resposta: b.respostaAdmin ?? "" };
      const valorA = valoresA[ordenacaoItens.campo] ?? "";
      const valorB = valoresB[ordenacaoItens.campo] ?? "";
      const comparacao = typeof valorA === "number" && typeof valorB === "number" ? valorA - valorB : String(valorA).localeCompare(String(valorB), "pt-BR", { numeric: true, sensitivity: "base" });
      return ordenacaoItens.asc ? comparacao : -comparacao;
    });
  };

  const cabecalhoItem = (campo: string, titulo: string, placeholder: string, className = "") => (
    <TableHead className={className}>
      <div className="flex min-w-[105px] items-center gap-1">
        <Input value={filtrosItens[campo] ?? ""} onChange={(event) => setFiltrosItens((atual) => ({ ...atual, [campo]: event.target.value }))} placeholder={placeholder} className="h-7 min-w-0 flex-1 text-xs" aria-label={`Buscar ${titulo}`} />
        <button type="button" className="shrink-0 text-muted-foreground" onClick={() => alternarOrdenacaoItens(campo)} aria-label={`Ordenar ${titulo}`}>
          {ordenacaoItens.campo === campo ? (ordenacaoItens.asc ? "↑" : "↓") : "↕"}
        </button>
      </div>
    </TableHead>
  );

  // Group filtered proposals by loteId
  const lotesAgrupados = useMemo(() => {
    const grupos: Record<
      string,
      {
        loteId: string;
        fornecedorCodigo: string;
        criadoEm: string;
        justificativa: string | null;
        itens: PropostaPrecoDB[];
      }
    > = {};

    for (const p of propostasFiltradas) {
      if (!grupos[p.loteId]) {
        grupos[p.loteId] = {
          loteId: p.loteId,
          fornecedorCodigo: p.fornecedorCodigo,
          criadoEm: p.criadoEm,
          justificativa: p.justificativa,
          itens: [],
        };
      }
      grupos[p.loteId].itens.push(p);
    }

    // Sort lots by creation date descending
    return Object.values(grupos).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [propostasFiltradas]);

  return (
    <PortalLayout
      titulo="Aprovação de Preços"
      descricao="Painel do comprador do Grupo Líder para analisar e aprovar reajustes de preço de custo enviados pelos parceiros."
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList className="grid w-full max-w-[320px] grid-cols-2">
            <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
            <TabsTrigger value="analisados">Analisados</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por lote, SKU, fornecedor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={carregarPropostas} disabled={carregando}>
              <RefreshCw className={`size-4 ${carregando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <TabsContent value="pendentes" className="space-y-4">
          {carregando ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando propostas pendentes...
            </div>
          ) : lotesAgrupados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
              Nenhuma proposta de reajuste de preço de custo pendente de aprovação.
            </div>
          ) : (
            <div className="space-y-4">
              {lotesAgrupados.map((lote) => {
                const isExpanded = expandedLots[lote.loteId] !== false; // expanded by default
                const nItens = lote.itens.length;

                return (
                  <Card
                    key={lote.loteId}
                    className="shadow-panel overflow-hidden border border-border"
                  >
                    {/* Lot Header */}
                    <div
                      onClick={() => toggleLot(lote.loteId)}
                      className="bg-muted/30 px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-mono text-sm font-bold text-foreground">
                            {lote.loteId}
                          </h4>
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Fornecedor: {lote.fornecedorCodigo}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Recebido em{" "}
                          {new Date(lote.criadoEm.replace(" ", "T") + "Z").toLocaleString("pt-BR")}{" "}
                          • {nItens} {nItens === 1 ? "item" : "itens"} proposto(s)
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <span className="inline-flex items-center gap-1 font-bold text-warning">
                            <Clock className="size-3.5 animate-pulse" /> Aguardando Decisão
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Lot Content */}
                    {isExpanded && (
                      <div className="p-5 space-y-4">
                        {/* Justification Box */}
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                          <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1 mb-1">
                            <MessageSquare className="size-3.5" /> Justificativa do Fornecedor para
                            o Reajuste
                          </Label>
                          <p className="text-sm font-medium text-foreground italic">
                            "{lote.justificativa || "Nenhuma justificativa fornecida."}"
                          </p>
                        </div>

                        {/* Items Table */}
                        <div className="border border-border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                {cabecalhoItem("sku", "SKU", "SKU", "w-[150px]")}
                                {cabecalhoItem("descricao", "descrição", "Descrição", "min-w-[200px]")}
                                {cabecalhoItem("atual", "custo atual", "Custo", "text-right")}
                                {cabecalhoItem("proposto", "custo proposto", "Proposto", "text-right")}
                                {cabecalhoItem("delta", "reajuste", "Reajuste", "text-center w-[110px]")}
                                {cabecalhoItem("resposta", "comentário do comprador", "Comentário", "min-w-[250px] pl-6")}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {itensVisiveis(lote.itens).map((p) => {
                                const pctDelta =
                                  ((p.precoProposto - p.precoAtual) / p.precoAtual) * 100;
                                const isProcessing = processandoId === p.id;
                                const currentResponse = respostasAdmin[p.id] ?? "";

                                return (
                                  <TableRow key={p.id} className="hover:bg-muted/10 h-14">
                                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                                    <TableCell className="font-semibold text-sm">
                                      {p.descricao}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                      {brl(p.precoAtual)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm text-primary font-bold">
                                      {brl(p.precoProposto)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <span
                                        className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold font-mono ${pctDelta >= 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
                                      >
                                        {pctDelta >= 0 ? "+" : ""}
                                        {pctDelta.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="pl-6">
                                      <div className="flex items-center gap-2 py-1">
                                        <Input
                                          placeholder="Aprovação rápida ou motivo da recusa..."
                                          value={currentResponse}
                                          onChange={(e) => handleInputChange(p.id, e.target.value)}
                                          disabled={isProcessing}
                                          className="h-9 text-xs flex-1 max-w-[240px]"
                                        />
                                        <div className="flex gap-1.5">
                                          <Button
                                            size="sm"
                                            variant="success"
                                            className="h-9 px-3 text-xs"
                                            onClick={() => handleResponder(p.id, "aprovado")}
                                            disabled={isProcessing}
                                          >
                                            Aprovar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-9 px-3 text-xs"
                                            onClick={() => handleResponder(p.id, "rejeitado")}
                                            disabled={isProcessing}
                                          >
                                            Recusar
                                          </Button>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analisados" className="space-y-4">
          {carregando ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando histórico...
            </div>
          ) : lotesAgrupados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
              Nenhuma proposta analisada/finalizada encontrada.
            </div>
          ) : (
            <div className="space-y-4">
              {lotesAgrupados.map((lote) => {
                const isExpanded = expandedLots[lote.loteId] === true; // collapsed by default
                const nItens = lote.itens.length;

                return (
                  <Card
                    key={lote.loteId}
                    className="shadow-panel overflow-hidden border border-border"
                  >
                    {/* Lot Header */}
                    <div
                      onClick={() => toggleLot(lote.loteId)}
                      className="bg-muted/20 px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-mono text-xs font-bold text-foreground">
                            {lote.loteId}
                          </h4>
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            Fornecedor: {lote.fornecedorCodigo}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Recebido em{" "}
                          {new Date(lote.criadoEm.replace(" ", "T") + "Z").toLocaleString("pt-BR")}{" "}
                          • {nItens} {nItens === 1 ? "item" : "itens"} reajustado(s)
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Clique para ver os itens
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Lot Content */}
                    {isExpanded && (
                      <div className="p-5 space-y-4">
                        <div className="bg-muted/20 p-3 rounded border">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                            Justificativa Original
                          </p>
                          <p className="text-xs italic">
                            "{lote.justificativa || "Nenhuma justificativa fornecida."}"
                          </p>
                        </div>

                        <div className="border border-border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30 h-8">
                                {cabecalhoItem("sku", "SKU", "SKU", "py-1 text-xs")}
                                {cabecalhoItem("descricao", "descrição", "Descrição", "py-1 text-xs")}
                                {cabecalhoItem("atual", "custo anterior", "Anterior", "py-1 text-xs text-right")}
                                {cabecalhoItem("proposto", "custo proposto", "Proposto", "py-1 text-xs text-right")}
                                {cabecalhoItem("delta", "delta", "Delta", "py-1 text-xs text-center w-[100px]")}
                                {cabecalhoItem("status", "status", "Status", "py-1 text-xs text-center w-[120px]")}
                                {cabecalhoItem("resposta", "comentário do comprador", "Comentário", "py-1 text-xs pl-6")}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {itensVisiveis(lote.itens).map((p) => {
                                const pctDelta =
                                  ((p.precoProposto - p.precoAtual) / p.precoAtual) * 100;
                                const approved = p.status === "aprovado";
                                const badgeColor = approved
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-danger/10 text-danger border-danger/30";
                                const StatusIcon = approved ? CheckCircle : XCircle;

                                return (
                                  <TableRow key={p.id} className="hover:bg-muted/10 h-10">
                                    <TableCell className="py-1 font-mono text-[10px]">
                                      {p.sku}
                                    </TableCell>
                                    <TableCell className="py-1 text-xs font-semibold">
                                      {p.descricao}
                                    </TableCell>
                                    <TableCell className="py-1 text-right font-mono text-[10px] text-muted-foreground">
                                      {brl(p.precoAtual)}
                                    </TableCell>
                                    <TableCell className="py-1 text-right font-mono text-xs text-primary font-bold">
                                      {brl(p.precoProposto)}
                                    </TableCell>
                                    <TableCell className="py-1 text-center font-mono">
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${pctDelta >= 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}
                                      >
                                        {pctDelta >= 0 ? "+" : ""}
                                        {pctDelta.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-1 text-center">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}
                                      >
                                        <StatusIcon className="size-3" />{" "}
                                        {approved ? "Aprovado" : "Recusado"}
                                      </span>
                                    </TableCell>
                                    <TableCell
                                      className="py-1 pl-6 text-xs text-muted-foreground italic max-w-[300px] truncate"
                                      title={p.respostaAdmin || ""}
                                    >
                                      "{p.respostaAdmin || "—"}"
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PortalLayout>
  );
}
