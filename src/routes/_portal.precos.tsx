import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Minus, Search, TrendingDown, TrendingUp, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";

import { fetchFaixasPrecoSubgrupo, submitPropostaPreco, type FaixaPrecoSubgrupoDB } from "@/api";
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
import { brl, dataBR, numero } from "@/lib/format";
import {
  codigoProdutoComDigito,
  grupoMercadologico,
  produtos,
  secaoMercadologica,
  subgrupoMercadologico,
  type Produto,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/precos")({
  head: () => ({
    meta: [
      { title: "Preço Concorrência | Portal do Fornecedor" },
      {
        name: "description",
        content: "Menor e maior preço de toda a subcategoria comparado ao preço do item do fornecedor.",
      },
      { property: "og:title", content: "Preço Concorrência | Portal do Fornecedor" },
    ],
  }),
  component: PrecosPage,
});

type StatusPreco = "Competitivo" | "Normal" | "Caro";

type LinhaPreco = {
  produto: Produto;
  codigo: string;
  chaveSubgrupo: string;
  rotuloSubgrupo: string;
  precoFornecedor: number;
  menorConcorrencia: number;
  maiorConcorrencia: number;
  nSkuSubcategoria: number;
  posicaoFaixa: number;
  status: StatusPreco;
};

type GrupoSubcategoria = {
  chave: string;
  rotulo: string;
  menor: number;
  maior: number;
  nSku: number;
  produtos: LinhaPreco[];
};

const statusConfig: Record<StatusPreco, { badge: string; texto: string }> = {
  Competitivo: {
    badge: "bg-success text-success-foreground",
    texto: "Perto do menor preço",
  },
  Normal: {
    badge: "bg-warning text-warning-foreground",
    texto: "No meio da faixa",
  },
  Caro: {
    badge: "bg-danger text-danger-foreground",
    texto: "Perto do maior preço",
  },
};

const arredondarPreco = (valor: number) => Math.max(0.01, Number(valor.toFixed(2)));

const codigoMercadologico = (valor: string | number | null | undefined) => {
  const n = Number(valor);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return String(valor ?? "").trim();
};

const chaveSubgrupoProduto = (produto: Produto) =>
  [
    codigoMercadologico(produto.departamentoCodigo),
    codigoMercadologico(produto.secaoCodigo),
    codigoMercadologico(produto.grupoCodigo),
    codigoMercadologico(produto.subgrupoCodigo),
  ].join("|");

const rotuloSubgrupoProduto = (produto: Produto) =>
  `${secaoMercadologica(produto)} › ${grupoMercadologico(produto)} › ${subgrupoMercadologico(produto)}`;

const faixaDoProduto = (
  produto: Produto,
  faixas: Map<string, FaixaPrecoSubgrupoDB>,
): { menor: number; maior: number; nSku: number } | null => {
  const chave = chaveSubgrupoProduto(produto);
  const oficial = faixas.get(chave);
  if (oficial && oficial.precoMin > 0 && oficial.precoMax > 0) {
    return {
      menor: arredondarPreco(oficial.precoMin),
      maior: arredondarPreco(oficial.precoMax),
      nSku: oficial.nSku,
    };
  }
  const menor = Number(produto.precoMinSubgrupo ?? 0);
  const maior = Number(produto.precoMaxSubgrupo ?? 0);
  if (menor > 0 && maior > 0) {
    return { menor: arredondarPreco(menor), maior: arredondarPreco(maior), nSku: 0 };
  }
  return null;
};

const statusPreco = (precoFornecedor: number, menor: number, maior: number): StatusPreco => {
  if (!(maior > menor)) return "Normal";
  const posicao = (precoFornecedor - menor) / (maior - menor);
  if (precoFornecedor >= maior || posicao >= 2 / 3) return "Caro";
  if (precoFornecedor <= menor || posicao <= 1 / 3) return "Competitivo";
  return "Normal";
};

const posicaoNaFaixa = (precoFornecedor: number, menor: number, maior: number) => {
  if (maior <= menor) return 50;
  return Math.min(100, Math.max(0, ((precoFornecedor - menor) / (maior - menor)) * 100));
};

function PrecosPage() {
  const { fornecedor, codigoFornecedorAtivo, dadosFornecedorVersao } = usePortal();
  const [subcategoria, setSubcategoria] = useState("todas");
  const [status, setStatus] = useState<StatusPreco | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [faixas, setFaixas] = useState<FaixaPrecoSubgrupoDB[]>([]);
  const [arquivoTabela, setArquivoTabela] = useState<string | null>(null);
  const [itensImportados, setItensImportados] = useState<Array<{ sku: string; descricao: string; precoAtual: number; precoProposto: number }>>([]);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [enviandoTabela, setEnviandoTabela] = useState(false);

  useEffect(() => {
    let ativo = true;
    fetchFaixasPrecoSubgrupo({ data: codigoFornecedorAtivo })
      .then((rows) => {
        if (ativo) setFaixas(rows ?? []);
      })
      .catch((error) => {
        console.error(error);
        if (ativo) setFaixas([]);
      });
    return () => {
      ativo = false;
    };
  }, [codigoFornecedorAtivo, dadosFornecedorVersao]);

  const mapaFaixas = useMemo(() => {
    const mapa = new Map<string, FaixaPrecoSubgrupoDB>();
    for (const faixa of faixas) {
      mapa.set(
        [
          codigoMercadologico(faixa.departamentoCodigo),
          codigoMercadologico(faixa.secaoCodigo),
          codigoMercadologico(faixa.grupoCodigo),
          codigoMercadologico(faixa.subgrupoCodigo),
        ].join("|"),
        faixa,
      );
    }
    return mapa;
  }, [faixas]);

  const analise = useMemo<LinhaPreco[]>(() => {
    return Array.from(produtos).flatMap((produto) => {
      const faixa = faixaDoProduto(produto, mapaFaixas);
      if (!faixa) return [];
      const precoTabela = Number(produto.precoTabela ?? 0);
      const precoOferta = Number(produto.precoOferta ?? 0);
      const precoFornecedor =
        produto.ofertaVigente && precoOferta > 0 ? precoOferta : precoTabela;

      return [
        {
          produto,
          codigo: codigoProdutoComDigito(produto.sku),
          chaveSubgrupo: chaveSubgrupoProduto(produto),
          rotuloSubgrupo: rotuloSubgrupoProduto(produto),
          precoFornecedor,
          menorConcorrencia: faixa.menor,
          maiorConcorrencia: faixa.maior,
          nSkuSubcategoria: faixa.nSku,
          posicaoFaixa: posicaoNaFaixa(precoFornecedor, faixa.menor, faixa.maior),
          status: statusPreco(precoFornecedor, faixa.menor, faixa.maior),
        },
      ];
    });
  }, [dadosFornecedorVersao, mapaFaixas]);

  const opcoesSubcategoria = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const item of analise) {
      if (!vistos.has(item.chaveSubgrupo)) vistos.set(item.chaveSubgrupo, item.rotuloSubgrupo);
    }
    return Array.from(vistos.entries())
      .map(([chave, rotulo]) => ({ chave, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [analise]);

  useEffect(() => {
    if (subcategoria !== "todas" && !opcoesSubcategoria.some((item) => item.chave === subcategoria)) {
      setSubcategoria("todas");
    }
  }, [opcoesSubcategoria, subcategoria]);

  const filtrados = analise.filter((item) => {
    if (subcategoria !== "todas" && item.chaveSubgrupo !== subcategoria) return false;
    if (status !== "todos" && item.status !== status) return false;
    if (busca) {
      const alvo =
        `${item.codigo} ${item.produto.sku} ${item.produto.descricao} ${item.rotuloSubgrupo}`.toLowerCase();
      if (!alvo.includes(busca.toLowerCase())) return false;
    }
    return true;
  });

  const grupos = useMemo<GrupoSubcategoria[]>(() => {
    const mapa = new Map<string, GrupoSubcategoria>();
    for (const item of filtrados) {
      const atual =
        mapa.get(item.chaveSubgrupo) ??
        ({
          chave: item.chaveSubgrupo,
          rotulo: item.rotuloSubgrupo,
          menor: item.menorConcorrencia,
          maior: item.maiorConcorrencia,
          nSku: item.nSkuSubcategoria,
          produtos: [],
        } satisfies GrupoSubcategoria);
      atual.produtos.push(item);
      mapa.set(item.chaveSubgrupo, atual);
    }
    return Array.from(mapa.values())
      .map((grupo) => ({
        ...grupo,
        produtos: [...grupo.produtos].sort((a, b) => a.produto.descricao.localeCompare(b.produto.descricao, "pt-BR")),
      }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [filtrados]);

  const contagem = (tipo: StatusPreco) => analise.filter((item) => item.status === tipo).length;

  const limparFiltros = () => {
    setSubcategoria("todas");
    setStatus("todos");
    setBusca("");
  };

  const processarTabelaExcel = async (arquivo: File) => {
    setArquivoTabela(arquivo.name);
    setItensImportados([]);
    setErrosImportacao([]);
    try {
      const workbook = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const normalizar = (valor: unknown) => String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const achar = (linha: Record<string, unknown>, nomes: string[]) => Object.entries(linha).find(([chave]) => nomes.includes(normalizar(chave)))?.[1];
      const porCodigo = new Map(produtos.flatMap((produto) => [[String(produto.sku), produto], [String(produto.codigoProdutoRms), produto]]));
      const importados: Array<{ sku: string; descricao: string; precoAtual: number; precoProposto: number }> = [];
      const erros: string[] = [];
      const vistos = new Set<string>();
      linhas.forEach((linha, indice) => {
        const codigo = String(achar(linha, ["codigo", "codigoproduto", "skuproduto", "sku"]) ?? "").trim();
        const bruto = String(achar(linha, ["precoproposto", "preconovo", "preco", "valor"]) ?? "").replace(/[^0-9,.-]/g, "");
        const preco = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
        const produto = porCodigo.get(codigo) ?? porCodigo.get(codigo.replace(/^0+/, ""));
        if (!codigo && !bruto) return;
        if (!produto) { erros.push(`Linha ${indice + 2}: produto ${codigo || "(sem código)"} não encontrado para este fornecedor.`); return; }
        if (vistos.has(produto.sku)) { erros.push(`Linha ${indice + 2}: produto ${codigo} duplicado.`); return; }
        if (!(preco > 0)) { erros.push(`Linha ${indice + 2}: preço proposto inválido.`); return; }
        vistos.add(produto.sku);
        importados.push({ sku: produto.sku, descricao: produto.descricao, precoAtual: Number(produto.precoTabela ?? 0), precoProposto: preco });
      });
      setItensImportados(importados);
      setErrosImportacao(erros);
    } catch {
      setErrosImportacao(["Não foi possível ler o arquivo. Use um arquivo Excel .xlsx ou .xls baseado no modelo."]);
    }
  };

  const baixarModeloTabela = () => {
    const planilha = XLSX.utils.json_to_sheet([{ "Código do produto": "", "Descrição": "", "Preço proposto": "", "Unidade": "", "Observação": "" }]);
    const arquivo = XLSX.write({ Sheets: { "Tabela de preços": planilha }, SheetNames: ["Tabela de preços"] }, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([arquivo], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a"); link.href = url; link.download = "modelo-tabela-precos.xlsx"; link.click(); URL.revokeObjectURL(url);
  };

  const exportarTabelaAtual = () => {
    const linhas = analise.map((item) => ({
      "Código do produto": item.produto.sku,
      "Descrição": item.produto.descricao,
      "Preço atual": item.precoFornecedor,
      "Preço proposto": "",
      "Unidade": "UN",
      "Observação": "",
    }));
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const arquivo = XLSX.write({ Sheets: { "Tabela de preços": planilha }, SheetNames: ["Tabela de preços"] }, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([arquivo], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a"); link.href = url; link.download = `tabela-precos-${codigoFornecedorAtivo}.xlsx`; link.click(); URL.revokeObjectURL(url);
  };

  const enviarTabelaImportada = async () => {
    if (!itensImportados.length) return;
    setEnviandoTabela(true);
    try {
      await submitPropostaPreco({ data: { fornecedorCodigo: codigoFornecedorAtivo, justificativa: `Tabela importada: ${arquivoTabela || "arquivo Excel"}`, itens: itensImportados } });
      setItensImportados([]);
      setArquivoTabela(null);
      setErrosImportacao(["Tabela enviada para análise com sucesso."]);
    } catch (error) { setErrosImportacao([error instanceof Error ? error.message : "Não foi possível enviar a tabela."]); }
    finally { setEnviandoTabela(false); }
  };



  return (
    <PortalLayout
      titulo="Preço Concorrência"
      descricao={`Menor e maior preço de toda a subcategoria, comparado ao item de ${fornecedor.nome}`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Resumo titulo="Produtos analisados" valor={numero(analise.length)} />
          <Resumo titulo="Competitivos" valor={numero(contagem("Competitivo"))} tom="success" />
          <Resumo titulo="Normal" valor={numero(contagem("Normal"))} tom="warning" />
          <Resumo titulo="Caros" valor={numero(contagem("Caro"))} tom="danger" />
        </div>

        <Card className="shadow-panel">
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Select value={subcategoria} onValueChange={setSubcategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a subcategoria" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="todas">Todas as subcategorias</SelectItem>
                  {opcoesSubcategoria.map((opcao) => (
                    <SelectItem key={opcao.chave} value={opcao.chave}>
                      {opcao.rotulo}
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
                  <SelectItem value="Competitivo">Competitivo</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
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
                  placeholder="Código, descrição ou subcategoria"
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
              <CardTitle className="text-base">Comparativo por subcategoria</CardTitle>
              <Badge variant="outline">
                {numero(filtrados.length)} itens · {numero(grupos.length)} subcategorias
              </Badge>
            </div>
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
                    <TableHead className="text-right">Menor da subcategoria</TableHead>
                    <TableHead className="text-right">Maior da subcategoria</TableHead>
                    <TableHead className="text-right">Preço do item</TableHead>
                    <TableHead>Faixa</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((grupo) => (
                    <SubgrupoPrecoRows key={grupo.chave} grupo={grupo} />
                  ))}
                  {grupos.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
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

function SubgrupoPrecoRows({ grupo }: { grupo: GrupoSubcategoria }) {
  const [aberto, setAberto] = useState(true);
  return (
    <>
      <TableRow className="bg-primary/5 hover:bg-primary/10">
        <TableCell colSpan={7} className="px-3 py-1.5">
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
            <span className="font-semibold">{grupo.rotulo}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {grupo.nSku > 0
                ? `${numero(grupo.nSku)} itens na subcategoria (todos os fornecedores)`
                : "Faixa da subcategoria"}
              {" · "}
              menor {brl(grupo.menor)} · maior {brl(grupo.maior)}
              {" · "}
              {numero(grupo.produtos.length)} do fornecedor
            </span>
          </button>
        </TableCell>
      </TableRow>
      {aberto &&
        grupo.produtos.map((item) => (
          <TableRow key={item.produto.sku}>
            <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
            <TableCell className="min-w-[240px] font-medium">{item.produto.descricao}</TableCell>
            <TableCell className="text-right">{brl(item.menorConcorrencia)}</TableCell>
            <TableCell className="text-right">{brl(item.maiorConcorrencia)}</TableCell>
            <TableCell className="text-right">
              {item.produto.ofertaVigente && item.produto.precoOferta ? (
                <div>
                  <span className="font-semibold text-success">{brl(item.precoFornecedor)}</span>
                  {item.produto.ofertaFim ? (
                    <p className="text-[0.65rem] font-normal text-muted-foreground">
                      Oferta até {dataBR(item.produto.ofertaFim)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <span className="font-semibold">{brl(item.precoFornecedor)}</span>
              )}
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
            <TableCell>
              <Badge className={`border-0 ${statusConfig[item.status].badge}`}>{item.status}</Badge>
              <p className="mt-1 text-[0.65rem] text-muted-foreground">{statusConfig[item.status].texto}</p>
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}

function Resumo({
  titulo,
  valor,
  tom = "primary",
}: {
  titulo: string;
  valor: string;
  tom?: "primary" | "success" | "danger" | "warning";
}) {
  const Icone =
    tom === "danger" ? TrendingUp : tom === "success" ? TrendingDown : tom === "warning" ? Minus : Search;
  const cor =
    tom === "danger"
      ? "text-danger"
      : tom === "success"
        ? "text-success"
        : tom === "warning"
          ? "text-warning"
          : "text-primary";

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
