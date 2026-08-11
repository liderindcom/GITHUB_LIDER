import { createFileRoute } from "@tanstack/react-router";
import { Download, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import {
  codigoProdutoComDigito,
  produtos,
  subgrupoMercadologico,
  type Produto,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/precos")({
  head: () => ({
    meta: [
      { title: "Preço Concorrência | Portal do Fornecedor" },
      {
        name: "description",
        content: "Comparativo de preço do fornecedor contra faixa de concorrência por linha.",
      },
      { property: "og:title", content: "Preço Concorrência | Portal do Fornecedor" },
    ],
  }),
  component: PrecosPage,
});

type StatusPreco = "Barato" | "Competitivo" | "Caro";

type LinhaPreco = {
  produto: Produto;
  codigo: string;
  linha: string;
  precoFornecedor: number;
  menorConcorrencia: number;
  maiorConcorrencia: number;
  precoMedioConcorrencia: number;
  diferencaMediaPct: number;
  posicaoFaixa: number;
  status: StatusPreco;
};

const statusConfig: Record<StatusPreco, { badge: string; texto: string }> = {
  Barato: {
    badge: "bg-success text-success-foreground",
    texto: "Abaixo da faixa",
  },
  Competitivo: {
    badge: "bg-primary/10 text-primary",
    texto: "Dentro da faixa",
  },
  Caro: {
    badge: "bg-danger text-danger-foreground",
    texto: "Acima da faixa",
  },
};

const arredondarPreco = (valor: number) => Math.max(0.01, Number(valor.toFixed(2)));

const faixaConcorrencia = (produto: Produto) => {
  const preco = produto.precoTabela;
  const assinatura = Array.from(produto.sku).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const perfil = assinatura % 5;

  if (perfil === 0) {
    return {
      menor: arredondarPreco(preco * 1.03),
      maior: arredondarPreco(preco * 1.22),
    };
  }

  if (perfil === 1 || perfil === 4) {
    return {
      menor: arredondarPreco(preco * 0.76),
      maior: arredondarPreco(preco * 0.95),
    };
  }

  return {
    menor: arredondarPreco(preco * 0.9),
    maior: arredondarPreco(preco * 1.12),
  };
};

const statusPreco = (precoFornecedor: number, menor: number, maior: number): StatusPreco => {
  if (precoFornecedor < menor) return "Barato";
  if (precoFornecedor > maior) return "Caro";
  return "Competitivo";
};

const posicaoNaFaixa = (precoFornecedor: number, menor: number, maior: number) => {
  if (maior <= menor) return 50;
  return Math.min(100, Math.max(0, ((precoFornecedor - menor) / (maior - menor)) * 100));
};

const opcoes = (valores: string[]) =>
  Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b));

function PrecosPage() {
  const { fornecedor } = usePortal();
  const [linha, setLinha] = useState("todas");
  const [status, setStatus] = useState<StatusPreco | "todos">("todos");
  const [busca, setBusca] = useState("");

  const analise = useMemo<LinhaPreco[]>(() => {
    return produtos.map((produto) => {
      const faixa = faixaConcorrencia(produto);
      const precoMedioConcorrencia = (faixa.menor + faixa.maior) / 2;
      const diferencaMediaPct =
        precoMedioConcorrencia > 0
          ? ((produto.precoTabela - precoMedioConcorrencia) / precoMedioConcorrencia) * 100
          : 0;

      return {
        produto,
        codigo: codigoProdutoComDigito(produto.sku),
        linha: subgrupoMercadologico(produto),
        precoFornecedor: produto.precoTabela,
        menorConcorrencia: faixa.menor,
        maiorConcorrencia: faixa.maior,
        precoMedioConcorrencia,
        diferencaMediaPct,
        posicaoFaixa: posicaoNaFaixa(produto.precoTabela, faixa.menor, faixa.maior),
        status: statusPreco(produto.precoTabela, faixa.menor, faixa.maior),
      };
    });
  }, []);

  const linhas = opcoes(analise.map((item) => item.linha));

  const filtrados = analise.filter((item) => {
    if (linha !== "todas" && item.linha !== linha) return false;
    if (status !== "todos" && item.status !== status) return false;
    if (busca) {
      const alvo =
        `${item.codigo} ${item.produto.sku} ${item.produto.descricao} ${item.linha}`.toLowerCase();
      if (!alvo.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  const contagem = (tipo: StatusPreco) => analise.filter((item) => item.status === tipo).length;
  const mediaDiferenca =
    filtrados.length > 0
      ? filtrados.reduce((acc, item) => acc + item.diferencaMediaPct, 0) / filtrados.length
      : 0;

  const limparFiltros = () => {
    setLinha("todas");
    setStatus("todos");
    setBusca("");
  };



  return (
    <PortalLayout
      titulo="Preço Concorrência"
      descricao={`Comparativo por linha para ${fornecedor.nome}`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Resumo titulo="Produtos analisados" valor={numero(analise.length)} />
          <Resumo titulo="Baratos" valor={numero(contagem("Barato"))} tom="success" />
          <Resumo titulo="Competitivos" valor={numero(contagem("Competitivo"))} tom="primary" />
          <Resumo titulo="Caros" valor={numero(contagem("Caro"))} tom="danger" />
        </div>

        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_auto]">
            <div className="space-y-2">
              <Label>Linha</Label>
              <Select value={linha} onValueChange={setLinha}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as linhas</SelectItem>
                  {linhas.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Barato">Barato</SelectItem>
                  <SelectItem value="Competitivo">Competitivo</SelectItem>
                  <SelectItem value="Caro">Caro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="busca-preco">Buscar produto</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-preco"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="pl-9"
                  placeholder="Código, descrição ou linha"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={limparFiltros} className="w-full">
                Limpar
              </Button>
            </div>


          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Comparativo por produto</CardTitle>
              <Badge variant="outline">
                Diferença média: {mediaDiferenca >= 0 ? "+" : ""}
                {percentual(mediaDiferenca)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead>Cód. produto</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead className="text-right">Menor</TableHead>
                    <TableHead className="text-right">Maior</TableHead>
                    <TableHead className="text-right">Fornecedor</TableHead>
                    <TableHead>Faixa</TableHead>
                    <TableHead className="text-right">Dif. média</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((item) => (
                    <TableRow key={item.produto.sku}>
                      <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                      <TableCell className="min-w-[240px] font-medium">
                        {item.produto.descricao}
                      </TableCell>
                      <TableCell className="min-w-[170px] text-xs">{item.linha}</TableCell>
                      <TableCell className="text-right">{brl(item.menorConcorrencia)}</TableCell>
                      <TableCell className="text-right">{brl(item.maiorConcorrencia)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {brl(item.precoFornecedor)}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="space-y-1.5">
                          <Progress value={item.posicaoFaixa} className="h-2" />
                          <div className="flex justify-between text-[0.65rem] text-muted-foreground">
                            <span>Menor</span>
                            <span>Maior</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={item.diferencaMediaPct > 0 ? "text-danger" : "text-success"}
                        >
                          {item.diferencaMediaPct >= 0 ? "+" : ""}
                          {percentual(item.diferencaMediaPct)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border-0 ${statusConfig[item.status].badge}`}>
                          {item.status}
                        </Badge>
                        <p className="mt-1 text-[0.65rem] text-muted-foreground">
                          {statusConfig[item.status].texto}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtrados.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum produto encontrado para os filtros selecionados.
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
  tom = "primary",
}: {
  titulo: string;
  valor: string;
  tom?: "primary" | "success" | "danger";
}) {
  const Icone = tom === "danger" ? TrendingUp : tom === "success" ? TrendingDown : Search;
  const cor =
    tom === "danger" ? "text-danger" : tom === "success" ? "text-success" : "text-primary";

  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="font-display text-2xl font-bold">{valor}</p>
        </div>
        <Icone className={`size-5 ${cor}`} />
      </CardContent>
    </Card>
  );
}
