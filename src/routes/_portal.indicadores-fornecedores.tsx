import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CalendarDays, Clock3, Percent } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchIndicadoresFornecedores } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PortalLayout } from "@/components/portal-layout";

export const Route = createFileRoute("/_portal/indicadores-fornecedores")({
  head: () => ({
    meta: [
      { title: "Indicadores por fornecedor | Área interna Líder" },
      {
        name: "description",
        content: "Fill Rate e lead time médio por fornecedor em período fechado.",
      },
    ],
  }),
  component: IndicadoresFornecedoresPage,
});

type IndicadorRow = {
  codigo: string;
  nome: string;
  pedidos: number;
  unidades_pedidas: number;
  unidades_atendidas: number;
  fill_rate_pct: number | null;
  leadtime_medio_dias: number | null;
  entregas_com_data: number;
};

function percentual(value: number | null) {
  return value === null ? "—" : `${Number(value).toFixed(2).replace(".", ",")}%`;
}

function dias(value: number | null) {
  return value === null ? "—" : `${Number(value).toFixed(2).replace(".", ",")} dias`;
}

function IndicadoresFornecedoresPage() {
  const [periodo, setPeriodo] = useState("");
  const [periodos, setPeriodos] = useState<Array<{ valor: string; rotulo: string }>>([]);
  const [rows, setRows] = useState<IndicadorRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    fetchIndicadoresFornecedores({ data: periodo })
      .then((data) => {
        if (!ativo) return;
        setPeriodos(data.periodos);
        setRows(data.rows as IndicadorRow[]);
        if (!periodo && data.periodo?.valor) setPeriodo(data.periodo.valor);
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(
          error instanceof Error ? error.message : "Não foi possível carregar os indicadores.",
        );
        setRows([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const resumo = useMemo(() => {
    const comDados = rows.filter((row) => row.fill_rate_pct !== null);
    const fill = comDados.length
      ? comDados.reduce((sum, row) => sum + Number(row.fill_rate_pct), 0) / comDados.length
      : null;
    const lead = rows.filter((row) => row.leadtime_medio_dias !== null);
    const leadtime = lead.length
      ? lead.reduce((sum, row) => sum + Number(row.leadtime_medio_dias), 0) / lead.length
      : null;
    return { comDados: comDados.length, fill, leadtime };
  }, [rows]);

  return (
    <PortalLayout
      titulo="Indicadores por fornecedor"
      descricao="Acompanhamento interno do Fill Rate e do lead time médio em períodos já encerrados."
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4 text-primary" /> Período fechado
              </div>
              <p className="text-xs text-muted-foreground">
                O mês em curso não aparece. O Fill Rate é ponderado pelas unidades pedidas e
                atendidas; o lead time usa pedidos com entrada no CDAM.
              </p>
            </div>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-full md:w-[240px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((item) => (
                  <SelectItem key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Percent className="size-4" /> Fill Rate médio entre fornecedores com dados
              </div>
              <div className="mt-2 text-2xl font-bold">{percentual(resumo.fill)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-4" /> Lead time médio
              </div>
              <div className="mt-2 text-2xl font-bold">{dias(resumo.leadtime)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BarChart3 className="size-4" /> Fornecedores com pedidos
              </div>
              <div className="mt-2 text-2xl font-bold">{resumo.comDados}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fornecedor · Fill Rate · Lead time</CardTitle>
          </CardHeader>
          <CardContent>
            {erro ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {erro}
              </div>
            ) : null}
            {!erro && carregando ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Carregando período fechado…
              </div>
            ) : null}
            {!erro && !carregando ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Unid. pedidas</TableHead>
                      <TableHead className="text-right">Unid. atendidas</TableHead>
                      <TableHead className="text-right">Fill Rate</TableHead>
                      <TableHead className="text-right">Lead time médio</TableHead>
                      <TableHead className="text-right">Entregas com data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.codigo}>
                        <TableCell>
                          <div className="font-medium">{row.nome || "Fornecedor sem nome"}</div>
                          <div className="text-xs text-muted-foreground">RMS {row.codigo}</div>
                        </TableCell>
                        <TableCell className="text-right">{row.pedidos}</TableCell>
                        <TableCell className="text-right">
                          {Number(row.unidades_pedidas).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(row.unidades_atendidas).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {percentual(row.fill_rate_pct)}
                        </TableCell>
                        <TableCell className="text-right">
                          {dias(row.leadtime_medio_dias)}
                        </TableCell>
                        <TableCell className="text-right">{row.entregas_com_data}</TableCell>
                      </TableRow>
                    ))}
                    {!rows.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                          Nenhum fornecedor encontrado no período fechado.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
