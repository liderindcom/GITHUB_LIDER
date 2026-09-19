import { createFileRoute } from "@tanstack/react-router";
import { PackageCheck, Settings2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TableColumnHeader } from "@/components/table-column-header";

import { usePortal } from "@/context/portal-context";
import { PortalLayout } from "@/components/portal-layout";
import { EstoqueMixTabs } from "@/components/estoque-mix-tabs";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { numero, brl, dataBR } from "@/lib/format";
import { calcularSugestoesCompraCdam } from "@/lib/sugestao-compra";
import {
  codigoProdutoComDigito,
  marcaProduto,
  descricaoComercial,
  estoque,
  lojas,
  mapaVendaMediaMensal,
  mesmoCodigoLoja,
  produtos,
  vendas,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/estoque")({
  head: () => ({
    meta: [
      { title: "Visão de Estoque | Portal do Fornecedor" },
      {
        name: "description",
        content: "Acompanhe o estoque real x estoque ideal baseado na classificação ABC do Líder.",
      },
    ],
  }),
  component: EstoquePage,
});

type SituacaoEstoque = "Falta" | "Excesso" | "Equilibrado";
type OrdenacaoEstoque =
  | "sku"
  | "ean"
  | "referencia"
  | "marca"
  | "descricao"
  | "saida"
  | "subgrupo"
  | "classe"
  | "vendaDiaria"
  | "vendaMensal"
  | "pedidoAberto"
  | "pendencia"
  | "coberturaCdam"
  | "estoqueCdam"
  | "estoqueAtual"
  | "qtdLojas"
  | "estoqueIdeal"
  | "diferenca"
  | "situacao";

const filtros: Array<SituacaoEstoque | "Todos"> = ["Todos", "Falta", "Excesso", "Equilibrado"];

const LINHAS_POR_PAGINA = 120;

function chaveClasseCard(classe: string, topStar = false): "TOP STAR" | "A" | "B" | "C" | "D" {
  if (topStar || classe === "Aa") return "TOP STAR";
  const letra =
    String(classe || "D")
      .toUpperCase()
      .trim()[0] || "D";
  if (letra === "A" || letra === "B" || letra === "C") return letra;
  return "D";
}

function EstoquePage() {
  const { fornecedor, dadosFornecedorVersao } = usePortal();
  const [filtro, setFiltro] = useState<SituacaoEstoque | "Todos">("Todos");
  const [loja, setLoja] = useState("todas");
  const [viewMode, setViewMode] = useState<"qtd" | "vlr">("qtd");
  const [classeCard, setClasseCard] = useState<"TOP STAR" | "A" | "B" | "C" | "D" | null>(null);
  const [pagina, setPagina] = useState(1);
  const [buscas, setBuscas] = useState<Record<string, string>>({});
  const [ordenacao, setOrdenacao] = useState<{ campo: OrdenacaoEstoque; direcao: "asc" | "desc" }>({
    campo: "classe",
    direcao: "asc",
  });
  const colunasDimensionamento: Array<[OrdenacaoEstoque, string]> = [
    ["sku", "SKU"],
    ["ean", "EAN"],
    ["referencia", "Referência"],
    ["marca", "Marca"],
    ["descricao", "Descrição"],
    ["saida", "Saiu de linha"],
    ["subgrupo", "Subgrupo"],
    ["vendaDiaria", "Venda média diária"],
    ["vendaMensal", "Venda média mensal"],
    ["classe", "Classe"],
    ["pedidoAberto", "Pedido aberto"],
    ["pendencia", "Pendência"],
    ["coberturaCdam", "Cobertura CDAM"],
    ["estoqueCdam", "Estoque CDAM"],
    ["estoqueAtual", "Estoque Real"],
    ["qtdLojas", "Estoque nas lojas"],
    ["estoqueIdeal", "Estoque Ideal"],
    ["diferenca", "Diferença"],
    ["situacao", "Situação"],
  ];
  const colunasPadrao = colunasDimensionamento.map(([campo]) => campo);
  const [colunasVisiveis, setColunasVisiveis] = useState<OrdenacaoEstoque[]>(colunasPadrao);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const chave = "portal-estoque-colunas-" + fornecedor.codigo;
    const salvo = window.localStorage.getItem(chave);
    if (salvo) {
      try {
        const valores = JSON.parse(salvo) as OrdenacaoEstoque[];
        setColunasVisiveis(valores.filter((valor) => colunasPadrao.includes(valor)));
        return;
      } catch {
        window.localStorage.removeItem(chave);
      }
    }
    setColunasVisiveis(colunasPadrao);
  }, [fornecedor.codigo]);

  const alternarColuna = (campo: OrdenacaoEstoque) => {
    setColunasVisiveis((atual) => {
      const novasColunas = atual.includes(campo)
        ? atual.length > 1
          ? atual.filter((item) => item !== campo)
          : atual
        : colunasPadrao.filter((item) => atual.includes(item) || item === campo);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "portal-estoque-colunas-" + fornecedor.codigo,
          JSON.stringify(novasColunas),
        );
      }
      return novasColunas;
    });
  };

  const aplicarPresetColunas = (preset: "completo" | "resumido" | "abastecimento") => {
    const presets: Record<typeof preset, OrdenacaoEstoque[]> = {
      completo: colunasPadrao,
      resumido: ["sku", "descricao", "vendaMensal", "estoqueAtual", "situacao"],
      abastecimento: [
        "sku",
        "descricao",
        "classe",
        "vendaMensal",
        "estoqueAtual",
        "estoqueIdeal",
        "diferenca",
      ],
    };
    const novasColunas = presets[preset];
    setColunasVisiveis(novasColunas);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "portal-estoque-colunas-" + fornecedor.codigo,
        JSON.stringify(novasColunas),
      );
    }
  };

  const colunaVisivel = (campo: OrdenacaoEstoque) =>
    colunasVisiveis.includes(campo) ? "" : "hidden";

  // Helper for meta calculation based on Systematic, Class, and CDAM/Store type (Lider Official spreadsheet)
  const getMetasCobertura = (sistematica: string, classe: string, isCdam: boolean): number => {
    const s = String(sistematica || "ESTOCADO")
      .toUpperCase()
      .trim();
    const cl = String(classe || "Dd").trim() || "Dd";
    const isTopStar = cl === "Aa";
    const clV = (cl[0] || "D").toUpperCase();

    if (s === "ESTOCADO") {
      if (isCdam) {
        if (isTopStar) return 90; // Best Seller / Top Star
        if (clV === "A") return 80;
        if (clV === "B") return 60;
        if (clV === "C") return 55;
        return 60;
      } else {
        if (isTopStar) return 30; // Best Seller / Top Star
        if (clV === "A") return 30;
        if (clV === "B") return 25;
        if (clV === "C") return 45;
        return 60;
      }
    } else if (s === "10") {
      // Systematic "10" Custom Rule
      if (clV === "A") return 30;
      if (clV === "B") return 25;
      if (clV === "C") return 20;
      return 20; // Class D or others
    } else if (s === "D. LOJA" || s === "DIRETO-LOJA") {
      if (clV === "A") return 40;
      if (clV === "B") return 30;
      if (clV === "C") return 45;
      return 60;
    } else if (s === "DIRET" || s === "DIRETISSIMO") {
      if (clV === "A") return 30;
      if (clV === "B") return 30;
      if (clV === "C") return 45;
      return 60;
    }
    return 30; // fallback
  };

  const sugestoesPorSku = useMemo(
    () => new Map(calcularSugestoesCompraCdam("30").map((item) => [item.produto.sku, item])),
    [dadosFornecedorVersao],
  );

  const listaCompleta = useMemo(() => {
    const produtoPorSkuMap = new Map(produtos.map((p) => [p.sku, p]));
    const lojaPorId = new Map(lojas.map((l) => [l.id, l]));
    const lojaPorLocal = new Map(lojas.map((l) => [l.idLocal, l]));
    const salesMap = mapaVendaMediaMensal();
    const stockMap = new Map<string, number>();
    for (const e of estoque) {
      stockMap.set(e.sku + "_" + e.lojaId, Number(e.estoqueAtual) || 0);
    }

    const arr: Array<{
      sku: string;
      lojaId: string;
      lojaNome: string;
      descricao: string;
      estoqueAtual: number;
      qtdLojas: number;
      ean: string;
      referencia: string;
      marca: string;
      saiu: string;
      subgrupo: string;
      vendaDiaria: number;
      vendaMensal: number;
      pedidoAberto: number;
      pendencia: boolean;
      coberturaCdam: number | null;
      estoqueCdam: number;
      estoqueIdeal: number;
      diferenca: number;
      situacao: SituacaoEstoque;
      classe: string;
      topStar: boolean;
      preco: number;
    }> = [];
    const visto = new Set<string>();

    const incluir = (
      sku: string,
      lojaItem: (typeof lojas)[number],
      vendaMensal: number,
      estoqueAtual: number,
    ) => {
      if (vendaMensal === 0 && estoqueAtual === 0) return;
      const chave = sku + "_" + lojaItem.idLocal;
      if (visto.has(chave)) return;
      visto.add(chave);
      const produto = produtoPorSkuMap.get(sku);
      const sugestao = sugestoesPorSku.get(sku);
      const pedidoAberto = sugestao?.pedidoAberto || 0;
      const coberturaCdam = sugestao?.coberturaAtual ?? null;
      const leadTime = sugestao?.leadTimeEntregaDias || 0;
      const estoqueCdam = sugestao?.estoqueCdam || 0;
      const pendencia =
        (estoqueCdam === 0 && pedidoAberto > 0) ||
        (coberturaCdam !== null && coberturaCdam < leadTime - 3);
      const cls = produto?.classeComposta || "Dd";
      const topStar = (produto?.classeTopStar || cls) === "Aa";
      const diasCobertura = getMetasCobertura(
        produto?.sistematica || "ESTOCADO",
        topStar ? "Aa" : cls,
        lojaItem.tipo === "D",
      );
      const estoqueIdeal = Math.round((vendaMensal / 30) * diasCobertura);
      const diferenca = estoqueAtual - estoqueIdeal;
      arr.push({
        sku,
        lojaId: lojaItem.idLocal,
        lojaNome: lojaItem.nome,
        descricao: produto?.descricao || sku,
        ean: produto?.ean || "",
        referencia: produto?.referencia || "",
        marca: produto ? marcaProduto(produto) : "",
        saiu:
          produto?.emLinha === 0
            ? produto.datSaiLin
              ? dataBR(produto.datSaiLin)
              : "Fora"
            : "Em linha",
        subgrupo: produto?.subgrupo || "",
        estoqueAtual,
        qtdLojas: estoqueAtual,
        vendaDiaria: sugestao?.vendaMediaDiaria || vendaMensal / 30,
        vendaMensal,
        pedidoAberto,
        pendencia,
        coberturaCdam,
        estoqueCdam,
        estoqueIdeal,
        diferenca,
        situacao: diferenca < 0 ? "Falta" : diferenca > 0 ? "Excesso" : "Equilibrado",
        classe: cls,
        topStar,
        preco: produto?.precoTabela || 1.0,
      });
    };

    for (const e of estoque) {
      const lojaItem = lojaPorLocal.get(e.lojaId) || lojaPorId.get(e.lojaId);
      if (!lojaItem) continue;
      const vendaMensal = salesMap.get(e.sku + "_" + lojaItem.id) || 0;
      incluir(e.sku, lojaItem, vendaMensal, Number(e.estoqueAtual) || 0);
    }

    for (const [chave, vendaMensal] of salesMap) {
      if (!vendaMensal) continue;
      const sep = chave.lastIndexOf("_");
      if (sep <= 0) continue;
      const sku = chave.slice(0, sep);
      const filial = chave.slice(sep + 1);
      const lojaItem = lojaPorId.get(filial);
      if (!lojaItem) continue;
      const estoqueAtual = stockMap.get(sku + "_" + lojaItem.idLocal) || 0;
      incluir(sku, lojaItem, vendaMensal, estoqueAtual);
    }

    return arr;
  }, [produtos, lojas, estoque, vendas, sugestoesPorSku, dadosFornecedorVersao]);

  const listaVisivel = useMemo(() => {
    if (loja !== "todas") return listaCompleta;

    const agrupado = new Map<string, (typeof listaCompleta)[number]>();
    for (const item of listaCompleta) {
      const atual = agrupado.get(item.sku);
      if (!atual) {
        agrupado.set(item.sku, {
          ...item,
          lojaId: "todas",
          lojaNome: "Todas as lojas",
        });
        continue;
      }

      atual.estoqueAtual += item.estoqueAtual;
      atual.qtdLojas += item.estoqueAtual;
      atual.vendaMensal += item.vendaMensal;
      atual.vendaDiaria = atual.vendaMensal / 30;
      atual.estoqueIdeal += item.estoqueIdeal;
      atual.diferenca = atual.estoqueAtual - atual.estoqueIdeal;
      atual.situacao =
        atual.diferenca < 0 ? "Falta" : atual.diferenca > 0 ? "Excesso" : "Equilibrado";
    }

    return Array.from(agrupado.values());
  }, [listaCompleta, loja]);

  // Aggregate stats of actual vs ideal stock per ABC class + Top Star (Aa)
  const resumoPorClasse = useMemo(() => {
    const keys = ["TOP STAR", "A", "B", "C", "D"] as const;
    const map = new Map();
    for (const k of keys) {
      map.set(k, { realQtd: 0, idealQtd: 0, realVlr: 0, idealVlr: 0 });
    }

    for (const item of listaVisivel) {
      const key = chaveClasseCard(item.classe, item.topStar);

      const current = map.get(key) || { realQtd: 0, idealQtd: 0, realVlr: 0, idealVlr: 0 };
      current.realQtd += Number(item.estoqueAtual) || 0;
      current.idealQtd += Number(item.estoqueIdeal) || 0;
      current.realVlr += (Number(item.estoqueAtual) || 0) * (Number(item.preco) || 0);
      current.idealVlr += (Number(item.estoqueIdeal) || 0) * (Number(item.preco) || 0);
      map.set(key, current);
    }

    return keys.map((key) => {
      const vals = map.get(key) || { realQtd: 0, idealQtd: 0, realVlr: 0, idealVlr: 0 };
      const real = viewMode === "vlr" ? vals.realVlr : vals.realQtd;
      const ideal = viewMode === "vlr" ? vals.idealVlr : vals.idealQtd;
      const diffQty = real - ideal;
      const diffPct = ideal > 0 ? (diffQty / ideal) * 100 : real > 0 ? 100 : 0;
      return {
        key,
        real,
        ideal,
        diffPct,
        semMeta: ideal <= 0 && real > 0,
      };
    });
  }, [listaVisivel, viewMode]);

  const listaFiltrada = useMemo(() => {
    return listaVisivel
      .filter((item) => {
        if (classeCard && chaveClasseCard(item.classe, item.topStar) !== classeCard) return false;
        if (loja !== "todas" && !mesmoCodigoLoja(item.lojaId, loja)) return false;
        if (filtro !== "Todos" && item.situacao !== filtro) return false;
        const campos: Record<string, string> = {
          sku: codigoProdutoComDigito(item.sku),
          ean: item.ean,
          referencia: item.referencia,
          marca: item.marca,
          descricao: item.descricao,
          saida: item.saiu,
          subgrupo: item.subgrupo,
          vendaDiaria: String(item.vendaDiaria),
          vendaMensal: String(item.vendaMensal),
          pedidoAberto: String(item.pedidoAberto),
          pendencia: item.pendencia ? "sim" : "não",
          coberturaCdam: String(item.coberturaCdam ?? ""),
          estoqueCdam: String(item.estoqueCdam),
          classe: item.classe === "Aa" ? "TOP STAR Aa" : item.classe,
          estoqueAtual: String(item.estoqueAtual),
          estoqueIdeal: String(item.estoqueIdeal),
          diferenca: String(item.diferenca),
          situacao: item.situacao,
        };
        return Object.entries(buscas).every(
          ([campo, termo]) =>
            !termo || (campos[campo] ?? "").toLowerCase().includes(termo.toLowerCase()),
        );
      })
      .sort((a, b) => {
        const valor = (item: (typeof listaVisivel)[number]): string | number => {
          if (ordenacao.campo === "saida") return item.saiu;
          return item[ordenacao.campo as keyof typeof item] as string | number;
        };
        const av = valor(a);
        const bv = valor(b);
        const comparacao =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
        return ordenacao.direcao === "asc" ? comparacao : -comparacao;
      });
  }, [listaVisivel, loja, filtro, classeCard, buscas, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / LINHAS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const listaPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * LINHAS_POR_PAGINA;
    return listaFiltrada.slice(inicio, inicio + LINHAS_POR_PAGINA);
  }, [listaFiltrada, paginaAtual]);

  const contagem = useMemo(() => {
    let falta = 0;
    let excesso = 0;
    let equilibrado = 0;
    for (const item of listaVisivel) {
      if (item.situacao === "Falta") falta += 1;
      else if (item.situacao === "Excesso") excesso += 1;
      else equilibrado += 1;
    }
    return { falta, excesso, equilibrado, total: listaVisivel.length };
  }, [listaVisivel]);

  useEffect(() => {
    setPagina(1);
  }, [loja, filtro, classeCard, buscas, ordenacao]);

  const alterarOrdenacao = (campo: OrdenacaoEstoque) =>
    setOrdenacao((atual) => ({
      campo,
      direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc",
    }));
  const buscaColuna = (campo: string) => (valor: string) =>
    setBuscas((atual) => ({ ...atual, [campo]: valor }));

  return (
    <PortalLayout
      titulo="Visão de Estoque"
      descricao="Acompanhe estoque, vendas e cobertura dos itens do fornecedor"
    >
      <EstoqueMixTabs />
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Resumo
            titulo="Falta de Estoque"
            valor={contagem.falta}
            tom="danger"
            ativo={filtro === "Falta"}
            onClick={() => {
              setClasseCard(null);
              setFiltro((atual) => (atual === "Falta" ? "Todos" : "Falta"));
            }}
          />
          <Resumo
            titulo="Com Excesso"
            valor={contagem.excesso}
            tom="primary"
            ativo={filtro === "Excesso"}
            onClick={() => {
              setClasseCard(null);
              setFiltro((atual) => (atual === "Excesso" ? "Todos" : "Excesso"));
            }}
          />
          <Resumo
            titulo="Equilibrados"
            valor={contagem.equilibrado}
            tom="success"
            ativo={filtro === "Equilibrado"}
            onClick={() => {
              setClasseCard(null);
              setFiltro((atual) => (atual === "Equilibrado" ? "Todos" : "Equilibrado"));
            }}
          />
          <Resumo
            titulo="Total de Posições"
            valor={contagem.total}
            tom="warning"
            ativo={filtro === "Todos"}
            onClick={() => {
              setClasseCard(null);
              setFiltro("Todos");
            }}
          />
        </div>

        {/* Qualidade do Estoque por Classe */}
        <Card className="shadow-panel bg-card/40 border-border/70">
          <CardHeader className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> Qualidade e Desvio de Estoque por
                  Classe ABC
                </CardTitle>
                <CardDescription className="text-2xs">
                  Análise agregada da saúde do inventário. Desvios negativos indicam risco de
                  ruptura; desvios positivos indicam sobre-abastecimento de capital.
                </CardDescription>
              </div>

              {/* Toggle Switch with High Contrast */}
              <div className="flex items-center gap-1 rounded-lg border border-primary/20 bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("qtd")}
                  className={`rounded-md px-3 py-1 text-2xs font-bold transition-all ${
                    viewMode === "qtd"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:text-foreground hover:bg-background/60"
                  }`}
                >
                  Quantidade
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("vlr")}
                  className={`rounded-md px-3 py-1 text-2xs font-bold transition-all ${
                    viewMode === "vlr"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:text-foreground hover:bg-background/60"
                  }`}
                >
                  Valores (R$)
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 pt-0">
            {resumoPorClasse.map((item) => {
              const diffVal = item.diffPct;
              let color = "text-success";
              let label = "Equilibrado";
              let sign = "";

              if (item.semMeta) {
                color = "text-primary";
                label = "Sem meta";
              } else if (diffVal < -5) {
                color = "text-danger";
                label = "Sub-abastecido";
              } else if (diffVal > 5) {
                color = "text-primary";
                label = "Super-abastecido";
                sign = "+";
              }

              const isTop = item.key === "TOP STAR";
              const selecionado = classeCard === item.key;
              const cardBg = isTop
                ? "bg-amber-950/20 border-amber-500/30"
                : "bg-background/35 border-border/50";
              const titleColor = isTop ? "text-amber-500 font-extrabold" : "text-muted-foreground";
              const fmt = (n: number) =>
                viewMode === "vlr" ? brl(n) : `${numero(Math.round(n))} un`;

              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => setClasseCard((atual) => (atual === item.key ? null : item.key))}
                  className={`w-full rounded-xl border p-3.5 space-y-1 text-left transition-shadow ${cardBg} ${
                    selecionado
                      ? "ring-2 ring-primary shadow-md"
                      : "hover:border-primary/40 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono ${titleColor}`}>
                      {isTop ? "⭐ TOP STAR" : `CLASSE ${item.key}`}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted border border-border/50 ${color}`}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-muted-foreground">Estoque Real</span>
                    <span className="font-mono text-sm font-semibold">{fmt(item.real)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Estoque Ideal</span>
                    <span className="font-mono text-sm font-semibold text-muted-foreground/80">
                      {fmt(item.ideal)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-dashed border-border/50 pt-1.5 mt-1.5">
                    <span className="text-xs font-semibold">Desvio Geral</span>
                    <span className={`font-mono text-sm font-extrabold ${color}`}>
                      {item.semMeta ? "—" : `${sign}${diffVal.toFixed(1).replace(".", ",")}%`}
                    </span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="size-4 text-primary" /> Dimensionamento de Estoque por
                  Loja
                </CardTitle>
                <CardDescription>
                  {classeCard
                    ? `Exibindo somente ${classeCard === "TOP STAR" ? "Top Star (Aa)" : `classe ${classeCard}`}. Clique de novo no card para voltar à lista completa.`
                    : "Comparativo de estoques reais contra as metas de cobertura do Líder (Estocado - Classe A: 30 dias, B: 25 dias, C: 45 dias, D: 60 dias | Sistemática 10 - A/B/C/D: 30/25/20/20 dias). Clique em um card de classe para filtrar."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold hover:bg-muted"
                    >
                      <Settings2 className="size-3.5" />
                      Colunas ({colunasVisiveis.length})
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold">Personalizar visão</p>
                        <p className="text-[11px] text-muted-foreground">
                          Escolha as colunas exibidas para este fornecedor.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px] hover:bg-muted"
                          onClick={() => aplicarPresetColunas("completo")}
                        >
                          Completo
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px] hover:bg-muted"
                          onClick={() => aplicarPresetColunas("resumido")}
                        >
                          Resumido
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px] hover:bg-muted"
                          onClick={() => aplicarPresetColunas("abastecimento")}
                        >
                          Abastecimento
                        </button>
                      </div>
                      <div className="grid gap-2">
                        {colunasDimensionamento.map(([campo, titulo]) => (
                          <label
                            key={campo}
                            className="flex cursor-pointer items-center gap-2 text-xs"
                          >
                            <Checkbox
                              checked={colunasVisiveis.includes(campo)}
                              onCheckedChange={() => alternarColuna(campo)}
                            />
                            {titulo}
                          </label>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold">Situação</Label>
                  <Select
                    value={filtro}
                    onValueChange={(v) => {
                      if (filtros.includes(v as (typeof filtros)[number])) {
                        setFiltro(v as SituacaoEstoque | "Todos");
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filtros.map((f) => (
                        <SelectItem key={f} value={f} className="text-xs">
                          {f === "Todos"
                            ? "Todas as Situações"
                            : f === "Falta"
                              ? "Falta"
                              : f === "Excesso"
                                ? "Excesso"
                                : "Equilibrado"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold">Filial</Label>
                  <Select value={loja} onValueChange={setLoja}>
                    <SelectTrigger className="h-8 w-44 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas" className="text-xs">
                        Todas as lojas
                      </SelectItem>
                      {lojas.map((l) => (
                        <SelectItem key={l.id} value={l.id} className="text-xs">
                          {l.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {colunasDimensionamento.map(([campo, titulo]) => (
                    <TableHead
                      key={campo}
                      className={
                        "min-w-[110px] whitespace-normal leading-tight " + colunaVisivel(campo)
                      }
                    >
                      <TableColumnHeader
                        title={titulo}
                        value={buscas[campo] ?? ""}
                        onChange={buscaColuna(campo)}
                        onSort={() => alterarOrdenacao(campo)}
                        direction={ordenacao.campo === campo ? ordenacao.direcao : null}
                        placeholder={titulo}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaPagina.map((item) => {
                  let badgeClass = "bg-success text-success-foreground";
                  let label = "Equilibrado";
                  let diffText = "-";
                  let diffColor = "text-muted-foreground";

                  const realVal =
                    viewMode === "vlr" ? item.estoqueAtual * item.preco : item.estoqueAtual;
                  const idealVal =
                    viewMode === "vlr" ? item.estoqueIdeal * item.preco : item.estoqueIdeal;
                  const diffAmt = realVal - idealVal;

                  if (item.diferenca < 0) {
                    badgeClass = "bg-danger text-danger-foreground animate-pulse";
                    label = "Falta";
                    diffText =
                      viewMode === "vlr"
                        ? `Falta ${brl(Math.abs(diffAmt))}`
                        : `Falta ${numero(Math.abs(item.diferenca))} un`;
                    diffColor = "text-danger font-semibold";
                  } else if (item.diferenca > 0) {
                    badgeClass = "bg-primary text-primary-foreground";
                    label = "Excesso";
                    diffText =
                      viewMode === "vlr"
                        ? `Sobra ${brl(diffAmt)}`
                        : `Sobra ${numero(item.diferenca)} un`;
                    diffColor = "text-primary";
                  }

                  return (
                    <TableRow
                      key={`${item.sku}-${item.lojaId}`}
                      className={
                        item.situacao === "Falta"
                          ? "bg-danger-soft/40"
                          : item.situacao === "Excesso"
                            ? "bg-primary/5"
                            : ""
                      }
                    >
                      <TableCell className={"font-mono text-xs " + colunaVisivel("sku")}>
                        {codigoProdutoComDigito(item.sku)}
                      </TableCell>
                      <TableCell className={"font-mono text-[11px] " + colunaVisivel("ean")}>
                        {item.ean || "—"}
                      </TableCell>
                      <TableCell className={"font-mono text-[11px] " + colunaVisivel("referencia")}>
                        {item.referencia || "—"}
                      </TableCell>
                      <TableCell className={"text-xs " + colunaVisivel("marca")}>
                        {item.marca || "—"}
                      </TableCell>
                      <TableCell
                        className={
                          "max-w-[220px] truncate font-medium " + colunaVisivel("descricao")
                        }
                      >
                        {item.descricao}
                      </TableCell>
                      <TableCell className={"text-xs " + colunaVisivel("saida")}>
                        {item.saiu}
                      </TableCell>
                      <TableCell
                        className={
                          "max-w-[150px] truncate text-xs text-muted-foreground " +
                          colunaVisivel("subgrupo")
                        }
                      >
                        {item.subgrupo || "—"}
                      </TableCell>
                      <TableCell
                        className={"text-right font-mono text-xs " + colunaVisivel("vendaDiaria")}
                      >
                        {numero(Math.round(item.vendaDiaria * 100) / 100)} un
                      </TableCell>
                      <TableCell
                        className={"text-right font-mono text-xs " + colunaVisivel("vendaMensal")}
                      >
                        {viewMode === "vlr"
                          ? brl(item.vendaMensal * item.preco)
                          : numero(Math.round(item.vendaMensal)) + " un"}
                      </TableCell>
                      <TableCell className={"text-center " + colunaVisivel("classe")}>
                        {item.classe === "Aa" ? (
                          <span className="inline-flex items-center justify-center gap-1 rounded bg-amber-950 border border-amber-500/40 px-2 py-1 text-2xs font-extrabold text-amber-300">
                            ⭐ Aa{" "}
                            <span className="text-[8px] uppercase tracking-wider text-amber-200">
                              Top Star
                            </span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-semibold">{item.classe}</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={"text-right font-mono text-xs " + colunaVisivel("pedidoAberto")}
                      >
                        {item.pedidoAberto > 0 ? numero(item.pedidoAberto) : "-"}
                      </TableCell>
                      <TableCell className={"text-center " + colunaVisivel("pendencia")}>
                        <span
                          className={
                            item.pendencia ? "text-warning font-semibold" : "text-muted-foreground"
                          }
                        >
                          {item.pendencia ? "Sim" : "Não"}
                        </span>
                      </TableCell>
                      <TableCell
                        className={"text-right font-mono text-xs " + colunaVisivel("coberturaCdam")}
                      >
                        {item.coberturaCdam !== null
                          ? numero(Math.round(item.coberturaCdam)) + "d"
                          : "Sem venda"}
                      </TableCell>
                      <TableCell
                        className={"text-right font-mono text-xs " + colunaVisivel("estoqueCdam")}
                      >
                        {numero(item.estoqueCdam)}
                      </TableCell>
                      <TableCell
                        className={"text-right font-mono text-xs " + colunaVisivel("estoqueAtual")}
                      >
                        {viewMode === "vlr"
                          ? brl(item.estoqueAtual * item.preco)
                          : `${numero(item.estoqueAtual)} un`}
                      </TableCell>
                      <TableCell
                        className={"text-center font-mono text-xs " + colunaVisivel("qtdLojas")}
                      >
                        {numero(item.qtdLojas)}
                      </TableCell>
                      <TableCell
                        className={
                          "text-right font-mono text-xs font-semibold text-muted-foreground " +
                          colunaVisivel("estoqueIdeal")
                        }
                      >
                        {viewMode === "vlr"
                          ? brl(item.estoqueIdeal * item.preco)
                          : `${numero(item.estoqueIdeal)} un`}
                      </TableCell>
                      <TableCell
                        className={
                          "text-right font-mono text-xs " +
                          diffColor +
                          " " +
                          colunaVisivel("diferenca")
                        }
                      >
                        {diffText}
                      </TableCell>
                      <TableCell className={colunaVisivel("situacao")}>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeClass}`}
                        >
                          {label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {listaPagina.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={colunasVisiveis.length}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma posição ativa encontrada com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {listaFiltrada.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Exibindo {(paginaAtual - 1) * LINHAS_POR_PAGINA + 1}–
                  {Math.min(paginaAtual * LINHAS_POR_PAGINA, listaFiltrada.length)} de{" "}
                  {numero(listaFiltrada.length)} posições
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span>
                    Página {paginaAtual} / {totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}

            {/* Visual High-Signal Diagnostic Panel */}
            <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-4 pt-4 border-t border-border">
              <span>Sincronizado reativamente com o ERP RMS (Líder)</span>
              <span>
                Catálogo: {produtos.length} SKUs | Estoques: {estoque.length} registros | Vendas:{" "}
                {vendas.length} registros | Versão: {dadosFornecedorVersao}
              </span>
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
  ativo = false,
  onClick,
}: {
  titulo: string;
  valor: number;
  tom: "danger" | "warning" | "success" | "primary";
  ativo?: boolean;
  onClick: () => void;
}) {
  const tons = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    success: "border-success/30 bg-success-soft text-success",
    primary: "border-primary/30 bg-primary/10 text-primary",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={[
        "w-full rounded-xl border p-4 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        tons[tom],
        ativo ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      ].join(" ")}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold">{numero(valor)}</p>
      <p className="mt-1 text-[10px] font-medium opacity-70">Clique para filtrar</p>
    </button>
  );
}
