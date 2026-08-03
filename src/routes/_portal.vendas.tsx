import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, dataBR, numero } from "@/lib/format";
import { lojas, produtoPorSku, produtos, vendas } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas Sell-Out | Portal do Fornecedor" },
      { name: "description", content: "Relatório de vendas item a item por loja e período com exportação para Excel." },
      { property: "og:title", content: "Vendas Sell-Out | Portal do Fornecedor" },
      { property: "og:description", content: "Filtre por data, loja e SKU e exporte o relatório de sell-out." },
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

  const filtradas = useMemo(
    () =>
      vendas.filter((v) => {
        if (v.data < de || v.data > ate) return false;
        if (loja !== "todas" && v.lojaId !== loja) return false;
        if (sku !== "todos" && v.sku !== sku) return false;
        if (busca) {
          const alvo = `${v.sku} ${produtoPorSku(v.sku).descricao}`.toLowerCase();
          if (!alvo.includes(busca.toLowerCase())) return false;
        }
        return true;
      }),
    [de, ate, loja, sku, busca],
  );

  const totalValor = filtradas.reduce((acc, v) => acc + v.quantidade * v.valorUnitario, 0);
  const totalQtd = filtradas.reduce((acc, v) => acc + v.quantidade, 0);
  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome ?? id;

  function exportar() {
    const cabecalho = ["Data", "Loja", "SKU", "Produto", "Quantidade", "Valor Unitario", "Valor Total"];
    const linhas = filtradas.map((v) => [
      dataBR(v.data),
      nomeLoja(v.lojaId),
      v.sku,
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
    link.download = `sell-out-${de}-a-${ate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado", { description: `${filtradas.length} linhas em formato Excel (CSV).` });
  }

  return (
    <PortalLayout titulo="Vendas Sell-Out" descricao="Relatório item a item das vendas realizadas nas lojas Líder">
      <div className="space-y-4">
        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-5">
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
                  <SelectItem value="todos">Todos os SKUs</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.sku} value={p.sku}>
                      {p.sku} · {p.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="busca">Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="SKU ou descrição"
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-panel">
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="text-muted-foreground">
              Linhas: <span className="font-semibold text-foreground">{numero(filtradas.length)}</span>
            </span>
            <span className="text-muted-foreground">
              Volume: <span className="font-semibold text-foreground">{numero(totalQtd)} un</span>
            </span>
            <span className="text-muted-foreground">
              Faturamento: <span className="font-semibold text-foreground">{brl(totalValor)}</span>
            </span>
          </div>
          <Button onClick={exportar} disabled={filtradas.length === 0}>
            <Download className="size-4" /> Exportar para Excel
          </Button>
        </div>

        <Card className="shadow-panel">
          <CardContent className="pt-6">
            <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor un.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.slice(0, 300).map((v, i) => (
                    <TableRow key={`${v.data}-${v.lojaId}-${v.sku}-${i}`}>
                      <TableCell>{dataBR(v.data)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{nomeLoja(v.lojaId)}</TableCell>
                      <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{produtoPorSku(v.sku).descricao}</TableCell>
                      <TableCell className="text-right">{numero(v.quantidade)}</TableCell>
                      <TableCell className="text-right">{brl(v.valorUnitario)}</TableCell>
                      <TableCell className="text-right font-medium">{brl(v.quantidade * v.valorUnitario)}</TableCell>
                    </TableRow>
                  ))}
                  {filtradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Nenhuma venda encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filtradas.length > 300 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Exibindo as 300 primeiras linhas. Exporte para Excel para ver o relatório completo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
