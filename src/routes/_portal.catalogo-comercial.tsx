import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Info,
  PackagePlus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import {
  fetchCatalogoComercial,
  salvarCatalogoComercial,
  type CatalogoComercialDB,
} from "@/catalogo-api";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/context/portal-context";

export const Route = createFileRoute("/_portal/catalogo-comercial")({
  head: () => ({
    meta: [
      { title: "Catálogo Comercial | Portal do Fornecedor" },
      {
        name: "description",
        content: "Apresente lançamentos, coleções e produtos ao Grupo Líder.",
      },
    ],
  }),
  component: CatalogoComercialPage,
});

type Formulario = Omit<
  CatalogoComercialDB,
  "id" | "fornecedorCodigo" | "status" | "criadoEm" | "atualizadoEm" | "publicadoEm"
> &
  Pick<CatalogoComercialDB, "status">;

const vazio: Formulario = {
  codigoFornecedor: "",
  descricao: "",
  marca: "",
  categoria: "",
  subcategoria: "",
  skuReferencia: "",
  imagemUrl: "",
  fichaTecnica: "",
  variacoesJson: "",
  precoSugerido: null,
  precoValidadeInicio: "",
  precoValidadeFim: "",
  estoqueDisponivel: null,
  prazoEntregaDias: null,
  pedidoMinimo: null,
  colecao: "",
  estacao: "",
  evento: "",
  origem: "FORNECEDOR",
  status: "RASCUNHO",
};

const MIME_POR_EXTENSAO: Record<string, string> = {
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const MAX_PLANILHA_BYTES = 10 * 1024 * 1024;

async function arquivoParaBase64(arquivo: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível preparar a planilha."));
    reader.readAsDataURL(arquivo);
  });
  const separador = dataUrl.indexOf(",");
  if (separador < 0) throw new Error("Não foi possível preparar a planilha.");
  return dataUrl.slice(separador + 1);
}

function CatalogoComercialPage() {
  const { fornecedor, codigoFornecedorAtivo } = usePortal();
  const [itens, setItens] = useState<CatalogoComercialDB[]>([]);
  const [form, setForm] = useState<Formulario>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [arquivoImportado, setArquivoImportado] = useState<string | null>(null);
  const [linhasImportadas, setLinhasImportadas] = useState<Formulario[]>([]);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    void fetchCatalogoComercial({ data: { fornecedorCodigo: codigoFornecedorAtivo } })
      .then((dados) => {
        setItens(dados);
        setCarregando(false);
      })
      .catch(() => {
        toast.error("Não foi possível carregar o catálogo.");
        setCarregando(false);
      });
  }, [codigoFornecedorAtivo]);

  const alterar = (campo: keyof Formulario, valor: string) => {
    const camposNumericos: Array<keyof Formulario> = [
      "precoSugerido",
      "estoqueDisponivel",
      "prazoEntregaDias",
      "pedidoMinimo",
    ];
    const valorFinal = camposNumericos.includes(campo)
      ? valor === ""
        ? null
        : Number(valor)
      : valor;
    setForm((atual) => ({ ...atual, [campo]: valorFinal }));
  };

  const salvar = async (status: "RASCUNHO" | "PUBLICADO") => {
    if (!form.descricao.trim()) {
      toast.error("Informe a descrição do produto ou coleção.");
      return;
    }
    setSalvando(true);
    try {
      const salvo = await salvarCatalogoComercial({ data: { ...form, status } });
      setItens((atual) => [salvo, ...atual]);
      setForm(vazio);
      toast.success(status === "PUBLICADO" ? "Produto enviado ao Grupo Líder." : "Rascunho salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  };

  const baixarModeloCatalogo = () => {
    const planilha = XLSX.utils.json_to_sheet([
      {
        "Código fornecedor": "",
        "Descrição comercial": "",
        Marca: "",
        Categoria: "",
        Subcategoria: "",
        "SKU RMS": "",
        "Imagem URL": "",
        "Ficha técnica": "",
        Variações: "",
        "Preço sugerido": "",
        "Início validade preço": "",
        "Fim validade preço": "",
        "Estoque disponível": "",
        "Prazo entrega dias": "",
        "Pedido mínimo": "",
        Coleção: "",
        Estação: "",
        Evento: "",
      },
    ]);
    const arquivo = XLSX.write(
      { Sheets: { "Catálogo Comercial": planilha }, SheetNames: ["Catálogo Comercial"] },
      { bookType: "xlsx", type: "array" },
    );
    const url = URL.createObjectURL(
      new Blob([arquivo], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-catalogo-comercial.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const processarCatalogoImportado = async (arquivo: File) => {
    if (arquivo.size > MAX_PLANILHA_BYTES) {
      setArquivoSelecionado(null);
      setArquivoImportado(arquivo.name);
      setLinhasImportadas([]);
      setErrosImportacao(["A planilha excede o limite de 10 MB. Escolha um arquivo menor."]);
      return;
    }
    setArquivoSelecionado(arquivo);
    setArquivoImportado(arquivo.name);
    setLinhasImportadas([]);
    setErrosImportacao([]);
    try {
      const workbook = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeiraAba, { defval: "" });
      const normalizar = (valor: unknown) =>
        String(valor ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      const achar = (linha: Record<string, unknown>, nomes: string[]) =>
        Object.entries(linha).find(([chave]) => nomes.includes(normalizar(chave)))?.[1];
      const texto = (linha: Record<string, unknown>, nomes: string[]) =>
        String(achar(linha, nomes) ?? "").trim();
      const numeroImportado = (linha: Record<string, unknown>, nomes: string[]) => {
        const bruto = texto(linha, nomes).replace(/[^0-9,.-]/g, "");
        if (!bruto) return null;
        const valor = Number(
          bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto,
        );
        return Number.isFinite(valor) ? valor : null;
      };
      const importadas: Formulario[] = [];
      const erros: string[] = [];
      linhas.forEach((linha, indice) => {
        const descricao = texto(linha, ["descricao", "descricaocomercial", "produto", "nome"]);
        if (!descricao) {
          if (Object.values(linha).some((valor) => String(valor).trim()))
            erros.push(`Linha ${indice + 2}: descrição comercial não informada.`);
          return;
        }
        importadas.push({
          ...vazio,
          codigoFornecedor: texto(linha, ["codigo", "codigofornecedor", "referenciafornecedor"]),
          descricao,
          marca: texto(linha, ["marca"]),
          categoria: texto(linha, ["categoria"]),
          subcategoria: texto(linha, ["subcategoria"]),
          skuReferencia: texto(linha, ["sku", "skurms", "skureferencia"]),
          imagemUrl: texto(linha, ["imagem", "imagemurl", "urlimagem"]),
          fichaTecnica: texto(linha, ["fichatecnica", "informacoescomerciais"]),
          variacoesJson: texto(linha, ["variacoes", "variacoesjson"]),
          precoSugerido: numeroImportado(linha, ["preco", "precosugerido", "valorsugerido"]),
          precoValidadeInicio: texto(linha, ["iniciovalidade", "iniciovalidadepreco"]),
          precoValidadeFim: texto(linha, ["fimvalidade", "fimvalidadepreco"]),
          estoqueDisponivel: numeroImportado(linha, ["estoque", "estoquedisponivel"]),
          prazoEntregaDias: numeroImportado(linha, ["prazo", "prazoentrega", "prazoentregadias"]),
          pedidoMinimo: numeroImportado(linha, ["pedidominimo", "quantidademinima"]),
          colecao: texto(linha, ["colecao", "linha"]),
          estacao: texto(linha, ["estacao"]),
          evento: texto(linha, ["evento", "oportunidade"]),
        });
      });
      setLinhasImportadas(importadas);
      setErrosImportacao(
        linhas.length === 0
          ? [
              "O arquivo foi lido, mas ainda não há produtos preenchidos. Preencha pelo menos a coluna Descrição comercial e selecione a planilha novamente.",
            ]
          : importadas.length === 0 && erros.length === 0
            ? [
                "A planilha foi lida, mas nenhuma linha foi reconhecida. Use o modelo do portal e mantenha a coluna Descrição comercial.",
              ]
            : erros,
      );
    } catch {
      setErrosImportacao([
        "Não foi possível ler o arquivo. Use um Excel .xlsx ou .xls baseado no modelo.",
      ]);
    }
  };

  const salvarCatalogoImportado = async () => {
    if (!linhasImportadas.length || !arquivoSelecionado) return;
    setImportando(true);
    try {
      const extensao = arquivoSelecionado.name
        .slice(arquivoSelecionado.name.lastIndexOf("."))
        .toLowerCase();
      const mimeType = MIME_POR_EXTENSAO[extensao] || arquivoSelecionado.type;
      const respostaCerberus = await fetch("/api/cerberus/catalogo-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          originalName: arquivoSelecionado.name,
          mimeType,
          bytesBase64: await arquivoParaBase64(arquivoSelecionado),
          fornecedorCodigo: codigoFornecedorAtivo,
        }),
      });
      const resultadoCerberus = (await respostaCerberus.json().catch(() => ({}))) as {
        error?: unknown;
        itens?: CatalogoComercialDB[];
      };
      if (!respostaCerberus.ok) {
        if (respostaCerberus.status === 404) {
          throw new Error("O recebimento seguro ainda não está habilitado neste ambiente.");
        }
        const mensagemServidor =
          typeof resultadoCerberus.error === "string" ? resultadoCerberus.error.trim() : "";
        const mensagemSegura =
          /^(Sessão|Sensor|Heartbeat|Tipo de arquivo|MIME|Nome de arquivo|Arquivo|Conteúdo|Campos obrigatórios|JSON inválido|Corpo inválido|A planilha|Nenhuma linha|Linha \d+|Fornecedor|Permissão)/.test(
            mensagemServidor,
          );
        if (mensagemSegura) throw new Error(mensagemServidor);
        throw new Error(
          "Não foi possível receber a planilha neste momento. Tente novamente em alguns minutos. Nenhum dado foi enviado.",
        );
      }
      if (typeof resultadoCerberus.error === "string") throw new Error(resultadoCerberus.error);
      if (!resultadoCerberus.itens?.length) throw new Error("Nenhum produto foi importado.");

      setItens((atual) => [...resultadoCerberus.itens!.slice().reverse(), ...atual]);
      setArquivoSelecionado(null);
      setLinhasImportadas([]);
      setArquivoImportado(null);
      toast.success(`${resultadoCerberus.itens.length} produto(s) importado(s) como rascunho.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar o catálogo.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <PortalLayout
      titulo="Catálogo Comercial"
      descricao="Apresente produtos, coleções e oportunidades ao Grupo Líder."
    >
      <div className="space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Nova frente comercial
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Catálogo Comercial</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Apresente lançamentos, coleções e oportunidades para os compradores do Grupo Líder. O
              catálogo não altera o cadastro oficial nem gera pedido automaticamente.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5">
            <Sparkles className="size-3.5" /> Atlas conectado
          </Badge>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="size-5 text-primary" /> Novo produto ou coleção
              </CardTitle>
              <CardDescription>
                Quanto mais completo o catálogo, melhor o comprador poderá avaliar a oportunidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Código fornecedor"
                  value={form.codigoFornecedor ?? ""}
                  onChange={(v) => alterar("codigoFornecedor", v)}
                />
                <Campo
                  label="Descrição comercial *"
                  value={form.descricao}
                  onChange={(v) => alterar("descricao", v)}
                  placeholder="Descrição do produto ou coleção"
                />
                <Campo
                  label="Marca"
                  value={form.marca ?? ""}
                  onChange={(v) => alterar("marca", v)}
                  placeholder="Marca ou linha"
                />
                <Campo
                  label="Categoria"
                  value={form.categoria ?? ""}
                  onChange={(v) => alterar("categoria", v)}
                  placeholder="Moda, pet, farma..."
                />
                <Campo
                  label="Subcategoria"
                  value={form.subcategoria ?? ""}
                  onChange={(v) => alterar("subcategoria", v)}
                  placeholder="Ex.: vestidos"
                />
                <Campo
                  label="SKU RMS"
                  value={form.skuReferencia ?? ""}
                  onChange={(v) => alterar("skuReferencia", v)}
                />
                <Campo
                  label="Imagem URL"
                  value={form.imagemUrl ?? ""}
                  onChange={(v) => alterar("imagemUrl", v)}
                  placeholder="https://..."
                />
                <Campo
                  label="Preço sugerido"
                  value={form.precoSugerido?.toString() ?? ""}
                  onChange={(v) => alterar("precoSugerido", v)}
                  inputMode="decimal"
                />
                <Campo
                  label="Início validade preço"
                  value={form.precoValidadeInicio ?? ""}
                  onChange={(v) => alterar("precoValidadeInicio", v)}
                  placeholder="AAAA-MM-DD"
                />
                <Campo
                  label="Fim validade preço"
                  value={form.precoValidadeFim ?? ""}
                  onChange={(v) => alterar("precoValidadeFim", v)}
                  placeholder="AAAA-MM-DD"
                />
                <Campo
                  label="Estoque disponível"
                  value={form.estoqueDisponivel?.toString() ?? ""}
                  onChange={(v) => alterar("estoqueDisponivel", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Prazo entrega dias"
                  value={form.prazoEntregaDias?.toString() ?? ""}
                  onChange={(v) => alterar("prazoEntregaDias", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Pedido mínimo"
                  value={form.pedidoMinimo?.toString() ?? ""}
                  onChange={(v) => alterar("pedidoMinimo", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Coleção"
                  value={form.colecao ?? ""}
                  onChange={(v) => alterar("colecao", v)}
                  placeholder="Ex.: Primavera 2027"
                />
                <Campo
                  label="Estação"
                  value={form.estacao ?? ""}
                  onChange={(v) => alterar("estacao", v)}
                  placeholder="Ex.: Verão, Natal, Círio"
                />
                <Campo
                  label="Evento"
                  value={form.evento ?? ""}
                  onChange={(v) => alterar("evento", v)}
                  placeholder="Ex.: Dia das Mães"
                />
                <Campo
                  label="Variações"
                  value={form.variacoesJson ?? ""}
                  onChange={(v) => alterar("variacoesJson", v)}
                  placeholder="Ex.: cores, tamanhos, voltagens"
                />
              </div>
              <div className="space-y-2">
                <Label>Ficha técnica</Label>
                <Textarea
                  value={form.fichaTecnica ?? ""}
                  onChange={(e) => alterar("fichaTecnica", e.target.value)}
                  placeholder="Materiais, composição, diferenciais e condições."
                  rows={5}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => void salvar("RASCUNHO")}
                  disabled={salvando}
                >
                  <Save className="mr-2 size-4" />
                  Salvar rascunho
                </Button>
                <Button onClick={() => void salvar("PUBLICADO")} disabled={salvando}>
                  <Send className="mr-2 size-4" />
                  Enviar ao Grupo Líder
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit bg-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="size-5 text-primary" /> Como o catálogo será usado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">1. Apresentação:</strong> o fornecedor cadastra
                o produto, a coleção e as condições comerciais.
              </p>
              <p>
                <strong className="text-foreground">2. Avaliação:</strong> o comprador compara a
                oportunidade com lojas, categorias, preço, margem e tendências.
              </p>
              <p>
                <strong className="text-foreground">3. Decisão:</strong> o Atlas pode sugerir teste,
                negociação ou inclusão no mix, sempre com confirmação humana.
              </p>
              <p>
                <strong className="text-foreground">4. Aprendizado:</strong> o resultado da compra
                ou teste retorna para melhorar as próximas recomendações.
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                As imagens são armazenadas inicialmente como URL. O upload gerenciado será uma etapa
                posterior, após validarmos o fluxo comercial.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" /> Enviar catálogo por planilha
            </CardTitle>
            <CardDescription>
              Envie vários produtos de uma vez. O arquivo será conferido e ficará como rascunho para
              revisão; ele não publica produtos nem gera pedido automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm md:grid-cols-3">
              <div className="flex gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">1. Prepare:</strong> baixe o modelo e preencha
                  a coluna Descrição comercial.
                </span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">2. Revise:</strong> confira a prévia das
                  linhas reconhecidas antes de enviar.
                </span>
              </div>
              <div className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">3. Envie:</strong> a planilha será recebida
                  para análise e ficará em rascunho.
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: .xlsx e .xls. O campo obrigatório é{" "}
              <strong className="text-foreground">Descrição comercial</strong>. Para começar, use o
              modelo abaixo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="size-4" /> Selecionar planilha
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const arquivo = event.target.files?.[0];
                    if (arquivo) void processarCatalogoImportado(arquivo);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <Button type="button" variant="outline" onClick={baixarModeloCatalogo}>
                <Download className="mr-2 size-4" /> Baixar modelo
              </Button>
              {arquivoImportado && (
                <div className="basis-full rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Planilha selecionada</p>
                      <p className="truncate text-muted-foreground" title={arquivoImportado}>
                        {arquivoImportado}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {linhasImportadas.length > 0
                          ? `${linhasImportadas.length} linha(s) pronta(s) para revisão.`
                          : "Nenhum produto está pronto para envio ainda."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {errosImportacao.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                {errosImportacao.map((erro, indice) => (
                  <p key={indice}>{erro}</p>
                ))}
              </div>
            )}
            {linhasImportadas.length > 0 && (
              <>
                <div className="max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-left">Marca</th>
                        <th className="p-2 text-left">Categoria</th>
                        <th className="p-2 text-right">Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasImportadas.map((linha, indice) => (
                        <tr key={`${linha.descricao}-${indice}`} className="border-t">
                          <td className="p-2">{linha.descricao}</td>
                          <td className="p-2">{linha.marca || "—"}</td>
                          <td className="p-2">{linha.categoria || "—"}</td>
                          <td className="p-2 text-right">
                            {linha.precoSugerido == null
                              ? "—"
                              : linha.precoSugerido.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  type="button"
                  onClick={() => void salvarCatalogoImportado()}
                  disabled={importando || errosImportacao.length > 0}
                >
                  <Send className="mr-2 size-4" />
                  {importando
                    ? "Enviando..."
                    : `Enviar ${linhasImportadas.length} produto(s) para análise`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos e coleções enviados</CardTitle>
            <CardDescription>
              {fornecedor.nome} · {carregando ? "carregando..." : `${itens.length} registro(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {itens.length === 0 && !carregando ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Seu catálogo ainda está vazio. Apresente a próxima oportunidade ao Grupo Líder.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {itens.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.marca, item.categoria, item.colecao].filter(Boolean).join(" · ") ||
                            "Sem classificação informada"}
                        </p>
                      </div>
                      <Badge variant={item.status === "PUBLICADO" ? "default" : "secondary"}>
                        {item.status === "PUBLICADO" ? "Enviado" : "Rascunho"}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                      {item.fichaTecnica || "Sem ficha técnica informada."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </div>
  );
}
