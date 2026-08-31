import { createFileRoute } from "@tanstack/react-router";
import { Percent, Tag, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { rebaixasMock, ofertasValidadeMock } from "@/lib/mock-data";

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
  const [busca, setBusca] = useState("");

  const rebaixasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return rebaixasMock.filter(
      (r) =>
        r.sku.toLowerCase().includes(termo) ||
        r.descricao.toLowerCase().includes(termo) ||
        r.lojaNome.toLowerCase().includes(termo) ||
        r.tipoRebaixa.toLowerCase().includes(termo)
    );
  }, [busca]);

  const ofertasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase();
    return ofertasValidadeMock.filter(
      (o) =>
        o.sku.toLowerCase().includes(termo) ||
        o.descricao.toLowerCase().includes(termo) ||
        o.lojaNome.toLowerCase().includes(termo) ||
        o.status.toLowerCase().includes(termo)
    );
  }, [busca]);

  return (
    <PortalLayout
      titulo="Ofertas e Rebaixas"
      descricao="Acompanhe as rebaixas de preço vigentes e as ofertas especiais de validade praticadas na rede Grupo Líder."
    >
      <div className="space-y-4">
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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="rebaixas" className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Rebaixas em Andamento ({rebaixasFiltradas.length})
            </TabsTrigger>
            <TabsTrigger value="validade" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Ofertas Validade ({ofertasFiltradas.length})
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
                  Listagem de produtos que estão passando por rebaixa temporária de preço acordada com as filiais.
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
                        <TableHead className="text-right">Qtd. Vendida</TableHead>
                        <TableHead className="text-right pr-6">Reembolso Est.</TableHead>
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
                            <TableCell className="text-right">{brl(item.precoVendaAnterior)}</TableCell>
                            <TableCell className="text-right text-primary font-semibold">
                              {brl(item.precoVendaOferta)}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-semibold">
                              {percentual(item.descontoPercentual)}
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono whitespace-nowrap">
                              {dataBR(item.dataInicio)} - {dataBR(item.dataFim)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal">
                                {item.tipoRebaixa}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{numero(item.quantidadeVenda)}</TableCell>
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
                                {dataBR(item.dataVencimento)}
                              </TableCell>
                              <TableCell className="text-center text-sm font-mono whitespace-nowrap">
                                {dataBR(item.dataInicio)} - {dataBR(item.dataFim)}
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
        </Tabs>
      </div>
    </PortalLayout>
  );
}
