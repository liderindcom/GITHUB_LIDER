import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  ImagePlus,
  Info,
  PackagePlus,
  Pencil,
  Search,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import {
  arquivarCatalogoComercial,
  atualizarCatalogoComercial,
  fetchCatalogoComercial,
  salvarCatalogoComercial,
  type CatalogoComercialDB,
  type CatalogoStatus,
} from "@/catalogo-api";
import { PortalLayout } from "@/components/portal-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  dadosFichaLiderJson: null,
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

const ROTULOS_STATUS: Record<CatalogoStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO_PARA_ANALISE: "Enviado para análise",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  ARQUIVADO: "Arquivado",
  PUBLICADO: "Enviado para análise",
};

const ROTULOS_FICHA: Record<string, string> = {
  codigoInterno: "Código interno",
  descricao: "Descrição do produto",
  embalagemQuantidade: "Quantidade por caixa",
  custoFornecedor: "Custo do fornecedor",
  condicaoFaturamento: "Condição de faturamento",
  ipiPct: "IPI (%)",
  prazoEntregaDias: "Prazo de entrega (dias)",
  freteTipo: "Frete",
  ean13: "EAN13",
  dun14: "DUN14",
  controlaValidade: "Controla validade",
  validadeDias: "Validade (dias)",
  diasValidadeMinima: "Validade mínima no recebimento",
  ncm: "NCM",
  cest: "CEST",
  caixaComprimentoCm: "Caixa: comprimento (cm)",
  caixaLarguraCm: "Caixa: largura (cm)",
  caixaAlturaCm: "Caixa: altura (cm)",
  caixaPesoBrutoKg: "Caixa: peso bruto (kg)",
  unidadeComprimentoCm: "Unidade: comprimento (cm)",
  unidadeLarguraCm: "Unidade: largura (cm)",
  unidadeAlturaCm: "Unidade: altura (cm)",
  unidadePesoBrutoKg: "Unidade: peso bruto (kg)",
  palletBaseCaixas: "Pallet: base (caixas)",
  palletAlturaCaixas: "Pallet: altura (caixas)",
  palletTotalCaixas: "Pallet: total de caixas",
};

const ALIASES_FICHA_LIDER: Record<string, string[]> = {
  codigoInterno: ["cod interno", "referencia", "codigo produto", "codigo"],
  descricao: ["descricao do produto", "descricao", "produto", "nome"],
  embalagemQuantidade: ["embl qtde na cx", "quantidade na caixa", "multiplo de compra"],
  custoFornecedor: ["custo do fornecedor", "custo", "preco fornecedor"],
  condicaoFaturamento: ["condicao de entrega", "faturamento"],
  ipiPct: ["ipi", "ipi percentual"],
  prazoEntregaDias: ["prazo de entrega", "prazo de entrega dias", "prazo"],
  freteTipo: ["frete", "tipo frete"],
  ean13: ["ean13", "ean 13", "codigo de barras"],
  dun14: ["dun14", "dun 14"],
  controlaValidade: ["controla validade", "controle validade"],
  validadeDias: ["validade em dias", "validade dias"],
  diasValidadeMinima: ["dias validade minima", "validade minima recebimento"],
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

const CAMPOS_NUMERICOS_FICHA = new Set([
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
]);

function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ");
}

function valorTextoFicha(valor: unknown) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function valorNumeroFicha(valor: unknown) {
  const texto = valorTextoFicha(valor).replace(/\s/g, "");
  if (!texto) return null;
  const normalizado =
    texto.includes(",") && texto.includes(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function fichaImportada(
  linha: Pick<CatalogoComercialDB, "dadosFichaLiderJson">,
): Record<string, unknown> {
  if (!linha.dadosFichaLiderJson) return {};
  try {
    const valor = JSON.parse(linha.dadosFichaLiderJson);
    return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function rotuloStatus(status: CatalogoStatus) {
  return ROTULOS_STATUS[status] || status;
}

function varianteStatus(
  status: CatalogoStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APROVADO") return "default";
  if (status === "REJEITADO") return "destructive";
  if (status === "ENVIADO_PARA_ANALISE" || status === "PUBLICADO") return "outline";
  return "secondary";
}

function valorFicha(linha: Record<string, unknown>, campo: string) {
  return Object.entries(linha).find(([chave]) =>
    (ALIASES_FICHA_LIDER[campo] || []).some(
      (nome) => normalizarCabecalho(nome) === normalizarCabecalho(chave),
    ),
  )?.[1];
}

function possuiCabecalhoFicha(linha: Record<string, unknown>) {
  return Object.keys(linha).some((chave) =>
    Object.values(ALIASES_FICHA_LIDER).some((nomes) =>
      nomes.some((nome) => normalizarCabecalho(nome) === normalizarCabecalho(chave)),
    ),
  );
}

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<CatalogoComercialDB | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | CatalogoStatus>("TODOS");
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);

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

  const limparEdicao = () => {
    setForm(vazio);
    setEditandoId(null);
  };

  const editarItem = (item: CatalogoComercialDB) => {
    setEditandoId(item.id);
    setForm({ ...item, status: "RASCUNHO" });
    window.setTimeout(() => {
      document
        .getElementById("form-catalogo")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const salvar = async (status: "RASCUNHO" | "ENVIADO_PARA_ANALISE") => {
    if (!form.descricao.trim()) {
      toast.error("Informe a descrição do produto ou coleção.");
      return;
    }
    setSalvando(true);
    try {
      const salvo = editandoId
        ? await atualizarCatalogoComercial({
            data: { id: editandoId, item: { ...form, status } },
          })
        : await salvarCatalogoComercial({ data: { ...form, status } });
      setItens((atual) =>
        editandoId ? atual.map((item) => (item.id === salvo.id ? salvo : item)) : [salvo, ...atual],
      );
      limparEdicao();
      toast.success(
        status === "ENVIADO_PARA_ANALISE"
          ? "Produto enviado ao Grupo Líder para análise."
          : editandoId
            ? "Produto atualizado no catálogo."
            : "Rascunho salvo no catálogo.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  };

  const arquivarItem = async (item: CatalogoComercialDB) => {
    if (
      !window.confirm(`Arquivar "${item.descricao}"? Ele deixará de aparecer no catálogo ativo.`)
    ) {
      return;
    }
    setArquivandoId(item.id);
    try {
      await arquivarCatalogoComercial({ data: { id: item.id } });
      setItens((atual) => atual.filter((candidato) => candidato.id !== item.id));
      if (editandoId === item.id) limparEdicao();
      toast.success("Produto arquivado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível arquivar o produto.");
    } finally {
      setArquivandoId(null);
    }
  };

  const itensFiltrados = itens.filter((item) => {
    const texto =
      `${item.descricao} ${item.codigoFornecedor ?? ""} ${item.skuReferencia ?? ""} ${item.marca ?? ""}`.toLocaleLowerCase(
        "pt-BR",
      );
    const combinaBusca = !busca.trim() || texto.includes(busca.trim().toLocaleLowerCase("pt-BR"));
    const combinaStatus = filtroStatus === "TODOS" || item.status === filtroStatus;
    return combinaBusca && combinaStatus;
  });

  const baixarModeloCatalogo = () => {
    const planilha = XLSX.utils.json_to_sheet([
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
    ]);
    const arquivo = XLSX.write(
      { Sheets: { "Ficha Produto": planilha }, SheetNames: ["Ficha Produto"] },
      { bookType: "xlsx", type: "array" },
    );
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
      if (linhas.length > 500) {
        setErrosImportacao(["A importação está limitada a 500 linhas por arquivo."]);
        return;
      }
      const fichaTecnica = possuiCabecalhoFicha(linhas[0] || {});
      const importadas: Formulario[] = [];
      const erros: string[] = [];
      linhas.forEach((linha, indice) => {
        const descricao = fichaTecnica
          ? valorTextoFicha(valorFicha(linha, "descricao"))
          : String(
              Object.entries(linha).find(([chave]) =>
                ["descricao", "descricaocomercial", "produto", "nome"].includes(
                  normalizarCabecalho(chave).replace(/ /g, ""),
                ),
              )?.[1] ?? "",
            ).trim();
        if (!descricao) {
          if (Object.values(linha).some((valor) => String(valor).trim()))
            erros.push(`Linha ${indice + 2}: descrição do produto não informada.`);
          return;
        }

        if (fichaTecnica) {
          const ficha: Record<string, unknown> = {};
          Object.keys(ALIASES_FICHA_LIDER).forEach((campo) => {
            const bruto = valorTextoFicha(valorFicha(linha, campo));
            ficha[campo] = CAMPOS_NUMERICOS_FICHA.has(campo)
              ? valorNumeroFicha(valorFicha(linha, campo))
              : bruto || null;
            if (CAMPOS_NUMERICOS_FICHA.has(campo) && bruto && ficha[campo] === null) {
              erros.push(`Linha ${indice + 2}: ${campo} deve ser numérico.`);
            }
          });
          const codigo = String(ficha.codigoInterno || "").trim();
          importadas.push({
            ...vazio,
            codigoFornecedor: codigo,
            descricao,
            skuReferencia: codigo,
            fichaTecnica: "Ficha técnica Líder importada; revisão comercial pendente.",
            dadosFichaLiderJson: JSON.stringify(ficha),
            prazoEntregaDias:
              typeof ficha.prazoEntregaDias === "number" ? ficha.prazoEntregaDias : null,
          });
          return;
        }

        const normalizarLegado = (valor: unknown) =>
          String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
        const acharLegado = (nomes: string[]) =>
          Object.entries(linha).find(([chave]) => nomes.includes(normalizarLegado(chave)))?.[1];
        const textoLegado = (nomes: string[]) => String(acharLegado(nomes) ?? "").trim();
        const numeroLegado = (nomes: string[]) => {
          const bruto = textoLegado(nomes).replace(/[^0-9,.-]/g, "");
          if (!bruto) return null;
          const valor = Number(
            bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto,
          );
          return Number.isFinite(valor) ? valor : null;
        };
        importadas.push({
          ...vazio,
          codigoFornecedor: textoLegado(["codigo", "codigofornecedor", "referenciafornecedor"]),
          descricao,
          marca: textoLegado(["marca"]),
          categoria: textoLegado(["categoria"]),
          subcategoria: textoLegado(["subcategoria"]),
          skuReferencia: textoLegado(["sku", "skurms", "skureferencia"]),
          imagemUrl: textoLegado(["imagem", "imagemurl", "urlimagem"]),
          fichaTecnica: textoLegado(["fichatecnica", "informacoescomerciais"]),
          variacoesJson: textoLegado(["variacoes", "variacoesjson"]),
          precoSugerido: numeroLegado(["preco", "precosugerido", "valorsugerido"]),
          precoValidadeInicio: textoLegado(["iniciovalidade", "iniciovalidadepreco"]),
          precoValidadeFim: textoLegado(["fimvalidade", "fimvalidadepreco"]),
          estoqueDisponivel: numeroLegado(["estoque", "estoquedisponivel"]),
          prazoEntregaDias: numeroLegado(["prazo", "prazoentrega", "prazoentregadias"]),
          pedidoMinimo: numeroLegado(["pedidominimo", "quantidademinima"]),
          colecao: textoLegado(["colecao", "linha"]),
          estacao: textoLegado(["estacao"]),
          evento: textoLegado(["evento", "oportunidade"]),
        });
      });
      setLinhasImportadas(importadas);
      setErrosImportacao(
        linhas.length === 0
          ? [
              "O arquivo foi lido, mas ainda não há produtos preenchidos. Preencha pelo menos a coluna Descrição do Produto e selecione a planilha novamente.",
            ]
          : importadas.length === 0 && erros.length === 0
            ? [
                "A planilha foi lida, mas nenhuma linha foi reconhecida. Use o modelo da ficha técnica e mantenha a coluna Descrição do Produto.",
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
      const payloadUpload = {
        originalName: arquivoSelecionado.name,
        mimeType,
        bytesBase64: await arquivoParaBase64(arquivoSelecionado),
      };
      const respostaUpload = await fetch("/api/cerberus/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payloadUpload),
      });
      const resultadoUpload = (await respostaUpload.json().catch(() => ({}))) as {
        error?: unknown;
        uploadId?: string;
        internalName?: string;
        sha256?: string;
      };
      if (!respostaUpload.ok) {
        if (respostaUpload.status === 404) {
          throw new Error("O recebimento seguro ainda não está habilitado neste ambiente.");
        }
        const mensagemServidor =
          typeof resultadoUpload.error === "string" ? resultadoUpload.error.trim() : "";
        const mensagemSegura =
          /^(Sessão|Sensor|Heartbeat|Tipo de arquivo|MIME|Nome de arquivo|Arquivo|Conteúdo|Campos obrigatórios|JSON inválido|Corpo inválido|A planilha|Nenhuma linha|Linha \d+|Fornecedor|Permissão|Produto duplicado)/.test(
            mensagemServidor,
          );
        if (mensagemSegura) throw new Error(mensagemServidor);
        throw new Error(
          "Não foi possível receber a planilha neste momento. Tente novamente em alguns minutos. Nenhum dado foi enviado.",
        );
      }
      if (!resultadoUpload.uploadId || !resultadoUpload.internalName || !resultadoUpload.sha256) {
        throw new Error("O recebimento seguro não devolveu um recibo válido.");
      }
      const respostaCerberus = await fetch("/api/cerberus/catalogo-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          uploadId: resultadoUpload.uploadId,
          internalName: resultadoUpload.internalName,
          sha256: resultadoUpload.sha256,
          fornecedorCodigo: codigoFornecedorAtivo,
        }),
      });
      const resultadoCerberus = (await respostaCerberus.json().catch(() => ({}))) as {
        error?: unknown;
        itens?: CatalogoComercialDB[];
      };
      if (!respostaCerberus.ok) {
        const mensagemServidor = typeof resultadoCerberus.error === "string" ? resultadoCerberus.error.trim() : "";
        throw new Error(mensagemServidor || "A importação segura foi recusada.");
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
          <Card id="form-catalogo" className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="size-5 text-primary" />
                {editandoId ? "Editar produto do catálogo" : "Novo produto ou coleção"}
              </CardTitle>
              <CardDescription>
                {editandoId
                  ? "Atualize os dados e salve como rascunho ou reenvie para análise."
                  : "Quanto mais completo o catálogo, melhor o comprador poderá avaliar a oportunidade."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {editandoId && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <span>
                    Você está editando um item existente. A edição volta o produto para revisão do
                    fornecedor.
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={limparEdicao}>
                    <X className="size-4" /> Cancelar
                  </Button>
                </div>
              )}
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
                <Button onClick={() => void salvar("ENVIADO_PARA_ANALISE")} disabled={salvando}>
                  <Send className="mr-2 size-4" />
                  Enviar para análise
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
              <FileSpreadsheet className="size-5 text-primary" /> Enviar ficha técnica por planilha
            </CardTitle>
            <CardDescription>
              Envie vários produtos de uma vez usando os campos de cadastro técnico do Líder. O
              arquivo será conferido e ficará como rascunho para revisão; ele não publica produtos
              nem gera pedido automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm md:grid-cols-3">
              <div className="flex gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">1. Prepare:</strong> baixe o modelo da ficha e
                  preencha a coluna Descrição do Produto.
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
              <strong className="text-foreground">Descrição do Produto</strong>. Código, embalagem,
              custo, IPI, prazo, frete, EAN, DUN, validade, NCM, CEST e dimensões ficam registrados
              na ficha técnica. Para começar, use o modelo abaixo.
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
                <Download className="mr-2 size-4" /> Baixar modelo da ficha técnica
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
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-left">EAN</th>
                        <th className="p-2 text-right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasImportadas.map((linha, indice) => {
                        const ficha = fichaImportada(linha);
                        return (
                          <tr key={`${linha.descricao}-${indice}`} className="border-t">
                            <td className="p-2 font-mono">{linha.codigoFornecedor || "—"}</td>
                            <td className="p-2">{linha.descricao}</td>
                            <td className="p-2">{String(ficha.ean13 || "—")}</td>
                            <td className="p-2 text-right">
                              {typeof ficha.custoFornecedor === "number"
                                ? ficha.custoFornecedor.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
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
            <CardTitle>Meu catálogo</CardTitle>
            <CardDescription>
              {fornecedor.nome} ·{" "}
              {carregando
                ? "carregando..."
                : `${itensFiltrados.length} de ${itens.length} registro(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por produto, código, SKU ou marca"
                  className="pl-9"
                />
              </div>
              <select
                value={filtroStatus}
                onChange={(event) =>
                  setFiltroStatus(event.target.value as "TODOS" | CatalogoStatus)
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Filtrar por status"
              >
                <option value="TODOS">Todos os status</option>
                <option value="RASCUNHO">Rascunhos</option>
                <option value="ENVIADO_PARA_ANALISE">Enviados para análise</option>
                <option value="APROVADO">Aprovados</option>
                <option value="REJEITADO">Rejeitados</option>
              </select>
            </div>

            {itens.length === 0 && !carregando ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Seu catálogo ainda está vazio. Importe uma ficha técnica ou cadastre um produto.
              </p>
            ) : itensFiltrados.length === 0 && !carregando ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum produto corresponde aos filtros atuais.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {itensFiltrados.map((item) => {
                  const ficha = fichaImportada(item);
                  return (
                    <div key={item.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold" title={item.descricao}>
                            {item.descricao}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[item.marca, item.categoria, item.colecao]
                              .filter(Boolean)
                              .join(" · ") || "Sem classificação informada"}
                          </p>
                        </div>
                        <Badge variant={varianteStatus(item.status)}>
                          {rotuloStatus(item.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Código: {item.codigoFornecedor || "—"}</span>
                        <span>EAN: {String(ficha.ean13 || "—")}</span>
                        <span>
                          Atualizado: {new Date(item.atualizadoEm).toLocaleDateString("pt-BR")}
                        </span>
                        <span>
                          {item.prazoEntregaDias ? `${item.prazoEntregaDias} dias` : "Prazo —"}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                        {item.fichaTecnica || "Sem ficha técnica informada."}
                      </p>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDetalhes(item)}
                        >
                          <Eye className="size-4" /> Ver ficha
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editarItem(item)}
                        >
                          <Pencil className="size-4" /> Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={arquivandoId === item.id}
                          onClick={() => void arquivarItem(item)}
                        >
                          <Archive className="size-4" /> Arquivar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(detalhes)} onOpenChange={(aberto) => !aberto && setDetalhes(null)}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            {detalhes && (
              <>
                <DialogHeader>
                  <DialogTitle>{detalhes.descricao}</DialogTitle>
                  <DialogDescription>
                    Código {detalhes.codigoFornecedor || "não informado"} · atualizado em{" "}
                    {new Date(detalhes.atualizadoEm).toLocaleString("pt-BR")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={varianteStatus(detalhes.status)}>
                    {rotuloStatus(detalhes.status)}
                  </Badge>
                  {detalhes.marca && <Badge variant="outline">{detalhes.marca}</Badge>}
                  {detalhes.categoria && <Badge variant="outline">{detalhes.categoria}</Badge>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["SKU/referência", detalhes.skuReferencia],
                    [
                      "Prazo de entrega",
                      detalhes.prazoEntregaDias ? `${detalhes.prazoEntregaDias} dias` : null,
                    ],
                    ["Preço sugerido", detalhes.precoSugerido],
                    ["Pedido mínimo", detalhes.pedidoMinimo],
                    ["Estoque disponível", detalhes.estoqueDisponivel],
                    ["Coleção", detalhes.colecao],
                  ].map(([label, valor]) => (
                    <div key={String(label)} className="rounded-lg border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium">
                        {valor === null || valor === "" ? "—" : String(valor)}
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Ficha técnica importada</h3>
                  {Object.entries(fichaImportada(detalhes)).filter(
                    ([, valor]) => valor !== null && valor !== "",
                  ).length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(fichaImportada(detalhes))
                        .filter(([, valor]) => valor !== null && valor !== "")
                        .map(([campo, valor]) => (
                          <div key={campo} className="rounded-lg bg-muted/50 p-2 text-sm">
                            <span className="text-xs text-muted-foreground">
                              {ROTULOS_FICHA[campo] || campo}
                            </span>
                            <p className="font-medium">{String(valor)}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                      Nenhuma ficha técnica estruturada foi importada.
                    </p>
                  )}
                </div>
                {detalhes.fichaTecnica && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Observações</h3>
                    <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                      {detalhes.fichaTecnica}
                    </p>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
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
