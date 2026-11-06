import type { CatalogoComercialDB, CatalogoStatus } from "@/catalogo-api";

export type Formulario = Omit<
  CatalogoComercialDB,
  "id" | "fornecedorCodigo" | "status" | "criadoEm" | "atualizadoEm" | "publicadoEm"
> &
  Pick<CatalogoComercialDB, "status">;

export const vazio: Formulario = {
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

export const MIME_POR_EXTENSAO: Record<string, string> = {
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const MAX_PLANILHA_BYTES = 10 * 1024 * 1024;

export const ROTULOS_STATUS: Record<CatalogoStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO_PARA_ANALISE: "Enviado para análise",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  ARQUIVADO: "Arquivado",
  PUBLICADO: "Enviado para análise",
};

export const ROTULOS_FICHA: Record<string, string> = {
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

export const ALIASES_FICHA_LIDER: Record<string, string[]> = {
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

export const CAMPOS_NUMERICOS_FICHA = new Set([
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

export function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ");
}

export function valorTextoFicha(valor: unknown) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

export function valorNumeroFicha(valor: unknown) {
  const texto = valorTextoFicha(valor).replace(/\s/g, "");
  if (!texto) return null;
  const normalizado =
    texto.includes(",") && texto.includes(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function fichaImportada(
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

export function rotuloStatus(status: CatalogoStatus) {
  return ROTULOS_STATUS[status] || status;
}

export function varianteStatus(
  status: CatalogoStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APROVADO") return "default";
  if (status === "REJEITADO") return "destructive";
  if (status === "ENVIADO_PARA_ANALISE" || status === "PUBLICADO") return "outline";
  return "secondary";
}

export function valorFicha(linha: Record<string, unknown>, campo: string) {
  return Object.entries(linha).find(([chave]) =>
    (ALIASES_FICHA_LIDER[campo] || []).some(
      (nome) => normalizarCabecalho(nome) === normalizarCabecalho(chave),
    ),
  )?.[1];
}

export function possuiCabecalhoFicha(linha: Record<string, unknown>) {
  return Object.keys(linha).some((chave) =>
    Object.values(ALIASES_FICHA_LIDER).some((nomes) =>
      nomes.some((nome) => normalizarCabecalho(nome) === normalizarCabecalho(chave)),
    ),
  );
}

export async function arquivoParaBase64(arquivo: File): Promise<string> {
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
