import { addDays, format } from "date-fns";
import { lojaForaDoPortalFornecedor } from "@/lib/lojas-excluidas-portal";
import { normalizarCodigoFornecedor, soDigitos } from "@/lib/fornecedor-codigo";
import {
  agendasRms,
  createDynamicArrayProxy,
  fornecedor,
  getActiveSupplierCode,
  globalDbCache,
  lojaPorCodigo,
  normalizarParaFilial,
  produtos,
  type CadastroFinanceiro,
  type TipoPrazoPagamento,
} from "./mock-data-catalog";
import { vendas, type VendaItem } from "./mock-data-orders";
import { d } from "./mock-data-orders";

export type EstoqueLinha = {
  sku: string;
  lojaId: string;
  estoqueMinimo: number;
  estoqueAtual: number;
  dataEstoque?: string | null;
  dataInventario?: string | null;
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
let lastVendasRef: VendaItem[] | null = null;
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
    const venda = fonte[i];
    if (!venda) continue;
    const d = venda.data;
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
    if (!v) continue;
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
      calcularDataPagamento(input.emissao, cadastro.prazoPagamentoDias, cadastro.prazoTipo) ?? "",
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
  const code = soDigitos(codigoFornecedor);
  if (globalDbCache.faturas) {
    const exatas = globalDbCache.faturas.filter(
      (f) => f.fornecedorCodigo === code && !agendasTransferencia.has(f.agendaRms),
    );
    if (exatas.length > 0) return exatas;
    const base = normalizarCodigoFornecedor(code);
    return globalDbCache.faturas.filter(
      (f) =>
        normalizarCodigoFornecedor(f.fornecedorCodigo) === base &&
        !agendasTransferencia.has(f.agendaRms),
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
  agendaRms?: string | number | null;
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
  const code = soDigitos(codigoFornecedor);
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const aberta = (conta: ContaReceberFornecedor) =>
    conta.status !== "Descontado" && (!conta.vencimento || conta.vencimento >= hojeIso);
  if (globalDbCache.contasReceber) {
    return globalDbCache.contasReceber.filter(
      (conta) => conta.fornecedorCodigo === code && aberta(conta),
    );
  }
  return contasReceberFornecedor.filter(
    (conta) => conta.fornecedorCodigo === code && aberta(conta),
  );
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
  numeroNota?: string | null;
  serie?: string | null;
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
  const fonte = globalDbCache.perdas
    ? globalDbCache.perdas
    : all_perdas.filter((p) => p.fornecedorCodigo === getActiveSupplierCode());
  return fonte.filter((p) => !lojaForaDoPortalFornecedor(p.lojaId));
});
