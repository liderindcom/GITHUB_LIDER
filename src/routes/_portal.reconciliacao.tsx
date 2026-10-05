import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, HelpCircle, PackageCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  codigoProdutoComDigito,
  estoque,
  perdas,
  produtos,
  transferenciasCdam,
  vendas,
} from "@/lib/mock-data";
import { numero } from "@/lib/format";

export const Route = createFileRoute("/_portal/reconciliacao")({
  beforeLoad: () => {
    throw redirect({ to: "/movimentacoes" });
  },
  head: () => ({
    meta: [
      { title: "Reconciliação de Estoque | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Confronte estoque inicial, entradas, vendas, transferências e estoque final por item.",
      },
    ],
  }),
  component: ReconciliacaoPage,
});

function ReconciliacaoPage() {
  const [busca, setBusca] = useState("");

  const linhas = useMemo(() => {
    return produtos
      .map((produto) => {
        const venda = vendas
          .filter((item) => item.sku === produto.sku)
          .reduce((total, item) => total + item.quantidade, 0);
        const perda = perdas
          .filter((item) => item.sku === produto.sku)
          .reduce((total, item) => total + item.quantidade, 0);
        const transferencia = transferenciasCdam
          .filter((item) => item.sku === produto.sku)
          .reduce((total, item) => total + item.quantidade, 0);
        const estoqueAtual = estoque
          .filter((item) => item.sku === produto.sku)
          .reduce((total, item) => total + item.estoqueAtual, 0);
        const texto =
          `${produto.sku} ${codigoProdutoComDigito(produto.sku)} ${produto.descricao} ${produto.marca ?? ""}`.toLowerCase();
        return { produto, venda, perda, transferencia, estoqueAtual, texto };
      })
      .filter((linha) => !busca || linha.texto.includes(busca.toLowerCase().trim()));
  }, [busca]);

  return (
    <PortalLayout
      titulo="Reconciliação de Estoque"
      descricao="Identifique divergências entre o estoque esperado e o estoque encontrado, item por item."
    >
      <div className="space-y-4">
        <Card className="border-amber-200 bg-amber-50/60 shadow-panel">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold">A divergência não é roubo confirmado</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                A tela vai calcular: estoque inicial + entradas − transferências − vendas − perdas −
                estoque final. O resultado positivo será tratado como{" "}
                <strong>perda a esclarecer</strong> até que a origem informe o motivo.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Resumo
            titulo="Itens monitorados"
            valor={linhas.length}
            icone={ClipboardList}
            classe="text-primary bg-primary/10"
          />
          <Resumo
            titulo="Vendas conhecidas"
            valor={linhas.reduce((total, linha) => total + linha.venda, 0)}
            icone={PackageCheck}
            classe="text-emerald-700 bg-emerald-50"
          />
          <Resumo
            titulo="Perdas registradas"
            valor={linhas.reduce((total, linha) => total + linha.perda, 0)}
            icone={HelpCircle}
            classe="text-amber-700 bg-amber-50"
          />
        </div>

        <Card className="shadow-panel">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Search className="size-4 text-primary" />
              Pesquisar item
            </CardTitle>
            <CardDescription className="text-xs">
              A coluna de divergência será habilitada quando houver histórico de estoque inicial e
              entradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Label htmlFor="busca-reconciliacao" className="text-xs font-semibold">
              SKU, código, marca ou descrição
            </Label>
            <Input
              id="busca-reconciliacao"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar..."
              className="mt-1 h-9 max-w-xl text-xs"
            />
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Conferência por item</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Transf.</TableHead>
                  <TableHead className="text-right">Perdas</TableHead>
                  <TableHead className="text-right">Estoque final</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={linha.produto.sku}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold">
                        {codigoProdutoComDigito(linha.produto.sku)}
                      </p>
                      <p className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {linha.produto.descricao}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">—</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {numero(Math.round(linha.venda))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {numero(Math.round(linha.transferencia))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {numero(Math.round(linha.perda))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {numero(Math.round(linha.estoqueAtual))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                      >
                        Aguardando histórico
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!linhas.length && (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Nenhum item encontrado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function Resumo({
  titulo,
  valor,
  icone: Icon,
  classe,
}: {
  titulo: string;
  valor: number;
  icone: typeof ClipboardList;
  classe: string;
}) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2.5 ${classe}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
            {titulo}
          </p>
          <p className="text-xl font-bold">{numero(Math.round(valor))}</p>
        </div>
      </CardContent>
    </Card>
  );
}
