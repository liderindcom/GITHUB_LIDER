import { addDays, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { lojaForaDoPortalFornecedor } from "@/lib/lojas-excluidas-portal";
import {
  DEMO_FORNECEDOR_CODIGO,
  normalizarCodigoFornecedor,
  soDigitos,
} from "@/lib/fornecedor-codigo";
import {
  getFiltroMercadologico,
  produtoPassaFiltro,
  rotuloComprador,
  rotuloDepartamento,
  rotuloGrupo,
  rotuloSecao,
  rotuloSubgrupo,
} from "@/lib/filtro-mercadologico";
import type { Pedido, VendaItem } from "./mock-data-orders";
import type { ContaReceberFornecedor, EstoqueLinha, Fatura, Perda } from "./mock-data-inventory";

export { DEMO_FORNECEDOR_CODIGO, normalizarCodigoFornecedor };

export { lojaForaDoPortalFornecedor };

/**
 * Cadastro comercial/financeiro do fornecedor junto ao Grupo Líder.
 * Fonte candidata: RM/RMS (condição de pagamento e desconto financeiro negociados).
 */
export type TipoPrazoPagamento = "DDE" | "DDR";

export type CadastroFinanceiro = {
  /** Prazo em dias. Base: DDE = emissão da NF; DDR = recebimento. */
  prazoPagamentoDias: number;
  prazoTipo?: TipoPrazoPagamento | null;
  /**
   * Desconto financeiro contratual (% sobre o valor da nota).
   * 0 = não há desconto financeiro no cadastro.
   */
  descontoFinanceiroPct: number;
  /**
   * Se preenchido, o desconto financeiro só se aplica quando o pagamento
   * ocorrer até este número de dias da emissão (ex.: 2% 10 ddl).
   * null = desconto aplicado na liquidação conforme condição cadastrada.
   */
  descontoFinanceiroAteDias: number | null;
  condicaoPagamentoLabel: string;
  anticipationEnabled: boolean;
};

/**
 * Modelo de entrega do fornecedor no Grupo Líder (Nestlé e similares).
 * Evidência RMS (VW03_NFEENTRADA + AA2CTIPO): entrega física no depósito/CD,
 * não nas lojas. Abastecimento loja = transferência interna (agendas 65/66/148).
 */
export type ModeloEntregaFornecedor = "somente_cdam" | "loja" | "loja_direta" | "misto";

export const rotuloModeloEntrega = (modelo?: string | null) => {
  if (modelo === "somente_cdam") return "Somente CDAM/depósito";
  if (modelo === "loja" || modelo === "loja_direta") return "Somente loja";
  if (modelo === "misto") return "Misto (loja e CDAM)";
  return modelo || "Sem evidência de NF";
};

export type VendaMensal = {
  mes: string;
  faturamento: number;
  volume: number;
};

export type FornecedorType = {
  codigo: string;
  nome: string;
  cnpj: string;
  cnpjSenhaInicial: string;
  destinatario: string;
  modeloEntrega: ModeloEntregaFornecedor;
  agendaRecebimentoCdam: number | null;
  filialEntregaPadrao: string;
  fornecedorComercialCodigo?: string | null;
  fornecedorComercialNome?: string | null;
  cadastroFinanceiro: CadastroFinanceiro;
  isentoCobranca?: number;
  acessoStatus?: string | null;
  acessoDataInicio?: string | null;
  acessoDataFim?: string | null;
};

export const fornecedores: FornecedorType[] = [
  {
    codigo: "4050",
    nome: "Nestlé Brasil S/A",
    cnpj: "60.409.075/0001-52",
    cnpjSenhaInicial: "60409075000152",
    destinatario: "Grupo Líder",
    modeloEntrega: "somente_cdam" as ModeloEntregaFornecedor,
    agendaRecebimentoCdam: 28,
    filialEntregaPadrao: "201",
    cadastroFinanceiro: {
      prazoPagamentoDias: 28,
      prazoTipo: "DDE",
      descontoFinanceiroPct: 1.5,
      descontoFinanceiroAteDias: null,
      condicaoPagamentoLabel: "28 ddl · desconto financeiro 1,5%",
      anticipationEnabled: true,
    },
  },
  {
    codigo: "704894",
    nome: "BTD DISTRIBUIDORA E COMERCIO LTDA",
    cnpj: "05.123.456/0001-99",
    cnpjSenhaInicial: "05123456000199",
    destinatario: "Grupo Líder",
    modeloEntrega: "somente_cdam" as ModeloEntregaFornecedor,
    agendaRecebimentoCdam: 520,
    filialEntregaPadrao: "201",
    cadastroFinanceiro: {
      prazoPagamentoDias: 30,
      prazoTipo: "DDE",
      descontoFinanceiroPct: 2.0,
      descontoFinanceiroAteDias: null,
      condicaoPagamentoLabel: "30 ddl · desconto financeiro 2,0%",
      anticipationEnabled: true,
    },
  },
  {
    codigo: "25167",
    nome: "BTM DIST DE ALIMENTOS LTDA",
    cnpj: "31.709.365/0001-13",
    cnpjSenhaInicial: "31709365000113",
    destinatario: "Grupo Líder",
    modeloEntrega: "somente_cdam" as ModeloEntregaFornecedor,
    agendaRecebimentoCdam: 35,
    filialEntregaPadrao: "201",
    cadastroFinanceiro: {
      prazoPagamentoDias: 35,
      prazoTipo: "DDE",
      descontoFinanceiroPct: 0.0,
      descontoFinanceiroAteDias: null,
      condicaoPagamentoLabel: "35 ddl",
      anticipationEnabled: true,
    },
  },
  {
    codigo: "13003",
    nome: "LATICINIOS TIROLEZ LTDA",
    cnpj: "55.885.321/0011-84",
    cnpjSenhaInicial: "55885321001184",
    destinatario: "Grupo Líder",
    modeloEntrega: "somente_cdam" as ModeloEntregaFornecedor,
    agendaRecebimentoCdam: null,
    filialEntregaPadrao: "2011",
    cadastroFinanceiro: {
      prazoPagamentoDias: 30,
      prazoTipo: "DDE",
      descontoFinanceiroPct: 3.0,
      descontoFinanceiroAteDias: null,
      condicaoPagamentoLabel: "DDE 1P 30 DIAS C/3% DESC FC",
      anticipationEnabled: true,
    },
  },
];

export const getActiveSupplierCode = (): string => {
  if (typeof window === "undefined") return DEMO_FORNECEDOR_CODIGO;
  // Preserva o código fiscal completo quando ele foi informado com dígito
  // (ex.: 10686-0 => 106860). Normalizá-lo aqui mistura fornecedores cujo
  // código-base também existe no RMS.
  return soDigitos(
    window.sessionStorage.getItem("portal-lider-sessao-fornecedor") || DEMO_FORNECEDOR_CODIGO,
  );
};

export const setActiveSupplierCode = (code: string) => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("portal-lider-sessao-fornecedor", soDigitos(code));
  }
};

export type ProdutoBloqueioDB = {
  sku: string;
  lojaId: string;
  bloqueio: number;
};

export const globalDbCache: {
  fornecedor: FornecedorType | null;
  produtos: Produto[] | null;
  vendas: VendaItem[] | null;
  perdas: Perda[] | null;
  estoque: EstoqueLinha[] | null;
  vendasMensais: VendaMensal[] | null;
  bloqueios: ProdutoBloqueioDB[] | null;
  pedidos: Pedido[] | null;
  faturas: Fatura[] | null;
  contasReceber: ContaReceberFornecedor[] | null;
  nfePendentes: Array<{
    id: string;
    numeroNota: string;
    chaveNfe: string;
    lojaId: string;
    destTipo: string;
    situacaoDescricao: string;
    agendaPrevisao?: string;
    status: string;
    fornecedorCodigo: string;
  }> | null;
  docas: Array<{
    lojaId: string;
    doca: string;
    tipo: string;
    horaInicio: string;
    horaFim: string;
    diasUteis?: string;
  }> | null;
  conciliacao: Array<{
    id: string;
    fornecedorCodigo: string;
    numeroNota: string;
    chaveNfe: string;
    pedido: string;
    sku: string;
    descricaoXml: string;
    quantidadeXml: number;
    quantidadePedida: number;
    precoXml: number;
    precoPedido: number;
    divergenciaPreco: number;
    divergenciaQuantidade: number;
    itemDesacordo: number;
  }> | null;
  transferenciasCdam: Array<{
    sku: string;
    lojaId: string;
    data: string;
    quantidade: number;
  }> | null;
} = {
  fornecedor: null,
  produtos: null,
  vendas: null,
  perdas: null,
  estoque: null,
  vendasMensais: null,
  bloqueios: null,
  pedidos: null,
  faturas: null,
  contasReceber: null,
  nfePendentes: null,
  docas: null,
  conciliacao: null,
  transferenciasCdam: null,
};

export const fornecedor = new Proxy({} as FornecedorType, {
  get(target, prop) {
    if (globalDbCache.fornecedor) {
      return Reflect.get(globalDbCache.fornecedor, prop);
    }
    const code = getActiveSupplierCode();
    const active =
      fornecedores.find((f) => f.codigo === code) || fornecedores[0] || ({} as FornecedorType);
    return Reflect.get(active, prop);
  },
}) as unknown as FornecedorType;

export type Loja = {
  /** Numero da loja (vendas no cache). */
  id: string;
  /** GET_COD_LOCAL = numero*10+DV (estoque, bloqueio, perda). */
  idLocal: string;
  nome: string;
  /** L = loja, D = depósito/CD (AA2CTIPO.TIP_LOJ_CLI). */
  tipo?: "L" | "D";
};

/** Nomes oficiais InteLider listUsuarioFilial 2026-08-17. id=numero; idLocal=GET_COD_LOCAL. */
const lojasOficiais: Array<[string, string, string, "L" | "D"]> = [
  ["1", "19", "L01 LIDER CONDOR", "L"],
  ["2", "27", "L02 LIDER ALCINDO CACELA", "L"],
  ["3", "35", "L03 LIDER DOCA", "L"],
  ["4", "43", "L04 LIDER OBIDOS", "L"],
  ["5", "51", "L05 LIDER CASTANHEIRA", "L"],
  ["6", "60", "L06 MAG CASTANHEIRA", "L"],
  ["7", "78", "L07 LIDER PCA BRASIL", "L"],
  ["8", "86", "L08 LIDER BATISTA CAMPOS", "L"],
  ["9", "94", "L09 LIDER HUMAITA", "L"],
  ["10", "108", "L10 LIDER CASTANHAL", "L"],
  ["11", "116", "L11 LIDER ICOARACI", "L"],
  ["12", "124", "L12 LIDER BR", "L"],
  ["15", "159", "L15 LIDER MATRIZ", "L"],
  ["17", "175", "L17 LIDER CANUDOS", "L"],
  ["18", "183", "L18 LIDER C.NOVA", "L"],
  ["19", "191", "L19 MAG CASTANHAL", "L"],
  ["21", "213", "L21 - ARMAZEM LIDER", "L"],
  ["22", "221", "L22 CAFE LIDER", "L"],
  ["24", "248", "L24 LIDER QUINTINO", "L"],
  ["27", "272", "L27 LIDER PEDREIRA", "L"],
  ["28", "280", "L28 LIDER INDEPENDENCIA", "L"],
  ["31", "310", "L31 LIDER BARCARENA", "L"],
  ["32", "329", "L32 LIDER MARABA", "L"],
  ["33", "337", "L33 LIDER AUGUSTO MONTENEGRO", "L"],
  ["34", "345", "L34 LIDER PORTO", "L"],
  ["35", "353", "PANIFICADORA LIDER", "L"],
  ["36", "361", "L36 LIDER PARAGOMINAS", "L"],
  ["37", "370", "L37 LIDER CAPANEMA", "L"],
  ["38", "388", "L38 LIDER ABAETETUBA", "L"],
  ["40", "400", "L40 LIDER MARAMBAIA", "L"],
  ["41", "418", "L41 MAGAZAN CASA", "L"],
  ["42", "426", "L42 LIDER SALINOPOLIS", "L"],
  ["43", "434", "L43 - OTICA LIDER", "L"],
  ["44", "442", "L44 LIDER GUAMA", "L"],
  ["47", "477", "L47 LIDER 14 DE MARCO", "L"],
  ["48", "485", "L48 LIDER SAO FRANCISCO", "L"],
  ["50", "507", "L50 LIDER ESTRELA", "L"],
  ["54", "540", "L54 LIDER DUQUE", "L"],
  ["55", "558", "L55 LIDER MOSQUEIRO", "L"],
  ["29", "291", "L29 FAZENDA TRES MARIAS I", "L"],
  ["30", "308", "L30 FAZENDA TRES MARIAS II", "L"],
  ["39", "399", "L39 CLINICA LIDER", "L"],
  ["200", "2003", "MANUTENCAO LIDER", "D"],
  ["205", "2050", "LIDER CIDADE NOVA", "D"],
  ["210", "2100", "CD ARAGUAINA", "D"],
  ["201", "2011", "L201-DEPOSITO AUG.MONTENEGRO", "D"],
  ["203", "2038", "L203-CENTRO DISTRIBUICAO FARMALIDER", "D"],
];

export const lojas: Loja[] = lojasOficiais.map(([id, idLocal, nome, tipo]) => ({
  id,
  idLocal,
  nome,
  tipo,
}));

const lojaPorNumero = new Map<string, Loja>();
const lojaPorLocal = new Map<string, Loja>();
for (const loja of lojas) {
  lojaPorNumero.set(loja.id, loja);
  lojaPorNumero.set(loja.id.padStart(2, "0"), loja);
  lojaPorLocal.set(loja.idLocal, loja);
}

const normalizarIdLoja = (id: string) =>
  String(id ?? "")
    .trim()
    .replace(/^0+(?=\d)/, "");

export const lojaPorCodigo = (
  id: string,
  modo: "numero" | "local" = "numero",
): Loja | undefined => {
  const cru = String(id ?? "").trim();
  const normal = normalizarIdLoja(cru);
  if (modo === "local") return lojaPorLocal.get(cru) ?? lojaPorLocal.get(normal);
  return lojaPorNumero.get(cru) ?? lojaPorNumero.get(normal);
};

export const normalizarParaFilial = (id: string): string => {
  const cru = String(id ?? "").trim();
  const normal = cru.replace(/^0+(?=\d)/, "");
  const loja =
    lojaPorLocal.get(cru) ||
    lojaPorLocal.get(normal) ||
    lojaPorNumero.get(cru) ||
    lojaPorNumero.get(normal);
  return loja ? loja.id : normal;
};

/** Nome oficial. Numero (vendas) ou GET_COD_LOCAL (estoque/perda). 3+ digitos = local. */
export const nomeLoja = (id: string): string => {
  const cru = String(id ?? "").trim();
  if (!cru) return cru;
  const normal = normalizarIdLoja(cru);
  if (cru.length >= 3) {
    return lojaPorLocal.get(cru)?.nome ?? lojaPorNumero.get(normal)?.nome ?? `Loja ${cru}`;
  }
  return lojaPorNumero.get(cru)?.nome ?? lojaPorNumero.get(normal)?.nome ?? `Loja ${cru}`;
};

export const nomeLojaPorLocal = (id: string): string =>
  lojaPorCodigo(id, "local")?.nome ?? nomeLoja(id);

export const mesmoCodigoLoja = (a: string, b: string): boolean => {
  if (normalizarIdLoja(a) === normalizarIdLoja(b)) return true;
  const lojaA = lojaPorCodigo(a) ?? lojaPorCodigo(a, "local");
  const lojaB = lojaPorCodigo(b) ?? lojaPorCodigo(b, "local");
  if (lojaA && lojaB) return lojaA.id === lojaB.id;
  return false;
};

/** Agendas RMS relevantes ao portal do fornecedor (mapa + evidência empírica). */
export const agendasRms = {
  /** Venda varejo PDV — Líder → consumidor final. NÃO é fluxo do fornecedor. */
  vendaVarejo: 102,
  /** Venda atacado — Líder → cliente atacado. NÃO é fluxo do fornecedor. */
  vendaAtacado: 101,
  /**
   * Recebimento de NF-e do fornecedor no depósito (Nestlé → CDAM).
   * Evidência: VW03_NFEENTRADA Nestlé agenda 28 → ~98% dest. tipo D (depósito 201).
   */
  recebimentoFornecedorCdam: 28,
  /**
   * Também aparece em entradas Nestlé (volume alto), inclusive em CNPJ de loja.
   * NÃO usar sozinha para “nota de loja” no portal Nestlé: pode misturar contextos.
   * Cadastro AA1CTCON trata 2 em paridade com devoluções — exige regra de filtro.
   */
  entradaNfGenericaOuDev: 2,
  /** Transferência saída intercompany (CD → loja). Não é NF do fornecedor. */
  transferenciaSaida: 65,
  /** Transferência entrada. Não é NF do fornecedor. */
  transferenciaEntrada: 66,
  /** Trânsito de transferência. Não é NF do fornecedor. */
  transferenciaTransito: 148,
  /** Devolução para fornecedor. */
  devolucaoFornecedor: 8,
} as const;

export type Produto = {
  sku: string;
  codigoProdutoRms: string;
  digitoProdutoRms: string;
  descricao: string;
  categoria: string;
  departamentoCodigo: string;
  departamento: string;
  secaoCodigo: string;
  secao: string;
  grupoCodigo: string;
  grupo: string;
  subgrupoCodigo: string;
  subgrupo: string;
  familia: string;
  papelMercadologico: "Destino" | "Rotina" | "Conveniência" | "Sazonal";
  precoTabela: number;
  /** Custo unitario do sistema (AA3CITEM.GIT_CUS_MED). Nao se calcula. */
  cmvUnit: number;
  precoMinSubgrupo?: number;
  precoMaxSubgrupo?: number;
  fornecedorCodigo?: string;
  compradorCodigo?: string;
  compradorNome?: string;
  embalagemCompra?: number;
  tipoEmbalagemCompra?: string;
  linha?: string | null;
  ean?: string | null;
  referencia?: string | null;
  descricaoMarketing?: string | null;
  datSaiLin?: string | null;
  emLinha?: number | null;
  precoFaixa2?: number | null;
  precoFaixa3?: number | null;
  precoOferta?: number | null;
  ofertaInicio?: string | null;
  ofertaFim?: string | null;
  ofertaVigente?: number | null;
  qtdAtacado?: number | null;
  marca?: string | null;
  fornecedorComercialCodigo?: string | null;
  fornecedorComercialNome?: string | null;
  /** Classe ABCD composta normal (valor + volume no subgrupo), ex.: Aa, Bc. */
  classeComposta?: string | null;
  /** Classe usada para Top Star: valor no subgrupo + quantidade no grupo. */
  classeTopStar?: string | null;
  sistematica?: string | null;
};

export { formatarClasseComposta } from "@/lib/classe-abcd";

/** Material de uso/consumo interno: não vai a gôndola e não gera sell-out. */
export function produtoUsoConsumo(produto: {
  departamentoCodigo?: string | null;
  departamento?: string | null;
  secaoCodigo?: string | null;
  secao?: string | null;
  grupo?: string | null;
  subgrupo?: string | null;
  categoria?: string | null;
}): boolean {
  const secaoCod = String(produto.secaoCodigo ?? "").replace(/^0+/, "");
  const deptoCod = String(produto.departamentoCodigo ?? "").replace(/^0+/, "");
  if (secaoCod === "98") return true;
  if (deptoCod === "650") return true;
  const texto = [
    produto.departamento,
    produto.secao,
    produto.grupo,
    produto.subgrupo,
    produto.categoria,
  ]
    .join(" ")
    .toUpperCase();
  return /USO E CONSUMO|EXPEDIENTE E CONSUMO|CONSUMO INTERNO/.test(texto);
}

export const marcaProduto = (produto: { marca?: string | null; descricao?: string }) => {
  const marca = produto.marca?.trim();
  return marca || "Marca não informada";
};

export const referenciaComercial = (produto: {
  referencia?: string | null;
  familia?: string;
  categoria?: string;
}) => {
  const referencia = produto.referencia?.trim();
  if (referencia) return referencia;
  return produto.familia
    ? `${produto.familia} · ${produto.categoria ?? ""}`.trim()
    : (produto.categoria ?? "");
};

export const descricaoComercial = (produto: {
  descricaoMarketing?: string | null;
  descricao: string;
}) => {
  const marketing = produto.descricaoMarketing?.trim();
  return marketing || produto.descricao;
};

export const all_produtos: Produto[] = [
  {
    sku: "10010",
    codigoProdutoRms: "1314520",
    digitoProdutoRms: "1",
    descricao: "Nescau Chocolate Pó 400g",
    categoria: "Achocolatados",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "13",
    secao: "Mercearia Doce",
    grupoCodigo: "1",
    grupo: "Achocolatados",
    subgrupoCodigo: "1",
    subgrupo: "Achocolatado em pó",
    familia: "Café da manhã",
    papelMercadologico: "Destino",
    precoTabela: 12.9,
    cmvUnit: 9.1,
    compradorCodigo: "13",
    compradorNome: "Comprador Mercearia Doce",
    embalagemCompra: 12,
    tipoEmbalagemCompra: "CX",
  },
  {
    sku: "10020",
    codigoProdutoRms: "1141500",
    digitoProdutoRms: "3",
    descricao: "Leite Condensado Moça Lata 395g",
    categoria: "Leites",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "6",
    secao: "Mercearia Doce",
    grupoCodigo: "6",
    grupo: "Leites culinários",
    subgrupoCodigo: "2",
    subgrupo: "Leite condensado",
    familia: "Sobremesas",
    papelMercadologico: "Rotina",
    precoTabela: 8.49,
    cmvUnit: 6.35,
    compradorCodigo: "13",
    compradorNome: "Comprador Mercearia Doce",
    embalagemCompra: 24,
    tipoEmbalagemCompra: "CX",
  },
  {
    sku: "10030",
    codigoProdutoRms: "3461877",
    digitoProdutoRms: "5",
    descricao: "Biscoito Passatempo Recheado Chocolate 130g",
    categoria: "Biscoitos",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "4",
    secao: "Biscoitos e snacks",
    grupoCodigo: "10",
    grupo: "Biscoitos recheados",
    subgrupoCodigo: "1",
    subgrupo: "Chocolate",
    familia: "Lanche infantil",
    papelMercadologico: "Conveniência",
    precoTabela: 4.29,
    cmvUnit: 3.2,
    compradorCodigo: "4",
    compradorNome: "Comprador Biscoitos",
    embalagemCompra: 30,
    tipoEmbalagemCompra: "PCT",
  },
  {
    sku: "4244",
    codigoProdutoRms: "4244",
    digitoProdutoRms: "0",
    descricao: "BTD ITEM COD 4244 - Azeite Extravirgem 500ml",
    categoria: "Azeites",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "8",
    secao: "Mercearia Salgada",
    grupoCodigo: "3",
    grupo: "Óleos e Azeites",
    subgrupoCodigo: "1",
    subgrupo: "Azeite de Oliva",
    familia: "Temperos",
    papelMercadologico: "Destino",
    precoTabela: 25.54,
    cmvUnit: 18.2,
    fornecedorCodigo: "704894",
    compradorCodigo: "32",
    compradorNome: "ORIMAR RODRIGUES",
    embalagemCompra: 12,
    tipoEmbalagemCompra: "CX",
  },
  {
    sku: "3213",
    codigoProdutoRms: "3213",
    digitoProdutoRms: "2",
    descricao: "BTD ITEM COD 3213 - Arroz Parboilizado T1 5kg",
    categoria: "Arroz",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "12",
    secao: "Mercearia Salgada",
    grupoCodigo: "1",
    grupo: "Cereais",
    subgrupoCodigo: "1",
    subgrupo: "Arroz",
    familia: "Alimentação Básica",
    papelMercadologico: "Destino",
    precoTabela: 31.93,
    cmvUnit: 22.8,
    fornecedorCodigo: "704894",
    compradorCodigo: "49",
    compradorNome: "IZABEL GOMES",
    embalagemCompra: 6,
    tipoEmbalagemCompra: "PCT",
  },
  {
    sku: "37",
    codigoProdutoRms: "37",
    digitoProdutoRms: "5",
    descricao: "BTD ITEM COD 37 - Feijão Preto 1kg",
    categoria: "Grãos",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "12",
    secao: "Mercearia Salgada",
    grupoCodigo: "1",
    grupo: "Cereais",
    subgrupoCodigo: "2",
    subgrupo: "Feijão",
    familia: "Alimentação Básica",
    papelMercadologico: "Rotina",
    precoTabela: 32.51,
    cmvUnit: 23.4,
    fornecedorCodigo: "704894",
    compradorCodigo: "49",
    compradorNome: "IZABEL GOMES",
    embalagemCompra: 30,
    tipoEmbalagemCompra: "PCT",
  },
];

export const createDynamicArrayProxy = <T>(getSource: () => T[]): T[] => {
  return new Proxy([], {
    get(target, prop, receiver) {
      const source = getSource();
      const value = Reflect.get(source, prop);
      if (typeof value === "function") {
        return value.bind(source);
      }
      return value;
    },
    getOwnPropertyDescriptor(target, prop) {
      const source = getSource();
      return Reflect.getOwnPropertyDescriptor(source, prop);
    },
    ownKeys(target) {
      const source = getSource();
      return Reflect.ownKeys(source);
    },
    has(target, prop) {
      const source = getSource();
      return Reflect.has(source, prop);
    },
  }) as unknown as T[];
};

/** Produtos do fornecedor informado (ou do fornecedor ativo quando omitido). */
export const produtosTodosDoFornecedor = (codigoFornecedor?: string): Produto[] => {
  const fornecedorAtivo = normalizarCodigoFornecedor(codigoFornecedor || getActiveSupplierCode());
  if (globalDbCache.produtos) {
    return globalDbCache.produtos.filter(
      (produto) => normalizarCodigoFornecedor(produto.fornecedorCodigo ?? "") === fornecedorAtivo,
    );
  }
  return all_produtos.filter(
    (produto) => normalizarCodigoFornecedor(produto.fornecedorCodigo ?? "4050") === fornecedorAtivo,
  );
};

export const produtos = createDynamicArrayProxy(() => {
  const filtro = getFiltroMercadologico();
  const todos = produtosTodosDoFornecedor();
  return todos.filter((p) => produtoPassaFiltro(p, filtro));
});

const produtoFallback = (sku: string): Produto => ({
  sku,
  codigoProdutoRms: sku,
  digitoProdutoRms: "",
  descricao: sku,
  categoria: "",
  departamentoCodigo: "",
  departamento: "",
  secaoCodigo: "",
  secao: "",
  grupoCodigo: "",
  grupo: "",
  subgrupoCodigo: "",
  subgrupo: "",
  familia: "",
  papelMercadologico: "Rotina",
  precoTabela: 0,
  cmvUnit: 0,
});

export const produtoPorSku = (sku: string) =>
  produtosTodosDoFornecedor().find((p) => p.sku === sku) ?? produtoFallback(sku);

export const codigoProdutoComDigito = (sku: string) => {
  const produto = produtoPorSku(sku);
  if (produto.codigoProdutoRms && produto.digitoProdutoRms) {
    return `${produto.codigoProdutoRms}-${produto.digitoProdutoRms}`;
  }
  return sku;
};

/** CMV da venda = quantidade × custo unitario do sistema. */
export const cmvDaVenda = (quantidade: number, produto: Produto): number =>
  Math.max(0, quantidade) * produto.cmvUnit;

/** Tira "12 - " se a descrição já veio com o código (cadastro misto no RMS). */
export const nomeMercadologicoSemCodigo = (codigo: string, descricao: string) => {
  const cod = String(codigo ?? "").trim();
  let nome = String(descricao ?? "").trim();
  if (!cod || !nome) return nome;
  const prefixos = [`${cod} - `, `${cod}-`, `${cod} – `];
  for (let volta = 0; volta < 3; volta++) {
    const atual = nome;
    for (const prefixo of prefixos) {
      if (nome.length > prefixo.length && nome.toUpperCase().startsWith(prefixo.toUpperCase())) {
        nome = nome.slice(prefixo.length).trim();
        break;
      }
    }
    if (nome === atual) break;
  }
  return nome;
};

export const mercadologico = (codigo: string, descricao: string) => {
  const cod = String(codigo ?? "").trim();
  const nome = nomeMercadologicoSemCodigo(cod, descricao);
  if (cod && nome) return `${cod} - ${nome}`;
  return nome || cod;
};

export const departamentoMercadologico = (produto: Produto) => rotuloDepartamento(produto);

export const secaoMercadologica = (produto: Produto) => rotuloSecao(produto);

export const grupoMercadologico = (produto: Produto) => rotuloGrupo(produto);

export const subgrupoMercadologico = (produto: Produto) => rotuloSubgrupo(produto);

export const compradorMercadologico = (produto: Produto) => rotuloComprador(produto);
