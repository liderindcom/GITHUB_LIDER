import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  Download,
  FileSpreadsheet,
  ImagePlus,
  PackagePlus,
  Save,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  fetchCatalogoComercial,
  importarCatalogoComercial,
  salvarCatalogoComercial,
  type CatalogoComercialDB,
  type CatalogoComercialImportInput,
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
  dadosFichaLiderJson: null,
  origem: "FORNECEDOR",
  status: "RASCUNHO",
};

function CatalogoComercialPage() {
  const { fornecedor } = usePortal();
  const [itens, setItens] = useState<CatalogoComercialDB[]>([]);
  const [form, setForm] = useState<Formulario>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState("");
  const [previewImportacao, setPreviewImportacao] = useState<CatalogoComercialImportInput[]>([]);
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    void fetchCatalogoComercial()
      .then((dados) => {
        setItens(dados);
        setCarregando(false);
      })
      .catch(() => {
        toast.error("Não foi possível carregar o catálogo.");
        setCarregando(false);
      });
  }, []);

  const processarImportacao = async (arquivo: File) => {
    setArquivoImportacao(arquivo.name);
    setPreviewImportacao([]);
    setErrosImportacao([]);
    try {
      const resultado = await lerFichaLider(arquivo);
      setPreviewImportacao(resultado.itens);
      setErrosImportacao(resultado.erros);
      if (resultado.itens.length > 0)
        toast.success(String(resultado.itens.length) + " item(ns) pronto(s) para revisão.");
    } catch (error) {
      setErrosImportacao([
        error instanceof Error ? error.message : "Não foi possível ler a ficha.",
      ]);
    }
  };

  const baixarModeloImportacao = () => {
    const modelo = [
      {
        "Cod Interno": "REF-001",
        "Descrição do Produto": "Produto exemplo",
        "Embl. Qtde na Cx": 12,
        "Custo do Fornecedor": 29.9,
        "IPI %": 0,
        "Prazo de Entrega (dias)": 15,
        Frete: "CIF",
        EAN13: "",
        DUN14: "",
        "Controla validade": "Não",
        "Validade em dias": "",
        "Dias validade mínima para recebimento": "",
        NCM: "",
        CEST: "",
        "Caixa Comp (cm)": "",
        "Caixa Larg (cm)": "",
        "Caixa Alt (cm)": "",
        "Caixa P.Bruto (kg)": "",
        "Unidade Comp (cm)": "",
        "Unidade Larg (cm)": "",
        "Unidade Alt (cm)": "",
        "Unidade P.Bruto (kg)": "",
        "Pallet Base (caixas)": "",
        "Pallet Altura (caixas)": "",
        "Pallet em caixas": "",
      },
    ];
    const folha = XLSX.utils.json_to_sheet(modelo);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, folha, "Ficha Produto");
    const arquivo = XLSX.write(livro, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(
      new Blob([arquivo], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-ficha-tecnica-produto-lider.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmarImportacao = async () => {
    if (previewImportacao.length === 0) return;
    setImportando(true);
    try {
      const resultado = await importarCatalogoComercial({ data: { itens: previewImportacao } });
      setItens(await fetchCatalogoComercial());
      setPreviewImportacao([]);
      setArquivoImportacao("");
      toast.success(String(resultado.importados) + " item(ns) importado(s) como rascunho.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar a ficha.");
    } finally {
      setImportando(false);
    }
  };

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

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" /> Importar ficha de produto
            </CardTitle>
            <CardDescription>
              Use a planilha baseada na ficha técnica do Líder. Classificações, sistemática e lojas
              ficam fora desta importação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="max-w-md"
                onChange={(event) => {
                  const arquivo = event.target.files?.[0];
                  if (arquivo) void processarImportacao(arquivo);
                }}
              />
              <Button type="button" variant="outline" onClick={baixarModeloImportacao}>
                <Download className="mr-2 size-4" /> Baixar modelo da ficha
              </Button>
            </div>
            {arquivoImportacao && (
              <p className="text-xs text-muted-foreground">
                <Upload className="mr-1 inline size-3.5" /> {arquivoImportacao} ·{" "}
                {previewImportacao.length} item(ns) válido(s)
              </p>
            )}
            {errosImportacao.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                {errosImportacao.slice(0, 8).map((erro, indice) => (
                  <p key={indice}>{erro}</p>
                ))}
                {errosImportacao.length > 8 && (
                  <p>+ {errosImportacao.length - 8} ocorrência(s) adicional(is).</p>
                )}
              </div>
            )}
            {previewImportacao.length > 0 && (
              <div className="space-y-3">
                <div className="max-h-56 overflow-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2">Código</th>
                        <th className="p-2">Descrição</th>
                        <th className="p-2">EAN</th>
                        <th className="p-2 text-right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewImportacao.slice(0, 20).map((item, indice) => {
                        const ficha = item.dadosFichaLiderJson
                          ? (JSON.parse(item.dadosFichaLiderJson) as {
                              ean13?: string;
                              custoFornecedor?: number;
                            })
                          : {};
                        return (
                          <tr key={item.codigoFornecedor + "-" + indice} className="border-t">
                            <td className="p-2 font-mono">{item.codigoFornecedor || "—"}</td>
                            <td className="p-2 font-medium">{item.descricao}</td>
                            <td className="p-2">{ficha.ean13 || "—"}</td>
                            <td className="p-2 text-right">{ficha.custoFornecedor ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {previewImportacao.length > 20 && (
                  <p className="text-xs text-muted-foreground">
                    Prévia limitada aos 20 primeiros itens.
                  </p>
                )}
                <Button
                  type="button"
                  onClick={() => void confirmarImportacao()}
                  disabled={importando}
                >
                  {importando
                    ? "Importando..."
                    : "Importar " + previewImportacao.length + " item(ns) como rascunho"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
                  label="Descrição comercial *"
                  value={form.descricao}
                  onChange={(v) => alterar("descricao", v)}
                  placeholder="Ex.: Coleção primavera — vestido midi"
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
                  label="Código / referência do fornecedor"
                  value={form.codigoFornecedor ?? ""}
                  onChange={(v) => alterar("codigoFornecedor", v)}
                />
                <Campo
                  label="SKU RMS relacionado (se houver)"
                  value={form.skuReferencia ?? ""}
                  onChange={(v) => alterar("skuReferencia", v)}
                />
                <Campo
                  label="Coleção"
                  value={form.colecao ?? ""}
                  onChange={(v) => alterar("colecao", v)}
                  placeholder="Ex.: Primavera 2027"
                />
                <Campo
                  label="Estação ou evento"
                  value={form.estacao ?? ""}
                  onChange={(v) => alterar("estacao", v)}
                  placeholder="Ex.: Verão, Natal, Círio"
                />
                <Campo
                  label="Preço sugerido"
                  value={form.precoSugerido?.toString() ?? ""}
                  onChange={(v) => alterar("precoSugerido", v)}
                  inputMode="decimal"
                />
                <Campo
                  label="Pedido mínimo"
                  value={form.pedidoMinimo?.toString() ?? ""}
                  onChange={(v) => alterar("pedidoMinimo", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Estoque disponível"
                  value={form.estoqueDisponivel?.toString() ?? ""}
                  onChange={(v) => alterar("estoqueDisponivel", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Prazo de entrega (dias)"
                  value={form.prazoEntregaDias?.toString() ?? ""}
                  onChange={(v) => alterar("prazoEntregaDias", v)}
                  inputMode="numeric"
                />
                <Campo
                  label="Imagem principal (URL)"
                  value={form.imagemUrl ?? ""}
                  onChange={(v) => alterar("imagemUrl", v)}
                  placeholder="https://..."
                />
                <Campo
                  label="Evento ou oportunidade"
                  value={form.evento ?? ""}
                  onChange={(v) => alterar("evento", v)}
                  placeholder="Ex.: Dia das Mães"
                />
              </div>
              <div className="space-y-2">
                <Label>Ficha técnica, variações e informações comerciais</Label>
                <Textarea
                  value={form.fichaTecnica ?? ""}
                  onChange={(e) => alterar("fichaTecnica", e.target.value)}
                  placeholder="Materiais, cores, tamanhos, voltagem, composição, diferenciais e condições."
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

const ALIASES_FICHA_LIDER: Record<string, string[]> = {
  codigoInterno: ["cod interno", "referencia", "referência", "codigo produto", "código produto"],
  descricao: ["descricao do produto", "descrição do produto", "produto", "descricao", "descrição"],
  embalagemQuantidade: [
    "embl",
    "qtde na cx",
    "quantidade na caixa",
    "multiplo de compra",
    "múltiplo de compra",
  ],
  custoFornecedor: ["custo do fornecedor", "custo", "preco fornecedor", "preço fornecedor"],
  condicaoFaturamento: ["condicao de entrega", "condição de entrega", "faturamento"],
  ipiPct: ["ipi", "ipi %", "ipi percentual"],
  prazoEntregaDias: ["prazo de entrega", "prazo de entrega dias", "prazo"],
  freteTipo: ["frete", "tipo frete"],
  ean13: ["ean13", "ean 13", "codigo de barras", "código de barras"],
  dun14: ["dun14", "dun 14"],
  controlaValidade: ["controla validade", "controle validade"],
  validadeDias: ["validade em dias", "validade dias"],
  diasValidadeMinima: [
    "dias validade minima",
    "dias validade mínima",
    "validade minima recebimento",
    "validade mínima recebimento",
  ],
  ncm: ["ncm"],
  cest: ["cest"],
  caixaComprimentoCm: ["caixa comp", "caixa comprimento", "comp caixa"],
  caixaLarguraCm: ["caixa larg", "caixa largura", "larg caixa"],
  caixaAlturaCm: ["caixa alt", "caixa altura", "alt caixa"],
  caixaPesoBrutoKg: ["caixa p bruto", "caixa peso bruto", "peso bruto caixa"],
  unidadeComprimentoCm: ["unidade comp", "unidade comprimento", "comp unidade"],
  unidadeLarguraCm: ["unidade larg", "unidade largura", "larg unidade"],
  unidadeAlturaCm: ["unidade alt", "unidade altura", "alt unidade"],
  unidadePesoBrutoKg: ["unidade p bruto", "unidade peso bruto", "peso bruto unidade"],
  palletBaseCaixas: ["pallet base", "base caixas", "pallet base caixas"],
  palletAlturaCaixas: ["pallet altura", "altura caixas", "pallet altura caixas"],
  palletTotalCaixas: ["pallet em caixas", "total pallet", "pallet caixas"],
};

function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ");
}
function valorTexto(valor: unknown) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor === null || valor === undefined ? "" : String(valor).trim();
}
function valorNumero(valor: unknown) {
  const texto = valorTexto(valor).replace(/\s/g, "");
  if (!texto) return null;
  const normalizado =
    texto.includes(",") && texto.includes(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}
async function lerFichaLider(arquivo: File) {
  const livro = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
  const nomeAba = livro.SheetNames[0];
  if (!nomeAba) throw new Error("O arquivo não possui uma aba.");
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets[nomeAba]!, {
    defval: "",
  });
  if (linhas.length === 0) throw new Error("A planilha está vazia.");
  if (linhas.length > 500) throw new Error("A importação está limitada a 500 linhas.");
  const cabecalhos = new Map<string, string>();
  Object.keys(linhas[0] || {}).forEach((cabecalho) =>
    cabecalhos.set(normalizarCabecalho(cabecalho), cabecalho),
  );
  const coluna = (campo: string) =>
    (ALIASES_FICHA_LIDER[campo] || [])
      .map(normalizarCabecalho)
      .map((nome) => cabecalhos.get(nome))
      .find(Boolean);
  const valor = (linha: Record<string, unknown>, campo: string) => {
    const nome = coluna(campo);
    return nome ? linha[nome] : "";
  };
  const erros: string[] = [];
  const itens: CatalogoComercialImportInput[] = [];
  const numericos = [
    "embalagemQuantidade",
    "custoFornecedor",
    "ipiPct",
    "prazoEntregaDias",
    "validadeDias",
    "diasValidadeMinima",
    "caixaComprimentoCm",
    "caixaLarguraCm",
    "caixaAlturaCm",
    "caixaPesoBrutoKg",
    "unidadeComprimentoCm",
    "unidadeLarguraCm",
    "unidadeAlturaCm",
    "unidadePesoBrutoKg",
    "palletBaseCaixas",
    "palletAlturaCaixas",
    "palletTotalCaixas",
  ];
  linhas.forEach((linha, indice) => {
    const linhaNumero = indice + 2;
    const descricao = valorTexto(valor(linha, "descricao"));
    if (!descricao) {
      erros.push("Linha " + linhaNumero + ": descrição é obrigatória.");
      return;
    }
    const ficha: Record<string, unknown> = {};
    Object.keys(ALIASES_FICHA_LIDER).forEach((campo) => {
      const bruto = valor(linha, campo);
      ficha[campo] = numericos.includes(campo) ? valorNumero(bruto) : valorTexto(bruto) || null;
      if (numericos.includes(campo) && valorTexto(bruto) && ficha[campo] === null)
        erros.push("Linha " + linhaNumero + ": " + campo + " deve ser numérico.");
    });
    const codigo = valorTexto(ficha["codigoInterno"]);
    itens.push({
      codigoFornecedor: codigo || null,
      descricao,
      marca: null,
      categoria: null,
      subcategoria: null,
      skuReferencia: codigo || null,
      imagemUrl: null,
      fichaTecnica: "Ficha técnica Líder importada; revisão comercial pendente.",
      variacoesJson: null,
      dadosFichaLiderJson: JSON.stringify(ficha),
      precoSugerido: null,
      precoValidadeInicio: null,
      precoValidadeFim: null,
      estoqueDisponivel: null,
      prazoEntregaDias:
        typeof ficha["prazoEntregaDias"] === "number" ? ficha["prazoEntregaDias"] : null,
      pedidoMinimo: null,
      colecao: null,
      estacao: null,
      evento: null,
    });
  });
  return { itens, erros };
}
