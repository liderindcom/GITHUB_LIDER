import { createFileRoute } from "@tanstack/react-router";
import { PackageX } from "lucide-react";
import { useMemo, useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { numero, percentual } from "@/lib/format";
import { estoque, lojas, produtoPorSku, statusEstoque, type StatusEstoque } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/estoque")({
  head: () => ({
    meta: [
      { title: "Monitor de Estoque | Portal do Fornecedor" },
      { name: "description", content: "Acompanhe estoque atual x mínimo por loja com sinalizadores de ruptura." },
      { property: "og:title", content: "Monitor de Estoque | Portal do Fornecedor" },
      { property: "og:description", content: "Identifique rupturas e itens em atenção nas lojas do Grupo Líder." },
    ],
  }),
  component: EstoquePage,
});

const estilo: Record<StatusEstoque, { linha: string; badge: string }> = {
  Ruptura: { linha: "bg-danger-soft/70", badge: "bg-danger text-danger-foreground" },
  Atenção: { linha: "bg-warning-soft/70", badge: "bg-warning text-warning-foreground" },
  Confortável: { linha: "", badge: "bg-success text-success-foreground" },
};

const filtros: Array<StatusEstoque | "Todos"> = ["Todos", "Ruptura", "Atenção", "Confortável"];

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

  const contagem = (status: StatusEstoque) => estoque.filter((l) => statusEstoque(l) === status).length;
  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome ?? id;

  return (
    <PortalLayout titulo="Monitor de Estoque" descricao="Estoque atual x estoque mínimo por loja e SKU">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Resumo titulo="Em ruptura" valor={contagem("Ruptura")} tom="danger" />
          <Resumo titulo="Em atenção" valor={contagem("Atenção")} tom="warning" />
          <Resumo titulo="Confortáveis" valor={contagem("Confortável")} tom="success" />
        </div>

        <Card className="shadow-panel">
          <CardHeader className="gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageX className="size-4 text-primary" /> Posições de estoque
              </CardTitle>
              <CardDescription>
                Vermelho indica ruptura total, amarelo indica estoque igual ou abaixo do mínimo.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {filtros.map((f) => (
                <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
                  {f}
                </Button>
              ))}
              <span className="mx-1 hidden w-px bg-border sm:block" />
              <Button
                size="sm"
                variant={loja === "todas" ? "secondary" : "outline"}
                onClick={() => setLoja("todas")}
              >
                Todas as lojas
              </Button>
              {lojas.map((l) => (
                <Button
                  key={l.id}
                  size="sm"
                  variant={loja === l.id ? "secondary" : "outline"}
                  onClick={() => setLoja(l.id)}
                >
                  {l.nome.replace(" - Líder", "")}
                </Button>
              ))}
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
                    <TableHead className="text-right">Cobertura</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((linha) => {
                    const status = statusEstoque(linha);
                    return (
                      <TableRow key={`${linha.sku}-${linha.lojaId}`} className={estilo[status].linha}>
                        <TableCell className="font-mono text-xs">{linha.sku}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {produtoPorSku(linha.sku).descricao}
                        </TableCell>
                        <TableCell>{nomeLoja(linha.lojaId)}</TableCell>
                        <TableCell className="text-right">{numero(linha.estoqueMinimo)}</TableCell>
                        <TableCell className="text-right font-semibold">{numero(linha.estoqueAtual)}</TableCell>
                        <TableCell className="text-right">
                          {percentual((linha.estoqueAtual / linha.estoqueMinimo) * 100)}
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilo[status].badge}`}>
                            {status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lista.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
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

function Resumo({ titulo, valor, tom }: { titulo: string; valor: number; tom: "danger" | "warning" | "success" }) {
  const tons = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    success: "border-success/30 bg-success-soft text-success",
  };
  return (
    <div className={`rounded-xl border p-4 shadow-panel ${tons[tom]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor} posições</p>
    </div>
  );
}
