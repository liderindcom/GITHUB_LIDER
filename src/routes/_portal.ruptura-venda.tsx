import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, Search, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { brl, numero } from "@/lib/format";
import { TableColumnHeader } from "@/components/table-column-header";
import {
  codigoProdutoComDigito,
  coberturaDias,
  estoque,
  estoqueMinimoCalculado,
  nomeLojaPorLocal,
  produtoPorSku,
  produtoUsoConsumo,
  statusEstoque,
  vendaMediaMensal,
  type StatusEstoque,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/ruptura-venda")({
  head: () => ({
    meta: [
      { title: "Ruptura e Perda de Venda | Portal do Fornecedor" },
      {
        name: "description",
        content: "Estimativa de perda de venda por ruptura e risco de venda por estoque baixo.",
      },
    ],
  }),
  component: RupturaVendaPage,
});

type FiltroSituacao = "todas" | "ruptura" | "atencao";

const situacaoBadge: Record<Extract<StatusEstoque, "Ruptura" | "Atenção">, string> = {
  Ruptura: "bg-danger text-danger-foreground",
  Atenção: "bg-warning text-warning-foreground",
};

const coberturaTexto = (dias: number | null) =>
  dias === null ? "Sem venda" : `${numero(Math.round(dias))}d`;

function RupturaVendaPage() {
  const [lojaId, setLojaId] = useState("todas");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [busca, setBusca] = useState("");
  const [buscasColuna, setBuscasColuna] = useState<Record<string, string>>({});
  const [ordenacao, setOrdenacao] = useState<{ coluna: string; direcao: "asc" | "desc" } | null>(null);
  const alterarBuscaColuna = (coluna: string, valor: string) => setBuscasColuna((atual) => ({ ...atual, [coluna]: valor }));
  const ordenarPor = (coluna: string) => setOrdenacao((atual) => atual?.coluna === coluna ? { coluna, direcao: atual.direcao === "asc" ? "desc" : "asc" } : { coluna, direcao: "asc" });

  const linhasBase = useMemo(() => {
    return Array.from(estoque)
      .map((linha) => {
        const status = statusEstoque(linha);
        if (status !== "Ruptura" && status !== "Atenção") return null;

        const produto = produtoPorSku(linha.sku);
        if (produtoUsoConsumo(produto)) return null;
        const mediaMensal = vendaMediaMensal(linha.sku, linha.lojaId);
        if (mediaMensal <= 0) return null;
        const mediaDiaria = mediaMensal / 30;
        const cobertura = coberturaDias(linha.estoqueAtual, mediaMensal);
        const demanda7Dias = mediaDiaria * 7;
        const unidadesEmRisco7Dias = Math.max(0, demanda7Dias - linha.estoqueAtual);
        const perdaDiaria = status === "Ruptura" ? mediaDiaria * produto.precoTabela : 0;
        const risco7Dias = unidadesEmRisco7Dias * produto.precoTabela;

        return {
          sku: linha.sku,
          produto,
          lojaId: linha.lojaId,
          lojaNome: nomeLojaPorLocal(linha.lojaId),
          status,
          estoqueMinimo: estoqueMinimoCalculado(linha.sku, linha.lojaId),
          estoqueAtual: linha.estoqueAtual,
          mediaDiaria,
          cobertura,
          perdaDiaria,
          risco7Dias,
        };
      })
      .filter((linha): linha is NonNullable<typeof linha> => linha !== null);
  }, []);

  const linhas = useMemo(() => {
    return linhasBase
      .filter((linha) => {
        if (lojaId !== "todas" && linha.lojaId !== lojaId) return false;
        if (situacao === "ruptura" && linha.status !== "Ruptura") return false;
        if (situacao === "atencao" && linha.status !== "Atenção") return false;
        if (busca) {
          const alvo = `${linha.sku} ${codigoProdutoComDigito(linha.sku)} ${linha.produto.descricao} ${linha.lojaNome}`.toLowerCase();
          if (!alvo.includes(busca.toLowerCase())) return false;
        }
        const valores: Record<string, string> = { sku: `${linha.sku} ${codigoProdutoComDigito(linha.sku)}`, produto: linha.produto.descricao, loja: linha.lojaNome, situacao: linha.status };
        return Object.entries(buscasColuna).every(([coluna, valor]) => !valor || (valores[coluna] ?? "").toLowerCase().includes(valor.toLowerCase()));
      })
      .sort((a, b) => {
        if (!ordenacao) return b.risco7Dias - a.risco7Dias;
        const valor = (linha: typeof a) => ({ sku: linha.sku, produto: linha.produto.descricao, loja: linha.lojaNome, situacao: linha.status, estoque: linha.estoqueAtual, venda: linha.mediaDiaria, cobertura: linha.cobertura ?? -1, perda: linha.perdaDiaria, mes: linha.perdaDiaria * diasDecorridosMes, risco: linha.risco7Dias }[ordenacao.coluna] ?? "");
        const va = valor(a), vb = valor(b);
        const comparacao = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
        return ordenacao.direcao === "asc" ? comparacao : -comparacao;
      });
  }, [busca, linhasBase, lojaId, situacao, buscasColuna, ordenacao]);

  const lojasFiltro = useMemo(() => {
    const map = new Map<string, string>();
    linhasBase.forEach((linha) => map.set(linha.lojaId, linha.lojaNome));
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [linhasBase]);

  const agora = new Date();
  const diasDecorridosMes = agora.getDate();
  const perdaDiariaTotal = linhas.reduce((acc, linha) => acc + linha.perdaDiaria, 0);
  const perdaMesCorrente = perdaDiariaTotal * diasDecorridosMes;
  const risco7DiasTotal = linhas.reduce((acc, linha) => acc + linha.risco7Dias, 0);
  const rupturas = linhas.filter((linha) => linha.status === "Ruptura").length;
  const skusAfetados = new Set(linhas.map((linha) => linha.sku)).size;

  const graficoLojas = useMemo(() => {
    const map = new Map<string, { loja: string; valor: number }>();
    for (const linha of linhas) {
      const atual = map.get(linha.lojaId) ?? {
        loja: linha.lojaNome.replace("Loja ", "L.").replace(" - Líder", ""),
        valor: 0,
      };
      atual.valor += linha.risco7Dias;
      map.set(linha.lojaId, atual);
    }

    return Array.from(map.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [linhas]);

  function exportar() {
    const cabecalho = [
      "SKU",
      "Produto",
      "Loja",
      "Situacao",
      "Estoque atual",
      "Estoque minimo",
      "Venda media diaria",
      "Cobertura dias",
      "Perda diaria ruptura",
      "Perda mes corrente",
      "Risco 7 dias",
    ];
    const linhasCsv = linhas.map((linha) => [
      codigoProdutoComDigito(linha.sku),
      linha.produto.descricao,
      linha.lojaNome,
      linha.status,
      String(linha.estoqueAtual),
      String(linha.estoqueMinimo),
      linha.mediaDiaria.toFixed(2).replace(".", ","),
      linha.cobertura === null ? "" : String(Math.round(linha.cobertura)),
      linha.perdaDiaria.toFixed(2).replace(".", ","),
      (linha.perdaDiaria * diasDecorridosMes).toFixed(2).replace(".", ","),
      linha.risco7Dias.toFixed(2).replace(".", ","),
    ]);
    const csv = [cabecalho, ...linhasCsv]
      .map((row) => row.map((col) => `"${col}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ruptura-perda-venda.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Ruptura exportada", {
      description: `${linhasCsv.length} linhas em formato Excel (CSV).`,
    });
  }

  return (
    <PortalLayout
      titulo="Ruptura e Perda de Venda"
      descricao="Estimativa financeira de venda perdida por ruptura e risco por estoque baixo"
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Resumo
            titulo="Perda no mês corrente"
            valor={brl(perdaMesCorrente)}
            tom="danger"
          />
          <Resumo titulo="Perda diária ruptura" valor={brl(perdaDiariaTotal)} tom="danger" />
          <Resumo titulo="Risco em 7 dias" valor={brl(risco7DiasTotal)} tom="warning" />
          <Resumo titulo="Posições em ruptura" valor={numero(rupturas)} tom="danger" />
          <Resumo titulo="SKUs afetados" valor={numero(skusAfetados)} tom="primary" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="size-4 text-danger" /> Risco por loja
              </CardTitle>
              <CardDescription>Valor estimado em risco nos próximos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {graficoLojas.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoLojas} layout="vertical" margin={{ left: 6, right: 18 }}>
                      <XAxis
                        type="number"
                        tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                        fontSize={11}
                      />
                      <YAxis dataKey="loja" type="category" width={96} fontSize={11} />
                      <Tooltip
                        formatter={(value: number | string) => [brl(Number(value)), "Risco 7d"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="valor" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem posições críticas para os filtros atuais.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-warning" /> Critério
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Ruptura considera estoque atual abaixo da venda média diária do produto.</p>
              <p>
                Uso e consumo (seção 98 / oficina) e itens sem sell-out ficam de fora: não há
                venda perdida.
              </p>
              <p>
                Perda diária = venda média diária dos últimos 30 dias multiplicada pelo preço de
                tabela do produto.
              </p>
              <p>
                Perda no mês corrente = perda diária × {diasDecorridosMes} dia
                {diasDecorridosMes === 1 ? "" : "s"} já decorrido
                {diasDecorridosMes === 1 ? "" : "s"} neste mês, só nas rupturas de agora.
              </p>
              <p>
                Risco em 7 dias = demanda estimada para 7 dias menos estoque atual, limitado a zero.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-panel">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-base">Produtos críticos</CardTitle>
                <CardDescription>
                  Rupturas e itens em atenção ordenados pelo maior risco financeiro
                </CardDescription>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_12rem_18rem_auto]">
                <div className="space-y-2">
                  <Label>Loja</Label>
                  <Select value={lojaId} onValueChange={setLojaId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="todas">Todas</SelectItem>
                      {lojasFiltro.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Situação</Label>
                  <Select
                    value={situacao}
                    onValueChange={(value) => setSituacao(value as FiltroSituacao)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="ruptura">Ruptura</SelectItem>
                      <SelectItem value="atencao">Atenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="busca-ruptura">Buscar</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="busca-ruptura"
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      className="pl-9"
                      placeholder="SKU, produto ou loja"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <Button onClick={exportar} className="w-full">
                    <Download className="size-4" /> Exportar
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table
              containerClassName="max-h-[500px] rounded-lg border border-border"
              className="border-separate border-spacing-0"
            >
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                <TableRow className="bg-muted/60">
                    {[["sku", "SKU"], ["produto", "Produto"], ["loja", "Loja"], ["situacao", "Situação"], ["estoque", "Estoque atual / mín."], ["venda", "Venda/dia"], ["cobertura", "Cobertura"], ["perda", "Perda/dia"], ["mes", "Perda no mês"], ["risco", "Risco 7d"]].map(([key, title]) => <TableHead key={key} className={key === "produto" || key === "loja" ? "" : "text-right"}><TableColumnHeader title={title} value={buscasColuna[key] ?? ""} onChange={(value) => alterarBuscaColuna(key, value)} onSort={() => ordenarPor(key)} direction={ordenacao?.coluna === key ? ordenacao.direcao : null} /></TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((linha) => (
                    <TableRow key={`${linha.sku}-${linha.lojaId}`}>
                      <TableCell className="font-mono text-xs">{codigoProdutoComDigito(linha.sku)}</TableCell>
                      <TableCell className="min-w-[240px] font-medium">
                        {linha.produto.descricao}
                      </TableCell>
                      <TableCell className="min-w-[180px] text-xs">{linha.lojaNome}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 ${situacaoBadge[linha.status]}`}>
                          {linha.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" title="Estoque atual / estoque mínimo">
                        {numero(linha.estoqueAtual)} / {numero(linha.estoqueMinimo)}
                      </TableCell>
                      <TableCell className="text-right">
                        {linha.mediaDiaria.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {coberturaTexto(linha.cobertura)}
                      </TableCell>
                      <TableCell className="text-right">{brl(linha.perdaDiaria)}</TableCell>
                      <TableCell className="text-right">
                        {brl(linha.perdaDiaria * diasDecorridosMes)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {brl(linha.risco7Dias)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {linhas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma ruptura ou posição em atenção encontrada para os filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
  valor: string;
  tom: "danger" | "warning" | "primary";
}) {
  const tons = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    primary: "border-primary/30 bg-primary/10 text-primary",
  };
  return (
    <div className={`rounded-xl border p-4 shadow-panel ${tons[tom]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
    </div>
  );
}
