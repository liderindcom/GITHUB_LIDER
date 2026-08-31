import { createFileRoute } from "@tanstack/react-router";
import { Download, PackageCheck, PackagePlus, Search, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { brl, numero } from "@/lib/format";
import { formatarClasseComposta } from "@/lib/mock-data";
import {
  calcularSugestoesCompraCdam,
  COBERTURA_BEST_SELLER_CDAM_DIAS,
  type JanelaSugestaoCompra,
  type LinhaSugestaoCompra,
} from "@/lib/sugestao-compra";

export const Route = createFileRoute("/_portal/sugestao-compra")({
  head: () => ({
    meta: [
      { title: "Sugestão de Compra CDAM | Portal do Fornecedor" },
      {
        name: "description",
        content: "Sugestão de compra para CDAM baseada em Best Seller Aa e cobertura alvo.",
      },
      { property: "og:title", content: "Sugestão de Compra CDAM | Portal do Fornecedor" },
    ],
  }),
  component: SugestaoCompraPage,
});

const coberturaTexto = (cobertura: number | null) =>
  cobertura === null ? "Sem venda" : `${numero(Math.round(cobertura))}d`;

function SugestaoCompraPage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [janela, setJanela] = useState<JanelaSugestaoCompra>("90");
  const [somenteComprar, setSomenteComprar] = useState("sim");
  const [busca, setBusca] = useState("");

  const linhas = useMemo<LinhaSugestaoCompra[]>(() => {
    void dadosFornecedorVersao;
    return calcularSugestoesCompraCdam(janela);
  }, [janela, dadosFornecedorVersao]);

  const lista = linhas.filter((linha) => {
    if (somenteComprar === "sim" && linha.sugestaoCompra <= 0) return false;
    if (busca) {
      const alvo =
        `${linha.codigo} ${linha.produto.sku} ${linha.produto.descricao} ${linha.subgrupo}`.toLowerCase();
      if (!alvo.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  const sugestaoTotal = lista.reduce((acc, linha) => acc + linha.sugestaoCompra, 0);
  const valorSugerido = lista.reduce((acc, linha) => acc + linha.valorSugerido, 0);
  const estoqueAlvoTotal = lista.reduce((acc, linha) => acc + linha.estoqueAlvo, 0);
  const pedidoAbertoTotal = lista.reduce((acc, linha) => acc + linha.pedidoAberto, 0);

  function exportar() {
    const cabecalho = [
      "Codigo",
      "Produto",
      "Comprador",
      "Fornecedor",
      "Subgrupo",
      "Classe",
      "Venda media diaria",
      "Cobertura base CDAM",
      "Lead time medio dias",
      "Cobertura usada dias",
      "Estoque alvo",
      "Estoque CDAM",
      "Pedido aberto",
      "Necessidade base",
      "Embalagem compra",
      "Tipo embalagem",
      "Qtd embalagens",
      "Sugestao compra ajustada",
      "Valor sugerido",
    ];
    const linhasCsv = lista.map((linha) => [
      linha.codigo,
      linha.produto.descricao,
      linha.comprador,
      linha.fornecedorNome,
      linha.subgrupo,
      linha.classeComposta,
      linha.vendaMediaDiaria.toFixed(2).replace(".", ","),
      `${COBERTURA_BEST_SELLER_CDAM_DIAS} dias`,
      `${linha.leadTimeEntregaDias} dias`,
      `${linha.coberturaObjetivoDias} dias`,
      String(linha.estoqueAlvo),
      String(linha.estoqueCdam),
      String(linha.pedidoAberto),
      String(linha.sugestaoBase),
      String(linha.embalagemCompra),
      linha.tipoEmbalagemCompra,
      String(linha.quantidadeEmbalagens),
      String(linha.sugestaoCompra),
      linha.valorSugerido.toFixed(2).replace(".", ","),
    ]);
    const csv = [cabecalho, ...linhasCsv]
      .map((row) => row.map((col) => `"${col}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sugestao-compra-cdam.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Sugestão exportada", {
      description: `${linhasCsv.length} produtos em formato Excel (CSV).`,
    });
  }

  return (
    <PortalLayout
      titulo="Sugestão de Compra CDAM"
      descricao={`Best Seller Aa com cobertura alvo de ${COBERTURA_BEST_SELLER_CDAM_DIAS} dias no CDAM mais o lead time médio de entrega`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Resumo titulo="Best Sellers Aa" valor={numero(linhas.length)} icone={PackageCheck} />
          <Resumo titulo="Sugestão total" valor={numero(sugestaoTotal)} icone={PackagePlus} />
          <Resumo titulo="Pedido aberto" valor={numero(pedidoAbertoTotal)} icone={Warehouse} />
          <Resumo titulo="Valor sugerido" valor={brl(valorSugerido)} icone={PackagePlus} />
        </div>

        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-[0.8fr_1fr_1.5fr_auto]">
            <div className="space-y-2">
              <Label>Venda média</Label>
              <Select value={janela} onValueChange={(value) => setJanela(value as JanelaSugestaoCompra)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mostrar</Label>
              <Select value={somenteComprar} onValueChange={setSomenteComprar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Somente com sugestão</SelectItem>
                  <SelectItem value="nao">Todos os Best Sellers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="busca-sugestao">Buscar produto</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-sugestao"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="pl-9"
                  placeholder="Código, descrição ou subgrupo"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button onClick={exportar} className="w-full">
                <Download className="size-4" /> Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Sugestão por produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead>Cód. produto</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Subgrupo</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Venda média/dia</TableHead>
                    <TableHead className="text-right">LT médio</TableHead>
                    <TableHead className="text-right">Alvo</TableHead>
                    <TableHead className="text-right">Estoque CDAM</TableHead>
                    <TableHead className="text-right">Cob. atual</TableHead>
                    <TableHead className="text-right">Pedido aberto</TableHead>
                    <TableHead className="text-right">Necessidade</TableHead>
                    <TableHead className="text-right">Emb.</TableHead>
                    <TableHead className="text-right">Sugestão</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((linha) => (
                    <TableRow key={linha.produto.sku}>
                      <TableCell className="font-mono text-xs">{linha.codigo}</TableCell>
                      <TableCell className="min-w-[240px] font-medium">
                        {linha.produto.descricao}
                      </TableCell>
                      <TableCell className="min-w-[180px] text-xs">{linha.comprador}</TableCell>
                      <TableCell className="min-w-[180px] text-xs">{linha.subgrupo}</TableCell>
                      <TableCell>
                        {linha.classeComposta === "Aa" ? (
                          <span className="inline-flex items-center justify-center gap-1 rounded bg-amber-950 border border-amber-500/40 px-2 py-1 text-[10px] font-extrabold text-amber-300 shadow-sm animate-pulse">
                            ⭐ Aa <span className="text-[8px] uppercase tracking-wider text-amber-200">Top Star</span>
                          </span>
                        ) : (
                          <Badge className="border-0 bg-primary text-primary-foreground">
                            {formatarClasseComposta(linha.classeComposta)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {linha.vendaMediaDiaria.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}
                      </TableCell>
                      <TableCell className="text-right">{linha.leadTimeEntregaDias}d</TableCell>
                      <TableCell className="text-right">
                        {numero(linha.estoqueAlvo)}
                        <p className="text-[0.65rem] text-muted-foreground">
                          {COBERTURA_BEST_SELLER_CDAM_DIAS}d + {linha.leadTimeEntregaDias}d
                        </p>
                      </TableCell>
                      <TableCell className="text-right">{numero(linha.estoqueCdam)}</TableCell>
                      <TableCell className="text-right">
                        {coberturaTexto(linha.coberturaAtual)}
                      </TableCell>
                      <TableCell className="text-right">{numero(linha.pedidoAberto)}</TableCell>
                      <TableCell className="text-right">{numero(linha.sugestaoBase)}</TableCell>
                      <TableCell className="text-right">
                        {numero(linha.embalagemCompra)}
                        <p className="text-[0.65rem] text-muted-foreground">
                          {numero(linha.sugestaoCompra)} un.
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {numero(linha.quantidadeEmbalagens)} {linha.tipoEmbalagemCompra}
                      </TableCell>
                      <TableCell className="text-right">{brl(linha.valorSugerido)}</TableCell>
                    </TableRow>
                  ))}
                  {lista.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={15}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum Best Seller Aa com sugestão para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Fórmula: necessidade = venda média diária × (60 dias + lead time médio) - estoque CDAM
              - pedido em aberto; sugestão = necessidade arredondada para a embalagem de compra.
              Total alvo filtrado: {numero(estoqueAlvoTotal)} unidades.
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function Resumo({
  titulo,
  valor,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  icone: typeof PackagePlus;
}) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="font-display text-2xl font-bold">{valor}</p>
        </div>
        <Icone className="size-5 text-primary" />
      </CardContent>
    </Card>
  );
}
