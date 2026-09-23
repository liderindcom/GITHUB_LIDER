import { addDays, format } from "date-fns";
import { lojaForaDoPortalFornecedor } from "@/lib/lojas-excluidas-portal";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import {
  getFiltroMercadologico,
  produtoPassaFiltro,
  rotuloComprador,
  rotuloDepartamento,
  rotuloGrupo,
  rotuloSecao,
  rotuloSubgrupo,
} from "@/lib/filtro-mercadologico";

export { normalizarCodigoFornecedor };

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
  taxaAcessoPct?: number;
  acessoDataInicio?: string | null;
  acessoDataFim?: string | null;
};

export const getActiveSupplierCode = (): string => {
  if (typeof window === "undefined") return "";
  return normalizarCodigoFornecedor(
    window.sessionStorage.getItem("portal-lider-sessao-fornecedor") || "",
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

export const clearActiveSupplierContext = () => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("portal-lider-sessao-fornecedor");
  }
  globalDbCache.fornecedor = null;
  globalDbCache.produtos = null;
  globalDbCache.vendas = null;
  globalDbCache.perdas = null;
  globalDbCache.estoque = null;
  globalDbCache.vendasMensais = null;
  globalDbCache.bloqueios = null;
  globalDbCache.pedidos = null;
  globalDbCache.faturas = null;
  globalDbCache.contasReceber = null;
  globalDbCache.nfePendentes = null;
  globalDbCache.docas = null;
  globalDbCache.conciliacao = null;
  globalDbCache.transferenciasCdam = null;
};
export const fornecedor = new Proxy({} as FornecedorType, {
  get(target, prop) {
    if (globalDbCache.fornecedor) {
      return Reflect.get(globalDbCache.fornecedor, prop);
    }
    const active = {} as FornecedorType;
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
  return globalDbCache.produtos ?? [];
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

export const pedidos = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.pedidos
    ? globalDbCache.pedidos.filter((p) => !lojaForaDoPortalFornecedor(p.lojaId))
    : [];
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

function dataCivilHojeSaoPaulo(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function dataCivilValida(valor: string): boolean {
  const raw = (valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [ano, mes, dia] = raw.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

/** Pedido apto a apuracao contratual: emissao civil ha mais de 30 dias. */
export function pedidoJulgavelFillRate(pedido: Pedido, agora = new Date()): boolean {
  const totais = quantidadesPedido(pedido);
  const emissao = (pedido.emissao || "").slice(0, 10);
  return (
    pedido.destino === "Fornecedor" &&
    pedido.status !== "Cancelado" &&
    totais.pedida > 0 &&
    dataCivilValida(emissao) &&
    diasEntre(emissao, dataCivilHojeSaoPaulo(agora)) > 30
  );
}

/** Falta contratual: pedido julgavel que nao teve nenhuma quantidade faturada. */
export function pedidoEmFaltaFillRate(pedido: Pedido, agora = new Date()): boolean {
  return pedidoJulgavelFillRate(pedido, agora) && quantidadesPedido(pedido).faturada <= 0;
}

/** Uma competencia so pode ser rotulada como cobravel depois da carencia de 30 dias. */
export function competenciaFillRateCobravel(competencia: string, agora = new Date()): boolean {
  if (!/^\d{4}-\d{2}$/.test(competencia)) return false;
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return (
    diasEntre(
      `${competencia}-${String(ultimoDia).padStart(2, "0")}`,
      dataCivilHojeSaoPaulo(agora),
    ) > 30
  );
}

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

export const vendas = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.vendas ? globalDbCache.vendas : [];
  return fonte.filter((v) => activeSkus.has(v.sku) && !lojaForaDoPortalFornecedor(v.lojaId));
});

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
    const list = globalDbCache.vendasMensais ?? [];
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
    const list = globalDbCache.vendasMensais ?? [];
    return Reflect.getOwnPropertyDescriptor(list, prop);
  },
  ownKeys() {
    if (globalDbCache.vendasMensais) {
      const list = globalDbCache.vendasMensais;
      return Reflect.ownKeys(list);
    }
    const list = globalDbCache.vendasMensais ?? [];
    return Reflect.ownKeys(list);
  },
}) as VendaMensal[];

export type EstoqueLinha = {
  sku: string;
  lojaId: string;
  estoqueMinimo: number;
  estoqueAtual: number;
};

export const estoque = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.estoque ? globalDbCache.estoque : [];
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
  const limiteDataISO = new Date(
    new Date(maxData + "T12:00:00").getTime() - janela * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const fatorMensal = 30 / janela;

  for (let i = 0; i < fonte.length; i++) {
    const v = fonte[i];
    if (v.data >= limiteDataISO && v.data <= maxData) {
      const filId = normalizarParaFilial(v.lojaId);
      map.set(
        v.sku + "_" + filId,
        (map.get(v.sku + "_" + filId) || 0) + v.quantidade * fatorMensal,
      );
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
  "recebimento_fornecedor_cdam" | "recebimento_fornecedor_loja" | "transferencia_interna" | "outra";

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
  return [];
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

export const contasReceberDoFornecedor = (
  codigoFornecedor: string = fornecedor.codigo,
): ContaReceberFornecedor[] => {
  const code = normalizarCodigoFornecedor(codigoFornecedor);
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const aberta = (conta: ContaReceberFornecedor) =>
    conta.status !== "Descontado" && (!conta.vencimento || conta.vencimento >= hojeIso);
  if (globalDbCache.contasReceber) {
    return globalDbCache.contasReceber.filter(
      (conta) => conta.fornecedorCodigo === code && aberta(conta),
    );
  }
  return [];
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

export const perdas = createDynamicArrayProxy(() => {
  const activeSkus = new Set(produtos.map((p) => p.sku));
  const fonte = globalDbCache.perdas ?? [];
  return fonte.filter((p) => activeSkus.has(p.sku) && !lojaForaDoPortalFornecedor(p.lojaId));
});

export const obterBloqueioProdutoLoja = (sku: string, lojaId: string): number => {
  if (globalDbCache.bloqueios) {
    const bloq = globalDbCache.bloqueios.find((b) => b.sku === sku && b.lojaId === lojaId);
    return bloq ? bloq.bloqueio : 0;
  }
  return 0;
};
