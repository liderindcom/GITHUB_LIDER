import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { LiderLogo } from "@/components/lider-logo";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/context/portal-context";
import { compradorProduto, compradoresProdutos } from "@/lib/comprador";
import { dataBR, numero } from "@/lib/format";
import { lojaForaDoPortalFornecedor } from "@/lib/lojas-excluidas-portal";
import {
  codigoProdutoComDigito,
  departamentoMercadologico,
  estoque,
  globalDbCache,
  lojaPorCodigo,
  lojas,
  produtos,
  secaoMercadologica,
  vendas,
  type Produto,
  type VendaItem,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/relatorio-mix")({
  head: () => ({
    meta: [
      { title: "Relatório MIX | Portal do Fornecedor" },
      {
        name: "description",
        content: "Relatório de produtos nas filiais com vendas, estoque e cobertura.",
      },
      { property: "og:title", content: "Relatório MIX | Portal do Fornecedor" },
      {
        property: "og:description",
        content: "Matriz por filial baseada no modelo REtqCob do Grupo Líder.",
      },
    ],
  }),
  component: RelatorioMixPage,
});

type FilialCell = {
  filial: string;
  fazParteMix: boolean;
  estoque: number;
  cobertura: number | null;
  bloqueio: number;
};

type ProdutoMix = {
  codigo: string;
  descricao: string;
  comprador: string;
  ref: string;
  status: "RT" | "FN" | "SA" | "R1";
  vendaMediaTotal: number;
  estoqueTotal: number;
  linha?: string | null;
  filiais: FilialCell[];
};

type SubGrupoMix = {
  codigo: string;
  nome: string;
  produtos: ProdutoMix[];
};

type GrupoMix = {
  codigo: string;
  nome: string;
  subgrupos: SubGrupoMix[];
};

const chaveSkuFilial = (sku: string, filial: string) => `${sku}::${filial}`;

const DIAS_MEDIA_VD = 30;

const codigoLojaSemZeros = (codigo: string) => String(codigo ?? "").trim().replace(/^0+(?=\d)/, "");

const ordenarCodigos = (a: string, b: string) => {
  const numeroA = Number(a);
  const numeroB = Number(b);
  if (Number.isFinite(numeroA) && Number.isFinite(numeroB)) return numeroA - numeroB;
  return a.localeCompare(b);
};

/** Vendas no cache usam o número da loja (1, 19, 27). */
const filialDeVenda = (lojaId: string) => lojaPorCodigo(lojaId, "numero")?.id ?? codigoLojaSemZeros(lojaId);

/**
 * Estoque e bloqueio vêm de GET_COD_LOCAL (19 = loja 1). Sem o modo `local`,
 * 19 colidiria com a loja 19.
 */
const filialDeLocal = (lojaId: string) =>
  lojaPorCodigo(lojaId, "local")?.id ?? lojaPorCodigo(lojaId, "numero")?.id ?? codigoLojaSemZeros(lojaId);

const filiaisOficiaisMix = () =>
  lojas
    .filter((loja) => loja.tipo !== "D" && !lojaForaDoPortalFornecedor(loja.id))
    .map((loja) => loja.id)
    .sort(ordenarCodigos);

const marcadorCelulaMix = (cell: FilialCell): "X" | "B" | "estoque" => {
  if (!cell.fazParteMix) return "X";
  if (cell.bloqueio > 0) return "B";
  return "estoque";
};

const textoCelulaEstoque = (cell: FilialCell) => {
  const marcador = marcadorCelulaMix(cell);
  if (marcador === "X") return "X";
  if (marcador === "B") return "B";
  return String(cell.estoque);
};

const mostraCobertura = (cell: FilialCell) =>
  marcadorCelulaMix(cell) === "estoque" && cell.cobertura !== null;

const codigosLojaCadastrados = new Set(lojas.flatMap((loja) => [loja.id, loja.idLocal]));

const codigoLojaSemDigito = (codigo: string) => {
  const normalizado = codigo.trim();
  if (codigosLojaCadastrados.has(normalizado)) return normalizado;
  if (/^\d{3,}$/.test(normalizado)) return normalizado.slice(0, -1);
  return normalizado;
};

const statusMix = (
  produto: Produto,
  vendaMediaTotal: number,
  estoqueTotal: number,
): ProdutoMix["status"] => {
  if (estoqueTotal <= 0) return "SA";
  if (vendaMediaTotal <= 0) return "R1";
  if (produto.papelMercadologico === "Destino") return "RT";
  if (produto.papelMercadologico === "Rotina") return "FN";
  return "R1";
};

const referenciaProduto = (produto: Produto) => {
  const referencia = produto.referencia?.trim();
  if (referencia) return referencia;
  return produto.familia ? `${produto.familia} · ${produto.categoria}` : produto.categoria;
};

const periodoVendas = (linhas: VendaItem[]) => {
  const datas = linhas
    .map((linha) => linha.data)
    .filter(Boolean)
    .sort();
  if (datas.length === 0) return "Sem venda no período";
  return `${dataBR(datas[0]!)} a ${dataBR(datas[datas.length - 1]!)}`;
};

const inicioJanelaDias = (linhas: VendaItem[], dias: number) => {
  const ultimaData = linhas
    .map((linha) => linha.data)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!ultimaData) return null;

  const inicio = new Date(`${ultimaData}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));
  return inicio.toISOString().slice(0, 10);
};

const numeroMedia = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const somarPorSku = <T extends { sku: string }>(linhas: T[], valor: (linha: T) => number) => {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    mapa.set(linha.sku, (mapa.get(linha.sku) ?? 0) + valor(linha));
  }
  return mapa;
};

const somarPorSkuFilial = <T extends { sku: string; lojaId: string }>(
  linhas: T[],
  valor: (linha: T) => number,
  filialDe: (lojaId: string) => string,
) => {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const chave = chaveSkuFilial(linha.sku, filialDe(linha.lojaId));
    mapa.set(chave, (mapa.get(chave) ?? 0) + valor(linha));
  }
  return mapa;
};

function RelatorioMixPage() {
  const { fornecedor, codigoFornecedorAtivo, dadosFornecedorVersao } = usePortal();
  const [grupoSelecionado, setGrupoSelecionado] = useState("todos");
  const supplierCode = codigoFornecedorAtivo;

  const dados = useMemo(() => {
    const produtosFornecedor = Array.from(produtos).filter(
      (produto) => (produto.fornecedorCodigo ?? "4050") === supplierCode,
    );
    const skusFornecedor = new Set(produtosFornecedor.map((produto) => produto.sku));
    const vendasFornecedor = Array.from(vendas).filter((linha) => skusFornecedor.has(linha.sku));
    const estoqueFornecedor = Array.from(estoque).filter((linha) => skusFornecedor.has(linha.sku));
    const filiaisRelatorio = filiaisOficiaisMix();
    const inicioUltimos30Dias = inicioJanelaDias(vendasFornecedor, DIAS_MEDIA_VD);
    const vendasUltimos30Dias = inicioUltimos30Dias
      ? vendasFornecedor.filter((linha) => linha.data >= inicioUltimos30Dias)
      : [];
    const vendasMediaSku = somarPorSku(
      vendasUltimos30Dias,
      (linha) => linha.quantidade / DIAS_MEDIA_VD,
    );
    const estoqueSku = somarPorSku(estoqueFornecedor, (linha) => linha.estoqueAtual);
    const vendasMediaSkuFilial = somarPorSkuFilial(
      vendasUltimos30Dias,
      (linha) => linha.quantidade / DIAS_MEDIA_VD,
      filialDeVenda,
    );
    const vendasSkuFilial = somarPorSkuFilial(vendasFornecedor, (linha) => linha.quantidade, filialDeVenda);
    const estoqueSkuFilial = somarPorSkuFilial(
      estoqueFornecedor,
      (linha) => linha.estoqueAtual,
      filialDeLocal,
    );
    const bloqueioSkuFilial = new Map<string, number>();
    for (const bloq of globalDbCache.bloqueios ?? []) {
      if (!skusFornecedor.has(bloq.sku)) continue;
      bloqueioSkuFilial.set(chaveSkuFilial(bloq.sku, filialDeLocal(bloq.lojaId)), bloq.bloqueio);
    }

    const gruposMap = new Map<string, GrupoMix>();

    for (const produto of produtosFornecedor) {
      const vendaMediaTotal = vendasMediaSku.get(produto.sku) ?? 0;
      const estoqueTotal = Math.round(estoqueSku.get(produto.sku) ?? 0);
      const grupoCodigo = produto.grupoCodigo || "0";
      const subgrupoCodigo = produto.subgrupoCodigo || "0";
      const grupoNome = produto.grupo || departamentoMercadologico(produto);
      const subgrupoNome = produto.subgrupo || secaoMercadologica(produto);
      const grupo =
        gruposMap.get(grupoCodigo) ??
        ({
          codigo: grupoCodigo,
          nome: grupoNome,
          subgrupos: [],
        } satisfies GrupoMix);
      const subgrupo =
        grupo.subgrupos.find((item) => item.codigo === subgrupoCodigo) ??
        ({
          codigo: subgrupoCodigo,
          nome: subgrupoNome,
          produtos: [],
        } satisfies SubGrupoMix);

      if (!gruposMap.has(grupoCodigo)) gruposMap.set(grupoCodigo, grupo);
      if (!grupo.subgrupos.includes(subgrupo)) grupo.subgrupos.push(subgrupo);

      subgrupo.produtos.push({
        codigo: codigoProdutoComDigito(produto.sku),
        descricao: produto.descricao,
        comprador: compradorProduto(produto),
        ref: referenciaProduto(produto),
        status: statusMix(produto, vendaMediaTotal, estoqueTotal),
        vendaMediaTotal,
        estoqueTotal,
        linha: produto.linha ?? null,
        filiais: filiaisRelatorio.map((filial) => {
          const chave = chaveSkuFilial(produto.sku, filial);
          const vendaMedia = vendasMediaSkuFilial.get(chave) ?? 0;
          const estoqueFilial = Math.round(estoqueSkuFilial.get(chave) ?? 0);
          const bloqueio = bloqueioSkuFilial.get(chave) ?? 0;
          const fazParteMix =
            estoqueSkuFilial.has(chave) || vendasSkuFilial.has(chave) || bloqueio > 0;

          return {
            filial,
            fazParteMix,
            estoque: estoqueFilial,
            cobertura: fazParteMix && bloqueio === 0 && vendaMedia > 0 ? estoqueFilial / vendaMedia : null,
            bloqueio,
          };
        }),
      });
    }

    const grupos = Array.from(gruposMap.values())
      .map((grupo) => ({
        ...grupo,
        subgrupos: [...grupo.subgrupos]
          .map((subgrupo) => ({
            ...subgrupo,
            produtos: [...subgrupo.produtos].sort((a, b) => a.descricao.localeCompare(b.descricao)),
          }))
          .sort((a, b) => ordenarCodigos(a.codigo, b.codigo)),
      }))
      .sort((a, b) => ordenarCodigos(a.codigo, b.codigo));

    return {
      versao: dadosFornecedorVersao,
      filiais: filiaisRelatorio,
      grupos,
      periodo: periodoVendas(vendasFornecedor),
      compradores: compradoresProdutos(produtosFornecedor),
      departamentos: Array.from(new Set(produtosFornecedor.map(departamentoMercadologico))).sort(),
      secoes: Array.from(new Set(produtosFornecedor.map(secaoMercadologica))).sort(),
    };
  }, [supplierCode, dadosFornecedorVersao]);

  const grupos = dados.grupos;
  const filiaisRelatorio = dados.filiais;

  useEffect(() => {
    if (
      grupoSelecionado !== "todos" &&
      !grupos.some((grupo) => grupo.codigo === grupoSelecionado)
    ) {
      setGrupoSelecionado("todos");
    }
  }, [grupoSelecionado, grupos]);

  const gruposDisponiveis = useMemo(() => {
    return grupos.map((grupo) => ({
      value: grupo.codigo,
      label: `${grupo.codigo} ${grupo.nome}`,
    }));
  }, [grupos]);

  const gruposFiltrados = useMemo(
    () =>
      grupoSelecionado === "todos"
        ? grupos
        : grupos.filter((grupo) => grupo.codigo === grupoSelecionado),
    [grupoSelecionado, grupos],
  );

  const totais = useMemo(() => {
    const produtos = gruposFiltrados.flatMap((grupo) =>
      grupo.subgrupos.flatMap((subgrupo) => subgrupo.produtos),
    );
    return {
      produtos: produtos.length,
      vendas: produtos.reduce((acc, produto) => acc + produto.vendaMediaTotal, 0),
      estoque: produtos.reduce((acc, produto) => acc + produto.estoqueTotal, 0),
    };
  }, [gruposFiltrados]);

  function exportar() {
    const cabecalho = [
      "Grupo",
      "Subgrupo",
      "Comprador",
      "Produto",
      "Ref",
      "Status",
      "VD",
      "ESTQ",
      ...filiaisRelatorio.map((filial) => `Filial ${codigoLojaSemDigito(filial)}`),
    ];
    const linhas = gruposFiltrados.flatMap((grupo) =>
      grupo.subgrupos.flatMap((subgrupo) =>
        subgrupo.produtos.flatMap((produto) => [
          [
            `${grupo.codigo} ${grupo.nome}`,
            `${subgrupo.codigo} ${subgrupo.nome}`,
            produto.comprador,
            `${produto.codigo} ${produto.descricao}`,
            produto.ref,
            produto.status,
            numeroMedia(produto.vendaMediaTotal),
            String(produto.estoqueTotal),
            ...produto.filiais.map((cell) => textoCelulaEstoque(cell)),
          ],
          [
            `${grupo.codigo} ${grupo.nome}`,
            `${subgrupo.codigo} ${subgrupo.nome}`,
            produto.comprador,
            "Cobertura",
            produto.ref,
            "**",
            "",
            "",
            ...produto.filiais.map((cell) =>
              mostraCobertura(cell) ? `${Math.round(cell.cobertura!)}d` : "",
            ),
          ],
        ]),
      ),
    );
    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((col) => `"${col}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-mix-retqcob.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado", {
      description: `${linhas.length} produtos em formato Excel (CSV).`,
    });
  }

  return (
    <PortalLayout
      titulo="Relatório MIX"
      descricao="Produtos nas filiais com vendas, estoque real e cobertura"
    >
      <div className="space-y-4">
        <Card className="shadow-panel">
          <CardHeader className="gap-4 border-b border-border">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)_auto]">
              <div className="flex min-w-0 items-start gap-4">
                <LiderLogo variant="mark" className="mt-1 h-10" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Líder Comércio e Indústria Ltda.</p>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Relatório de Produtos nas Filiais - MIX
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Departamento:{" "}
                    <span className="font-medium text-foreground">
                      {dados.departamentos.length === 1 ? dados.departamentos[0] : "Todos"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <LinhaMeta rotulo="Comprador" valor={dados.compradores} />
                <LinhaMeta rotulo="Fornecedor" valor={`${supplierCode} ${fornecedor.nome}`} />
                <LinhaMeta rotulo="Período" valor={dados.periodo} />
              </div>

              <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                <Badge className="border-0 bg-primary text-primary-foreground">[REtqCob]</Badge>
                <Badge variant="outline">Base do fornecedor</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5 lg:grid-cols-[18rem_minmax(0,1fr)_auto]">
            <Select value={grupoSelecionado} onValueChange={setGrupoSelecionado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os grupos</SelectItem>
                {gruposDisponiveis.map((grupo) => (
                  <SelectItem key={grupo.value} value={grupo.value}>
                    {grupo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid gap-2 sm:grid-cols-3">
              <ResumoMini rotulo="Produtos" valor={numero(totais.produtos)} />
              <ResumoMini rotulo="VD" valor={numeroMedia(totais.vendas)} />
              <ResumoMini rotulo="ESTQ" valor={numero(totais.estoque)} />
            </div>

            <Button onClick={exportar}>
              <Download className="size-4" /> Exportar
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardContent className="pt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="size-4 text-primary" />
              <span>Seção: {dados.secoes.length === 1 ? dados.secoes[0] : "Todas as seções"}</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>VD - Venda média diária total dos últimos 30 dias</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>ESTQ - Estoque total; na loja: estoque, X fora do mix ou B bloqueado</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>X - fora do mix da loja</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>B - no mix, bloqueado na loja</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>Cobertura = estoque / venda média</span>
            </div>

            <div className="max-h-[68vh] overflow-auto rounded-lg border border-border">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-30 bg-muted text-muted-foreground shadow-sm">
                  <tr>
                    <th className="sticky left-0 z-40 min-w-[21rem] border-b border-r border-border bg-muted px-3 py-2 text-left">
                      Produto
                    </th>
                    <th className="sticky left-[21rem] z-40 w-14 border-b border-r border-border bg-muted px-2 py-2 text-center">
                      LIN
                    </th>
                    <th className="sticky left-[24.5rem] z-40 w-20 border-b border-r border-border bg-muted px-2 py-2 text-right">
                      VD
                    </th>
                    <th className="sticky left-[29.5rem] z-40 w-20 border-b border-r border-border bg-muted px-2 py-2 text-right">
                      ESTQ
                    </th>
                    <th
                      className="border-b border-border px-3 py-2 text-center"
                      colSpan={filiaisRelatorio.length}
                    >
                      FILIAIS
                    </th>
                  </tr>
                  <tr>
                    <th className="sticky left-0 z-40 border-b border-r border-border bg-muted px-3 py-2 text-left" />
                    <th className="sticky left-[21rem] z-40 border-b border-r border-border bg-muted px-2 py-2" />
                    <th className="sticky left-[24.5rem] z-40 border-b border-r border-border bg-muted px-2 py-2" />
                    <th className="sticky left-[29.5rem] z-40 border-b border-r border-border bg-muted px-2 py-2" />
                    {filiaisRelatorio.map((filial) => (
                      <th
                        key={filial}
                        className="w-16 border-b border-border px-2 py-2 text-center"
                      >
                        {codigoLojaSemDigito(filial)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gruposFiltrados.map((grupo) => (
                    <GrupoRows key={grupo.codigo} grupo={grupo} filiais={filiaisRelatorio} />
                  ))}
                  {gruposFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={4 + filiaisRelatorio.length}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum produto encontrado para o fornecedor atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>[ REtqCob - Atualizado pela base do fornecedor atual ]</span>
              <span>X fora do mix · B bloqueado na loja · número = estoque</span>
              <span>** Cobertura em dias</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function GrupoRows({ grupo, filiais }: { grupo: GrupoMix; filiais: string[] }) {
  return (
    <>
      <tr className="bg-primary/5">
        <td colSpan={4 + filiais.length} className="border-b border-border px-3 py-2 font-semibold">
          Grupo {grupo.codigo} {grupo.nome}
        </td>
      </tr>
      {grupo.subgrupos.map((subgrupo) => (
        <SubGrupoRows
          key={`${grupo.codigo}-${subgrupo.codigo}`}
          subgrupo={subgrupo}
          filiais={filiais}
        />
      ))}
    </>
  );
}

function SubGrupoRows({ subgrupo, filiais }: { subgrupo: SubGrupoMix; filiais: string[] }) {
  const [aberto, setAberto] = useState(true);
  return (
    <>
      <tr className="bg-muted/50">
        <td colSpan={4 + filiais.length} className="border-b border-border px-3 py-1.5 font-medium">
          <button
            type="button"
            onClick={() => setAberto((atual) => !atual)}
            className="flex w-full items-center gap-2 text-left hover:text-primary"
            aria-expanded={aberto}
          >
            {aberto ? (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span>
              Sub-Grupo {subgrupo.codigo} {subgrupo.nome}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground">
              ({subgrupo.produtos.length})
            </span>
          </button>
        </td>
      </tr>
      {aberto &&
        subgrupo.produtos.map((produto) => (
          <ProdutoRows key={produto.codigo} produto={produto} />
        ))}
    </>
  );
}

const obterNomeBloqueio = (b: number) => {
  if (b === 1) return "Bloqueio de Compra";
  if (b === 2) return "Bloqueio de Venda";
  if (b === 3) return "Bloqueio de Recebimento";
  if (b === 4) return "Bloqueio de Transferência";
  return "Bloqueado na loja";
};

function ProdutoRows({ produto }: { produto: ProdutoMix }) {
  return (
    <>
      <tr className="font-mono hover:bg-accent/40">
        <td className="sticky left-0 z-20 border-b border-r border-border bg-background px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{produto.codigo}</span> 
            <span>{produto.descricao}</span>
            {produto.linha && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary border border-primary/15" title="Linha de Distribuição">
                Linha: {produto.linha}
              </span>
            )}
          </div>
        </td>
        <td className="sticky left-[21rem] z-20 border-b border-r border-border bg-background px-2 py-1.5 text-center">
          {produto.status}
        </td>
        <td className="sticky left-[24.5rem] z-20 border-b border-r border-border bg-background px-2 py-1.5 text-right">
          {numeroMedia(produto.vendaMediaTotal)}
        </td>
        <td className="sticky left-[29.5rem] z-20 border-b border-r border-border bg-background px-2 py-1.5 text-right">
          {numero(produto.estoqueTotal)}
        </td>
        {produto.filiais.map((cell) => {
          const marcador = marcadorCelulaMix(cell);
          return (
            <td key={cell.filial} className="border-b border-border px-2 py-1.5 text-center">
              {marcador === "X" ? (
                <span className="text-muted-foreground">X</span>
              ) : marcador === "B" ? (
                <span
                  className="inline-flex cursor-help rounded border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive"
                  title={obterNomeBloqueio(cell.bloqueio)}
                >
                  B
                </span>
              ) : (
                <span>{numero(cell.estoque)}</span>
              )}
            </td>
          );
        })}
      </tr>
      <tr className="font-mono text-muted-foreground hover:bg-accent/30">
        <td className="sticky left-0 z-20 border-b border-r border-border bg-background px-3 py-1.5">
          Cobertura
        </td>
        <td className="sticky left-[21rem] z-20 border-b border-r border-border bg-background px-2 py-1.5 text-center">
          **
        </td>
        <td className="sticky left-[24.5rem] z-20 border-b border-r border-border bg-background px-2 py-1.5 text-right" />
        <td className="sticky left-[29.5rem] z-20 border-b border-r border-border bg-background px-2 py-1.5 text-right" />
        {produto.filiais.map((cell) => (
          <td key={cell.filial} className="border-b border-border px-2 py-1.5 text-center">
            <span className={mostraCobertura(cell) && cell.cobertura! <= 7 ? "text-danger" : ""}>
              {mostraCobertura(cell) ? `${numero(Math.round(cell.cobertura!))}d` : ""}
            </span>
          </td>
        ))}
      </tr>
    </>
  );
}

function LinhaMeta({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{rotulo}:</span>
      <span className="truncate font-medium">{valor}</span>
    </div>
  );
}

function ResumoMini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="font-display text-lg font-bold">{valor}</p>
    </div>
  );
}
