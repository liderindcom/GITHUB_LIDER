import { createFileRoute } from "@tanstack/react-router";
import { Search, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PortalLayout } from "@/components/portal-layout";
import { TableColumnHeader } from "@/components/table-column-header";
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
import { usePortal } from "@/context/portal-context";
import { brl, numero, percentual } from "@/lib/format";
import { codigoProdutoComDigito, nomeLojaPorLocal, perdas } from "@/lib/mock-data";
import { mesAtualIso, rotuloMesAno } from "@/lib/pedidos-janela";

export const Route = createFileRoute("/_portal/perdas")({
  head: () => ({
    meta: [
      { title: "Perdas por loja | Portal do Fornecedor" },
      {
        name: "description",
        content:
          "Agenda 520: quais lojas geram mais perda, para processo e treinamento. Total mensal por produto.",
      },
    ],
  }),
  component: PerdasPage,
});

function PerdasPage() {
  const { dadosFornecedorVersao } = usePortal();
  const mesCorrente = mesAtualIso();
  const [mesSelecionado, setMesSelecionado] = useState(mesCorrente);
  const [lojaId, setLojaId] = useState("todas");
  const [busca, setBusca] = useState("");
  const [buscasRanking, setBuscasRanking] = useState<Record<string, string>>({});
  const [ordenacaoRanking, setOrdenacaoRanking] = useState<{ campo: "posicao" | "nome" | "share" | "valor" | "quantidade" | "produtos"; direcao: "asc" | "desc" }>({ campo: "valor", direcao: "desc" });
  const [buscasProdutos, setBuscasProdutos] = useState<Record<string, string>>({});
  const [ordenacaoProdutos, setOrdenacaoProdutos] = useState<{ campo: "loja" | "sku" | "produtoDescricao" | "quantidade" | "valorTotal"; direcao: "asc" | "desc" }>({ campo: "valorTotal", direcao: "desc" });

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>([mesCorrente]);
    for (const p of perdas) {
      const mes = (p.data || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(mes)) set.add(mes);
    }
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [dadosFornecedorVersao, mesCorrente]);

  const perdasDoMes = useMemo(
    () => perdas.filter((p) => (p.data || "").slice(0, 7) === mesSelecionado),
    [mesSelecionado, dadosFornecedorVersao],
  );

  const listaLojas = useMemo(() => {
    const map = new Map<string, string>();
    perdasDoMes.forEach((p) => map.set(p.lojaId, nomeLojaPorLocal(p.lojaId)));
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [perdasDoMes]);

  useEffect(() => {
    if (lojaId === "todas") return;
    if (!listaLojas.some((l) => l.id === lojaId)) setLojaId("todas");
  }, [listaLojas, lojaId]);

  const ranking = useMemo(() => {
    const totalGeral = perdasDoMes.reduce((acc, p) => acc + p.valorTotal, 0);
    const map = new Map<
      string,
      { lojaId: string; nome: string; valor: number; quantidade: number; dias: Set<string>; produtos: Set<string> }
    >();
    perdasDoMes.forEach((p) => {
      const atual = map.get(p.lojaId) || {
        lojaId: p.lojaId,
        nome: nomeLojaPorLocal(p.lojaId),
        valor: 0,
        quantidade: 0,
        dias: new Set<string>(),
        produtos: new Set<string>(),
      };
      atual.valor += p.valorTotal;
      atual.quantidade += p.quantidade;
      if (p.data && p.data !== "sem-data") atual.dias.add(p.data);
      atual.produtos.add(p.sku);
      map.set(p.lojaId, atual);
    });
    return Array.from(map.values())
      .map((loja) => ({
        ...loja,
        share: totalGeral > 0 ? (loja.valor / totalGeral) * 100 : 0,
        dias: loja.dias.size,
        produtos: loja.produtos.size,
      }))
      .filter((loja) => Object.entries(buscasRanking).every(([campo, termo]) => !termo || String(campo === "nome" ? loja.nome : campo === "share" ? loja.share : campo === "valor" ? loja.valor : campo === "quantidade" ? loja.quantidade : campo === "produtos" ? loja.produtos : "").toLowerCase().includes(termo.toLowerCase())))
      .sort((a, b) => {
        const av = ordenacaoRanking.campo === "nome" ? a.nome : ordenacaoRanking.campo === "share" ? a.share : ordenacaoRanking.campo === "valor" ? a.valor : ordenacaoRanking.campo === "quantidade" ? a.quantidade : ordenacaoRanking.campo === "produtos" ? a.produtos : 0;
        const bv = ordenacaoRanking.campo === "nome" ? b.nome : ordenacaoRanking.campo === "share" ? b.share : ordenacaoRanking.campo === "valor" ? b.valor : ordenacaoRanking.campo === "quantidade" ? b.quantidade : ordenacaoRanking.campo === "produtos" ? b.produtos : 0;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
        return ordenacaoRanking.direcao === "asc" ? cmp : -cmp;
      });
  }, [perdasDoMes, buscasRanking, ordenacaoRanking]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const map = new Map<
      string,
      {
        lojaId: string;
        sku: string;
        produtoDescricao: string;
        quantidade: number;
        valorTotal: number;
      }
    >();
    for (const p of perdasDoMes) {
      if (lojaId !== "todas" && p.lojaId !== lojaId) continue;
      if (termo) {
        const alvo = `${p.sku} ${codigoProdutoComDigito(p.sku)} ${p.produtoDescricao} ${nomeLojaPorLocal(p.lojaId)}`.toLowerCase();
        if (!alvo.includes(termo)) continue;
      }
      const key = `${p.lojaId}\t${p.sku}`;
      const atual = map.get(key);
      if (!atual) {
        map.set(key, {
          lojaId: p.lojaId,
          sku: p.sku,
          produtoDescricao: p.produtoDescricao,
          quantidade: p.quantidade,
          valorTotal: p.valorTotal,
        });
      } else {
        atual.quantidade += p.quantidade;
        atual.valorTotal += p.valorTotal;
      }
    }
    return Array.from(map.values())
      .filter((p) => Object.entries(buscasProdutos).every(([campo, termo]) => !termo || String(campo === "loja" ? nomeLojaPorLocal(p.lojaId) : campo === "sku" ? codigoProdutoComDigito(p.sku) : campo === "produtoDescricao" ? p.produtoDescricao : campo === "quantidade" ? p.quantidade : p.valorTotal).toLowerCase().includes(termo.toLowerCase())))
      .sort((a, b) => {
        const av = ordenacaoProdutos.campo === "loja" ? nomeLojaPorLocal(a.lojaId) : ordenacaoProdutos.campo === "sku" ? codigoProdutoComDigito(a.sku) : a[ordenacaoProdutos.campo];
        const bv = ordenacaoProdutos.campo === "loja" ? nomeLojaPorLocal(b.lojaId) : ordenacaoProdutos.campo === "sku" ? codigoProdutoComDigito(b.sku) : b[ordenacaoProdutos.campo];
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
        return ordenacaoProdutos.direcao === "asc" ? cmp : -cmp;
      });
  }, [perdasDoMes, lojaId, busca, buscasProdutos, ordenacaoProdutos]);

  const alterarOrdenacaoRanking = (campo: typeof ordenacaoRanking.campo) => setOrdenacaoRanking((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
  const alterarOrdenacaoProdutos = (campo: typeof ordenacaoProdutos.campo) => setOrdenacaoProdutos((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));

  const prejuizoTotal = filtradas.reduce((acc, p) => acc + p.valorTotal, 0);
  const totalQuantidade = filtradas.reduce((acc, p) => acc + p.quantidade, 0);
  const lojaLider = ranking[0];
  const grafico = ranking.slice(0, 12).map((loja) => ({
    nome: loja.nome.replace(/^L\d+\s+/, ""),
    valor: loja.valor,
  }));

  return (
    <PortalLayout
      titulo="Perdas por loja"
      descricao="Agenda 520: perda física mensal por filial, para priorizar processo e treinamento. Total do mês por produto, sem lançamento a lançamento."
    >
      <div className="space-y-6">
        <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mês de referência</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mesSelecionado === mesCorrente
                    ? `${rotuloMesAno(mesSelecionado)} · mês corrente`
                    : rotuloMesAno(mesSelecionado)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mes-perda" className="text-[10px] font-bold uppercase tracking-wider">
                  Mês
                </Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger id="mes-perda" className="h-9 w-full sm:w-64 text-xs bg-background">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {mesesDisponiveis.map((m) => (
                      <SelectItem key={m} value={m}>
                        {rotuloMesAno(m)}
                        {m === mesCorrente ? " (mês corrente)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Loja que mais gera perda
              </CardDescription>
              <CardTitle className="text-xl font-bold text-danger">
                {lojaLider ? lojaLider.nome : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {lojaLider
                  ? `${brl(lojaLider.valor)} · ${percentual(lojaLider.share)} do mês`
                  : `Sem perda 520 em ${rotuloMesAno(mesSelecionado)}`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Perda da visão
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{brl(prejuizoTotal)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {rotuloMesAno(mesSelecionado)}
                {" · "}
                {lojaId === "todas" ? "Todas as lojas" : nomeLojaPorLocal(lojaId)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Volume perdido
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-primary">{numero(totalQuantidade)} u.</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {ranking.length} lojas com perda em {rotuloMesAno(mesSelecionado)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Onde concentrar treinamento</CardTitle>
              <CardDescription className="text-xs">
                Clique na loja para ver o total do mês de cada produto
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                containerClassName="max-h-[500px]"
                className="border-separate border-spacing-0"
              >
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                  <TableRow className="border-border bg-muted hover:bg-muted">
                      <TableHead className="text-xs"><TableColumnHeader title="#" onSort={() => alterarOrdenacaoRanking("posicao")} direction={ordenacaoRanking.campo === "posicao" ? ordenacaoRanking.direcao : null} /></TableHead>
                      {([["nome", "Loja"], ["share", "Share"], ["valor", "Perda"], ["quantidade", "Un."], ["produtos", "SKUs"]] as Array<[typeof ordenacaoRanking.campo, string]>).map(([campo, titulo]) => <TableHead key={campo} className="text-xs"><TableColumnHeader title={titulo} value={buscasRanking[campo] ?? ""} onChange={(v) => setBuscasRanking((atual) => ({ ...atual, [campo]: v }))} onSort={() => alterarOrdenacaoRanking(campo)} direction={ordenacaoRanking.campo === campo ? ordenacaoRanking.direcao : null} /></TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((loja, i) => (
                      <TableRow
                        key={loja.lojaId}
                        className={`cursor-pointer border-border hover:bg-accent/60 ${
                          lojaId === loja.lojaId ? "bg-accent/60" : ""
                        }`}
                        onClick={() => setLojaId(loja.lojaId === lojaId ? "todas" : loja.lojaId)}
                      >
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{loja.nome}</TableCell>
                        <TableCell className="text-right text-xs">{percentual(loja.share)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-danger">
                          {brl(loja.valor)}
                        </TableCell>
                        <TableCell className="text-right text-xs">{numero(loja.quantidade)}</TableCell>
                        <TableCell className="text-right text-xs">{loja.produtos}</TableCell>
                      </TableRow>
                    ))}
                    {ranking.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          Sem perda 520 em {rotuloMesAno(mesSelecionado)} para este fornecedor.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Ranking em valor</CardTitle>
              <CardDescription className="text-xs">
                As 12 lojas com maior perda física em {rotuloMesAno(mesSelecionado)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                {grafico.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafico} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                      <XAxis type="number" tickFormatter={(v) => brl(Number(v))} stroke="currentColor" fontSize={10} />
                      <YAxis dataKey="nome" type="category" stroke="currentColor" fontSize={10} width={140} />
                      <Tooltip
                        formatter={(v: number) => [brl(v), "Perda"]}
                        contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "none", borderRadius: "10px" }}
                      />
                      <Bar dataKey="valor" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem dados para o gráfico
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-panel border-none bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingDown className="size-4 text-primary" /> Total do mês por produto
                </CardTitle>
                <CardDescription className="text-xs">
                  {rotuloMesAno(mesSelecionado)}
                  {" · "}
                  {lojaId === "todas"
                    ? "Todas as lojas · clique numa loja acima para focar o treino"
                    : `${nomeLojaPorLocal(lojaId)} · clique de novo no ranking para voltar ao total`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="loja" className="text-[10px] font-bold uppercase tracking-wider">
                    Loja
                  </Label>
                  <Select value={lojaId} onValueChange={setLojaId}>
                    <SelectTrigger id="loja" className="h-9 w-56 text-xs bg-background/50">
                      <SelectValue placeholder="Todas as lojas" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="todas">Todas as lojas</SelectItem>
                      {listaLojas.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-60 space-y-1.5">
                  <Label htmlFor="busca" className="text-[10px] font-bold uppercase tracking-wider">
                    Produto
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      id="busca"
                      type="search"
                      placeholder="SKU ou descrição"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="h-9 pl-8 text-xs bg-background/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table
              containerClassName="max-h-[500px]"
              className="border-separate border-spacing-0"
            >
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                <TableRow className="border-border bg-muted hover:bg-muted">
                    {([["loja", "Loja"], ["sku", "SKU"], ["produtoDescricao", "Produto"], ["quantidade", "Quantidade"], ["valorTotal", "Perda (R$)"]] as Array<[typeof ordenacaoProdutos.campo, string]>).map(([campo, titulo]) => <TableHead key={campo} className="text-xs font-semibold"><TableColumnHeader title={titulo} value={buscasProdutos[campo] ?? ""} onChange={(v) => setBuscasProdutos((atual) => ({ ...atual, [campo]: v }))} onSort={() => alterarOrdenacaoProdutos(campo)} direction={ordenacaoProdutos.campo === campo ? ordenacaoProdutos.direcao : null} /></TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((p) => (
                    <TableRow key={`${p.lojaId}-${p.sku}`} className="border-border hover:bg-muted/30">
                      <TableCell className="text-xs py-3">{nomeLojaPorLocal(p.lojaId)}</TableCell>
                      <TableCell className="font-mono text-xs py-3">{codigoProdutoComDigito(p.sku)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs py-3">{p.produtoDescricao}</TableCell>
                      <TableCell className="text-right text-xs py-3">{numero(p.quantidade)}</TableCell>
                      <TableCell className="text-right text-xs font-semibold text-danger py-3">
                        {brl(p.valorTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                        Nenhuma perda 520 em {rotuloMesAno(mesSelecionado)} nesta visão.
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
