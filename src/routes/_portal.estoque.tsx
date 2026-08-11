import { createFileRoute } from "@tanstack/react-router";
import { PackageX } from "lucide-react";
import { useMemo, useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { numero } from "@/lib/format";
import {
  COBERTURA_EXCESSIVA_DIAS,
  coberturaDias,
  estoque,
  lojas,
  produtoPorSku,
  statusEstoque,
  vendaMediaMensal,
  type StatusEstoque,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/estoque")({
  head: () => ({
    meta: [
      { title: "Monitor de Estoque | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhe estoque atual x mínimo por loja com sinalizadores de ruptura.",
      },
      { property: "og:title", content: "Monitor de Estoque | Portal do Fornecedor" },
      {
        property: "og:description",
        content: "Identifique rupturas e itens em atenção nas lojas do Grupo Líder.",
      },
    ],
  }),
  component: EstoquePage,
});

const estilo: Record<StatusEstoque, { linha: string; badge: string }> = {
  Ruptura: { linha: "bg-danger-soft/70", badge: "bg-danger text-danger-foreground" },
  Atenção: { linha: "bg-warning-soft/70", badge: "bg-warning text-warning-foreground" },
  Confortável: { linha: "", badge: "bg-success text-success-foreground" },
  Excesso: { linha: "bg-primary/5", badge: "bg-primary text-primary-foreground" },
};

const filtros: Array<StatusEstoque | "Todos"> = [
  "Todos",
  "Ruptura",
  "Atenção",
  "Confortável",
  "Excesso",
];

function EstoquePage() {
  const [filtro, setFiltro] = useState<StatusEstoque | "Todos">("Todos");
  const [loja, setLoja] = useState("todas");

  const lista = useMemo(
    () =>
      estoque.filter((linha) => {
        if (filtro !== "Todos" && statusEstoque(linha) !== filtro) return false;
        if (loja !== "todas" && linha.lojaId !== loja) return false;
        return true;
      }),
    [filtro, loja],
  );

  const contagem = (status: StatusEstoque) =>
    estoque.filter((l) => statusEstoque(l) === status).length;
  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome ?? id;

  return (
    <PortalLayout
      titulo="Monitor de Estoque"
      descricao="Estoque atual, venda média mensal e cobertura em dias por loja e SKU"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Resumo titulo="Em ruptura" valor={contagem("Ruptura")} tom="danger" />
          <Resumo titulo="Em atenção" valor={contagem("Atenção")} tom="warning" />
          <Resumo titulo="Confortáveis" valor={contagem("Confortável")} tom="success" />
          <Resumo titulo="Cobertura excessiva" valor={contagem("Excesso")} tom="primary" />
        </div>

        <Card className="shadow-panel">
          <CardHeader className="gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageX className="size-4 text-primary" /> Posições de estoque
              </CardTitle>
              <CardDescription>
                Vermelho indica ruptura total, amarelo indica estoque igual ou abaixo do mínimo.
                Cobertura em dias = estoque atual ÷ venda média diária (média mensal / 30). Excesso
                = cobertura acima de {COBERTURA_EXCESSIVA_DIAS} dias.
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center justify-between border-t pt-4">
              {/* Filtro por Situação de Estoque */}
              <div className="flex flex-wrap gap-1.5">
                {filtros.map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filtro === f ? "default" : "outline"}
                    onClick={() => setFiltro(f)}
                    className="h-8 text-xs font-semibold"
                  >
                    {f}
                  </Button>
                ))}
              </div>
              
              {/* Seletor de Loja Compacto em Select */}
              <div className="flex items-center gap-2 min-w-[280px]">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filtrar por Loja:</span>
                <Select value={loja} onValueChange={setLoja}>
                  <SelectTrigger className="h-8 text-xs font-medium bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as lojas</SelectItem>
                    {lojas.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Estoque mínimo</TableHead>
                    <TableHead className="text-right">Estoque atual</TableHead>
                    <TableHead className="text-right">Venda média mensal</TableHead>
                    <TableHead className="text-right">Cobertura (dias)</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((linha) => {
                    const status = statusEstoque(linha);
                    const mediaMensal = vendaMediaMensal(linha.sku, linha.lojaId);
                    const dias = coberturaDias(linha.estoqueAtual, mediaMensal);
                    return (
                      <TableRow
                        key={`${linha.sku}-${linha.lojaId}`}
                        className={estilo[status].linha}
                      >
                        <TableCell className="font-mono text-xs">{linha.sku}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {produtoPorSku(linha.sku).descricao}
                        </TableCell>
                        <TableCell>{nomeLoja(linha.lojaId)}</TableCell>
                        <TableCell className="text-right">{numero(linha.estoqueMinimo)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {numero(linha.estoqueAtual)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numero(Math.round(mediaMensal))}
                        </TableCell>
                        <TableCell className="text-right">
                          {dias === null
                            ? "—"
                            : `${numero(Math.round(dias))} dia${Math.round(dias) === 1 ? "" : "s"}`}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilo[status].badge}`}
                          >
                            {status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lista.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma posição encontrada com esses filtros.
                      </TableCell>
                    </TableRow>
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

function Resumo({
  titulo,
  valor,
  tom,
}: {
  titulo: string;
  valor: number;
  tom: "danger" | "warning" | "success" | "primary";
}) {
  const tons = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    success: "border-success/30 bg-success-soft text-success",
    primary: "border-primary/30 bg-primary/10 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 shadow-panel ${tons[tom]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor} posições</p>
    </div>
  );
}
