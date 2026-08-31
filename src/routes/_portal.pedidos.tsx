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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compradorPedido } from "@/lib/comprador";
import { brl, dataBR, numero, percentual } from "@/lib/format";
import { Building2, Clock3, Factory, Percent, Route as RouteIcon, User } from "lucide-react";
import {
  codigoProdutoComDigito,
  fillRateGeral,
  fillRatePedido,
  leadTimeEntregaCdam,
  nomeLoja,
  pedidos,
  produtoPorSku,
  produtos,
  quantidadesPedido,
  tempoMedioEntregaCdam,
  totalPedido,
  type Pedido,
  type PedidoStatus,
} from "@/lib/mock-data";
import { formatarNumeroPedido } from "@/lib/pedido-numero";
import {
  JANELA_PEDIDOS_DIAS,
  emissaoNosUltimosDias,
  mesFechadoIso,
  rotuloMesAno,
} from "@/lib/pedidos-janela";

export const Route = createFileRoute("/_portal/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos de Compra | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhe os pedidos de compra emitidos pelo Grupo Líder e seus itens.",
      },
      { property: "og:title", content: "Pedidos de Compra | Portal do Fornecedor" },
      {
        property: "og:description",
        content: "Filtre por status e veja itens, quantidades pedidas e faturadas.",
      },
    ],
  }),
  component: PedidosPage,
});

const filtros: Array<PedidoStatus | "Todos"> = [
  "Todos",
  "Aberto",
  "Faturado",
  "Pendente",
  "Entregue",
  "Cancelado",
];

const corStatus: Record<PedidoStatus, string> = {
  Aberto: "bg-accent text-accent-foreground",
  Faturado: "bg-success-soft text-success",
  Pendente: "bg-warning-soft text-warning",
  Entregue: "bg-success-soft text-success",
  Cancelado: "bg-danger-soft text-danger",
};

const corFillRate = (fillRate: number) => {
  if (fillRate >= 95) return "bg-success-soft text-success";
  if (fillRate >= 70) return "bg-warning-soft text-warning";
  return "bg-danger-soft text-danger";
};

function PedidosPage() {
  const [filtro, setFiltro] = useState<PedidoStatus | "Todos">("Todos");
  const [selecionado, setSelecionado] = useState<Pedido | null>(null);
  const pedidosFornecedor = pedidos.filter(
    (p) => p.destino === "Fornecedor" && emissaoNosUltimosDias(p.emissao, JANELA_PEDIDOS_DIAS),
  );

  const lista = pedidosFornecedor.filter((p) => {
    const statusOk = filtro === "Todos" || p.status === filtro;
    return statusOk;
  });

  const mesFillRate = mesFechadoIso();
  const pedidosMesFechado = pedidos.filter(
    (p) => p.destino === "Fornecedor" && (p.emissao || "").slice(0, 7) === mesFillRate,
  );
  const fillRateMes = fillRateGeral(pedidosMesFechado);
  const tempoMedio = tempoMedioEntregaCdam(pedidosFornecedor);

  return (
    <PortalLayout
      titulo="Pedidos de Compra"
      descricao={`Pedidos do Grupo Líder para o fornecedor nos últimos ${JANELA_PEDIDOS_DIAS} dias. Transferências internas loja/CDAM ficam de fora.`}
    >
      <Card className="shadow-panel">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <ResumoPedido
              titulo="Pedidos do fornecedor"
              valor={`${pedidosFornecedor.length}`}
              descricao={`Últimos ${JANELA_PEDIDOS_DIAS} dias (lista)`}
              icone={Factory}
            />
            <ResumoPedido
              titulo="Fila filtrada"
              valor={`${lista.length}`}
              descricao="Pedidos na visao atual"
              icone={RouteIcon}
            />
            <ResumoPedido
              titulo="Fill rate"
              valor={percentual(fillRateMes)}
              descricao={`${rotuloMesAno(mesFillRate)} · mesmo número do menu Fill rate`}
              icone={Percent}
            />
            <ResumoPedido
              titulo="Tempo médio"
              valor={tempoMedio === null ? "-" : `${tempoMedio.toFixed(1)} dias`}
              descricao="Últimos 5 entregues no CDAM"
              icone={Clock3}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
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
            </div>
          </div>

          <Table
            containerClassName="max-h-[500px] rounded-lg border border-border"
            className="border-separate border-spacing-0"
          >
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
              <TableRow className="bg-muted/60">
                  <TableHead>Pedido</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Entrada CDAM</TableHead>
                  <TableHead>Entrega prevista</TableHead>
                  <TableHead>Destino operacional</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Fill rate</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((pedido) => {
                  const comprador = compradorPedido(pedido.itens, produtoPorSku, produtos);
                  return (
                  <TableRow
                    key={`${pedido.numero}-${pedido.lojaId}`}
                    onClick={() => setSelecionado(pedido)}
                    className="cursor-pointer transition-colors hover:bg-accent/60"
                  >
                    <TableCell className="font-medium">{formatarNumeroPedido(pedido.numero)}</TableCell>
                    <TableCell>
                      <Badge className="border-0 bg-primary/10 text-primary">
                        {pedido.destino}
                      </Badge>
                    </TableCell>
                    <TableCell>{dataBR(pedido.emissao)}</TableCell>
                    <TableCell>{pedido.entradaCdam ? dataBR(pedido.entradaCdam) : "-"}</TableCell>
                    <TableCell>{dataBR(pedido.entregaPrevista)}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {pedido.destinoOperacional}
                    </TableCell>
                    <TableCell
                      className="max-w-[180px] truncate text-xs text-muted-foreground"
                      title={comprador}
                    >
                      {comprador}
                    </TableCell>
                    <TableCell className="text-right">{pedido.itens.length}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={`${corFillRate(fillRatePedido(pedido))} border-0`}>
                        {percentual(fillRatePedido(pedido))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {brl(totalPedido(pedido))}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${corStatus[pedido.status]} border-0`}>
                        {pedido.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {lista.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Nenhum pedido com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Clique em um pedido para ver os itens detalhados.
          </p>
        </CardContent>
      </Card>

      <Sheet open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selecionado && <DetalhePedido pedido={selecionado} nomeLoja={nomeLoja} />}
        </SheetContent>
      </Sheet>
    </PortalLayout>
  );
}

function DetalhePedido({ pedido, nomeLoja }: { pedido: Pedido; nomeLoja: (id: string) => string }) {
  const quantidades = quantidadesPedido(pedido);
  const fillRate = fillRatePedido(pedido);
  const leadTime = leadTimeEntregaCdam(pedido);
  const comprador = compradorPedido(pedido.itens, produtoPorSku, produtos);

  return (
    <>
      <SheetHeader>
        <SheetTitle>Pedido {formatarNumeroPedido(pedido.numero)}</SheetTitle>
        <SheetDescription>
          {pedido.destinoOperacional} · emissão {dataBR(pedido.emissao)} · entrega{" "}
          {dataBR(pedido.entregaPrevista)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          <Badge className="border-0 bg-primary/10 text-primary">{pedido.destino}</Badge>
          <Badge className={`${corStatus[pedido.status]} border-0`}>{pedido.status}</Badge>
          <Badge className={`${corFillRate(fillRate)} border-0`}>
            Fill rate {percentual(fillRate)}
          </Badge>
          {leadTime !== null && (
            <Badge className="border-0 bg-primary/10 text-primary">{leadTime} dias até CDAM</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 text-center text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Pedida</p>
            <p className="font-display text-lg font-bold">{numero(quantidades.pedida)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Faturada</p>
            <p className="font-display text-lg font-bold">{numero(quantidades.faturada)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fill rate</p>
            <p className="font-display text-lg font-bold">{percentual(fillRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entrada CDAM</p>
            <p className="font-display text-lg font-bold">
              {pedido.entradaCdam ? dataBR(pedido.entradaCdam) : "-"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Fluxo operacional</p>
              <p className="text-muted-foreground">
                {pedido.origemOperacional} para {pedido.destinoOperacional}
              </p>
              <p className="text-muted-foreground">Filial referencia: {nomeLoja(pedido.lojaId)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Comprador</p>
              <p className="text-muted-foreground">{comprador}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Pedida</TableHead>
                <TableHead className="text-right">Faturada</TableHead>
                <TableHead className="text-right">Fill rate</TableHead>
                <TableHead className="text-right">Preço un.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedido.itens.map((item) => (
                <TableRow key={item.sku}>
                  <TableCell className="font-mono text-xs">{codigoProdutoComDigito(item.sku)}</TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {produtoPorSku(item.sku).descricao}
                  </TableCell>
                  <TableCell className="text-right">{numero(item.quantidadePedida)}</TableCell>
                  <TableCell className="text-right">{numero(item.quantidadeFaturada)}</TableCell>
                  <TableCell className="text-right">
                    {percentual(
                      item.quantidadePedida > 0
                        ? (item.quantidadeFaturada / item.quantidadePedida) * 100
                        : 0,
                    )}
                  </TableCell>
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
          <span className="text-base font-semibold">{brl(totalPedido(pedido))}</span>
        </div>
      </div>
    </>
  );
}

function ResumoPedido({
  titulo,
  valor,
  descricao,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  icone: typeof Factory;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icone className="size-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="font-display text-2xl font-bold">{valor}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
    </div>
  );
}
