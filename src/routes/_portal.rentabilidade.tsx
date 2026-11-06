import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Filter, Layers3, PackageSearch, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchRentabilidade, type RentabilidadeDB, type RentabilidadeLinhaDB } from "@/api";
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
import { brl, percentual } from "@/lib/format";

export const Route = createFileRoute("/_portal/rentabilidade")({
  head: () => ({
    meta: [
      { title: "Rentabilidade | Portal do Fornecedor" },
      {
        name: "description",
        content: "DRE gerencial por fornecedor e produto, com rebaixas apuradas e recebidas.",
      },
    ],
  }),
  component: RentabilidadePage,
});

type Resumo = {
  quantidade: number;
  receitaLiquida: number;
  cmv: number;
  rebaixaApurada: number;
  rebaixaRecebida: number;
  margemBruta: number;
  resultadoGerencial: number;
  resultadoRealizado: number;
  estoqueQuantidade: number;
  estoqueValor: number;
  coberturaDias: number | null;
};

const resumoVazio = (): Resumo => ({
  quantidade: 0,
  receitaLiquida: 0,
  cmv: 0,
  rebaixaApurada: 0,
  rebaixaRecebida: 0,
  margemBruta: 0,
  resultadoGerencial: 0,
  resultadoRealizado: 0,
  estoqueQuantidade: 0,
  estoqueValor: 0,
  coberturaDias: null,
});

function resumir(linhas: RentabilidadeLinhaDB[]): Resumo {
  return linhas.reduce(acumularResumoLinha, resumoVazio());
}

function acumularResumoLinha(total: Resumo, linha: RentabilidadeLinhaDB): Resumo {
  total.quantidade += linha.quantidade;
  total.receitaLiquida += linha.receitaLiquida;
  total.cmv += linha.cmv;
  total.rebaixaApurada += linha.rebaixaApurada;
  total.rebaixaRecebida += linha.rebaixaRecebida;
  total.margemBruta += linha.margemBruta;
  total.resultadoGerencial += linha.resultadoGerencial;
  total.resultadoRealizado += linha.resultadoRealizado;
  total.estoqueQuantidade += linha.estoqueQuantidade;
  total.estoqueValor += linha.estoqueValor;
  return total;
}

function coberturaResumo(linhas: RentabilidadeLinhaDB[], de: string, ate: string): number | null {
  const estoqueValor = linhas.reduce((total, linha) => total + linha.estoqueValor, 0);
  const cmv = linhas.reduce((total, linha) => total + linha.cmv, 0);
  const diasPeriodo = Math.max(
    1,
    Math.round(
      (new Date(`${ate}T00:00:00Z`).getTime() - new Date(`${de}T00:00:00Z`).getTime()) / 86400000,
    ) + 1,
  );
  return estoqueValor > 0 && cmv > 0 ? estoqueValor / (cmv / diasPeriodo) : null;
}

const margemPct = (resultado: number, receita: number) =>
  receita > 0 ? (resultado / receita) * 100 : 0;
const linhasRentabilidadeVazias: RentabilidadeLinhaDB[] = [];

function primeiroDiaMesAnterior() {
  const hoje = new Date();
  hoje.setDate(1);
  hoje.setMonth(hoje.getMonth() - 1);
  return hoje.toISOString().slice(0, 10);
}

function ultimoDiaMesAnterior() {
  const hoje = new Date();
  hoje.setDate(0);
  return hoje.toISOString().slice(0, 10);
}

function Kpi({
  titulo,
  valor,
  detalhe,
  icone: Icon,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: typeof BarChart3;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? "border-primary/40 bg-primary/5 shadow-panel" : "shadow-panel"}>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight">{valor}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function PaginacaoRentabilidade({
  pagina,
  totalPaginas,
  totalItens,
  onChange,
}: {
  pagina: number;
  totalPaginas: number;
  totalItens: number;
  onChange: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
      <span>
        Página {pagina} de {totalPaginas} · {totalItens.toLocaleString("pt-BR")} registro(s)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pagina <= 1}
          onClick={() => onChange(Math.max(1, pagina - 1))}
        >
          Anterior
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pagina >= totalPaginas}
          onClick={() => onChange(Math.min(totalPaginas, pagina + 1))}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

function RentabilidadePage() {
  const { fornecedor, codigoFornecedorAtivo, usuarioInterno } = usePortal();
  const modo: "interno" | "fornecedor" = usuarioInterno ? "interno" : "fornecedor";
  const fornecedorSelecionado = codigoFornecedorAtivo || fornecedor.codigo;
  const fornecedorConsulta = modo === "fornecedor" ? fornecedorSelecionado : "";
  const ITENS_POR_PAGINA = 100;
  const [de, setDe] = useState(primeiroDiaMesAnterior);
  const [ate, setAte] = useState(ultimoDiaMesAnterior);
  const [segmento, setSegmento] = useState("todos");
  const [departamento, setDepartamento] = useState("todos");
  const [secao, setSecao] = useState("todos");
  const [grupo, setGrupo] = useState("todos");
  const [subgrupo, setSubgrupo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [buscaFornecedor, setBuscaFornecedor] = useState("");
  const [dados, setDados] = useState<RentabilidadeDB | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    void fetchRentabilidade({ data: { de, ate, modo } })
      .then((resultado) => {
        if (ativo) setDados(resultado);
      })
      .catch((error: unknown) => {
        if (!ativo) return;
        setDados(null);
        setErro(
          error instanceof Error ? error.message : "Não foi possível carregar a rentabilidade.",
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [ate, de, fornecedorConsulta, modo]);

  const linhas = dados?.linhas ?? linhasRentabilidadeVazias;
  const segmentos = useMemo(
    () => [...new Set(linhas.map((linha) => linha.segmento).filter(Boolean))].sort(),
    [linhas],
  );
  const departamentos = useMemo(
    () =>
      [
        ...new Set(
          linhas
            .filter((linha) => segmento === "todos" || linha.segmento === segmento)
            .map((linha) => linha.departamento)
            .filter(Boolean),
        ),
      ].sort(),
    [linhas, segmento],
  );
  const secoes = useMemo(
    () =>
      [
        ...new Set(
          linhas
            .filter((linha) => segmento === "todos" || linha.segmento === segmento)
            .filter((linha) => departamento === "todos" || linha.departamento === departamento)
            .map((linha) => linha.secao)
            .filter(Boolean),
        ),
      ].sort(),
    [departamento, linhas, segmento],
  );
  const grupos = useMemo(
    () =>
      [
        ...new Set(
          linhas
            .filter((linha) => segmento === "todos" || linha.segmento === segmento)
            .filter((linha) => departamento === "todos" || linha.departamento === departamento)
            .filter((linha) => secao === "todos" || linha.secao === secao)
            .map((linha) => linha.grupo)
            .filter(Boolean),
        ),
      ].sort(),
    [departamento, linhas, secao, segmento],
  );
  const subgrupos = useMemo(
    () =>
      [
        ...new Set(
          linhas
            .filter((linha) => segmento === "todos" || linha.segmento === segmento)
            .filter((linha) => departamento === "todos" || linha.departamento === departamento)
            .filter((linha) => secao === "todos" || linha.secao === secao)
            .filter((linha) => grupo === "todos" || linha.grupo === grupo)
            .map((linha) => linha.subgrupo)
            .filter(Boolean),
        ),
      ].sort(),
    [departamento, grupo, linhas, secao, segmento],
  );

  const linhasFiltradas = useMemo(() => {
    const consulta = modo === "fornecedor" ? busca.trim().toLocaleLowerCase() : "";
    const consultaFornecedor = modo === "interno" ? buscaFornecedor.trim().toLocaleLowerCase() : "";
    const fornecedorDaBusca = modo === "fornecedor" ? fornecedorSelecionado : "todos";
    return linhas
      .filter(
        (linha) => fornecedorDaBusca === "todos" || linha.fornecedorCodigo === fornecedorDaBusca,
      )
      .filter((linha) => {
        if (!consultaFornecedor) return true;
        return `${linha.fornecedorCodigo} ${linha.fornecedorNome}`
          .toLocaleLowerCase()
          .includes(consultaFornecedor);
      })
      .filter((linha) => segmento === "todos" || linha.segmento === segmento)
      .filter((linha) => departamento === "todos" || linha.departamento === departamento)
      .filter((linha) => secao === "todos" || linha.secao === secao)
      .filter((linha) => grupo === "todos" || linha.grupo === grupo)
      .filter((linha) => subgrupo === "todos" || linha.subgrupo === subgrupo)
      .filter((linha) => {
        if (!consulta) return true;
        return [linha.sku, linha.descricao, linha.produtosBusca]
          .join(" ")
          .toLocaleLowerCase()
          .includes(consulta);
      });
  }, [busca, buscaFornecedor, departamento, fornecedorSelecionado, grupo, linhas, modo, secao, segmento, subgrupo]);

  const resumo = useMemo(() => {
    const resultado = resumir(linhasFiltradas);
    resultado.coberturaDias = coberturaResumo(linhasFiltradas, de, ate);
    return resultado;
  }, [ate, de, linhasFiltradas]);
  const fornecedores = useMemo(() => {
    const mapa = new Map<string, { codigo: string; nome: string; resumo: Resumo }>();
    for (const linha of linhasFiltradas) {
      const existente = mapa.get(linha.fornecedorCodigo);
      if (existente) {
        acumularResumoLinha(existente.resumo, linha);
      } else {
        mapa.set(linha.fornecedorCodigo, {
          codigo: linha.fornecedorCodigo,
          nome: linha.fornecedorNome,
          resumo: acumularResumoLinha(resumoVazio(), linha),
        });
      }
    }
    return [...mapa.values()].sort(
      (a, b) => b.resumo.resultadoGerencial - a.resumo.resultadoGerencial,
    );
  }, [linhasFiltradas]);

  const fornecedoresVisiveis = useMemo(() => {
    const consulta = buscaFornecedor.trim().toLocaleLowerCase();
    if (!consulta) return fornecedores;
    return fornecedores.filter((item) =>
      `${item.codigo} ${item.nome}`.toLocaleLowerCase().includes(consulta),
    );
  }, [buscaFornecedor, fornecedores]);

  const linhasOrdenadas = useMemo(
    () => [...linhasFiltradas].sort((a, b) => b.resultadoGerencial - a.resultadoGerencial),
    [linhasFiltradas],
  );
  const totalItensTabela = modo === "interno" ? fornecedoresVisiveis.length : linhasOrdenadas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItensTabela / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const fornecedoresPagina = useMemo(
    () =>
      fornecedoresVisiveis.slice(
        (paginaAtual - 1) * ITENS_POR_PAGINA,
        paginaAtual * ITENS_POR_PAGINA,
      ),
    [fornecedoresVisiveis, paginaAtual],
  );
  const linhasPagina = useMemo(
    () =>
      linhasOrdenadas.slice(
        (paginaAtual - 1) * ITENS_POR_PAGINA,
        paginaAtual * ITENS_POR_PAGINA,
      ),
    [linhasOrdenadas, paginaAtual],
  );

  useEffect(() => {
    setPagina(1);
  }, [ate, busca, buscaFornecedor, de, departamento, grupo, modo, secao, segmento, subgrupo]);

  const benchmark = dados?.benchmark;
  const margemGerencial = margemPct(resumo.resultadoGerencial, resumo.receitaLiquida);
  const margemRealizada = margemPct(resumo.resultadoRealizado, resumo.receitaLiquida);
  const fornecedorAtual = fornecedorSelecionado;

  return (
    <PortalLayout
      titulo="Rentabilidade"
      descricao="DRE gerencial por fornecedor e produto, com rebaixas apuradas e recebidas."
    >
      <div className="space-y-4">
        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-8">
            <div className="space-y-2">
              <Label htmlFor="rentabilidade-de">Período inicial</Label>
              <Input
                id="rentabilidade-de"
                type="date"
                value={de}
                onChange={(event) => setDe(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rentabilidade-ate">Período final</Label>
              <Input
                id="rentabilidade-ate"
                type="date"
                value={ate}
                onChange={(event) => setAte(event.target.value)}
              />
            </div>
            {modo === "interno" ? (
              <>
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Select
                    value={segmento}
                    onValueChange={(valor) => {
                      setSegmento(valor);
                      setDepartamento("todos");
                      setSecao("todos");
                      setGrupo("todos");
                      setSubgrupo("todos");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os segmentos" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      <SelectItem value="todos">Todos os segmentos</SelectItem>
                      {segmentos.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    value={departamento}
                    onValueChange={(valor) => {
                      setDepartamento(valor);
                      setSecao("todos");
                      setGrupo("todos");
                      setSubgrupo("todos");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os departamentos" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      <SelectItem value="todos">Todos os departamentos</SelectItem>
                      {departamentos.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seção</Label>
                  <Select
                    value={secao}
                    onValueChange={(valor) => {
                      setSecao(valor);
                      setGrupo("todos");
                      setSubgrupo("todos");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as seções" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      <SelectItem value="todos">Todas as seções</SelectItem>
                      {secoes.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select
                    value={grupo}
                    onValueChange={(valor) => {
                      setGrupo(valor);
                      setSubgrupo("todos");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os grupos" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      <SelectItem value="todos">Todos os grupos</SelectItem>
                      {grupos.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subgrupo</Label>
                  <Select value={subgrupo} onValueChange={setSubgrupo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os subgrupos" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      <SelectItem value="todos">Todos os subgrupos</SelectItem>
                      {subgrupos.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="flex items-end">
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">Fornecedor ativo:</span>{" "}
                  {fornecedor.nome}
                </div>
              </div>
            )}
            {modo === "fornecedor" ? (
              <div className="space-y-2">
                <Label htmlFor="rentabilidade-busca">Produto/SKU</Label>
                <div className="relative">
                  <PackageSearch className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="rentabilidade-busca"
                    className="pl-9"
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar produto do fornecedor selecionado..."
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {erro ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-5 text-sm text-destructive">{erro}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi
            titulo="Receita líquida"
            valor={brl(resumo.receitaLiquida)}
            detalhe={`${resumo.quantidade.toLocaleString("pt-BR")} unidades`}
            icone={BarChart3}
          />
          <Kpi
            titulo="Resultado gerencial"
            valor={brl(resumo.resultadoGerencial)}
            detalhe={`Margem ${percentual(margemGerencial)}`}
            icone={WalletCards}
            destaque
          />
          <Kpi
            titulo="Rebaixas apuradas"
            valor={brl(resumo.rebaixaApurada)}
            detalhe="Reconhecidas no período executado"
            icone={ReceiptText}
          />
          <Kpi
            titulo="Rebaixas recebidas"
            valor={brl(resumo.rebaixaRecebida)}
            detalhe={`Resultado realizado: ${brl(resumo.resultadoRealizado)}`}
            icone={Layers3}
          />
          <Kpi
            titulo="Estoque a custo"
            valor={brl(resumo.estoqueValor)}
            detalhe={`${resumo.estoqueQuantidade.toLocaleString("pt-BR")} unidades na posição atual`}
            icone={PackageSearch}
          />
          <Kpi
            titulo="Cobertura (custo)"
            valor={
              resumo.coberturaDias === null
                ? "—"
                : `${resumo.coberturaDias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`
            }
            detalhe="Estoque a custo ÷ CMV médio diário"
            icone={BarChart3}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          O estoque é uma posição operacional/patrimonial e não é subtraído novamente do DRE. A
          posição exibida é a última disponível na fonte operacional
          {dados?.estoque.data ? ` (${dados.estoque.data.slice(0, 10)})` : ""}.
        </p>

        {modo === "fornecedor" && benchmark ? (
          <Card className="border-primary/20 shadow-panel">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Comparação com outros fornecedores</CardTitle>
                  <CardDescription>
                    Média anonimizada dos demais fornecedores no mesmo período.
                  </CardDescription>
                </div>
                <Badge variant="secondary">{benchmark.participantes} fornecedor(es) na base</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Sua margem gerencial</p>
                <p className="mt-1 text-xl font-bold">{percentual(margemGerencial)}</p>
                <p className="text-xs text-muted-foreground">
                  Média: {percentual(benchmark.margemGerencialMediaPct)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Seu resultado</p>
                <p className="mt-1 text-xl font-bold">{brl(resumo.resultadoGerencial)}</p>
                <p className="text-xs text-muted-foreground">
                  Média: {brl(benchmark.resultadoGerencialMedio)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Diferença de margem</p>
                <p
                  className={`mt-1 text-xl font-bold ${margemGerencial >= benchmark.margemGerencialMediaPct ? "text-success" : "text-destructive"}`}
                >
                  {percentual(margemGerencial - benchmark.margemGerencialMediaPct)}
                </p>
                <p className="text-xs text-muted-foreground">Em relação à média</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">Receita média da base</p>
                <p className="mt-1 text-xl font-bold">{brl(benchmark.receitaMedia)}</p>
                <p className="text-xs text-muted-foreground">Sem identificar concorrentes</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-panel">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {modo === "interno" ? "Comparativo por fornecedor" : "Resultado por produto"}
                </CardTitle>
                <CardDescription>
                  {modo === "interno"
                    ? "Use a hierarquia de segmento, departamento, seção, grupo e subgrupo para comparar fornecedores equivalentes."
                    : "Abra o resultado até o nível de SKU e acompanhe o efeito das rebaixas."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {modo === "interno" ? (
                  <div className="relative w-full sm:w-72">
                    <PackageSearch className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="rentabilidade-busca-fornecedor"
                      className="pl-9"
                      value={buscaFornecedor}
                      onChange={(event) => setBuscaFornecedor(event.target.value)}
                      placeholder="Buscar fornecedor por nome ou código..."
                    />
                  </div>
                ) : null}
                <Badge variant="outline" className="gap-1">
                  <Filter className="size-3" />{" "}
                  {carregando
                    ? "Atualizando..."
                    : modo === "interno"
                      ? `${fornecedoresVisiveis.length} fornecedor(es)`
                      : `${linhasFiltradas.length} linha(s)`}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {modo === "interno" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Receita líquida</TableHead>
                    <TableHead className="text-right">CMV</TableHead>
                    <TableHead className="text-right">Rebaixa apurada</TableHead>
                    <TableHead className="text-right">Rebaixa recebida</TableHead>
                    <TableHead className="text-right">Estoque a custo</TableHead>
                    <TableHead className="text-right">Resultado gerencial</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedoresPagina.map((item) => (
                    <TableRow key={item.codigo}>
                      <TableCell>
                        <div className="font-medium">{item.nome}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {item.codigo}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {brl(item.resumo.receitaLiquida)}
                      </TableCell>
                      <TableCell className="text-right">{brl(item.resumo.cmv)}</TableCell>
                      <TableCell className="text-right">
                        {brl(item.resumo.rebaixaApurada)}
                      </TableCell>
                      <TableCell className="text-right">
                        {brl(item.resumo.rebaixaRecebida)}
                      </TableCell>
                      <TableCell className="text-right">{brl(item.resumo.estoqueValor)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {brl(item.resumo.resultadoGerencial)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            margemPct(item.resumo.resultadoGerencial, item.resumo.receitaLiquida) >=
                            0
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {percentual(
                            margemPct(item.resumo.resultadoGerencial, item.resumo.receitaLiquida),
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {fornecedoresVisiveis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhum fornecedor encontrado para os filtros.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto/SKU</TableHead>
                    <TableHead>Hierarquia mercadológica</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Receita líquida</TableHead>
                    <TableHead className="text-right">CMV</TableHead>
                    <TableHead className="text-right">Rebaixa apurada</TableHead>
                    <TableHead className="text-right">Rebaixa recebida</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Cobertura (custo)</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasPagina.map((linha) => (
                      <TableRow key={`${linha.fornecedorCodigo}-${linha.sku}`}>
                        <TableCell>
                          <div className="max-w-[20rem] truncate font-medium">
                            {linha.descricao}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            SKU {linha.sku}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {linha.segmento} · {linha.departamento} · {linha.secao}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {linha.grupo} · {linha.subgrupo} · {linha.categoria}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {linha.quantidade.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">{brl(linha.receitaLiquida)}</TableCell>
                        <TableCell className="text-right">{brl(linha.cmv)}</TableCell>
                        <TableCell className="text-right">{brl(linha.rebaixaApurada)}</TableCell>
                        <TableCell className="text-right">{brl(linha.rebaixaRecebida)}</TableCell>
                        <TableCell className="text-right">
                          <div>{brl(linha.estoqueValor)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {linha.estoqueQuantidade.toLocaleString("pt-BR")} un.
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {linha.coberturaDias === null
                            ? "—"
                            : `${linha.coberturaDias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {brl(linha.resultadoGerencial)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              margemPct(linha.resultadoGerencial, linha.receitaLiquida) >= 0
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {percentual(margemPct(linha.resultadoGerencial, linha.receitaLiquida))}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  {linhasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                        Nenhum produto encontrado para os filtros.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
            <PaginacaoRentabilidade
              pagina={paginaAtual}
              totalPaginas={totalPaginas}
              totalItens={totalItensTabela}
              onChange={setPagina}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card className="shadow-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Leitura do resultado</CardTitle>
              <CardDescription>Valores diretos do período selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Receita líquida</span>
                <span className="font-semibold">{brl(resumo.receitaLiquida)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">(-) CMV</span>
                <span>{brl(-resumo.cmv)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Margem bruta</span>
                <span className="font-semibold">{brl(resumo.margemBruta)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Estoque a custo (posição atual)</span>
                <span>{brl(resumo.estoqueValor)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Cobertura financeira</span>
                <span>
                  {resumo.coberturaDias === null
                    ? "—"
                    : `${resumo.coberturaDias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">(+) Rebaixas apuradas</span>
                <span className="font-semibold text-primary">{brl(resumo.rebaixaApurada)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Resultado gerencial</span>
                <span className="text-lg font-bold text-primary">
                  {brl(resumo.resultadoGerencial)}
                </span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Margem realizada com rebaixas recebidas: {percentual(margemRealizada)}.
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conciliação das rebaixas</CardTitle>
              <CardDescription>
                O recebimento liquida a rebaixa apurada sem duplicar o resultado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Apuradas</span>
                <span className="font-semibold">{brl(resumo.rebaixaApurada)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Recebidas</span>
                <span className="font-semibold text-success">{brl(resumo.rebaixaRecebida)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span>Pendentes</span>
                <span className="font-semibold text-amber-600">
                  {brl(Math.max(0, resumo.rebaixaApurada - resumo.rebaixaRecebida))}
                </span>
              </div>
              {dados?.rebaixasNaoAlocadas.reduce((total, item) => total + item.valor, 0) ? (
                <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700">
                  Existem recebimentos sem vínculo direto a SKU; eles ficam destacados como não
                  alocados.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {dados?.fonte === "mock"
            ? "Ambiente de demonstração: os dados exibidos usam a base sintética do portal."
            : "Fonte operacional: vendas, produtos, ofertas e contas a receber do portal."}{" "}
          {modo === "fornecedor"
            ? `Fornecedor ativo: ${fornecedorAtual}.`
            : "Visão interna com comparação entre fornecedores."}
        </p>
      </div>
    </PortalLayout>
  );
}
