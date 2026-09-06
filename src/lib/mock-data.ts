import { addDays, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { lojaForaDoPortalFornecedor } from "@/lib/lojas-excluidas-portal";
import {
  DEMO_FORNECEDOR_CODIGO,
  normalizarCodigoFornecedor,
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
  agendaRecebimentoCdam: number;
  filialEntregaPadrao: string;
  fornecedorComercialCodigo?: string | null;
  fornecedorComercialNome?: string | null;
  cadastroFinanceiro: CadastroFinanceiro;
  isentoCobranca?: number;
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
  return normalizarCodigoFornecedor(
    window.sessionStorage.getItem("portal-lider-sessao-fornecedor") || DEMO_FORNECEDOR_CODIGO,
  );
};

export const setActiveSupplierCode = (code: string) => {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(
      "portal-lider-sessao-fornecedor",
      normalizarCodigoFornecedor(code),
    );
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
    const active = fornecedores.find((f) => f.codigo === code) || fornecedores[0] || {} as FornecedorType;
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

const normalizarIdLoja = (id: string) => String(id ?? "").trim().replace(/^0+(?=\d)/, "");

export const lojaPorCodigo = (id: string, modo: "numero" | "local" = "numero"): Loja | undefined => {
  const cru = String(id ?? "").trim();
  const normal = normalizarIdLoja(cru);
  if (modo === "local") return lojaPorLocal.get(cru) ?? lojaPorLocal.get(normal);
  return lojaPorNumero.get(cru) ?? lojaPorNumero.get(normal);
};

export const normalizarParaFilial = (id: string): string => {
  const cru = String(id ?? "").trim();
  const normal = cru.replace(/^0+(?=\d)/, "");
  const loja = lojaPorLocal.get(cru) || lojaPorLocal.get(normal) || lojaPorNumero.get(cru) || lojaPorNumero.get(normal);
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
  return produto.familia ? `${produto.familia} · ${produto.categoria ?? ""}`.trim() : (produto.categoria ?? "");
};

export const descricaoComercial = (produto: {
  descricaoMarketing?: string | null;
  descricao: string;
}) => {
  const marketing = produto.descricaoMarketing?.trim();
  return marketing || produto.descricao;
};

const all_produtos: Produto[] = [
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
    sku: "1017",
    codigoProdutoRms: "1017",
    digitoProdutoRms: "4",
    descricao: "BTD ITEM COD 1017 - Café Torrado e Moído 500g",
    categoria: "Cafés",
    departamentoCodigo: "100",
    departamento: "Mercearia",
    secaoCodigo: "13",
    secao: "Mercearia Doce",
    grupoCodigo: "2",
    grupo: "Cafés",
    subgrupoCodigo: "1",
    subgrupo: "Café em pó",
    familia: "Café da manhã",
    papelMercadologico: "Rotina",
    precoTabela: 33.46,
    cmvUnit: 24.1,
    fornecedorCodigo: "704894",
    compradorCodigo: "51",
    compradorNome: "LEONARDO SILVA",
    embalagemCompra: 20,
    tipoEmbalagemCompra: "PCT",
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

const createDynamicArrayProxy = <T>(getSource: () => T[]): T[] => {
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

export const produtosTodosDoFornecedor = (): Produto[] => {
  if (globalDbCache.produtos) return globalDbCache.produtos;
  return all_produtos.filter(
    (p) => (p.fornecedorCodigo ?? "4050") === getActiveSupplierCode(),
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

export type PedidoStatus = "Aberto" | "Faturado" | "Pendente" | "Entregue" | "Cancelado";
export type PedidoDestino = "Fornecedor" | "CDAM";

export type PedidoAgenda = {
  contexto: "Compras/Recebimento" | "Transferencia/CDAM";
  agendaEntrada: string;
  agendaParidade: string;
  regra: string;
};

export type PedidoItem = {
  sku: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  precoUnitario: number;
};

export type Pedido = {
  numero: string;
  destino: PedidoDestino;
  origemOperacional: string;
  destinoOperacional: string;
  agenda: PedidoAgenda;
  emissao: string;
  entregaPrevista: string;
  entradaCdam?: string;
  lojaId: string;
  status: PedidoStatus;
  totLiq?: number;
  itens: PedidoItem[];
};

const hoje = new Date();
const d = (offset: number) => format(addDays(hoje, offset), "yyyy-MM-dd");

const all_pedidos: Pedido[] = [
  {
    numero: "PC-884210",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra:
        "Pedido emitido diretamente ao fornecedor; a entrada fiscal ocorre por agenda de compra/recebimento.",
    },
    emissao: d(-6),
    entregaPrevista: d(3),
    lojaId: "01",
    status: "Aberto",
    itens: [
      { sku: "10010", quantidadePedida: 480, quantidadeFaturada: 0, precoUnitario: 12.4 },
      { sku: "10020", quantidadePedida: 720, quantidadeFaturada: 0, precoUnitario: 8.1 },
    ],
  },
  {
    numero: "PC-884198",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra:
        "Pedido faturado pelo fornecedor contra filial/loja; deve alimentar recebimento e financeiro do fornecedor.",
    },
    emissao: d(-14),
    entregaPrevista: d(-4),
    entradaCdam: d(-5),
    lojaId: "05",
    status: "Entregue",
    itens: [
      { sku: "10010", quantidadePedida: 600, quantidadeFaturada: 600, precoUnitario: 12.25 },
      { sku: "10030", quantidadePedida: 1200, quantidadeFaturada: 1200, precoUnitario: 4.05 },
    ],
  },
  {
    numero: "PC-884176",
    destino: "CDAM",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Transferencia/CDAM",
      agendaEntrada: "66",
      agendaParidade: "65 / 148",
      regra:
        "Pedido abastece o deposito central; depois pode gerar transito/transferencia para lojas, sem tratar como venda direta da loja.",
    },
    emissao: d(-21),
    entregaPrevista: d(-2),
    entradaCdam: d(-10),
    lojaId: "12",
    status: "Entregue",
    itens: [
      { sku: "10020", quantidadePedida: 960, quantidadeFaturada: 360, precoUnitario: 8.2 },
      { sku: "10030", quantidadePedida: 840, quantidadeFaturada: 0, precoUnitario: 4.12 },
    ],
  },
  {
    numero: "PC-884166",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido direto ao fornecedor com entrega fisica registrada no CDAM.",
    },
    emissao: d(-24),
    entregaPrevista: d(-14),
    entradaCdam: d(-16),
    lojaId: "13",
    status: "Entregue",
    itens: [
      { sku: "10010", quantidadePedida: 520, quantidadeFaturada: 500, precoUnitario: 12.18 },
      { sku: "10020", quantidadePedida: 480, quantidadeFaturada: 480, precoUnitario: 8.05 },
    ],
  },
  {
    numero: "PC-884155",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra:
        "Pedido direto ao fornecedor com entrada no deposito central para abastecimento posterior.",
    },
    emissao: d(-31),
    entregaPrevista: d(-21),
    entradaCdam: d(-23),
    lojaId: "13",
    status: "Entregue",
    itens: [
      { sku: "10030", quantidadePedida: 1800, quantidadeFaturada: 1720, precoUnitario: 4.01 },
    ],
  },
  {
    numero: "PC-884149",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido direto ao fornecedor entregue no CDAM e elegivel para SLA logistico.",
    },
    emissao: d(-38),
    entregaPrevista: d(-29),
    entradaCdam: d(-30),
    lojaId: "13",
    status: "Entregue",
    itens: [{ sku: "10020", quantidadePedida: 900, quantidadeFaturada: 900, precoUnitario: 8.08 }],
  },
  {
    numero: "PC-884140",
    destino: "CDAM",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Transferencia/CDAM",
      agendaEntrada: "66",
      agendaParidade: "65 / 148",
      regra:
        "Pedido cancelado para o deposito central; manter separado dos pedidos diretos ao fornecedor para nao contaminar reposicao loja.",
    },
    emissao: d(-30),
    entregaPrevista: d(-18),
    lojaId: "01",
    status: "Cancelado",
    itens: [{ sku: "10010", quantidadePedida: 240, quantidadeFaturada: 0, precoUnitario: 12.6 }],
  },
  // Pedidos BTD Distribuidora (704894)
  {
    numero: "PC-990010",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido emitido diretamente ao fornecedor BTD.",
    },
    emissao: d(-5),
    entregaPrevista: d(2),
    lojaId: "01",
    status: "Aberto",
    itens: [
      { sku: "4244", quantidadePedida: 500, quantidadeFaturada: 0, precoUnitario: 25.54 },
      { sku: "1017", quantidadePedida: 300, quantidadeFaturada: 0, precoUnitario: 33.46 },
    ],
  },
  {
    numero: "PC-990020",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "CDAM - Deposito Central",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado por BTD.",
    },
    emissao: d(-12),
    entregaPrevista: d(-2),
    entradaCdam: d(-3),
    lojaId: "12",
    status: "Entregue",
    itens: [
      { sku: "3213", quantidadePedida: 1000, quantidadeFaturada: 1000, precoUnitario: 31.93 },
      { sku: "37", quantidadePedida: 1500, quantidadeFaturada: 1450, precoUnitario: 32.51 },
    ],
  },
  {
    numero: "PC-1123713",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Consul."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [
      { sku: "3184972", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 1649.0 }
    ]
  },
  {
    numero: "PC-1126056",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Panasonic."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [
      { sku: "3127566", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 4189.0 }
    ]
  },
  {
    numero: "PC-1126062",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Esmaltec."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [
      { sku: "3041877", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 979.0 }
    ]
  },
  {
    numero: "PC-1124390",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Panasonic e Consul."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [
      { sku: "3033157", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 1599.0 },
      { sku: "3072750", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 2959.0 }
    ]
  },
  {
    numero: "PC-1123557",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido em aberto pendente de faturamento pela Dako."
    },
    emissao: d(-6),
    entregaPrevista: d(4),
    lojaId: "35",
    status: "Aberto",
    itens: [
      { sku: "3187843", quantidadePedida: 1, quantidadeFaturada: 0, precoUnitario: 1989.0 }
    ]
  },
  {
    numero: "PC-1123560",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido em aberto pendente de faturamento pela Atlas."
    },
    emissao: d(-6),
    entregaPrevista: d(4),
    lojaId: "35",
    status: "Aberto",
    itens: [
      { sku: "3151113", quantidadePedida: 1, quantidadeFaturada: 0, precoUnitario: 1439.0 }
    ]
  },
  {
    numero: "PC-1124470",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Panasonic."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "78",
    status: "Entregue",
    itens: [
      { sku: "3072752", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 2669.0 }
    ]
  },
  {
    numero: "PC-1126818",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Brastemp."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "35",
    status: "Entregue",
    itens: [
      { sku: "219992", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 1099.0 }
    ]
  },
  {
    numero: "PC-1124432",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido entregue e faturado pela Clarice."
    },
    emissao: d(-14),
    entregaPrevista: d(-10),
    lojaId: "60",
    status: "Entregue",
    itens: [
      { sku: "3245593", quantidadePedida: 1, quantidadeFaturada: 1, precoUnitario: 569.0 }
    ]
  },
  {
    numero: "PC-1124172",
    destino: "Fornecedor",
    origemOperacional: "Compras Grupo Lider",
    destinoOperacional: "Fornecedor direto",
    agenda: {
      contexto: "Compras/Recebimento",
      agendaEntrada: "Recebimento de NF-e",
      agendaParidade: "Conforme origem fiscal da compra",
      regra: "Pedido em aberto pendente de faturamento pela Clarice."
    },
    emissao: d(-6),
    entregaPrevista: d(4),
    lojaId: "60",
    status: "Aberto",
    itens: [
      { sku: "3245593", quantidadePedida: 1, quantidadeFaturada: 0, precoUnitario: 569.0 }
    ]
  }
];

export const pedidos = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.pedidos
    ? globalDbCache.pedidos.filter((p) => !lojaForaDoPortalFornecedor(p.lojaId))
    : all_pedidos.map((p) => ({
        ...p,
        numero: p.numero.startsWith("PC-") ? p.numero.substring(3) : p.numero,
      }));
  return fonte
    .map((p) => ({
      ...p,
      itens: p.itens.filter((item) => activeSkus.has(item.sku)),
    }))
    .filter((p) => p.itens.length > 0 && !lojaForaDoPortalFornecedor(p.lojaId));
});

export const totalPedido = (pedido: Pedido) =>
  pedido.totLiq !== undefined && pedido.totLiq > 0
    ? pedido.totLiq
    : pedido.itens.reduce((acc, item) => acc + item.quantidadePedida * item.precoUnitario, 0);

export const quantidadesPedido = (pedido: Pedido) =>
  pedido.itens.reduce(
    (acc, item) => ({
      pedida: acc.pedida + item.quantidadePedida,
      faturada: acc.faturada + item.quantidadeFaturada,
    }),
    { pedida: 0, faturada: 0 },
  );

export const fillRatePedido = (pedido: Pedido) => {
  const totais = quantidadesPedido(pedido);
  if (totais.pedida <= 0) return 0;
  return (totais.faturada / totais.pedida) * 100;
};

export const fillRateGeral = (lista: Pedido[]) => {
  const totais = lista
    .filter((pedido) => pedido.status !== "Cancelado")
    .reduce(
      (acc, pedido) => {
        const atual = quantidadesPedido(pedido);
        return {
          pedida: acc.pedida + atual.pedida,
          faturada: acc.faturada + atual.faturada,
        };
      },
      { pedida: 0, faturada: 0 },
    );
  if (totais.pedida <= 0) return 0;
  return (totais.faturada / totais.pedida) * 100;
};

const diasEntre = (inicio: string, fim: string) => {
  const inicioMs = new Date(`${inicio}T12:00:00`).getTime();
  const fimMs = new Date(`${fim}T12:00:00`).getTime();
  return Math.max(0, Math.round((fimMs - inicioMs) / 86400000));
};

export const leadTimeEntregaCdam = (pedido: Pedido) =>
  pedido.entradaCdam ? diasEntre(pedido.emissao, pedido.entradaCdam) : null;

export const ultimosPedidosEntreguesCdam = (lista: Pedido[], limite = 5) =>
  lista
    .filter((pedido) => pedido.status === "Entregue" && pedido.entradaCdam)
    .sort((a, b) => (b.entradaCdam ?? "").localeCompare(a.entradaCdam ?? ""))
    .slice(0, limite);

export const tempoMedioEntregaCdam = (lista: Pedido[], limite = 5) => {
  const entregues = ultimosPedidosEntreguesCdam(lista, limite);
  if (entregues.length === 0) return null;
  const total = entregues.reduce((acc, pedido) => acc + (leadTimeEntregaCdam(pedido) ?? 0), 0);
  return total / entregues.length;
};

export type VendaItem = {
  data: string;
  lojaId: string;
  sku: string;
  quantidade: number;
  valorUnitario: number;
};

function gerarVendas(): VendaItem[] {
  const rows: VendaItem[] = [];
  for (let dia = 89; dia >= 0; dia--) {
    for (const loja of lojas) {
      for (const produto of all_produtos) {
        const base = produto.sku === "10030" ? 46 : produto.sku === "10020" ? 28 : 19;
        const variacao = ((dia * 7 + Number(loja.id) * 13 + Number(produto.sku)) % 17) - 6;
        const quantidade = Math.max(3, base + variacao);
        const ajuste = ((dia + Number(loja.id)) % 5) * 0.07;
        rows.push({
          data: d(-dia),
          lojaId: loja.id,
          sku: produto.sku,
          quantidade,
          valorUnitario: Number((produto.precoTabela + ajuste).toFixed(2)),
        });
      }
    }
  }
  return rows;
}

const all_vendas: VendaItem[] = gerarVendas();

export const vendas = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.vendas
    ? globalDbCache.vendas
    : all_vendas.filter((v) => activeSkus.has(v.sku));
  return fonte.filter((v) => activeSkus.has(v.sku) && !lojaForaDoPortalFornecedor(v.lojaId));
});

const all_vendasMensais = (code: string) => {
  const faturamento = code === "704894" ? 2070000 : 418000;
  const volume = code === "704894" ? 150000 : 31500;
  return Array.from({ length: 12 }, (_, i) => {
    const mes = subMonths(hoje, 11 - i);
    const fator = 1 + i * 0.08;
    return {
      mes: format(mes, "MMM/yy", { locale: ptBR }),
      faturamento: Number((faturamento * fator).toFixed(2)),
      volume: Math.round(volume * fator),
    };
  });
};

export const vendasMensais = new Proxy([], {
  get(target, prop) {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      const value = Reflect.get(list, prop);
      if (typeof value === "function") {
        return value.bind(list);
      }
      return value;
    }
    const list = all_vendasMensais(getActiveSupplierCode());
    const value = Reflect.get(list, prop);
    if (typeof value === "function") {
      return value.bind(list);
    }
    return value;
  },
  getOwnPropertyDescriptor(target, prop) {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      return Reflect.getOwnPropertyDescriptor(list, prop);
    }
    const list = all_vendasMensais(getActiveSupplierCode());
    return Reflect.getOwnPropertyDescriptor(list, prop);
  },
  ownKeys() {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      return Reflect.ownKeys(list);
    }
    const list = all_vendasMensais(getActiveSupplierCode());
    return Reflect.ownKeys(list);
  },
}) as VendaMensal[];

export type EstoqueLinha = {
  sku: string;
  lojaId: string;
  estoqueMinimo: number;
  estoqueAtual: number;
};

const all_estoque: EstoqueLinha[] = [
  // Nestlé
  { sku: "10010", lojaId: "01", estoqueMinimo: 120, estoqueAtual: 0 },
  { sku: "10010", lojaId: "05", estoqueMinimo: 120, estoqueAtual: 96 },
  { sku: "10010", lojaId: "12", estoqueMinimo: 100, estoqueAtual: 340 },
  { sku: "10020", lojaId: "01", estoqueMinimo: 180, estoqueAtual: 420 },
  { sku: "10020", lojaId: "05", estoqueMinimo: 180, estoqueAtual: 150 },
  { sku: "10020", lojaId: "12", estoqueMinimo: 160, estoqueAtual: 0 },
  { sku: "10030", lojaId: "01", estoqueMinimo: 240, estoqueAtual: 610 },
  { sku: "10030", lojaId: "05", estoqueMinimo: 240, estoqueAtual: 238 },
  { sku: "10030", lojaId: "12", estoqueMinimo: 220, estoqueAtual: 705 },
  // BTD
  { sku: "4244", lojaId: "01", estoqueMinimo: 200, estoqueAtual: 180 },
  { sku: "4244", lojaId: "05", estoqueMinimo: 200, estoqueAtual: 0 },
  { sku: "4244", lojaId: "12", estoqueMinimo: 200, estoqueAtual: 350 },
  { sku: "1017", lojaId: "01", estoqueMinimo: 150, estoqueAtual: 140 },
  { sku: "1017", lojaId: "05", estoqueMinimo: 150, estoqueAtual: 200 },
  { sku: "1017", lojaId: "12", estoqueMinimo: 150, estoqueAtual: 0 },
  { sku: "3213", lojaId: "01", estoqueMinimo: 300, estoqueAtual: 400 },
  { sku: "3213", lojaId: "05", estoqueMinimo: 300, estoqueAtual: 50 },
  { sku: "3213", lojaId: "12", estoqueMinimo: 300, estoqueAtual: 600 },
  { sku: "37", lojaId: "01", estoqueMinimo: 250, estoqueAtual: 100 },
  { sku: "37", lojaId: "05", estoqueMinimo: 250, estoqueAtual: 500 },
  { sku: "37", lojaId: "12", estoqueMinimo: 250, estoqueAtual: 0 },
];

export const estoque = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.estoque
    ? globalDbCache.estoque
    : all_estoque.filter((e) => activeSkus.has(e.sku));
  return fonte.filter((e) => activeSkus.has(e.sku) && !lojaForaDoPortalFornecedor(e.lojaId));
});

export const transferenciasCdam = createDynamicArrayProxy(() => {
  const fonte = globalDbCache.transferenciasCdam ?? [];
  const activeSkus = new Set(produtos.map((p) => p.sku));
  return fonte.filter((t) => activeSkus.has(t.sku));
});

export type StatusEstoque = "Ruptura" | "Atenção" | "Confortável" | "Excesso";

export const COBERTURA_EXCESSIVA_DIAS = 60;

/** Teto do minimo: 10 dias de venda. */
export const ESTOQUE_MINIMO_TETO_DIAS = 10;

const diasJanelaVendaMedia = 30;

const embalagemPadraoSku = (sku: string): number => {
  const produto = produtos.find((item) => item.sku === sku);
  const emb = Number(produto?.embalagemCompra ?? 1);
  return Number.isFinite(emb) && emb > 0 ? emb : 1;
};

/**
 * Minimo (SKU x loja), nao e coluna RMS.
 * - venda = 0 ou media diaria < embalagem padrao → 1 embalagem
 * - senao → 10 dias de venda (nunca acima disso)
 */
export const estoqueMinimoCalculado = (sku: string, lojaId: string): number => {
  const vendaPeriodo = Math.max(0, vendaMediaMensal(sku, lojaId));
  const mediaDiaria = vendaPeriodo / diasJanelaVendaMedia;
  const embalagem = embalagemPadraoSku(sku);
  if (vendaPeriodo === 0 || mediaDiaria < embalagem) return embalagem;
  return Math.ceil(mediaDiaria * ESTOQUE_MINIMO_TETO_DIAS);
};

export const statusEstoque = (linha: EstoqueLinha): StatusEstoque => {
  const mediaMensal = vendaMediaMensal(linha.sku, linha.lojaId);
  const mediaDiaria = mediaMensal / 30;
  const minimo = estoqueMinimoCalculado(linha.sku, linha.lojaId);

  if (linha.estoqueAtual < mediaDiaria) return "Ruptura";
  if (linha.estoqueAtual <= minimo) return "Atenção";
  
  const cobertura = coberturaDias(linha.estoqueAtual, mediaMensal);
  if (cobertura !== null && cobertura > COBERTURA_EXCESSIVA_DIAS) return "Excesso";
  return "Confortável";
};

/** Janela de sell-out usada para média mensal e cobertura (dias). */
export const JANELA_VENDA_ESTOQUE_DIAS = 90;

/**
 * Venda média mensal em unidades (SKU × loja),
 * projetada a partir da média diária dos últimos 90 dias: (Σ qty / 90) × 30.
 */
let lastVendasRef: any = null;
let cachedSalesMap = new Map<string, number>();

export const mapaVendaMediaMensal = (): Map<string, number> => {
  const fonte = globalDbCache.vendas ?? vendas;
  if (fonte === lastVendasRef && cachedSalesMap.size > 0) {
    return cachedSalesMap;
  }

  const map = new Map<string, number>();
  if (fonte.length === 0) {
    lastVendasRef = fonte;
    cachedSalesMap = map;
    return map;
  }

  let maxData = "2025-12-15";
  for (let i = 0; i < fonte.length; i++) {
    const d = fonte[i].data;
    if (d && d > maxData) maxData = d;
  }

  const janela = JANELA_VENDA_ESTOQUE_DIAS;
  const limiteDataISO = new Date(new Date(maxData + "T12:00:00").getTime() - janela * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const fatorMensal = 30 / janela;

  for (let i = 0; i < fonte.length; i++) {
    const v = fonte[i];
    if (v.data >= limiteDataISO && v.data <= maxData) {
      const filId = normalizarParaFilial(v.lojaId);
      map.set(v.sku + "_" + filId, (map.get(v.sku + "_" + filId) || 0) + v.quantidade * fatorMensal);
    }
  }

  lastVendasRef = fonte;
  cachedSalesMap = map;
  return map;
};

export const vendaMediaMensal = (sku: string, lojaId: string): number => {
  const filId = normalizarParaFilial(lojaId);
  return mapaVendaMediaMensal().get(sku + "_" + filId) || 0;
};

/**
 * Cobertura de estoque em dias = estoque atual ÷ venda média diária.
 * Retorna null quando não há base de venda (evita divisão por zero).
 */
export const coberturaDias = (estoqueAtual: number, vendaMediaMensalUn: number): number | null => {
  if (vendaMediaMensalUn <= 0) return null;
  const mediaDiaria = vendaMediaMensalUn / 30;
  return estoqueAtual / mediaDiaria;
};

/** Direção fiscal da nota no relacionamento comercial. */
export type DirecaoNota = "fornecedor_para_lider" | "outra";

/** Natureza operacional do documento no RMS (não misturar com transferência loja). */
export type NaturezaDocumento =
  | "recebimento_fornecedor_cdam"
  | "recebimento_fornecedor_loja"
  | "transferencia_interna"
  | "outra";

export type Fatura = {
  id: string;
  numeroNota: string;
  emissao: string;
  /**
   * Data de pagamento prevista = emissão + prazo do cadastro financeiro.
   * Calculada; não usar vencimento solto sem base no cadastro.
   */
  dataPagamento: string;
  valor: number;
  /** Desconto financeiro contratual (R$), se houver no cadastro. */
  descontoFinanceiro: number;
  /** Valor líquido após desconto financeiro do cadastro. */
  valorLiquido: number;
  status: "A vencer" | "Pago";
  /** Filial de destino da NF (loja ou CDAM). */
  lojaId: string;
  /** Código do fornecedor emitente (escopo do portal). */
  fornecedorCodigo: string;
  /** Só notas do fornecedor para o Grupo Líder entram no financeiro do portal. */
  direcao: DirecaoNota;
  destinatario: string;
  /** Agenda RMS de entrada/recebimento. Nunca 65/66/148. */
  agendaRms: number;
  natureza: NaturezaDocumento;
  recebimento?: string;
  prazoTipo?: TipoPrazoPagamento | null;
};

const arredondar2 = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

/** Data de pagamento. DDE = emissão + prazo. DDR exige data de recebimento (nao inventar). */
export const calcularDataPagamento = (
  emissaoIso: string,
  prazoDias: number,
  tipo: TipoPrazoPagamento | null | undefined = "DDE",
  recebimentoIso?: string | null,
): string | null => {
  const ancora = tipo === "DDR" ? recebimentoIso : emissaoIso;
  if (!ancora) return null;
  const base = new Date(`${ancora}T12:00:00`);
  return format(addDays(base, prazoDias), "yyyy-MM-dd");
};

/**
 * Desconto financeiro do cadastro sobre o valor da nota.
 * Retorna 0 quando o cadastro não tem desconto (pct <= 0).
 */
export const calcularDescontoFinanceiro = (
  valor: number,
  cadastro: CadastroFinanceiro = fornecedor.cadastroFinanceiro,
): number => {
  if (!cadastro.descontoFinanceiroPct || cadastro.descontoFinanceiroPct <= 0) return 0;
  return arredondar2(valor * (cadastro.descontoFinanceiroPct / 100));
};

type FaturaInput = {
  id: string;
  numeroNota: string;
  emissao: string;
  valor: number;
  status: "A vencer" | "Pago";
  lojaId: string;
  fornecedorCodigo?: string;
  direcao?: DirecaoNota;
  destinatario?: string;
  agendaRms?: number;
  natureza?: NaturezaDocumento;
};

const montarFatura = (input: FaturaInput): Fatura => {
  const cadastro = fornecedor.cadastroFinanceiro;
  const descontoFinanceiro = calcularDescontoFinanceiro(input.valor, cadastro);
  return {
    id: input.id,
    numeroNota: input.numeroNota,
    emissao: input.emissao,
    dataPagamento:
      calcularDataPagamento(
        input.emissao,
        cadastro.prazoPagamentoDias,
        cadastro.prazoTipo,
      ) ?? "",
    valor: input.valor,
    descontoFinanceiro,
    valorLiquido: arredondar2(input.valor - descontoFinanceiro),
    status: input.status,
    lojaId: input.lojaId,
    fornecedorCodigo: input.fornecedorCodigo ?? fornecedor.codigo,
    direcao: input.direcao ?? "fornecedor_para_lider",
    destinatario: input.destinatario ?? fornecedor.destinatario,
    agendaRms: input.agendaRms ?? agendasRms.recebimentoFornecedorCdam,
    natureza: input.natureza ?? "recebimento_fornecedor_cdam",
  };
};

/**
 * Base bruta (simula ETL).
 * Nestlé entrega só no CDAM/depósito — notas válidas usam filial 201 + agenda 28.
 * Inclui deliberadamente ruído (outro fornecedor, transferência, loja) para o filtro provar exclusão.
 */
const faturasBrutas: FaturaInput[] = [
  {
    id: "FAT-9001",
    numeroNota: "NF 118420",
    emissao: d(-8),
    valor: 124500,
    status: "A vencer",
    lojaId: "201",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  {
    id: "FAT-9002",
    numeroNota: "NF 118455",
    emissao: d(-5),
    valor: 86300.5,
    status: "A vencer",
    lojaId: "201",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  {
    id: "FAT-9003",
    numeroNota: "NF 118477",
    emissao: d(-3),
    valor: 152980.75,
    status: "A vencer",
    lojaId: "201",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  {
    id: "FAT-9004",
    numeroNota: "NF 118501",
    emissao: d(-1),
    valor: 64210.3,
    status: "A vencer",
    lojaId: "201",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  {
    id: "FAT-8971",
    numeroNota: "NF 118330",
    emissao: d(-40),
    valor: 98750,
    status: "Pago",
    lojaId: "201",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  {
    id: "FAT-8962",
    numeroNota: "NF 118298",
    emissao: d(-52),
    valor: 111230.4,
    status: "Pago",
    lojaId: "201",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  // Outro fornecedor — não deve aparecer
  {
    id: "FAT-OUTRO-1",
    numeroNota: "NF 990001",
    emissao: d(-4),
    valor: 50000,
    status: "A vencer",
    lojaId: "201",
    fornecedorCodigo: "9999",
    direcao: "fornecedor_para_lider",
    destinatario: "Grupo Líder",
    agendaRms: agendasRms.recebimentoFornecedorCdam,
    natureza: "recebimento_fornecedor_cdam",
  },
  // Transferência interna CD→loja (agendas 65/66/148) — NÃO é nota do fornecedor
  {
    id: "FAT-TRF-1",
    numeroNota: "TRF 660012",
    emissao: d(-2),
    valor: 22000,
    status: "A vencer",
    lojaId: "01",
    fornecedorCodigo: "4050",
    direcao: "fornecedor_para_lider",
    destinatario: "Grupo Líder",
    agendaRms: agendasRms.transferenciaEntrada,
    natureza: "transferencia_interna",
  },
  // Nota indevida em loja (não deve aparecer para fornecedor somente_cdam)
  {
    id: "FAT-LOJA-1",
    numeroNota: "NF 770001",
    emissao: d(-3),
    valor: 15000,
    status: "A vencer",
    lojaId: "05",
    fornecedorCodigo: "4050",
    direcao: "fornecedor_para_lider",
    destinatario: "Grupo Líder",
    agendaRms: agendasRms.entradaNfGenericaOuDev,
    natureza: "outra",
  },
];

export const faturas: Fatura[] = faturasBrutas.map(montarFatura);

const agendasTransferencia = new Set<number>([
  agendasRms.transferenciaSaida,
  agendasRms.transferenciaEntrada,
  agendasRms.transferenciaTransito,
]);

/**
 * Títulos do portal financeiro:
 * - fornecedor autenticado → Grupo Líder
 * - natureza recebimento fornecedor (exclui transferência interna)
 * - se modeloEntrega = somente_cdam: só filial tipo depósito/CD
 */
export const faturasDoFornecedor = (codigoFornecedor: string = fornecedor.codigo): Fatura[] => {
  const code = normalizarCodigoFornecedor(codigoFornecedor);
  if (globalDbCache.faturas) {
    return globalDbCache.faturas.filter(
      (f) => f.fornecedorCodigo === code && !agendasTransferencia.has(f.agendaRms),
    );
  }
  const activeForn = fornecedor;

  return faturas.filter((f) => {
    if (f.fornecedorCodigo !== code) return false;
    if (f.direcao !== "fornecedor_para_lider") return false;
    if (f.destinatario !== activeForn.destinatario) return false;
    if (f.natureza !== "recebimento_fornecedor_cdam") return false;
    if (agendasTransferencia.has(f.agendaRms)) return false;
    if (activeForn.modeloEntrega === "somente_cdam") {
      const filial = lojaPorCodigo(f.lojaId) ?? lojaPorCodigo(f.lojaId, "local");
      if (filial?.tipo !== "D") return false;
    }
    return true;
  });
};

export type ContaReceberStatus = "Aberto" | "Programado" | "Em análise" | "Descontado";

export type ContaReceberFornecedor = {
  id: string;
  documento: string;
  tipo: "Acordo comercial" | "Bonificação" | "Devolução" | "Avaria" | "Verba comercial";
  descricao: string;
  emissao: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: ContaReceberStatus;
  abatimentoProximoPagamento: boolean;
  proximoPagamentoId?: string;
  origem: string;
  observacao: string;
  fornecedorCodigo: string;
};

export const contasReceberFornecedor: ContaReceberFornecedor[] = [
  {
    id: "CR-240801",
    documento: "ACORDO 08/2026",
    tipo: "Acordo comercial",
    descricao: "Acordo de exposição em tabloide e ponta de gôndola",
    emissao: d(-9),
    competencia: "08/2026",
    vencimento: d(20),
    valor: 18500,
    status: "Programado",
    abatimentoProximoPagamento: true,
    proximoPagamentoId: "FAT-9001",
    origem: "Comercial",
    observacao: "Abatimento autorizado para o próximo pagamento aberto.",
    fornecedorCodigo: fornecedor.codigo,
  },
  {
    id: "CR-240802",
    documento: "DEV 430118",
    tipo: "Devolução",
    descricao: "Devolução de mercadoria recebida no CDAM",
    emissao: d(-7),
    competencia: "08/2026",
    vencimento: d(12),
    valor: 7260.4,
    status: "Programado",
    abatimentoProximoPagamento: true,
    proximoPagamentoId: "FAT-9001",
    origem: "Logística CDAM",
    observacao: "Devolução vinculada ao recebimento no depósito.",
    fornecedorCodigo: fornecedor.codigo,
  },
  {
    id: "CR-240803",
    documento: "AVARIA 7721",
    tipo: "Avaria",
    descricao: "Avaria operacional identificada na conferência",
    emissao: d(-5),
    competencia: "08/2026",
    vencimento: d(14),
    valor: 2180.75,
    status: "Aberto",
    abatimentoProximoPagamento: true,
    proximoPagamentoId: "FAT-9001",
    origem: "Conferência",
    observacao: "Pendente de aceite documental, previsto para desconto.",
    fornecedorCodigo: fornecedor.codigo,
  },
  {
    id: "CR-240804",
    documento: "BONIF 08/2026",
    tipo: "Bonificação",
    descricao: "Bonificação comercial por campanha sell-out",
    emissao: d(-3),
    competencia: "08/2026",
    vencimento: d(25),
    valor: 12400,
    status: "Em análise",
    abatimentoProximoPagamento: false,
    origem: "Trade marketing",
    observacao: "Aguardando validação comercial antes de programar abatimento.",
    fornecedorCodigo: fornecedor.codigo,
  },
  {
    id: "CR-240721",
    documento: "VERBA 07/2026",
    tipo: "Verba comercial",
    descricao: "Verba de aniversário Líder liquidada no pagamento anterior",
    emissao: d(-28),
    competencia: "07/2026",
    vencimento: d(-4),
    valor: 9800,
    status: "Descontado",
    abatimentoProximoPagamento: false,
    proximoPagamentoId: "FAT-8971",
    origem: "Comercial",
    observacao: "Baixado por desconto em pagamento já liquidado.",
    fornecedorCodigo: fornecedor.codigo,
  },
  {
    id: "CR-OUTRO-1",
    documento: "ACORDO OUTRO",
    tipo: "Acordo comercial",
    descricao: "Registro de outro fornecedor para provar filtro do portal",
    emissao: d(-4),
    competencia: "08/2026",
    vencimento: d(18),
    valor: 5000,
    status: "Programado",
    abatimentoProximoPagamento: true,
    proximoPagamentoId: "FAT-OUTRO-1",
    origem: "Comercial",
    observacao: "Não deve aparecer para o fornecedor autenticado.",
    fornecedorCodigo: "9999",
  },
];

export const contasReceberDoFornecedor = (
  codigoFornecedor: string = fornecedor.codigo,
): ContaReceberFornecedor[] => {
  const code = normalizarCodigoFornecedor(codigoFornecedor);
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const aberta = (conta: ContaReceberFornecedor) =>
    conta.status !== "Descontado" &&
    (!conta.vencimento || conta.vencimento >= hojeIso);
  if (globalDbCache.contasReceber) {
    return globalDbCache.contasReceber.filter(
      (conta) => conta.fornecedorCodigo === code && aberta(conta),
    );
  }
  return contasReceberFornecedor.filter((conta) => conta.fornecedorCodigo === code && aberta(conta));
};

/** Taxa mensal candidata de antecipação (motor separado do desconto financeiro do cadastro). */
export const TAXA_ANTECIPACAO_MENSAL = 0.018;

/**
 * Desconto de antecipação (pró-rata die) sobre o valor líquido do título
 * (já considerando desconto financeiro do cadastro, se houver).
 */
export const calcularDescontoAntecipacao = (
  valorBase: number,
  diasAntecipados: number,
  taxaMensal: number = TAXA_ANTECIPACAO_MENSAL,
  minDias = 5,
): number => {
  const dias = Math.max(minDias, Math.max(0, diasAntecipados));
  return arredondar2(valorBase * taxaMensal * (dias / 30));
};

export type Agendamento = {
  id: string;
  chaveNfe: string;
  lojaId: string;
  data: string;
  horario: string;
  status: "Confirmado" | "Aguardando agendamento";
};

export const horariosDisponiveis = ["07:00", "08:30", "10:00", "11:30", "13:30", "15:00", "16:30"];

export const agendamentos: Agendamento[] = [
  {
    id: "AG-2201",
    chaveNfe: "15250860409075000152550010001184200019584127",
    lojaId: "01",
    data: d(2),
    horario: "08:30",
    status: "Confirmado",
  },
  {
    id: "AG-2202",
    chaveNfe: "15250860409075000152550010001184550019584231",
    lojaId: "05",
    data: d(5),
    horario: "13:30",
    status: "Confirmado",
  },
];

export const notasAguardandoAgendamento = [
  {
    numeroNota: "NF 118477",
    chaveNfe: "15250860409075000152550010001184770019584399",
    lojaId: "12",
  },
  {
    numeroNota: "NF 118501",
    chaveNfe: "15250860409075000152550010001185010019584512",
    lojaId: "01",
  },
];

export type Perda = {
  fornecedorCodigo: string;
  lojaId: string;
  lojaNome: string;
  sku: string;
  produtoDescricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  data: string;
  ocorrencias: number;
};

const all_perdas: Perda[] = [
  // Dados Reais coletados do Fornecedor 704894 (BTD)
  {
    fornecedorCodigo: "704894",
    lojaId: "2011",
    lojaNome: "Loja 2011 - Lider Augusto Montenegro",
    sku: "4244",
    produtoDescricao: "BTD ITEM COD 4244 - Azeite Extravirgem 500ml",
    quantidade: 1589.48,
    valorUnitario: 25.54,
    valorTotal: 40598.12,
    data: "2026-08-01",
    ocorrencias: 19,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "337",
    lojaNome: "Loja 337 - Lider Castanhal",
    sku: "1017",
    produtoDescricao: "BTD ITEM COD 1017 - Café Torrado e Moído 500g",
    quantidade: 389.61,
    valorUnitario: 33.46,
    valorTotal: 13036.14,
    data: "2026-08-02",
    ocorrencias: 146,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "183",
    lojaNome: "Loja 183 - Lider Marabá",
    sku: "3213",
    produtoDescricao: "BTD ITEM COD 3213 - Arroz Parboilizado T1 5kg",
    quantidade: 286.28,
    valorUnitario: 31.93,
    valorTotal: 9142.88,
    data: "2026-08-03",
    ocorrencias: 21,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "426",
    lojaNome: "Loja 426 - Lider Cidade Nova",
    sku: "37",
    produtoDescricao: "BTD ITEM COD 37 - Feijão Preto 1kg",
    quantidade: 235.64,
    valorUnitario: 32.51,
    valorTotal: 7661.52,
    data: "2026-08-04",
    ocorrencias: 39,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "175",
    lojaNome: "Loja 175 - Lider Icoaraci",
    sku: "4244",
    produtoDescricao: "BTD ITEM COD 4244 - Azeite Extravirgem 500ml",
    quantidade: 51.64,
    valorUnitario: 36.29,
    valorTotal: 1873.98,
    data: "2026-08-05",
    ocorrencias: 56,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "400",
    lojaNome: "Loja 400 - Lider Ananindeua",
    sku: "1017",
    produtoDescricao: "BTD ITEM COD 1017 - Café Torrado e Moído 500g",
    quantidade: 25.05,
    valorUnitario: 32.09,
    valorTotal: 803.84,
    data: "2026-08-05",
    ocorrencias: 16,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "116",
    lojaNome: "Loja 116 - Lider Reduto",
    sku: "3213",
    produtoDescricao: "BTD ITEM COD 3213 - Arroz Parboilizado T1 5kg",
    quantidade: 22.2,
    valorUnitario: 35.11,
    valorTotal: 779.54,
    data: "2026-08-04",
    ocorrencias: 20,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "248",
    lojaNome: "Loja 248 - Lider Pedreira",
    sku: "37",
    produtoDescricao: "BTD ITEM COD 37 - Feijão Preto 1kg",
    quantidade: 21.94,
    valorUnitario: 32.68,
    valorTotal: 717.03,
    data: "2026-08-03",
    ocorrencias: 20,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "280",
    lojaNome: "Loja 280 - Lider Guamá",
    sku: "4244",
    produtoDescricao: "BTD ITEM COD 4244 - Azeite Extravirgem 500ml",
    quantidade: 17.62,
    valorUnitario: 29.29,
    valorTotal: 516.18,
    data: "2026-08-02",
    ocorrencias: 3,
  },
  {
    fornecedorCodigo: "704894",
    lojaId: "78",
    lojaNome: "Loja 78 - Lider Canudos",
    sku: "1017",
    produtoDescricao: "BTD ITEM COD 1017 - Café Torrado e Moído 500g",
    quantidade: 10.31,
    valorUnitario: 32.51,
    valorTotal: 335.22,
    data: "2026-08-01",
    ocorrencias: 7,
  },
];

export const perdas = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.perdas
    ? globalDbCache.perdas
    : all_perdas.filter((p) => p.fornecedorCodigo === getActiveSupplierCode());
  return fonte.filter((p) => activeSkus.has(p.sku) && !lojaForaDoPortalFornecedor(p.lojaId));
});

export const obterBloqueioProdutoLoja = (sku: string, lojaId: string): number => {
  if (globalDbCache.bloqueios) {
    const bloq = globalDbCache.bloqueios.find((b) => b.sku === sku && b.lojaId === lojaId);
    return bloq ? bloq.bloqueio : 0;
  }
  return 0;
};


export type RebaixaMock = {
  id: string;
  sku: string;
  descricao: string;
  lojaId: string;
  lojaNome: string;
  precoVendaAnterior: number;
  precoVendaOferta: number;
  descontoPercentual: number;
  dataInicio: string;
  dataFim: string;
  tipoRebaixa: string;
  quantidadeVenda: number;
  reembolsoEstimado: number;
};

export type OfertaValidadeMock = {
  id: string;
  sku: string;
  descricao: string;
  lojaId: string;
  lojaNome: string;
  precoNormal: number;
  precoOferta: number;
  dataVencimento: string;
  dataInicio: string;
  dataFim: string;
  quantidadeInicial: number;
  quantidadeVendida: number;
  status: 'Ativa' | 'Próxima ao Fim' | 'Expirada';
};

export const nestleRebaixasMock: RebaixaMock[] = [
  {
    id: '1',
    sku: '3566870',
    descricao: 'Ninho Soluvel Inst Lata 380g',
    lojaId: '1',
    lojaNome: 'L01 LIDER CONDOR',
    precoVendaAnterior: 18.90,
    precoVendaOferta: 15.58,
    descontoPercentual: 17.5,
    dataInicio: '2026-08-10',
    dataFim: '2026-09-10',
    tipoRebaixa: 'Margem Garantida',
    quantidadeVenda: 450,
    reembolsoEstimado: 1494.00,
  },
  {
    id: '2',
    sku: '3566870',
    descricao: 'Ninho Soluvel Inst Lata 380g',
    lojaId: '4',
    lojaNome: 'L04 LIDER OBIDOS',
    precoVendaAnterior: 18.90,
    precoVendaOferta: 15.58,
    descontoPercentual: 17.5,
    dataInicio: '2026-08-10',
    dataFim: '2026-09-10',
    tipoRebaixa: 'Margem Garantida',
    quantidadeVenda: 120,
    reembolsoEstimado: 398.40,
  },
  {
    id: '3',
    sku: '2368706',
    descricao: 'Cereal Mucilon Milho Sachê 180g',
    lojaId: '2',
    lojaNome: 'L02 LIDER ALCINDO CACELA',
    precoVendaAnterior: 9.50,
    precoVendaOferta: 7.90,
    descontoPercentual: 16.8,
    dataInicio: '2026-08-15',
    dataFim: '2026-09-15',
    tipoRebaixa: 'Acordo Comercial',
    quantidadeVenda: 890,
    reembolsoEstimado: 1424.00,
  },
  {
    id: '4',
    sku: '33061424',
    descricao: 'Chocolate KitKat Milk 41,5g',
    lojaId: '3',
    lojaNome: 'L03 LIDER DOCA',
    precoVendaAnterior: 4.50,
    precoVendaOferta: 3.49,
    descontoPercentual: 22.4,
    dataInicio: '2026-08-20',
    dataFim: '2026-09-20',
    tipoRebaixa: 'Preço de Custo',
    quantidadeVenda: 1500,
    reembolsoEstimado: 1515.00,
  }
];

export const realRebaixasDb = [
  { id: '24065', sku: '2676745', descricao: 'JAQUETA MOL MASC C/CAPUZ FICO PTO', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 10.09, precoVendaOferta: 8.07, descontoPercentual: 20.0, dataInicio: '2023-08-10', dataFim: '2023-10-08', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 242.4, supplierCodigo: '107251' }, 
  { id: '23665', sku: '1583352', descricao: 'REG MACHAO MALHA JUV FAKINI AMA/12', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 2.69, precoVendaOferta: 2.15, descontoPercentual: 20.0, dataInicio: '2023-08-10', dataFim: '2023-10-08', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 64.8, supplierCodigo: '200598' }, 
  { id: '24303', sku: '384526', descricao: 'BL COTT FEM MALWEE PTO/M', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 17.55, precoVendaOferta: 14.04, descontoPercentual: 20.0, dataInicio: '2023-08-10', dataFim: '2023-10-08', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 421.2, supplierCodigo: '103460' }, 
  { id: '23581', sku: '1362445', descricao: 'PIJAMA BLUSA+SHORT INF MALWEE ROS/06', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 1.15, precoVendaOferta: 0.92, descontoPercentual: 20.0, dataInicio: '2023-08-10', dataFim: '2023-10-08', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 27.6, supplierCodigo: '103460' }, 
  { id: '23785', sku: '1136356', descricao: 'BLUSA G POLO FEM MALWEE GOI/G', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 4.47, precoVendaOferta: 3.58, descontoPercentual: 20.0, dataInicio: '2023-08-10', dataFim: '2023-10-08', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 106.8, supplierCodigo: '103460' }, 
  { id: '23663', sku: '1583425', descricao: 'CAM G POLO MALHA INF FAKINI MAR/06', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 2.69, precoVendaOferta: 2.15, descontoPercentual: 20.0, dataInicio: '2023-08-10', dataFim: '2023-10-08', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 64.8, supplierCodigo: '200598' }, 
  { id: '18563', sku: '68861', descricao: 'CONJ MALHA BEBE MA LIL', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 40.39, precoVendaOferta: 32.31, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 969.6, supplierCodigo: '200598' }, 
  { id: '21629', sku: '2670127', descricao: 'CALCA MOL MA JUV LUNENDER PTO/18', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 3.17, precoVendaOferta: 2.54, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 75.6, supplierCodigo: '107251' }, 
  { id: '18089', sku: '2676753', descricao: 'JAQUETA MOL MASC C/CAPUZ FICO VDE/GG', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 10.09, precoVendaOferta: 8.07, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 242.4, supplierCodigo: '107251' }, 
  { id: '18379', sku: '60828', descricao: 'CONJ MEIA MALHA BEBE MO BCL', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 7.6, precoVendaOferta: 6.08, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 182.4, supplierCodigo: '103460' }, 
  { id: '18651', sku: '1462857', descricao: 'CAM XADREZ INF FAKINI AZL', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 1.81, precoVendaOferta: 1.45, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 43.2, supplierCodigo: '200598' }, 
  { id: '18559', sku: '62863', descricao: 'CONJ MALHA BEBE MO BCO', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 39.34, precoVendaOferta: 31.47, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 944.4, supplierCodigo: '103460' }, 
  { id: '18767', sku: '1637495', descricao: 'BLUSA MLH MA JUV MALWEE 42697 VDE/14', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 4.04, precoVendaOferta: 3.23, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 97.2, supplierCodigo: '103460' }, 
  { id: '21679', sku: '1751280', descricao: 'BLUSA MLH INF FAKINI 3576 ROS/06', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 3.61, precoVendaOferta: 2.89, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 86.4, supplierCodigo: '200598' }, 
  { id: '22181', sku: '2883627', descricao: 'VESTIDO BB MLH MA FORFUN AMA', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 7.5, precoVendaOferta: 6.0, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 180.0, supplierCodigo: '200598' }, 
  { id: '18401', sku: '1916688', descricao: 'CAM MC MASC MALWEE VRM/P', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 9.72, precoVendaOferta: 7.78, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 232.8, supplierCodigo: '103460' }, 
  { id: '19543', sku: '1756451', descricao: 'CASACO ESP FEM MALWEE 47298 OFF/GG', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 36.89, precoVendaOferta: 29.51, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 885.6, supplierCodigo: '103460' }, 
  { id: '21517', sku: '1848550', descricao: 'VEST MLH MA RN FAKINI 2011 BCO/M', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 2.42, precoVendaOferta: 1.94, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 57.6, supplierCodigo: '200598' }, 
  { id: '21689', sku: '2500256', descricao: 'CAM MLH JUV MO LUNENDER MAR/14', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 3.62, precoVendaOferta: 2.9, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 86.4, supplierCodigo: '107251' }, 
  { id: '22459', sku: '1969307', descricao: 'CAM PL MASC MALWEE VIN/GG', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 10.19, precoVendaOferta: 8.15, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 244.8, supplierCodigo: '103460' }, 
  { id: '22571', sku: '2355388', descricao: 'MACACAO MLH INF FAKINI MAR/04', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 11.73, precoVendaOferta: 9.38, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 282.0, supplierCodigo: '200598' }, 
  { id: '21675', sku: '1390309', descricao: 'CONJ BLUSA+SHORT PATATI PATATA', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 3.52, precoVendaOferta: 2.82, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 84.0, supplierCodigo: '103460' }, 
  { id: '19109', sku: '1743775', descricao: 'VEST ESP FEM LUNENDER 42240', lojaId: '8', lojaNome: 'L08 LIDER', precoVendaAnterior: 11.07, precoVendaOferta: 8.86, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 265.2, supplierCodigo: '107251' }, 
  { id: '21735', sku: '2445336', descricao: 'BL MLH FEM MALWEE', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 3.98, precoVendaOferta: 3.18, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 96.0, supplierCodigo: '103460' }, 
  { id: '21759', sku: '2167875', descricao: 'CAM MLH BB MO LUNENDER MAR/02', lojaId: '10', lojaNome: 'L10 LIDER', precoVendaAnterior: 4.29, precoVendaOferta: 3.43, descontoPercentual: 20.0, dataInicio: '2023-08-09', dataFim: '2023-10-07', tipoRebaixa: 'Acordo Comercial', quantidadeVenda: 120, reembolsoEstimado: 103.2, supplierCodigo: '107251' }
];

export const rebaixasMock: RebaixaMock[] = createDynamicArrayProxy(() => {
  const code = getActiveSupplierCode();
  const matchingReal = realRebaixasDb.filter((r) => r.supplierCodigo === code);
  if (matchingReal.length > 0) {
    return matchingReal;
  }
  return nestleRebaixasMock;
});

export const ofertasValidadeMock: OfertaValidadeMock[] = [
  {
    id: '101',
    sku: '30526116',
    descricao: 'Leite UHT Integral Ninho 1L',
    lojaId: '1',
    lojaNome: 'L01 LIDER CONDOR',
    precoNormal: 6.90,
    precoOferta: 4.99,
    dataVencimento: '2026-09-05',
    dataInicio: '2026-08-20',
    dataFim: '2026-09-04',
    quantidadeInicial: 2020,
    quantidadeVendida: 820,
    status: 'Ativa',
  },
  {
    id: '102',
    sku: '33504806',
    descricao: 'Iogurte Grego Tradicional Nestlé 400g',
    lojaId: '5',
    lojaNome: 'L05 LIDER CASTANHEIRA',
    precoNormal: 8.50,
    precoOferta: 5.90,
    dataVencimento: '2026-08-30',
    dataInicio: '2026-08-18',
    dataFim: '2026-08-29',
    quantidadeInicial: 600,
    quantidadeVendida: 150,
    status: 'Próxima ao Fim',
  },
  {
    id: '103',
    sku: '33061424',
    descricao: 'Chocolate KitKat Milk 41,5g',
    lojaId: '2',
    lojaNome: 'L02 LIDER ALCINDO CACELA',
    precoNormal: 4.50,
    precoOferta: 2.99,
    dataVencimento: '2026-08-22',
    dataInicio: '2026-08-01',
    dataFim: '2026-08-21',
    quantidadeInicial: 950,
    quantidadeVendida: 950,
    status: 'Expirada',
  }
];
