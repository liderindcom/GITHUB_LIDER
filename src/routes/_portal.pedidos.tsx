import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, dataBR, numero } from "@/lib/format";
import { lojas, pedidos, produtoPorSku, totalPedido, type Pedido, type PedidoStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos de Compra | Portal do Fornecedor" },
      { name: "description", content: "Acompanhe os pedidos de compra emitidos pelo Grupo Líder e seus itens." },
      { property: "og:title", content: "Pedidos de Compra | Portal do Fornecedor" },
      { property: "og:description", content: "Filtre por status e veja itens, quantidades pedidas e faturadas." },
    ],
  }),
  component: PedidosPage,
});

const filtros: Array<PedidoStatus | "Todos"> = ["Todos", "Aberto", "Faturado", "Pendente", "Cancelado"];

const corStatus: Record<PedidoStatus, string> = {
  Aberto: "bg-accent text-accent-foreground",
  Faturado: "bg-success-soft text-success",
  Pendente: "bg-warning-soft text-warning",
  Cancelado: "bg-danger-soft text-danger",
};

function PedidosPage() {
  const [filtro, setFiltro] = useState<PedidoStatus | "Todos">("Todos");
  const [selecionado, setSelecionado] = useState<Pedido | null>(null);

  const lista = filtro === "Todos" ? pedidos : pedidos.filter((p) => p.status === filtro);
  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome ?? id;

  return (
    <PortalLayout titulo="Pedidos de Compra" descricao="Pedidos emitidos pelo Grupo Líder para a sua indústria">
      <Card className="shadow-panel">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filtro === f ? "default" : "outline"}
                onClick={() => setFiltro(f)}
              >
                {f}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Pedido</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Entrega prevista</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((pedido) => (
                  <TableRow
                    key={pedido.numero}
                    onClick={() => setSelecionado(pedido)}
                    className="cursor-pointer transition-colors hover:bg-accent/60"
                  >
                    <TableCell className="font-medium">{pedido.numero}</TableCell>
                    <TableCell>{dataBR(pedido.emissao)}</TableCell>
                    <TableCell>{dataBR(pedido.entregaPrevista)}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{nomeLoja(pedido.lojaId)}</TableCell>
                    <TableCell className="text-right">{pedido.itens.length}</TableCell>
                    <TableCell className="text-right font-medium">{brl(totalPedido(pedido))}</TableCell>
                    <TableCell>
                      <Badge className={`${corStatus[pedido.status]} border-0`}>{pedido.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {lista.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum pedido com esse status.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">Clique em um pedido para ver os itens detalhados.</p>
        </CardContent>
      </Card>

      <Sheet open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selecionado && (
            <>
              <SheetHeader>
                <SheetTitle>Pedido {selecionado.numero}</SheetTitle>
                <SheetDescription>
                  {nomeLoja(selecionado.lojaId)} · emissão {dataBR(selecionado.emissao)} · entrega{" "}
                  {dataBR(selecionado.entregaPrevista)}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                <Badge className={`${corStatus[selecionado.status]} border-0`}>{selecionado.status}</Badge>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60">
                        <TableHead>SKU</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Pedida</TableHead>
                        <TableHead className="text-right">Faturada</TableHead>
                        <TableHead className="text-right">Preço un.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selecionado.itens.map((item) => (
                        <TableRow key={item.sku}>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            {produtoPorSku(item.sku).descricao}
                          </TableCell>
                          <TableCell className="text-right">{numero(item.quantidadePedida)}</TableCell>
                          <TableCell className="text-right">{numero(item.quantidadeFaturada)}</TableCell>
                          <TableCell className="text-right">{brl(item.precoUnitario)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {brl(item.quantidadePedida * item.precoUnitario)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Total do pedido</span>
                  <span className="text-base font-semibold">{brl(totalPedido(selecionado))}</span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PortalLayout>
  );
}
