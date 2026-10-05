import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeftRight, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
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
import {
  codigoProdutoComDigito,
  estoque,
  faturasDoFornecedor,
  globalDbCache,
  lojas,
  perdas,
  pedidos,
  produtos,
  transferenciasCdam,
  vendas,
} from "@/lib/mock-data";
import { dataBR, numero } from "@/lib/format";

export const Route = createFileRoute("/_portal/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações | Portal do Fornecedor" }] }),
  component: MovimentacoesPage,
});

type ColunaOrdenacao = "produto" | "entrada" | "vendido" | "transferido" | "perda" | "estoqueAtual";
type DirecaoOrdenacao = "asc" | "desc";

function MovimentacoesPage() {
  const { dadosFornecedorVersao } = usePortal();
  const [busca, setBusca] = useState("");
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [periodoMeses, setPeriodoMeses] = useState("3");
  const [ordenacao, setOrdenacao] = useState<{
    coluna: ColunaOrdenacao;
    direcao: DirecaoOrdenacao;
  }>({
    coluna: "produto",
    direcao: "asc",
  });

  const linhas = useMemo(() => {
    void dadosFornecedorVersao;
    const pertenceAoLocal = (lojaId: string) => lojaFiltro === "todas" || lojaId === lojaFiltro;
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - Number(periodoMeses) + 1, 1);
    const inicioPeriodo = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-01`;
    const estaNoPeriodo = (data: string) => data >= inicioPeriodo;
    const faturas = faturasDoFornecedor();
    const faturaPorNota = new Map<string, (typeof faturas)[number]>();
    const faturaPorChave = new Map<string, (typeof faturas)[number]>();
    faturas.forEach((fatura) => {
      const nota = String(fatura.numeroNota ?? "").trim();
      faturaPorNota.set(nota, fatura);
      faturaPorNota.set(nota.split("-")[0], fatura);
      if (fatura.chaveNfe) faturaPorChave.set(String(fatura.chaveNfe).trim(), fatura);
    });
    const entradasNfe = (globalDbCache.conciliacao ?? []).map((item) => {
      const fatura =
        faturaPorChave.get(String(item.chaveNfe ?? "").trim()) ??
        faturaPorNota.get(String(item.numeroNota ?? "").trim());
      return {
        sku: item.sku,
        lojaId: fatura?.lojaId ?? "",
        data: fatura?.recebimento ?? fatura?.emissao ?? "",
        quantidade: item.quantidadeXml,
      };
    });
    const entradasPedidosEntregues = pedidos.flatMap((pedido) =>
      pedido.status === "Entregue"
        ? pedido.itens.map((item) => ({
            sku: item.sku,
            lojaId: pedido.lojaId,
            data: pedido.entradaCdam ?? pedido.emissao,
            quantidade: item.quantidadeFaturada,
          }))
        : [],
    );
    const entradasComData = entradasNfe.filter((entrada) => entrada.data && entrada.quantidade > 0);
    const entradas = entradasComData.length ? entradasComData : entradasPedidosEntregues;
    return produtos
      .map((produto) => {
        const unidadesPorEmbalagem = Math.max(1, Number(produto.embalagemCompra ?? 1));
        const entrada = entradas
          .filter(
            (item) =>
              item.sku === produto.sku && pertenceAoLocal(item.lojaId) && estaNoPeriodo(item.data),
          )
          .reduce((total, item) => total + item.quantidade * unidadesPorEmbalagem, 0);
        const vendido = vendas
          .filter(
            (item) =>
              item.sku === produto.sku && pertenceAoLocal(item.lojaId) && estaNoPeriodo(item.data),
          )
          .reduce((total, item) => total + item.quantidade, 0);
        const perda = perdas
          .filter(
            (item) =>
              item.sku === produto.sku && pertenceAoLocal(item.lojaId) && estaNoPeriodo(item.data),
          )
          .reduce((total, item) => total + item.quantidade, 0);
        const transferido = transferenciasCdam
          .filter(
            (item) =>
              item.sku === produto.sku && pertenceAoLocal(item.lojaId) && estaNoPeriodo(item.data),
          )
          .reduce((total, item) => total + item.quantidade, 0);
        const estoqueAtual = estoque
          .filter((item) => item.sku === produto.sku && pertenceAoLocal(item.lojaId))
          .reduce((total, item) => total + item.estoqueAtual, 0);
        const dataInventario = estoque
          .filter((item) => item.sku === produto.sku && pertenceAoLocal(item.lojaId))
          .map((item) => item.dataInventario)
          .filter((data): data is string => Boolean(data))
          .sort()
          .at(-1);
        const texto =
          `${produto.sku} ${codigoProdutoComDigito(produto.sku)} ${produto.descricao} ${produto.marca ?? ""}`.toLowerCase();
        return { produto, entrada, vendido, perda, transferido, estoqueAtual, dataInventario, texto };
      })
      .filter((linha) => !busca || linha.texto.includes(busca.toLowerCase().trim()))
      .filter(
        (linha) =>
          linha.entrada > 0 ||
          linha.vendido > 0 ||
          linha.perda > 0 ||
          linha.transferido > 0 ||
          linha.estoqueAtual > 0,
      );
  }, [busca, lojaFiltro, periodoMeses, dadosFornecedorVersao]);

  const linhasOrdenadas = useMemo(() => {
    return [...linhas].sort((a, b) => {
      const valorA = ordenacao.coluna === "produto" ? a.produto.descricao : a[ordenacao.coluna];
      const valorB = ordenacao.coluna === "produto" ? b.produto.descricao : b[ordenacao.coluna];
      const comparacao =
        typeof valorA === "string"
          ? valorA.localeCompare(String(valorB), "pt-BR")
          : Number(valorA) - Number(valorB);
      return ordenacao.direcao === "asc" ? comparacao : -comparacao;
    });
  }, [linhas, ordenacao]);

  const ordenarPor = (coluna: ColunaOrdenacao) => {
    setOrdenacao((atual) => ({
      coluna,
      direcao: atual.coluna === coluna && atual.direcao === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <PortalLayout
      titulo="Movimentações e Conferência"
      descricao="Veja tudo do item em uma única conta, sem precisar trocar de aba."
    >
      <div className="space-y-4">
        <Card className="border-blue-200 bg-blue-50/60 shadow-panel">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-blue-950">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-blue-700" />
            <div>
              <p className="font-semibold">Como ler a conferência</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
                Todas as quantidades desta tabela estão em <strong>unidades físicas (un)</strong>.
                As entradas são convertidas pelo fator de embalagem cadastrado no produto. A conta
                será:{" "}
                <strong>
                  estoque inicial + entradas − vendas − transferências − perdas − estoque atual
                </strong>
                . Enquanto o histórico de estoque inicial e entradas não estiver disponível, a
                diferença fica como “aguardando dados”.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Search className="size-4 text-primary" />
              Pesquisar item
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-[1fr_220px_180px]">
            <div className="space-y-1">
              <Label htmlFor="busca-mov" className="text-xs font-semibold">
                SKU, código, marca ou descrição
              </Label>
              <Input
                id="busca-mov"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Pesquisar..."
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Período de avaliação</Label>
              <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="4">Últimos 4 meses</SelectItem>
                  <SelectItem value="5">Últimos 5 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Loja / local</Label>
              <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id}>
                      {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowLeftRight className="size-4 text-primary" />
              Conferência por item
            </CardTitle>
            <CardDescription className="text-xs">
              Últimos {periodoMeses} meses: movimentos conhecidos, estoque atual e situação da
              conferência.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-auto">
              <Table className="min-w-[980px]">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                  <TableRow>
                    <CabecalhoOrdenavel
                      texto="Produto"
                      coluna="produto"
                      ordenacao={ordenacao}
                      onClick={ordenarPor}
                    />
                    <CabecalhoOrdenavel
                      texto="Entradas recebidas (un)"
                      coluna="entrada"
                      alinhamento="center"
                      ordenacao={ordenacao}
                      onClick={ordenarPor}
                    />
                    <CabecalhoOrdenavel
                      texto="Vendas (un)"
                      coluna="vendido"
                      alinhamento="center"
                      ordenacao={ordenacao}
                      onClick={ordenarPor}
                    />
                    <CabecalhoOrdenavel
                      texto="Transferências (un)"
                      coluna="transferido"
                      alinhamento="center"
                      ordenacao={ordenacao}
                      onClick={ordenarPor}
                    />
                    <CabecalhoOrdenavel
                      texto="Perdas (un)"
                      coluna="perda"
                      alinhamento="center"
                      ordenacao={ordenacao}
                      onClick={ordenarPor}
                    />
                    <CabecalhoOrdenavel
                      texto="Estoque atual (un)"
                      coluna="estoqueAtual"
                      alinhamento="center"
                      ordenacao={ordenacao}
                      onClick={ordenarPor}
                    />
                    <TableHead className="text-center">Último inventário</TableHead>
                    <TableHead className="text-center">Conferência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasOrdenadas.map((linha) => (
                    <TableRow key={linha.produto.sku}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">
                          {codigoProdutoComDigito(linha.produto.sku)}
                        </p>
                        <p className="max-w-[280px] truncate text-xs text-muted-foreground">
                          {linha.produto.descricao}
                        </p>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {linha.entrada > 0 ? numero(Math.round(linha.entrada)) : "—"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {numero(Math.round(linha.vendido))}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {numero(Math.round(linha.transferido))}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {numero(Math.round(linha.perda))}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold">
                        {numero(Math.round(linha.estoqueAtual))}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {linha.dataInventario ? dataBR(linha.dataInventario) : "Sem inventário"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="border-slate-300 bg-slate-50 text-[10px] text-slate-700"
                        >
                          Aguardando entradas
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

function CabecalhoOrdenavel({
  texto,
  coluna,
  alinhamento,
  ordenacao,
  onClick,
}: {
  texto: string;
  coluna: ColunaOrdenacao;
  alinhamento?: "center" | "right";
  ordenacao: { coluna: ColunaOrdenacao; direcao: DirecaoOrdenacao };
  onClick: (coluna: ColunaOrdenacao) => void;
}) {
  const ativo = ordenacao.coluna === coluna;
  return (
    <TableHead
      className={
        alinhamento === "center"
          ? "text-center"
          : alinhamento === "right"
            ? "text-right"
            : undefined
      }
    >
      <button
        type="button"
        onClick={() => onClick(coluna)}
        className={`inline-flex items-center gap-1 text-xs font-semibold hover:text-primary ${alinhamento === "center" ? "justify-center" : alinhamento === "right" ? "justify-end" : ""}`}
      >
        {texto}
        <ArrowUpDown className={`size-3 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
        {ativo && (
          <span className="sr-only">
            {ordenacao.direcao === "asc" ? "crescente" : "decrescente"}
          </span>
        )}
      </button>
    </TableHead>
  );
}
