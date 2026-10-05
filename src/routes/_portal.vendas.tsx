import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { brl, dataBR, numero } from "@/lib/format";
import { codigoProdutoComDigito, lojas, produtoPorSku, produtos, vendas } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas Sell-Out | Portal do Fornecedor" },
      {
        name: "description",
        content: "Relatório de vendas item a item por loja e período com exportação para Excel.",
      },
      { property: "og:title", content: "Vendas Sell-Out | Portal do Fornecedor" },
      {
        property: "og:description",
        content: "Filtre por data, loja e produto e exporte o relatório de sell-out.",
      },
    ],
  }),
  component: VendasPage,
});

const hojeISO = new Date().toISOString().slice(0, 10);
const inicioPadrao = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

function VendasPage() {
  const [de, setDe] = useState(inicioPadrao);
  const [ate, setAte] = useState(hojeISO);
  const [loja, setLoja] = useState("todas");
  const [sku, setSku] = useState("todos");
  const [busca, setBusca] = useState("");
  const [agrupamento, setAgrupamento] = useState<"dia" | "mes" | "produto">("dia");
  const [ordenacao, setOrdenacao] = useState<{ campo: "data" | "loja" | "sku" | "produto" | "quantidade" | "unitario" | "total"; asc: boolean }>({ campo: "data", asc: false });

  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome ?? id;

  // 1. Filtragem inicial
  const filtradas = useMemo(
    () =>
      vendas.filter((v) => {
        if (v.data < de || v.data > ate) return false;
        if (loja !== "todas" && v.lojaId !== loja) return false;
        if (sku !== "todos" && v.sku !== sku) return false;
        if (busca) {
          const alvo =
            `${v.sku} ${codigoProdutoComDigito(v.sku)} ${produtoPorSku(v.sku).descricao} ${nomeLoja(v.lojaId)}`.toLowerCase();
          if (!alvo.includes(busca.toLowerCase())) return false;
        }
        return true;
      }),
    [de, ate, loja, sku, busca],
  );

  // 2. Agrupamento dinâmico obrigatório (mínimo: diário)
  const agrupadas = useMemo(() => {
    const mapa = new Map<string, { data: string; lojaId: string; sku: string; quantidade: number; faturamento: number }>();

    filtradas.forEach((v) => {
      let chave = "";
      let dataAgrupada = v.data;
      let lojaAgrupada = v.lojaId;
      let skuAgrupado = v.sku;

      if (agrupamento === "dia") {
        chave = `${v.data}-${v.lojaId}-${v.sku}`;
      } else if (agrupamento === "mes") {
        const mes = v.data.slice(0, 7); // YYYY-MM
        chave = `${mes}-${v.lojaId}-${v.sku}`;
        dataAgrupada = `${mes}-15`; // Usa o dia 15 para representar o faturamento do mês
      } else if (agrupamento === "produto") {
        chave = `${v.sku}`;
        lojaAgrupada = "todas";
        dataAgrupada = "-";
      }

      const atual = mapa.get(chave) || {
        data: dataAgrupada,
        lojaId: lojaAgrupada,
        sku: skuAgrupado,
        quantidade: 0,
        faturamento: 0,
      };

      atual.quantidade += v.quantidade;
      atual.faturamento += v.quantidade * v.valorUnitario;
      mapa.set(chave, atual);
    });

    return Array.from(mapa.values()).map((item, index) => ({
      id: index,
      data: item.data,
      lojaId: item.lojaId,
      sku: item.sku,
      quantidade: item.quantidade,
      valorUnitario: item.quantidade > 0 ? item.faturamento / item.quantidade : 0,
    }));
  }, [filtradas, agrupamento]);

  const agrupadasOrdenadas = useMemo(() => [...agrupadas].sort((a, b) => {
    const valor = (item: typeof a) => ordenacao.campo === "data" ? item.data : ordenacao.campo === "loja" ? nomeLoja(item.lojaId) : ordenacao.campo === "sku" ? item.sku : ordenacao.campo === "produto" ? produtoPorSku(item.sku).descricao : ordenacao.campo === "quantidade" ? item.quantidade : ordenacao.campo === "unitario" ? item.valorUnitario : item.quantidade * item.valorUnitario;
    const av = valor(a); const bv = valor(b);
    const comparacao = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true, sensitivity: "base" });
    return ordenacao.asc ? comparacao : -comparacao;
  }), [agrupadas, ordenacao]);

  const ordenar = (campo: typeof ordenacao.campo) => setOrdenacao((atual) => ({ campo, asc: atual.campo === campo ? !atual.asc : true }));

  const totalValor = useMemo(() => agrupadas.reduce((acc, v) => acc + v.quantidade * v.valorUnitario, 0), [agrupadas]);
  const totalQtd = useMemo(() => agrupadas.reduce((acc, v) => acc + v.quantidade, 0), [agrupadas]);

  function exportar() {
    const cabecalho = [
      "Data/Periodo",
      "Loja",
      "Código Produto",
      "Produto",
      "Quantidade Total",
      "Valor Unitario Medio",
      "Valor Total",
    ];
    const linhas = agrupadas.map((v) => [
      v.data === "-" ? "Consolidado Geral" : agrupamento === "mes" ? v.data.slice(0, 7) : dataBR(v.data),
      v.lojaId === "todas" ? "Todas as Lojas (Agrupado)" : nomeLoja(v.lojaId),
      codigoProdutoComDigito(v.sku),
      produtoPorSku(v.sku).descricao,
      String(v.quantidade),
      v.valorUnitario.toFixed(2).replace(".", ","),
      (v.quantidade * v.valorUnitario).toFixed(2).replace(".", ","),
    ]);
    const csv = [cabecalho, ...linhas].map((l) => l.map((c) => `"${c}"`).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sell-out-${agrupamento}-${de}-a-${ate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado", {
      description: `${agrupadas.length} linhas em formato Excel (CSV).`,
    });
  }

  return (
    <PortalLayout
      titulo="Vendas Sell-Out"
      descricao="Análise e relatórios de vendas realizadas nas lojas Líder com agrupamento dinâmico."
    >
      <div className="space-y-4">
        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="de">Data inicial</Label>
              <Input id="de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ate">Data final</Label>
              <Input id="ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Loja</Label>
              <Select value={loja} onValueChange={setLoja}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {lojas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={sku} onValueChange={setSku}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.sku} value={p.sku}>
                      {codigoProdutoComDigito(p.sku)} · {p.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agrupamento</Label>
              <Select value={agrupamento} onValueChange={(value: any) => setAgrupamento(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Agrupar por Dia</SelectItem>
                  <SelectItem value="mes">Agrupar por Mês</SelectItem>
                  <SelectItem value="produto">Agrupar por Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="busca">Filtrar por texto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="busca"
                  placeholder="Código ou descrição..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Volume: <span className="font-semibold text-foreground">{numero(totalQtd)} un</span>
            </span>
            <span className="text-muted-foreground">
              Faturamento: <span className="font-semibold text-foreground">{brl(totalValor)}</span>
            </span>
          </div>
          <Button onClick={exportar} disabled={agrupadas.length === 0}>
            <Download className="size-4" /> Exportar para Excel
          </Button>
        </div>

        <Card className="shadow-panel">
          <CardContent className="pt-6">
            <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead><button type="button" onClick={() => ordenar("data")} className="inline-flex items-center gap-1">Data/Período ↕</button></TableHead>
                    <TableHead><button type="button" onClick={() => ordenar("loja")} className="inline-flex items-center gap-1">Loja ↕</button></TableHead>
                    <TableHead><button type="button" onClick={() => ordenar("sku")} className="inline-flex items-center gap-1">Cód. produto ↕</button></TableHead>
                    <TableHead><div className="flex items-center gap-1"><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Produto / código" className="h-7 min-w-[150px] text-xs" /><button type="button" onClick={() => ordenar("produto")} aria-label="Ordenar produto">↕</button></div></TableHead>
                    <TableHead className="text-right"><button type="button" onClick={() => ordenar("quantidade")} className="inline-flex items-center gap-1">Qtd Total ↕</button></TableHead>
                    <TableHead className="text-right"><button type="button" onClick={() => ordenar("unitario")} className="inline-flex items-center gap-1">Val. Unit. Médio ↕</button></TableHead>
                    <TableHead className="text-right"><button type="button" onClick={() => ordenar("total")} className="inline-flex items-center gap-1">Total faturado ↕</button></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agrupadasOrdenadas.slice(0, 300).map((v, i) => (
                    <TableRow key={`${v.data}-${v.lojaId}-${v.sku}-${i}`}>
                      <TableCell>
                        {v.data === "-" ? "Consolidado Geral" : agrupamento === "mes" ? v.data.slice(0, 7) : dataBR(v.data)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {v.lojaId === "todas" ? "Todas as lojas (Agrupado)" : nomeLoja(v.lojaId)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {codigoProdutoComDigito(v.sku)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {produtoPorSku(v.sku).descricao}
                      </TableCell>
                      <TableCell className="text-right">{numero(v.quantidade)}</TableCell>
                      <TableCell className="text-right">{brl(v.valorUnitario)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {brl(v.quantidade * v.valorUnitario)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {agrupadas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma venda encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {agrupadas.length > 300 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Exibindo as 300 primeiras linhas agrupadas. Exporte para Excel para ver o relatório completo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
