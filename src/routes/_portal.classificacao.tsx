import { createFileRoute } from "@tanstack/react-router";
import { Boxes, ChevronDown, ChevronRight, Layers3, PackageSearch, Tags, TrendingUp } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { usePortal } from "@/context/portal-context";
import { classificarProduto } from "@/lib/classificacao-dinamica";

import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { brl, numero, percentual } from "@/lib/format";
import {
  cmvDaVenda,
  codigoProdutoComDigito,
  departamentoMercadologico,
  estoque,
  fillRatePedido,
  grupoMercadologico,
  pedidos,
  produtos,
  secaoMercadologica,
  statusEstoque,
  subgrupoMercadologico,
  vendas,
  formatarClasseComposta,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/classificacao")({
  head: () => ({
    meta: [
      { title: "Classificação Mercadológica | Portal do Fornecedor" },
      {
        name: "description",
        content: "Análise mercadológica por SKU com sell-out, margem, estoque e fill rate.",
      },
      { property: "og:title", content: "Classificação Mercadológica | Portal do Fornecedor" },
    ],
  }),
  component: ClassificacaoPage,
});

const chaveSubgrupo = (produto: (typeof produtos)[number]) =>
  [
    produto.departamentoCodigo,
    produto.secaoCodigo,
    produto.grupoCodigo,
    produto.subgrupoCodigo,
  ].join(".");

const opcoes = (valores: string[]) =>
  Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b));

function ClassificacaoPage() {
  const { dadosFornecedorVersao, classificacaoDados, setClassificacaoDados } = usePortal();
  const [departamento, setDepartamento] = useState("todos");
  const [secao, setSecao] = useState("todos");
  const [grupo, setGrupo] = useState("todos");
  const [subgrupo, setSubgrupo] = useState("todos");

  const analise = useMemo(() => {
    void dadosFornecedorVersao;
    const listProdutos = Array.from(produtos);
    const listVendas = Array.from(vendas);
    const listEstoque = Array.from(estoque);
    const listPedidos = Array.from(pedidos);

    const fim = listVendas.reduce((max, v) => (v.data > max ? v.data : max), "");
    let inicio: string | null = null;
    if (fim) {
      const d = new Date(`${fim}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 89);
      inicio = d.toISOString().slice(0, 10);
    }
    const vendas90 = inicio ? listVendas.filter((v) => v.data >= inicio) : listVendas;

    const vendasPorSku = new Map<string, typeof vendas90>();
    for (const v of vendas90) {
      const lista = vendasPorSku.get(v.sku) ?? [];
      lista.push(v);
      vendasPorSku.set(v.sku, lista);
    }
    const estoquePorSku = new Map<string, typeof listEstoque>();
    for (const e of listEstoque) {
      const lista = estoquePorSku.get(e.sku) ?? [];
      lista.push(e);
      estoquePorSku.set(e.sku, lista);
    }

    const diasClasse = 90;
    const faturamentoGeral90 = vendas90.reduce((acc, v) => acc + v.quantidade * v.valorUnitario, 0);

    const linhasBase = listProdutos.map((produto) => {
      const vendasSku = vendasPorSku.get(produto.sku) ?? [];
      const estoqueSku = estoquePorSku.get(produto.sku) ?? [];
      const pedidosSku = listPedidos.filter((pedido) =>
        pedido.itens.some((item) => item.sku === produto.sku),
      );
      const quantidade = vendasSku.reduce((acc, v) => acc + v.quantidade, 0);
      const faturamento = vendasSku.reduce((acc, v) => acc + v.quantidade * v.valorUnitario, 0);
      const cmv = vendasSku.reduce((acc, v) => acc + cmvDaVenda(v.quantidade, produto), 0);
      const estoqueAtual = estoqueSku.reduce((acc, e) => acc + e.estoqueAtual, 0);
      const lojasRuptura = estoqueSku.filter((e) => statusEstoque(e) === "Ruptura").length;
      const fillRate =
        pedidosSku.length > 0
          ? pedidosSku.reduce((acc, pedido) => acc + fillRatePedido(pedido), 0) / pedidosSku.length
          : 0;

      return {
        produto,
        quantidade,
        faturamento,
        vendaMedia90: faturamento / diasClasse,
        participacaoGeral: faturamentoGeral90 > 0 ? (faturamento / faturamentoGeral90) * 100 : 0,
        margem: faturamento > 0 ? ((faturamento - cmv) / faturamento) * 100 : 0,
        estoqueAtual,
        lojasRuptura,
        fillRate,
        classeComposta: formatarClasseComposta(produto.classeComposta),
        participacaoSubgrupo: 0,
        participacaoAcumuladaSubgrupo: 0,
      };
    });

    const porSubgrupo = new Map<string, typeof linhasBase>();
    for (const linha of linhasBase) {
      const key = chaveSubgrupo(linha.produto);
      porSubgrupo.set(key, [...(porSubgrupo.get(key) ?? []), linha]);
    }

    for (const linhasSubgrupo of porSubgrupo.values()) {
      const porValor = [...linhasSubgrupo].sort((a, b) => b.vendaMedia90 - a.vendaMedia90);
      const totalValor = porValor.reduce((acc, linha) => acc + linha.vendaMedia90, 0);
      let acumuladoValor = 0;
      for (const linha of porValor) {
        const participacao =
          totalValor > 0 ? (linha.vendaMedia90 / totalValor) * 100 : 0;
        acumuladoValor += participacao;
        linha.participacaoSubgrupo = participacao;
        linha.participacaoAcumuladaSubgrupo = acumuladoValor;
      }
    }

    return linhasBase;
  }, [dadosFornecedorVersao]);

  const departamentos = opcoes(produtos.map(departamentoMercadologico));
  const secoes = opcoes(
    produtos
      .filter((p) => departamento === "todos" || departamentoMercadologico(p) === departamento)
      .map(secaoMercadologica),
  );
  const grupos = opcoes(
    produtos
      .filter((p) => departamento === "todos" || departamentoMercadologico(p) === departamento)
      .filter((p) => secao === "todos" || secaoMercadologica(p) === secao)
      .map(grupoMercadologico),
  );
  const subgrupos = opcoes(
    produtos
      .filter((p) => departamento === "todos" || departamentoMercadologico(p) === departamento)
      .filter((p) => secao === "todos" || secaoMercadologica(p) === secao)
      .filter((p) => grupo === "todos" || grupoMercadologico(p) === grupo)
      .map(subgrupoMercadologico),
  );

  const lista = analise.filter((linha) => {
    const produto = linha.produto;
    if (departamento !== "todos" && departamentoMercadologico(produto) !== departamento)
      return false;
    if (secao !== "todos" && secaoMercadologica(produto) !== secao) return false;
    if (grupo !== "todos" && grupoMercadologico(produto) !== grupo) return false;
    if (subgrupo !== "todos" && subgrupoMercadologico(produto) !== subgrupo) return false;
    return true;
  });

  const arvore = useMemo(() => {
    type NoSub = { nome: string; linhas: typeof lista };
    type NoGrupo = { nome: string; subgrupos: Map<string, NoSub> };
    type NoSecao = { nome: string; grupos: Map<string, NoGrupo> };
    const deptos = new Map<string, { nome: string; secoes: Map<string, NoSecao> }>();

    for (const linha of lista) {
      const dNome = departamentoMercadologico(linha.produto);
      const sNome = secaoMercadologica(linha.produto);
      const gNome = grupoMercadologico(linha.produto);
      const sgNome = subgrupoMercadologico(linha.produto);
      const d = deptos.get(dNome) ?? { nome: dNome, secoes: new Map() };
      const s = d.secoes.get(sNome) ?? { nome: sNome, grupos: new Map() };
      const g = s.grupos.get(gNome) ?? { nome: gNome, subgrupos: new Map() };
      const sg = g.subgrupos.get(sgNome) ?? { nome: sgNome, linhas: [] };
      sg.linhas.push(linha);
      g.subgrupos.set(sgNome, sg);
      s.grupos.set(gNome, g);
      d.secoes.set(sNome, s);
      deptos.set(dNome, d);
    }

    const ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR");
    return Array.from(deptos.values())
      .sort((a, b) => ordenar(a.nome, b.nome))
      .map((d) => ({
        nome: d.nome,
        secoes: Array.from(d.secoes.values())
          .sort((a, b) => ordenar(a.nome, b.nome))
          .map((s) => ({
            nome: s.nome,
            grupos: Array.from(s.grupos.values())
              .sort((a, b) => ordenar(a.nome, b.nome))
              .map((g) => ({
                nome: g.nome,
                subgrupos: Array.from(g.subgrupos.values())
                  .sort((a, b) => ordenar(a.nome, b.nome))
                  .map((sg) => ({
                    nome: sg.nome,
                    linhas: [...sg.linhas].sort(
                      (a, b) =>
                        a.classeComposta.localeCompare(b.classeComposta) ||
                        b.vendaMedia90 - a.vendaMedia90,
                    ),
                  })),
              })),
          })),
      }));
  }, [lista]);

  const arvoreDinamica = useMemo(() => {
    if (classificacaoDados === "departamento") return [];
    
    const gruposMap = new Map<string, typeof lista>();
    for (const linha of lista) {
      const gNome = classificarProduto(linha.produto, classificacaoDados);
      const list = gruposMap.get(gNome) ?? [];
      list.push(linha);
      gruposMap.set(gNome, list);
    }
    
    const ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR");
    return Array.from(gruposMap.entries())
      .map(([nome, linhas]) => ({
        nome,
        linhas: [...linhas].sort(
          (a, b) =>
            a.classeComposta.localeCompare(b.classeComposta) ||
            b.vendaMedia90 - a.vendaMedia90,
        ),
      }))
      .sort((a, b) => ordenar(a.nome, b.nome));
  }, [lista, classificacaoDados]);

  const rotuloGrupo = useMemo(() => {
    switch (classificacaoDados) {
      case "segmento":
        return "Segmento";
      case "secao":
        return "Seção";
      case "grupo":
        return "Grupo";
      case "subgrupo":
        return "Subgrupo";
      case "comprador":
        return "Comprador";
      default:
        return "Classificação";
    }
  }, [classificacaoDados]);

  const totalDepartamentos = new Set(produtos.map(departamentoMercadologico)).size;
  const totalSubgrupos = new Set(produtos.map(subgrupoMercadologico)).size;
  const classesA = lista.filter((item) => item.classeComposta.startsWith("A")).length;
  const faturamentoTotal = lista.reduce((acc, item) => acc + item.faturamento, 0);

  const limparFiltros = () => {
    setDepartamento("todos");
    setSecao("todos");
    setGrupo("todos");
    setSubgrupo("todos");
  };

  return (
    <PortalLayout
      titulo="Classificação Mercadológica"
      descricao="Hierarquia comercial, papel do SKU e desempenho operacional"
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Resumo titulo="Departamentos" valor={numero(totalDepartamentos)} icone={Layers3} />
          <Resumo titulo="Subgrupos" valor={numero(totalSubgrupos)} icone={Tags} />
          <Resumo titulo="Classe A" valor={numero(classesA)} icone={Boxes} />
          <Resumo titulo="Sell-out analisado" valor={brl(faturamentoTotal)} icone={TrendingUp} />
        </div>

        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Agrupar tabela por</Label>
              <Select value={classificacaoDados} onValueChange={setClassificacaoDados}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="segmento">Segmento</SelectItem>
                  <SelectItem value="departamento">Departamento</SelectItem>
                  <SelectItem value="secao">Seção</SelectItem>
                  <SelectItem value="grupo">Grupo</SelectItem>
                  <SelectItem value="subgrupo">Subgrupo</SelectItem>
                  <SelectItem value="comprador">Comprador</SelectItem>
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
            <div className="flex items-end">
              <Button variant="outline" onClick={limparFiltros} className="w-full">
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="size-4 text-primary" /> Análise por produto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table
              containerClassName="max-h-[500px] rounded-lg border border-border"
              className="border-separate border-spacing-0"
            >
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-stone-100 [&_th]:shadow-sm">
                <TableRow className="bg-stone-100">
                    <TableHead>Cód. produto</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Venda média 90d</TableHead>
                    <TableHead className="text-right">Part. subgrupo</TableHead>
                    <TableHead className="text-right">Acum.</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Rupturas</TableHead>
                    <TableHead className="text-right">Fill rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classificacaoDados === "departamento" ? (
                    arvore.map((depto) => (
                      <NivelMercadologico
                        key={'d-' + depto.nome}
                        rotulo={'Departamento ' + depto.nome}
                        tom="bg-primary/10"
                      >
                        {depto.secoes.map((secaoNo) => (
                          <NivelMercadologico
                            key={'s-' + depto.nome + '-' + secaoNo.nome}
                            rotulo={'Seção ' + secaoNo.nome}
                            tom="bg-primary/5"
                          >
                            {secaoNo.grupos.map((grupoNo) => (
                              <NivelMercadologico
                                key={'g-' + depto.nome + '-' + secaoNo.nome + '-' + grupoNo.nome}
                                rotulo={'Grupo ' + grupoNo.nome}
                                tom="bg-muted/70"
                              >
                                {grupoNo.subgrupos.map((sub) => (
                                  <NivelMercadologico
                                    key={'sg-' + depto.nome + '-' + secaoNo.nome + '-' + grupoNo.nome + '-' + sub.nome}
                                    rotulo={'Subgrupo ' + sub.nome}
                                    extra={sub.linhas.length + ' SKUs'}
                                    tom="bg-muted/40"
                                  >
                                    {sub.linhas.map((linha) => (
                                      <ProdutoClassificacaoRow
                                        key={linha.produto.sku}
                                        linha={linha}
                                      />
                                    ))}
                                  </NivelMercadologico>
                                ))}
                              </NivelMercadologico>
                            ))}
                          </NivelMercadologico>
                        ))}
                      </NivelMercadologico>
                    ))
                  ) : (
                    arvoreDinamica.map((grupo) => (
                      <NivelMercadologico
                        key={'g-' + grupo.nome}
                        rotulo={rotuloGrupo + ': ' + grupo.nome}
                        extra={grupo.linhas.length + ' SKUs'}
                        tom="bg-primary/10"
                      >
                        {grupo.linhas.map((linha) => (
                          <ProdutoClassificacaoRow
                            key={linha.produto.sku}
                            linha={linha}
                          />
                        ))}
                      </NivelMercadologico>
                    ))
                  )}
                  {lista.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum produto encontrado para os filtros selecionados.
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

const COLS_CLASSIFICACAO = 11;

function NivelMercadologico({
  rotulo,
  extra,
  tom,
  children,
}: {
  rotulo: string;
  extra?: string;
  tom: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(true);
  return (
    <>
      <TableRow className={tom}>
        <TableCell colSpan={COLS_CLASSIFICACAO} className="px-3 py-1.5 font-medium">
          <button
            type="button"
            onClick={() => setAberto((atual) => !atual)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={aberto}
          >
            {aberto ? (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span>{rotulo}</span>
            {extra ? <span className="text-[10px] font-normal text-muted-foreground">({extra})</span> : null}
          </button>
        </TableCell>
      </TableRow>
      {aberto ? children : null}
    </>
  );
}

function ProdutoClassificacaoRow({
  linha,
}: {
  linha: {
    produto: (typeof produtos)[number];
    vendaMedia90: number;
    participacaoSubgrupo: number;
    participacaoAcumuladaSubgrupo: number;
    margem: number;
    estoqueAtual: number;
    lojasRuptura: number;
    fillRate: number;
    classeComposta: string;
  };
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{codigoProdutoComDigito(linha.produto.sku)}</TableCell>
      <TableCell className="min-w-[220px] font-medium">{linha.produto.descricao}</TableCell>
      <TableCell>
        <Badge className="border-0 bg-primary/10 text-primary">{linha.produto.papelMercadologico}</Badge>
      </TableCell>
      <TableCell>
        {linha.classeComposta === "Aa" ? (
          <span className="inline-flex items-center justify-center gap-1 rounded border border-amber-500/40 bg-amber-950 px-2 py-1 text-[10px] font-extrabold text-amber-300 shadow-sm animate-pulse">
            ⭐ Aa <span className="text-[8px] uppercase tracking-wider text-amber-200">Top Star</span>
          </span>
        ) : (
          <Badge variant="outline" className="font-mono">
            {linha.classeComposta}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right font-medium">{brl(linha.vendaMedia90)}</TableCell>
      <TableCell className="text-right">{percentual(linha.participacaoSubgrupo)}</TableCell>
      <TableCell className="text-right">{percentual(linha.participacaoAcumuladaSubgrupo)}</TableCell>
      <TableCell className="text-right">{percentual(linha.margem)}</TableCell>
      <TableCell className="text-right">{numero(linha.estoqueAtual)}</TableCell>
      <TableCell className="text-right">{numero(linha.lojasRuptura)}</TableCell>
      <TableCell className="text-right">{percentual(linha.fillRate)}</TableCell>
    </TableRow>
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
        <SelectContent className="max-h-60">
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
  icone: typeof Layers3;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-panel">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icone className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="truncate font-display text-xl font-bold">{valor}</p>
      </div>
    </div>
  );
}
