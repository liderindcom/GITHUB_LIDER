import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { 
  Search, 
  Download, 
  Package, 
  ShoppingBag, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Tags,
  Layers3
} from "lucide-react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePortal } from "@/context/portal-context";
import { numero } from "@/lib/format";
import { 
  produtos, 
  estoque, 
  pedidos, 
  vendas, 
  produtoPorSku,
  type Produto, 
  type Pedido 
} from "@/lib/mock-data";
import { calcularSugestoesCompraCdam } from "@/lib/sugestao-compra";

export const Route = createFileRoute("/_portal/itens")({
  head: () => ({
    meta: [
      { title: "Meus Itens e Cobertura | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhe todos os seus itens, venda média, classificação, pedidos em aberto, pendências e cobertura de estoque.",
      },
      { property: "og:title", content: "Meus Itens e Cobertura | Portal do Fornecedor" },
    ],
  }),
  component: ItensPage,
});

function ItensPage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [busca, setBusca] = useState("");
  const [classeFiltro, setClasseFiltro] = useState("todas");
  const [pendenciaFiltro, setPendenciaFiltro] = useState("todas");
  const [coberturaFiltro, setCoberturaFiltro] = useState("todas");

  // Load suggestions which contains composite classes, stock, sales, coverage
  const sugestoes = useMemo(() => {
    void dadosFornecedorVersao;
    return calcularSugestoesCompraCdam("90"); // 90 days window
  }, [dadosFornecedorVersao]);

  // Map to help access calculated suggestions per SKU
  const sugestaoPorSku = useMemo(() => {
    const map = new Map<string, typeof sugestoes[0]>();
    for (const s of sugestoes) {
      map.set(s.produto.sku, s);
    }
    return map;
  }, [sugestoes]);

  // Map open orders per SKU
  const pedidosPorSku = useMemo(() => {
    const map = new Map<string, { id: string; status: string; dataEmissao: string; quantidade: number }[]>();
    for (const pedido of pedidos) {
      if (["Aberto", "Pendente", "Faturado"].includes(pedido.status)) {
        for (const item of pedido.itens) {
          const list = map.get(item.sku) || [];
          const saldo = Math.max(0, item.quantidadePedida - item.quantidadeFaturada);
          if (saldo > 0) {
            list.push({
              id: pedido.numero,
              status: pedido.status,
              dataEmissao: pedido.emissao,
              quantidade: saldo
            });
            map.set(item.sku, list);
          }
        }
      }
    }
    return map;
  }, [pedidos]);

  // Aggregate stock and sales per SKU across all stores
  const estoqueESalesPorSku = useMemo(() => {
    const map = new Map<string, { totalStock: number; averageSalesDaily: number; totalCoverage: number | null }>();
    for (const p of produtos) {
      const sku = p.sku;
      // Total Stock
      const skuEstoque = estoque.filter(e => e.sku === sku);
      const totalStock = skuEstoque.reduce((acc, curr) => acc + curr.estoqueAtual, 0);

      // Average Daily Sales (based on 90 days of vendas)
      const skuVendas = vendas.filter(v => v.sku === sku);
      const totalSales = skuVendas.reduce((acc, curr) => acc + curr.quantidade, 0);
      const averageSalesDaily = totalSales / 90;

      const totalCoverage = averageSalesDaily > 0 ? totalStock / averageSalesDaily : null;
      map.set(sku, { totalStock, averageSalesDaily, totalCoverage });
    }
    return map;
  }, [produtos, estoque, vendas]);

  // Map each product to a full rich row item
  const listaItens = useMemo(() => {
    return produtos.map((produto) => {
      const sug = sugestaoPorSku.get(produto.sku);
      const orders = pedidosPorSku.get(produto.sku) || [];
      const stockSales = estoqueESalesPorSku.get(produto.sku) || { totalStock: 0, averageSalesDaily: 0, totalCoverage: null };

      const hasPendente = orders.some((o) => o.status === "Pendente");
      const openOrderQty = orders.reduce((acc, curr) => acc + curr.quantidade, 0);

      // We can use standard composite class (e.g. Aa, Ab) or fallback to "Dd"
      const classe = sug?.classeComposta || "Dd";
      const vendaMediaDiaria = sug?.vendaMediaDiaria || stockSales.averageSalesDaily;
      const vendaMediaMensal = vendaMediaDiaria * 30;

      // Coverage: use CDAM coverage from suggestions or total coverage across stores as a backup
      const coberturaCdam = sug?.coberturaAtual ?? null;
      const coberturaGeral = stockSales.totalCoverage;

      return {
        produto,
        classe,
        vendaMediaDiaria,
        vendaMediaMensal,
        pedidosAbertos: orders,
        openOrderQty,
        hasPendente,
        coberturaCdam,
        coberturaGeral,
        totalStock: stockSales.totalStock,
      };
    });
  }, [produtos, sugestaoPorSku, pedidosPorSku, estoqueESalesPorSku]);

  // Filter items
  const listaFiltrada = useMemo(() => {
    return listaItens.filter((item) => {
      // Filter by text search
      if (busca) {
        const query = busca.toLowerCase();
        const target = `${item.produto.sku} ${item.produto.descricao} ${item.produto.subgrupo}`.toLowerCase();
        if (!target.includes(query)) return false;
      }

      // Filter by class (e.g., A, B, C, D based on first letter of composite class)
      if (classeFiltro !== "todas") {
        if (!item.classe.startsWith(classeFiltro)) return false;
      }

      // Filter by pendency
      if (pendenciaFiltro !== "todas") {
        const value = pendenciaFiltro === "sim";
        if (item.hasPendente !== value) return false;
      }

      // Filter by stock coverage situation
      if (coberturaFiltro !== "todas") {
        const cob = item.coberturaCdam;
        if (coberturaFiltro === "ruptura") {
          if (item.totalStock === 0) return true;
          if (cob !== null && cob === 0) return true;
          return false;
        }
        if (coberturaFiltro === "baixa") {
          if (cob !== null && cob > 0 && cob <= 7) return true;
          return false;
        }
        if (coberturaFiltro === "critica") {
          if (cob === null || cob <= 7) return true;
          return false;
        }
        if (coberturaFiltro === "confortavel") {
          if (cob !== null && cob > 7 && cob <= 45) return true;
          return false;
        }
        if (coberturaFiltro === "excesso") {
          if (cob !== null && cob > 45) return true;
          return false;
        }
      }

      return true;
    });
  }, [listaItens, busca, classeFiltro, pendenciaFiltro, coberturaFiltro]);

  // KPI Calculations
  const totalItens = listaItens.length;
  const totalFiltrados = listaFiltrada.length;
  const comPendencias = listaItens.filter((i) => i.hasPendente).length;
  const totalVendaMensal = listaItens.reduce((acc, curr) => acc + curr.vendaMediaMensal, 0);
  const totalPedidosAbertosQty = listaItens.reduce((acc, curr) => acc + curr.openOrderQty, 0);

  function exportar() {
    const cabecalho = [
      "SKU",
      "Descricao",
      "Subgrupo",
      "Classe",
      "Venda Media Diaria (un)",
      "Venda Media Mensal (un)",
      "Estoque CDAM (un)",
      "Pedido em Aberto (un)",
      "Tem Pendencia (Status Pendente)",
      "Cobertura CDAM (dias)",
      "Estoque Geral (un)",
      "Cobertura Geral (dias)"
    ];

    const linhasCsv = listaFiltrada.map((item) => [
      item.produto.sku,
      item.produto.descricao,
      item.produto.subgrupo || "",
      item.classe,
      item.vendaMediaDiaria.toFixed(2),
      Math.round(item.vendaMediaMensal),
      item.coberturaCdam !== null && item.vendaMediaDiaria > 0 ? Math.round(item.coberturaCdam * item.vendaMediaDiaria) : 0,
      item.openOrderQty,
      item.hasPendente ? "SIM" : "NAO",
      item.coberturaCdam !== null ? Math.round(item.coberturaCdam) : "Sem venda",
      item.totalStock,
      item.coberturaGeral !== null ? Math.round(item.coberturaGeral) : "Sem venda"
    ]);

    const csv = [cabecalho, ...linhasCsv].map((row) => row.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "meus-itens-e-cobertura.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados", {
      description: `${linhasCsv.length} itens exportados com sucesso in formato CSV.`,
    });
  }

  return (
    <PortalLayout
      titulo="Meus Itens e Cobertura"
      descricao="Painel consolidado de rastreamento de SKUs: venda média, classificação, pedidos em aberto, pendências documentais e cobertura de estoque."
    >
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-border bg-card shadow-panel">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <Package className="size-5" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Total de Itens</p>
                <p className="text-xl font-bold">{totalItens} <span className="text-xs font-normal text-muted-foreground">({totalFiltrados} filtrados)</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-panel">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-success-soft p-2.5 text-success border border-success/20">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Venda Mensal Total</p>
                <p className="text-xl font-bold">{numero(Math.round(totalVendaMensal))} <span className="text-xs font-normal text-muted-foreground">un/mês</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-panel">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-warning-soft p-2.5 text-warning border border-warning/20">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Itens com Pendência</p>
                <p className="text-xl font-bold">{comPendencias} <span className="text-xs font-normal text-muted-foreground">SKUs</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-panel">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary border border-primary/20">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Qtd em Aberto</p>
                <p className="text-xl font-bold">{numero(totalPedidosAbertosQty)} <span className="text-xs font-normal text-muted-foreground">un</span></p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Card */}
        <Card className="shadow-panel">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Search className="size-4 text-primary" /> Filtros e Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="busca" className="text-xs font-semibold">Pesquisar SKU, Descrição ou Subgrupo</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="busca"
                    placeholder="Pesquisar..."
                    className="pl-8 h-9 text-xs"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Filtrar por Classe</Label>
                <Select value={classeFiltro} onValueChange={setClasseFiltro}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todas as Classes</SelectItem>
                    <SelectItem value="A" className="text-xs">Classe A</SelectItem>
                    <SelectItem value="B" className="text-xs">Classe B</SelectItem>
                    <SelectItem value="C" className="text-xs">Classe C</SelectItem>
                    <SelectItem value="D" className="text-xs">Classe D</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Possui Pendência?</Label>
                <Select value={pendenciaFiltro} onValueChange={setPendenciaFiltro}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todos</SelectItem>
                    <SelectItem value="sim" className="text-xs">Sim (Status Pendente)</SelectItem>
                    <SelectItem value="nao" className="text-xs">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Situação Cobertura</Label>
                <Select value={coberturaFiltro} onValueChange={setCoberturaFiltro}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todas as situações</SelectItem>
                    <SelectItem value="ruptura" className="text-xs">Ruptura (Sem Estoque)</SelectItem>
                    <SelectItem value="baixa" className="text-xs">Crítica / Baixa (0 a 7 dias)</SelectItem>
                    <SelectItem value="confortavel" className="text-xs">Confortável (8 a 45 dias)</SelectItem>
                    <SelectItem value="excesso" className="text-xs">Excesso (&gt; 45 dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button size="sm" variant="outline" className="h-8 text-xs flex items-center gap-1.5" onClick={exportar}>
                <Download className="size-3.5" /> Exportar para CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card className="shadow-panel">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-[80px]">SKU</TableHead>
                    <TableHead className="min-w-[200px]">Descrição do Item</TableHead>
                    <TableHead>Subgrupo</TableHead>
                    <TableHead className="text-right">Venda Média Diária</TableHead>
                    <TableHead className="text-right">Venda Média Mensal</TableHead>
                    <TableHead className="text-center">Classe</TableHead>
                    <TableHead className="text-right">Pedido Aberto</TableHead>
                    <TableHead className="text-center">Se Tem Pendência</TableHead>
                    <TableHead className="text-right">Cobertura CDAM</TableHead>
                    <TableHead className="text-right">Estoque CDAM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaFiltrada.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhum item encontrado com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    listaFiltrada.map((item) => {
                      const cob = item.coberturaCdam;
                      const hasVenda = item.vendaMediaDiaria > 0;
                      
                      // Cobertura text and styling
                      let cobText = "Sem venda";
                      let cobStyle = "text-muted-foreground bg-muted";
                      if (hasVenda) {
                        if (cob === null || cob === 0) {
                          cobText = "Ruptura";
                          cobStyle = "text-danger bg-danger-soft border-danger/20";
                        } else {
                          const dias = Math.round(cob);
                          cobText = `${dias}d`;
                          if (dias <= 7) {
                            cobStyle = "text-danger bg-danger-soft border-danger/20 font-semibold";
                          } else if (dias <= 15) {
                            cobStyle = "text-warning bg-warning-soft border-warning/20";
                          } else if (dias <= 45) {
                            cobStyle = "text-success bg-success-soft border-success/20";
                          } else {
                            cobStyle = "text-primary bg-primary/10 border-primary/20";
                          }
                        }
                      }

                      // Badge styles for classification Aa, Ab...
                      let classBadgeStyle = "bg-muted text-muted-foreground";
                      if (item.classe.startsWith("A")) {
                        classBadgeStyle = "bg-success-soft text-success border border-success/30 font-bold";
                      } else if (item.classe.startsWith("B")) {
                        classBadgeStyle = "bg-primary/10 text-primary border border-primary/30";
                      } else if (item.classe.startsWith("C")) {
                        classBadgeStyle = "bg-warning-soft text-warning border border-warning/30";
                      }

                      return (
                        <TableRow key={item.produto.sku} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold">{item.produto.sku}</TableCell>
                          <TableCell className="font-medium text-xs max-w-[260px] truncate" title={item.produto.descricao}>
                            {item.produto.descricao}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {item.produto.subgrupo}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {item.vendaMediaDiaria.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {numero(Math.round(item.vendaMediaMensal))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={"text-[10px] px-1.5 py-0.5 h-5 uppercase " + classBadgeStyle}>
                              {item.classe}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {item.openOrderQty > 0 ? (
                              <span className="text-primary font-semibold">{numero(item.openOrderQty)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.hasPendente ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-warning bg-warning-soft border-warning/30 flex items-center justify-center gap-1 mx-auto w-fit">
                                <AlertTriangle className="size-3" /> Sim
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-muted-foreground bg-muted flex items-center justify-center gap-1 mx-auto w-fit">
                                <CheckCircle2 className="size-3 text-muted-foreground/60" /> Não
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={"text-xs px-2 py-0.5 font-mono " + cobStyle}>
                              {cobText}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {numero(Math.round(item.coberturaCdam !== null && item.vendaMediaDiaria > 0 ? item.coberturaCdam * item.vendaMediaDiaria : 0))}
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
      </div>
    </PortalLayout>
  );
}
