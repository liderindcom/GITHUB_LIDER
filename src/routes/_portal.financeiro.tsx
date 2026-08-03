import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";
import { BadgeCheck, Calculator, Landmark } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortal } from "@/context/portal-context";
import { brl, dataBR, percentual } from "@/lib/format";
import { TAXA_ANTECIPACAO_MENSAL, faturas, lojas } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro e Antecipação | Portal do Fornecedor" },
      {
        name: "description",
        content: "Consulte títulos a vencer e simule a antecipação de recebíveis com cálculo de taxa em tempo real.",
      },
      { property: "og:title", content: "Financeiro e Antecipação | Portal do Fornecedor" },
      { property: "og:description", content: "Simulador interativo de antecipação de títulos com taxa pró-rata die." },
    ],
  }),
  component: FinanceiroPage,
});

const hoje = new Date();

function FinanceiroPage() {
  const { registrarAntecipacao, antecipacoes } = usePortal();
  const aVencer = faturas.filter((f) => f.status === "A vencer");

  const [selecionadas, setSelecionadas] = useState<string[]>([aVencer[0]?.id ?? ""]);
  const [taxa, setTaxa] = useState(TAXA_ANTECIPACAO_MENSAL * 100);

  const nomeLoja = (id: string) => lojas.find((l) => l.id === id)?.nome.replace(" - Líder", " ·") ?? id;

  const simulacao = useMemo(() => {
    const itens = aVencer
      .filter((f) => selecionadas.includes(f.id))
      .map((f) => {
        const dias = Math.max(0, differenceInCalendarDays(new Date(`${f.vencimento}T12:00:00`), hoje));
        const desconto = f.valor * (taxa / 100 / 30) * dias;
        return { fatura: f, dias, desconto, liquido: f.valor - desconto };
      });
    const bruto = itens.reduce((acc, i) => acc + i.fatura.valor, 0);
    const desconto = itens.reduce((acc, i) => acc + i.desconto, 0);
    return { itens, bruto, desconto, liquido: bruto - desconto };
  }, [aVencer, selecionadas, taxa]);

  function alternar(id: string) {
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  function solicitar() {
    if (simulacao.itens.length === 0) {
      toast.error("Selecione ao menos um título para antecipar.");
      return;
    }
    const registro = registrarAntecipacao({
      faturaIds: simulacao.itens.map((i) => i.fatura.id),
      valorBruto: simulacao.bruto,
      desconto: simulacao.desconto,
      valorLiquido: simulacao.liquido,
    });
    toast.success("Solicitação de antecipação registrada", {
      description: `Protocolo ${registro.codigoAuditoria} · líquido ${brl(registro.valorLiquido)}`,
    });
  }

  return (
    <PortalLayout titulo="Financeiro" descricao="Títulos a receber e simulador interativo de antecipação">
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="shadow-panel xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4 text-primary" /> Títulos
            </CardTitle>
            <CardDescription>Selecione os títulos a vencer que deseja incluir na simulação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-10" />
                    <TableHead>Nota</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faturas.map((f) => {
                    const antecipavel = f.status === "A vencer";
                    return (
                      <TableRow key={f.id} className={selecionadas.includes(f.id) ? "bg-accent/60" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selecionadas.includes(f.id)}
                            onCheckedChange={() => alternar(f.id)}
                            disabled={!antecipavel}
                            aria-label={`Selecionar ${f.numeroNota}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{f.numeroNota}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{nomeLoja(f.lojaId)}</TableCell>
                        <TableCell>{dataBR(f.emissao)}</TableCell>
                        <TableCell>{dataBR(f.vencimento)}</TableCell>
                        <TableCell className="text-right font-medium">{brl(f.valor)}</TableCell>
                        <TableCell>
                          <Badge
                            className={`border-0 ${
                              antecipavel ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                            }`}
                          >
                            {f.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-primary" /> Simulador de antecipação
            </CardTitle>
            <CardDescription>Cálculo pró-rata die atualizado em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Taxa negociada (mês)</span>
                <span className="font-semibold text-primary">{percentual(taxa)}</span>
              </div>
              <Slider
                value={[taxa]}
                min={0.8}
                max={4}
                step={0.05}
                onValueChange={(v) => setTaxa(v[0] ?? taxa)}
                className="pointer-events-auto"
              />
              <p className="text-xs text-muted-foreground">
                Equivalente diário: {percentual(taxa / 30)} por dia de antecipação.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              {simulacao.itens.map((item) => (
                <div key={item.fatura.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    {item.fatura.numeroNota} · {item.dias} {item.dias === 1 ? "dia" : "dias"}
                  </span>
                  <span className="font-medium">-{brl(item.desconto)}</span>
                </div>
              ))}
              {simulacao.itens.length === 0 && (
                <p className="text-center text-muted-foreground">Nenhum título selecionado.</p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <Linha rotulo="Valor bruto" valor={brl(simulacao.bruto)} />
              <Linha rotulo="Desconto financeiro" valor={`-${brl(simulacao.desconto)}`} tom="danger" />
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold">Valor líquido a receber</span>
                <span className="text-xl font-semibold text-success">{brl(simulacao.liquido)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={solicitar}>
              Solicitar antecipação
            </Button>

            {antecipacoes.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Solicitações registradas
                </p>
                {antecipacoes.map((a) => (
                  <div key={a.codigoAuditoria} className="flex items-center gap-2 text-xs">
                    <BadgeCheck className="size-4 shrink-0 text-success" />
                    <span className="font-mono">{a.codigoAuditoria}</span>
                    <span className="ml-auto font-medium">{brl(a.valorLiquido)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={tom === "danger" ? "font-medium text-danger" : "font-medium"}>{valor}</span>
    </div>
  );
}
