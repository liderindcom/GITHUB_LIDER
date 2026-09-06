import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Download,
  PackageSearch,
  Percent,
  Search,
  Tags,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { fetchShareFornecedor, type ShareCategoriaDB, type ShareFornecedorDB } from "@/api";
import { PortalLayout } from "@/components/portal-layout";
import { TableColumnHeader } from "@/components/table-column-header";
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
  departamentoMercadologico,
  grupoMercadologico,
  produtos,
  secaoMercadologica,
  subgrupoMercadologico,
  vendas,
  type Produto,
  type VendaItem,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/representatividade")({
  head: () => ({
    meta: [
      { title: "Share de Vendas | Portal do Fornecedor" },
      {
        name: "description",
        content: "Share de vendas do fornecedor por categoria e marca no Grupo Líder.",
      },
      { property: "og:title", content: "Share de Vendas | Portal do Fornecedor" },
    ],
  }),
  component: RepresentatividadePage,
});

type Janela = "30" | "60" | "90" | "tudo";

type LinhaRepresentatividade = {
  produto: Produto;
  codigo: string;
  departamento: string;
  secao: string;
  grupo: string;
  subgrupo: string;
  quantidade: number;
  faturamento: number;
  vendaSubgrupo: number;
  representatividade: number;
  acumulado: number;
  posicao: number;
};

type ShareCategoriaView = ShareCategoriaDB & {
  shareValor: number;
  shareQuantidade: number;
};

type DirecaoTabela = "asc" | "desc" | null;
type OrdenacaoTabela = { campo: string; direcao: DirecaoTabela };

function ordenarTabela<T>(linhas: T[], busca: string, texto: (linha: T) => string, ordenacao: OrdenacaoTabela, valor: (linha: T, campo: string) => string | number) {
  const filtradas = linhas.filter((linha) => !busca || texto(linha).toLowerCase().includes(busca.toLowerCase()));
  if (!ordenacao.direcao) return filtradas;
  return [...filtradas].sort((a, b) => {
    const esquerda = valor(a, ordenacao.campo);
    const direita = valor(b, ordenacao.campo);
    const comparacao = typeof esquerda === "number" && typeof direita === "number"
      ? esquerda - direita
      : String(esquerda).localeCompare(String(direita), "pt-BR", { numeric: true, sensitivity: "base" });
    return ordenacao.direcao === "asc" ? comparacao : -comparacao;
  });
}

function alternarOrdenacao(atual: OrdenacaoTabela, campo: string): OrdenacaoTabela {
  return { campo, direcao: atual.campo === campo ? (atual.direcao === null ? "asc" : atual.direcao === "asc" ? "desc" : null) : "asc" };
}

type ShareMarcaView = {
  marca: string;
  fornecedorValor: number;
  fornecedorQuantidade: number;
  produtos: number;
  categorias: number;
  sharePortfolio: number;
};

const CORES_SHARE = ["#0f766e", "#2563eb", "#dc2626", "#9333ea", "#ca8a04", "#16a34a"];

const opcoes = (valores: string[]) =>
  Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b));

const chaveSubgrupo = (produto: Produto) =>
  [
    produto.departamentoCodigo,
    produto.secaoCodigo,
    produto.grupoCodigo,
    produto.subgrupoCodigo,
  ].join(".");

const inicioJanela = (linhas: VendaItem[], janela: Janela) => {
  if (janela === "tudo") return null;
  const ultimaData = linhas
    .map((linha) => linha.data)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!ultimaData) return null;

  const inicio = new Date(`${ultimaData}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - (Number(janela) - 1));
  return inicio.toISOString().slice(0, 10);
};

const statusParticipacao = (percentualSubgrupo: number, posicao: number) => {
  if (posicao === 1) return "Líder";
  if (percentualSubgrupo >= 20) return "Relevante";
  if (percentualSubgrupo < 5) return "Cauda";
  return "Intermediário";
};

const badgeParticipacao = (status: string) => {
  if (status === "Líder") return "bg-primary text-primary-foreground";
  if (status === "Relevante") return "bg-success text-success-foreground";
  if (status === "Cauda") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary";
};

const compactarMoeda = (valor: number) => {
  if (Math.abs(valor) >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)} mi`;
  if (Math.abs(valor) >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)} mil`;
  return brl(valor);
};

const marcaDaLinha = (produto: { marca?: string | null }) => {
  const marca = produto.marca?.trim();
  return marca || "Marca não informada";
};

const resumoCategoriasDemo = (linhas: LinhaRepresentatividade[]): ShareCategoriaView[] => {
  const mapa = new Map<string, ShareCategoriaView>();
  for (const linha of linhas) {
    const categoria = linha.produto.categoria || linha.subgrupo;
    const atual =
      mapa.get(categoria) ??
      ({
        categoria,
        departamento: linha.departamento,
        secao: linha.secao,
        grupo: linha.grupo,
        subgrupo: linha.subgrupo,
        fornecedorValor: 0,
        liderValor: 0,
        fornecedorQuantidade: 0,
        liderQuantidade: 0,
        fornecedorSkus: 0,
        liderSkus: 0,
        shareValor: 0,
        shareQuantidade: 0,
      } satisfies ShareCategoriaView);
    atual.fornecedorValor += linha.faturamento;
    atual.fornecedorQuantidade += linha.quantidade;
    atual.fornecedorSkus += 1;
    mapa.set(categoria, atual);
  }

  return Array.from(mapa.values())
    .map((item, index) => {
      const shareEstimado = Math.max(8, 32 - index * 4);
      const liderValor = item.fornecedorValor / (shareEstimado / 100);
      const liderQuantidade = item.fornecedorQuantidade / (shareEstimado / 100);
      return {
        ...item,
        liderValor,
        liderQuantidade,
        liderSkus: Math.max(
          item.fornecedorSkus + 3,
          Math.round(item.fornecedorSkus / (shareEstimado / 100)),
        ),
        shareValor: shareEstimado,
        shareQuantidade: shareEstimado,
      };
    })
    .sort((a, b) => b.fornecedorValor - a.fornecedorValor);
};

const resumoMarcasDemo = (linhas: LinhaRepresentatividade[]): ShareMarcaView[] => {
  const total = linhas.reduce((acc, linha) => acc + linha.faturamento, 0);
  const mapa = new Map<string, ShareMarcaView>();
  for (const linha of linhas) {
    const marca = marcaDaLinha(linha.produto);
    const atual =
      mapa.get(marca) ??
      ({
        marca,
        fornecedorValor: 0,
        fornecedorQuantidade: 0,
        produtos: 0,
        categorias: 0,
        sharePortfolio: 0,
      } satisfies ShareMarcaView);
    atual.fornecedorValor += linha.faturamento;
    atual.fornecedorQuantidade += linha.quantidade;
    atual.produtos += 1;
    atual.categorias = new Set(
      linhas
        .filter((item) => marcaDaLinha(item.produto) === marca)
        .map((item) => item.produto.categoria),
    ).size;
    mapa.set(marca, atual);
  }
  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      sharePortfolio: total > 0 ? (item.fornecedorValor / total) * 100 : 0,
    }))
    .sort((a, b) => b.fornecedorValor - a.fornecedorValor);
};

function RepresentatividadePage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [janela, setJanela] = useState<Janela>("90");
  const [departamento, setDepartamento] = useState("todos");
  const [secao, setSecao] = useState("todos");
  const [grupo, setGrupo] = useState("todos");
  const [subgrupo, setSubgrupo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [shareFornecedor, setShareFornecedor] = useState<ShareFornecedorDB | null>(null);
  const [carregandoShare, setCarregandoShare] = useState(false);
  const [erroShare, setErroShare] = useState<string | null>(null);
  const [buscaCategoriaTabela, setBuscaCategoriaTabela] = useState("");
  const [buscaMarcaTabela, setBuscaMarcaTabela] = useState("");
  const [buscaProdutoTabela, setBuscaProdutoTabela] = useState("");
  const [ordemCategoriaTabela, setOrdemCategoriaTabela] = useState<OrdenacaoTabela>({ campo: "categoria", direcao: null });
  const [ordemMarcaTabela, setOrdemMarcaTabela] = useState<OrdenacaoTabela>({ campo: "marca", direcao: null });
  const [ordemProdutoTabela, setOrdemProdutoTabela] = useState<OrdenacaoTabela>({ campo: "codigo", direcao: null });

  const baseProdutos = Array.from(produtos);

  useEffect(() => {
    let cancelado = false;
    setCarregandoShare(true);
    setErroShare(null);

    fetchShareFornecedor({
      data: {
        fornecedorCodigo: fornecedor.codigo,
        janela,
      },
    })
      .then((dados) => {
        if (!cancelado) setShareFornecedor(dados);
      })
      .catch((error) => {
        console.error("Erro ao carregar share do fornecedor:", error);
        if (!cancelado) {
          setShareFornecedor(null);
          setErroShare("Share agregado indisponível");
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoShare(false);
      });

    return () => {
      cancelado = true;
    };
  }, [fornecedor.codigo, janela, dadosFornecedorVersao]);

  const analise = useMemo<LinhaRepresentatividade[]>(() => {
    void dadosFornecedorVersao;
    const produtosAtuais = Array.from(produtos);
    const produtosPorSku = new Map(produtosAtuais.map((produto) => [produto.sku, produto]));
    const inicio = inicioJanela(Array.from(vendas), janela);
    const vendasPeriodo = Array.from(vendas).filter((venda) => {
      if (!produtosPorSku.has(venda.sku)) return false;
      if (inicio && venda.data < inicio) return false;
      return true;
    });

    const vendaSku = new Map<string, { quantidade: number; faturamento: number }>();
    for (const venda of vendasPeriodo) {
      const atual = vendaSku.get(venda.sku) ?? { quantidade: 0, faturamento: 0 };
      atual.quantidade += venda.quantidade;
      atual.faturamento += venda.quantidade * venda.valorUnitario;
      vendaSku.set(venda.sku, atual);
    }

    const linhasBase = produtosAtuais.map((produto) => {
      const vendaProduto = vendaSku.get(produto.sku) ?? { quantidade: 0, faturamento: 0 };
      return {
        produto,
        codigo: codigoProdutoComDigito(produto.sku),
        departamento: departamentoMercadologico(produto),
        secao: secaoMercadologica(produto),
        grupo: grupoMercadologico(produto),
        subgrupo: subgrupoMercadologico(produto),
        quantidade: vendaProduto.quantidade,
        faturamento: vendaProduto.faturamento,
        vendaSubgrupo: 0,
        representatividade: 0,
        acumulado: 0,
        posicao: 0,
      };
    });

    const porSubgrupo = new Map<string, typeof linhasBase>();
    for (const linha of linhasBase) {
      const chave = chaveSubgrupo(linha.produto);
      porSubgrupo.set(chave, [...(porSubgrupo.get(chave) ?? []), linha]);
    }

    for (const linhasSubgrupo of porSubgrupo.values()) {
      const ordenadas = [...linhasSubgrupo].sort((a, b) => b.faturamento - a.faturamento);
      const totalSubgrupo = ordenadas.reduce((acc, item) => acc + item.faturamento, 0);
      let acumulado = 0;

      ordenadas.forEach((linha, index) => {
        const representatividade =
          totalSubgrupo > 0 ? (linha.faturamento / totalSubgrupo) * 100 : 0;
        acumulado += representatividade;
        linha.vendaSubgrupo = totalSubgrupo;
        linha.representatividade = representatividade;
        linha.acumulado = acumulado;
        linha.posicao = index + 1;
      });
    }

    return linhasBase.sort((a, b) => {
      const subgrupoCompare = a.subgrupo.localeCompare(b.subgrupo);
      if (subgrupoCompare !== 0) return subgrupoCompare;
      return a.posicao - b.posicao;
    });
  }, [janela, dadosFornecedorVersao]);

  const departamentos = opcoes(baseProdutos.map(departamentoMercadologico));
  const secoes = opcoes(
    baseProdutos
      .filter((p) => departamento === "todos" || departamentoMercadologico(p) === departamento)
      .map(secaoMercadologica),
  );
  const grupos = opcoes(
    baseProdutos
      .filter((p) => departamento === "todos" || departamentoMercadologico(p) === departamento)
      .filter((p) => secao === "todos" || secaoMercadologica(p) === secao)
      .map(grupoMercadologico),
  );
  const subgrupos = opcoes(
    baseProdutos
      .filter((p) => departamento === "todos" || departamentoMercadologico(p) === departamento)
      .filter((p) => secao === "todos" || secaoMercadologica(p) === secao)
      .filter((p) => grupo === "todos" || grupoMercadologico(p) === grupo)
      .map(subgrupoMercadologico),
  );

  const lista = analise.filter((linha) => {
    if (departamento !== "todos" && linha.departamento !== departamento) return false;
    if (secao !== "todos" && linha.secao !== secao) return false;
    if (grupo !== "todos" && linha.grupo !== grupo) return false;
    if (subgrupo !== "todos" && linha.subgrupo !== subgrupo) return false;
    if (busca) {
      const alvo =
        `${linha.codigo} ${linha.produto.sku} ${linha.produto.descricao} ${linha.subgrupo}`.toLowerCase();
      if (!alvo.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  const sellOut = lista.reduce((acc, linha) => acc + linha.faturamento, 0);
  const maiorParticipacao = lista.reduce(
    (max, linha) => Math.max(max, linha.representatividade),
    0,
  );
  const subgruposFiltrados = new Set(lista.map((linha) => linha.subgrupo)).size;
  const categoriasDemo = useMemo(() => resumoCategoriasDemo(analise), [analise]);
  const marcasDemo = useMemo(() => resumoMarcasDemo(analise), [analise]);
  const fonteShareReal = Boolean(shareFornecedor?.categorias.length);
  const categoriasShareBase = fonteShareReal ? (shareFornecedor?.categorias ?? []) : categoriasDemo;
  const marcasShareBase = fonteShareReal ? (shareFornecedor?.marcas ?? []) : marcasDemo;
  const categoriasTabela = useMemo(() => ordenarTabela(categoriasShare, buscaCategoriaTabela, (linha) => `${linha.categoria} ${linha.subgrupo}`, ordemCategoriaTabela, (linha, campo) => campo === "fornecedor" ? linha.fornecedorValor : campo === "categoriaTotal" ? linha.liderValor : campo === "share" ? linha.shareValor : linha.categoria), [categoriasShare, buscaCategoriaTabela, ordemCategoriaTabela]);
  const marcasTabela = useMemo(() => ordenarTabela(marcasShareBase, buscaMarcaTabela, (linha) => linha.marca, ordemMarcaTabela, (linha, campo) => campo === "venda" ? linha.fornecedorValor : campo === "produtos" ? linha.produtos : campo === "share" ? linha.sharePortfolio : linha.marca), [marcasShareBase, buscaMarcaTabela, ordemMarcaTabela]);
  const listaTabela = useMemo(() => ordenarTabela(lista, buscaProdutoTabela, (linha) => `${linha.codigo} ${linha.produto.descricao} ${linha.departamento} ${linha.secao} ${linha.grupo} ${linha.subgrupo}`, ordemProdutoTabela, (linha, campo) => campo === "produto" ? linha.produto.descricao : campo === "departamento" ? linha.departamento : campo === "secao" ? linha.secao : campo === "grupo" ? linha.grupo : campo === "subgrupo" ? linha.subgrupo : campo === "venda" ? linha.faturamento : campo === "vendaSubgrupo" ? linha.vendaSubgrupo : campo === "representatividade" ? linha.representatividade : campo === "acumulado" ? linha.acumulado : campo === "posicao" ? linha.posicao : linha.codigo), [lista, buscaProdutoTabela, ordemProdutoTabela]);
  const categoriasShare = categoriasShareBase.filter((linha) => {
    if (departamento !== "todos" && linha.departamento !== departamento) return false;
    if (secao !== "todos" && linha.secao !== secao) return false;
    if (grupo !== "todos" && linha.grupo !== grupo) return false;
    if (subgrupo !== "todos" && linha.subgrupo !== subgrupo) return false;
    return true;
  });
  const graficoCategorias = categoriasShare.map((linha, index) => {
    const sub = (linha.subgrupo || "").trim();
    const cat = (linha.categoria || "").trim();
    const base = sub && cat && sub !== cat ? `${cat} · ${sub}` : sub || cat || "Sem categoria";
    return {
      categoria: `${index + 1}. ${base}`,
      categoriaCompleta: base,
      fornecedor: Number(linha.fornecedorValor.toFixed(2)),
      lider: Number(linha.liderValor.toFixed(2)),
      share: Number(linha.shareValor.toFixed(1)),
    };
  });
  const alturaGraficoCategorias = Math.max(320, graficoCategorias.length * 36);
  const marcasShare = marcasShareBase.slice(0, 8);
  const totalShareFornecedor = categoriasShare.reduce(
    (acc, linha) => acc + linha.fornecedorValor,
    0,
  );
  const totalShareLider = categoriasShare.reduce((acc, linha) => acc + linha.liderValor, 0);
  const shareMedio = totalShareLider > 0 ? (totalShareFornecedor / totalShareLider) * 100 : 0;
  const melhorCategoria = categoriasShare.reduce<ShareCategoriaView | null>((melhor, linha) => {
    if (!melhor || linha.shareValor > melhor.shareValor) return linha;
    return melhor;
  }, null);
  const marcasFiltradas = marcasShareBase.length;
  const periodoShare =
    shareFornecedor?.periodo.inicio && shareFornecedor.periodo.fim
      ? `${shareFornecedor.periodo.inicio} a ${shareFornecedor.periodo.fim}`
      : janela === "tudo"
        ? "Toda a base"
        : `${janela} dias`;

  const limparFiltros = () => {
    setDepartamento("todos");
    setSecao("todos");
    setGrupo("todos");
    setSubgrupo("todos");
    setBusca("");
  };

  function exportar() {
    const cabecalho = [
      "Codigo",
      "Produto",
      "Departamento",
      "Secao",
      "Grupo",
      "Subgrupo",
      "Venda produto",
      "Venda subgrupo",
      "Representatividade",
      "Acumulado",
      "Posicao",
    ];
    const linhas = lista.map((linha) => [
      linha.codigo,
      linha.produto.descricao,
      linha.departamento,
      linha.secao,
      linha.grupo,
      linha.subgrupo,
      linha.faturamento.toFixed(2).replace(".", ","),
      linha.vendaSubgrupo.toFixed(2).replace(".", ","),
      linha.representatividade.toFixed(1).replace(".", ","),
      linha.acumulado.toFixed(1).replace(".", ","),
      String(linha.posicao),
    ]);
    const csv = [cabecalho, ...linhas]
      .map((row) => row.map((col) => `"${col}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "representatividade-mercadologica.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Representatividade exportada", {
      description: `${linhas.length} produtos em formato Excel (CSV).`,
    });
  }

  return (
    <PortalLayout
      titulo="Share de Vendas"
      descricao={`Share = venda do fornecedor ÷ venda de todos os itens da categoria no Grupo Líder — ${fornecedor.nome}`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Resumo titulo="Share médio" valor={percentual(shareMedio)} icone={Percent} />
          <Resumo
            titulo="Venda fornecedor"
            valor={brl(totalShareFornecedor || sellOut)}
            icone={TrendingUp}
          />
          <Resumo titulo="Categorias" valor={numero(categoriasShare.length)} icone={BarChart3} />
          <Resumo titulo="Marcas" valor={numero(marcasFiltradas)} icone={Tags} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card className="shadow-panel">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Share por categoria</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {carregandoShare
                      ? "Carregando base agregada"
                      : erroShare
                        ? erroShare
                        : fonteShareReal
                          ? `${numero(graficoCategorias.length)} categorias · venda real ${periodoShare}`
                          : "Base demonstrativa do fornecedor"}
                  </p>
                </div>
                {melhorCategoria && (
                  <Badge className="border-0 bg-primary text-primary-foreground">
                    Maior share: {percentual(melhorCategoria.shareValor)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[28rem] overflow-auto">
                <div style={{ height: alturaGraficoCategorias, minHeight: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={graficoCategorias}
                      layout="vertical"
                      margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(value) => compactarMoeda(Number(value))}
                      />
                      <YAxis
                        type="category"
                        dataKey="categoria"
                        width={168}
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                      />
                      <Tooltip
                        formatter={(value, name) => {
                          if (name === "share") return [percentual(Number(value)), "Share"];
                          if (name === "fornecedor") return [brl(Number(value)), "Total do fornecedor"];
                          return [brl(Number(value)), "Total da categoria"];
                        }}
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.categoriaCompleta ?? "")
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey="lider"
                        name="Total da categoria"
                        fill="#94a3b8"
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="fornecedor"
                        name="Fornecedor"
                        fill="#0f766e"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-base">Resumo de marcas</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Participação de cada marca dentro das vendas do fornecedor.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={marcasShare}
                      dataKey="fornecedorValor"
                      nameKey="marca"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {marcasShare.map((_, index) => (
                        <Cell key={index} fill={CORES_SHARE[index % CORES_SHARE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _, item) => [
                        `${brl(Number(value))} · ${percentual(item.payload.sharePortfolio)}`,
                        item.payload.marca,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {marcasShare.slice(0, 5).map((marca, index) => (
                  <div
                    key={marca.marca}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: CORES_SHARE[index % CORES_SHARE.length] }}
                      />
                      <span className="truncate font-medium">{marca.marca}</span>
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {percentual(marca.sharePortfolio)}
                    </span>
                  </div>
                ))}
                {marcasShare.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sem marcas com venda no período.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-[0.8fr_1fr_1fr_1fr_1fr_1.2fr_auto_auto]">
            <div className="space-y-2">
              <Label>Janela</Label>
              <Select value={janela} onValueChange={(value) => setJanela(value as Janela)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="tudo">Toda a base</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FiltroMercadologico
              label="Departamento"
              value={departamento}
              values={departamentos}
              onChange={(value) => {
                setDepartamento(value);
                setSecao("todos");
                setGrupo("todos");
                setSubgrupo("todos");
              }}
            />
            <FiltroMercadologico
              label="Seção"
              value={secao}
              values={secoes}
              onChange={(value) => {
                setSecao(value);
                setGrupo("todos");
                setSubgrupo("todos");
              }}
            />
            <FiltroMercadologico
              label="Grupo"
              value={grupo}
              values={grupos}
              onChange={(value) => {
                setGrupo(value);
                setSubgrupo("todos");
              }}
            />
            <FiltroMercadologico
              label="Subgrupo"
              value={subgrupo}
              values={subgrupos}
              onChange={setSubgrupo}
            />

            <div className="space-y-2">
              <Label htmlFor="busca-representatividade">Buscar produto</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="busca-representatividade"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="pl-9"
                  placeholder="Código, descrição ou subgrupo"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={limparFiltros} className="w-full">
                Limpar
              </Button>
            </div>

            <div className="flex items-end">
              <Button onClick={exportar} className="w-full">
                <Download className="size-4" /> Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-base">Resumo por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead><TableColumnHeader title="Categoria" value={buscaCategoriaTabela} onChange={setBuscaCategoriaTabela} onSort={() => setOrdemCategoriaTabela(alternarOrdenacao(ordemCategoriaTabela, "categoria"))} direction={ordemCategoriaTabela.campo === "categoria" ? ordemCategoriaTabela.direcao : null} /></TableHead>
                      <TableHead className="text-right"><TableColumnHeader title="Fornecedor" onSort={() => setOrdemCategoriaTabela(alternarOrdenacao(ordemCategoriaTabela, "fornecedor"))} direction={ordemCategoriaTabela.campo === "fornecedor" ? ordemCategoriaTabela.direcao : null} /></TableHead>
                      <TableHead className="text-right"><TableColumnHeader title="Total da categoria" onSort={() => setOrdemCategoriaTabela(alternarOrdenacao(ordemCategoriaTabela, "categoriaTotal"))} direction={ordemCategoriaTabela.campo === "categoriaTotal" ? ordemCategoriaTabela.direcao : null} /></TableHead>
                      <TableHead className="text-right"><TableColumnHeader title="Share" onSort={() => setOrdemCategoriaTabela(alternarOrdenacao(ordemCategoriaTabela, "share"))} direction={ordemCategoriaTabela.campo === "share" ? ordemCategoriaTabela.direcao : null} /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriasTabela.map((linha) => (
                      <TableRow key={`${linha.categoria}-${linha.subgrupo}`}>
                        <TableCell className="min-w-[190px]">
                          <div className="font-medium">{linha.categoria}</div>
                          <div className="text-xs text-muted-foreground">{linha.subgrupo}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {brl(linha.fornecedorValor)}
                        </TableCell>
                        <TableCell className="text-right">{brl(linha.liderValor)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{percentual(linha.shareValor)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {categoriasShare.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          Sem categorias com venda no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-base">Resumo por marca</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead><TableColumnHeader title="Marca" value={buscaMarcaTabela} onChange={setBuscaMarcaTabela} onSort={() => setOrdemMarcaTabela(alternarOrdenacao(ordemMarcaTabela, "marca"))} direction={ordemMarcaTabela.campo === "marca" ? ordemMarcaTabela.direcao : null} /></TableHead>
                      <TableHead className="text-right"><TableColumnHeader title="Venda" onSort={() => setOrdemMarcaTabela(alternarOrdenacao(ordemMarcaTabela, "venda"))} direction={ordemMarcaTabela.campo === "venda" ? ordemMarcaTabela.direcao : null} /></TableHead>
                      <TableHead className="text-right"><TableColumnHeader title="Produtos" onSort={() => setOrdemMarcaTabela(alternarOrdenacao(ordemMarcaTabela, "produtos"))} direction={ordemMarcaTabela.campo === "produtos" ? ordemMarcaTabela.direcao : null} /></TableHead>
                      <TableHead className="text-right"><TableColumnHeader title="Part. portfólio" onSort={() => setOrdemMarcaTabela(alternarOrdenacao(ordemMarcaTabela, "share"))} direction={ordemMarcaTabela.campo === "share" ? ordemMarcaTabela.direcao : null} /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marcasTabela.map((linha) => (
                      <TableRow key={linha.marca}>
                        <TableCell className="min-w-[170px] font-medium">{linha.marca}</TableCell>
                        <TableCell className="text-right font-medium">
                          {brl(linha.fornecedorValor)}
                        </TableCell>
                        <TableCell className="text-right">{numero(linha.produtos)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{percentual(linha.sharePortfolio)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {marcasShareBase.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          Sem marcas com venda no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-panel">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Produtos por subgrupo</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{numero(subgruposFiltrados)} subgrupos</Badge>
                <Badge variant="outline">Maior part. {percentual(maiorParticipacao)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead><TableColumnHeader title="Cód. produto" value={buscaProdutoTabela} onChange={setBuscaProdutoTabela} onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "codigo"))} direction={ordemProdutoTabela.campo === "codigo" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead><TableColumnHeader title="Produto" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "produto"))} direction={ordemProdutoTabela.campo === "produto" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead><TableColumnHeader title="Departamento" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "departamento"))} direction={ordemProdutoTabela.campo === "departamento" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead><TableColumnHeader title="Seção" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "secao"))} direction={ordemProdutoTabela.campo === "secao" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead><TableColumnHeader title="Grupo" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "grupo"))} direction={ordemProdutoTabela.campo === "grupo" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead><TableColumnHeader title="Subgrupo" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "subgrupo"))} direction={ordemProdutoTabela.campo === "subgrupo" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead className="text-right"><TableColumnHeader title="Venda produto" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "venda"))} direction={ordemProdutoTabela.campo === "venda" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead className="text-right"><TableColumnHeader title="Venda subgrupo" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "vendaSubgrupo"))} direction={ordemProdutoTabela.campo === "vendaSubgrupo" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead><TableColumnHeader title="Representatividade" onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "representatividade"))} direction={ordemProdutoTabela.campo === "representatividade" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead className="text-right"><TableColumnHeader title="Acum." onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "acumulado"))} direction={ordemProdutoTabela.campo === "acumulado" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead className="text-center"><TableColumnHeader title="Pos." onSort={() => setOrdemProdutoTabela(alternarOrdenacao(ordemProdutoTabela, "posicao"))} direction={ordemProdutoTabela.campo === "posicao" ? ordemProdutoTabela.direcao : null} /></TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaTabela.map((linha) => {
                    const status = statusParticipacao(linha.representatividade, linha.posicao);

                    return (
                      <TableRow key={linha.produto.sku}>
                        <TableCell className="font-mono text-xs">{linha.codigo}</TableCell>
                        <TableCell className="min-w-[240px] font-medium">
                          {linha.produto.descricao}
                        </TableCell>
                        <TableCell className="min-w-[150px] text-xs">
                          {linha.departamento}
                        </TableCell>
                        <TableCell className="min-w-[160px] text-xs">{linha.secao}</TableCell>
                        <TableCell className="min-w-[170px] text-xs">{linha.grupo}</TableCell>
                        <TableCell className="min-w-[180px] text-xs">{linha.subgrupo}</TableCell>
                        <TableCell className="text-right font-medium">
                          {brl(linha.faturamento)}
                        </TableCell>
                        <TableCell className="text-right">{brl(linha.vendaSubgrupo)}</TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-1.5">
                            <div className="flex justify-between gap-2 text-xs">
                              <span>{percentual(linha.representatividade)}</span>
                              <span className="text-muted-foreground">
                                {numero(Math.round(linha.quantidade))} un.
                              </span>
                            </div>
                            <Progress value={linha.representatividade} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{percentual(linha.acumulado)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">#{linha.posicao}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 ${badgeParticipacao(status)}`}>
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {listaTabela.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={12}
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

function FiltroMercadologico({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  icone: typeof PackageSearch;
}) {
  return (
    <Card className="shadow-panel">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="font-display text-2xl font-bold">{valor}</p>
        </div>
        <Icone className="size-5 text-primary" />
      </CardContent>
    </Card>
  );
}
