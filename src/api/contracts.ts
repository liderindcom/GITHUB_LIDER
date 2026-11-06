/** Shared response contracts for the portal server functions. */

export type MarcaFornecedorDB = {
  sku: string;
  marca: string;
  atualizadoEm: string;
};
export type UsuarioFornecedorRow = {
  id: string;
  fornecedorCodigo: string;
  nome: string;
  email: string;
  senhaHash: string;
  ativo: number;
  criadoEm: string;
  precisaTrocarSenha?: number;
};
export type FornecedorDB = {
  codigo: string;
  nome: string;
  cnpj: string;
  cnpjSenhaInicial: string;
  destinatario: string;
  modeloEntrega: string;
  agendaRecebimentoCdam?: number | null;
  filialEntregaPadrao: string;
  fornecedorComercialCodigo?: string | null;
  fornecedorComercialNome?: string | null;
  prazoPagamentoDias: number;
  prazoTipo?: "DDE" | "DDR" | null;
  descontoFinanceiroPct: number;
  condicaoPagamentoLabel: string;
  acessoLiberado?: number;
  metaFillRatePct?: number;
  isentoCobranca?: number;
  acessoDataInicio?: string | null;
  acessoDataFim?: string | null;
  acessoStatus?:
    | "SEM_ACORDO"
    | "DEGUSTACAO"
    | "AGUARDANDO_CONTRATO"
    | "AGUARDANDO_COMPETENCIA"
    | "COBRANCA_ATIVA"
    | "ATIVO_COM_ACORDO"
    | "EXPIRADO"
    | null;
  acordoNumero?: string | null;
  degustacaoUsada?: number | null;
  taxaAcessoPct?: number | null;
  carenciaDias?: number | null;
  carenciaAte?: string | null;
  primeiraCompetenciaCobravel?: string | null;
  primeiraCobrancaEm?: string | null;
  ultimoAcordoMes?: string | null;
};
export type ProdutoDB = {
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
  papelMercadologico: string;
  precoTabela: number;
  cmvUnit: number;
  precoMinSubgrupo?: number;
  precoMaxSubgrupo?: number;
  fornecedorCodigo: string;
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
};
export type PerdaDB = {
  id: number;
  fornecedorCodigo: string;
  lojaId: string;
  lojaNome: string;
  numeroNota: string | null;
  serie: string | null;
  sku: string;
  produtoDescricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  data: string;
  ocorrencias: number;
};
export type VendaDB = {
  id?: number;
  data: string;
  lojaId: string;
  sku: string;
  quantidade: number;
  valorUnitario: number;
};
export type EstoqueDB = {
  sku: string;
  lojaId: string;
  estoqueAtual: number;
  dataEstoque?: string | null;
  dataInventario?: string | null;
};
export type FaturaDB = {
  id: string;
  numeroNota: string;
  serie?: string;
  chaveNfe?: string;
  emissao: string;
  recebimento?: string;
  dataPagamento: string;
  valor: number;
  descontoFinanceiro: number;
  valorLiquido: number;
  status: "A vencer" | "Pago";
  lojaId: string;
  destTipo?: string;
  fornecedorCodigo: string;
  direcao: "fornecedor_para_lider";
  destinatario: string;
  agendaRms: number;
  natureza: "recebimento_fornecedor_cdam" | "recebimento_fornecedor_loja";
  prazoTipo?: "DDE" | "DDR";
};
export type PedidoStatusDB = "Aberto" | "Faturado" | "Pendente" | "Entregue" | "Cancelado";
export type PedidoItemDB = {
  sku: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  precoUnitario: number;
};
export type PedidoDB = {
  numero: string;
  destino: "Fornecedor";
  origemOperacional: string;
  destinoOperacional: string;
  agenda: {
    contexto: "Compras/Recebimento";
    agendaEntrada: string;
    agendaParidade: string;
    regra: string;
  };
  emissao: string;
  entregaPrevista: string;
  entradaCdam?: string;
  lojaId: string;
  status: PedidoStatusDB;
  totLiq?: number;
  itens: PedidoItemDB[];
};
export type ShareJanela = "30" | "60" | "90" | "180" | "365" | "tudo";
export type ShareCategoriaDB = {
  categoria: string;
  departamento: string;
  secao: string;
  grupo: string;
  subgrupo: string;
  fornecedorValor: number;
  liderValor: number;
  fornecedorQuantidade: number;
  liderQuantidade: number;
  fornecedorSkus: number;
  liderSkus: number;
  shareValor: number;
  shareQuantidade: number;
};
export type ShareMarcaDB = {
  marca: string;
  fornecedorValor: number;
  fornecedorQuantidade: number;
  produtos: number;
  categorias: number;
  sharePortfolio: number;
};
export type ShareResumoDB = {
  fornecedorValor: number;
  liderValorCategorias: number;
  fornecedorQuantidade: number;
  liderQuantidadeCategorias: number;
  categorias: number;
  marcas: number;
  produtos: number;
  shareValorMedio: number;
  shareQuantidadeMedio: number;
};
export type ShareFornecedorDB = {
  periodo: {
    janela: ShareJanela;
    inicio: string | null;
    fim: string | null;
  };
  categorias: ShareCategoriaDB[];
  marcas: ShareMarcaDB[];
  resumo: ShareResumoDB;
};
export type AtualizacaoDadosFornecedorDB = {
  status: string;
  ultimoSucessoEm: string | null;
  ultimaTentativaEm: string | null;
  execucaoStatus: string | null;
  execucaoInicioEm: string | null;
  execucaoFimEm: string | null;
  execucaoErro: string | null;
};
export type FornecedorAcordoCadastroDB = {
  codigo: string;
  nome: string;
  acessoLiberado: number;
  acessoStatus: string | null;
  acordoNumero: string | null;
  contratoAssinadoEm: string | null;
  contratoDocumentoRef: string | null;
  contratoValidadoEm: string | null;
  contratoValidadoPor: string | null;
};
export type ProdutoBloqueioDB = {
  sku: string;
  lojaId: string;
  bloqueio: number;
};
export type FaixaPrecoSubgrupoDB = {
  departamentoCodigo: string;
  secaoCodigo: string;
  grupoCodigo: string;
  subgrupoCodigo: string;
  precoMin: number;
  precoMax: number;
  nSku: number;
};
export type ContaReceberDB = {
  id: string;
  documento: string;
  tipo: "Acordo comercial" | "Bonificação" | "Devolução" | "Avaria" | "Verba comercial";
  descricao: string;
  emissao: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: "Aberto" | "Programado" | "Em análise" | "Descontado";
  abatimentoProximoPagamento: boolean;
  origem: string;
  observacao: string;
  fornecedorCodigo: string;
  agendaRms: string | null;
};
export type ComprasAnoMesDB = {
  mes: string;
  pedido: number;
  entregue: number;
  perda: number;
  documentos: number;
};
export type ComprasAnoDestinoDB = {
  lojaId: string;
  pedido: number;
  entregue: number;
  perda: number;
};
export type ComprasAnoDB = {
  ano: number;
  ateMes: string;
  pedido: number;
  entregue: number;
  perda: number;
  documentos: number;
  documentosEmAberto: number;
  meses: ComprasAnoMesDB[];
  destinos: ComprasAnoDestinoDB[];
};
export type RentabilidadeLinhaDB = {
  fornecedorCodigo: string;
  fornecedorNome: string;
  segmento: string;
  sku: string;
  descricao: string;
  departamento: string;
  secao: string;
  grupo: string;
  subgrupo: string;
  categoria: string;
  quantidade: number;
  receitaBruta: number;
  receitaLiquida: number;
  cmv: number;
  rebaixaApurada: number;
  rebaixaRecebida: number;
  margemBruta: number;
  resultadoGerencial: number;
  resultadoRealizado: number;
  estoqueQuantidade: number;
  estoqueValor: number;
  estoqueData: string | null;
  coberturaDias: number | null;
  /** Termos preservados para a busca da visão interna após a agregação hierárquica. */
  produtosBusca?: string;
};
export type RentabilidadeRebaixaDB = {
  id: string;
  fornecedorCodigo: string;
  sku: string | null;
  descricao: string;
  valor: number;
  dataReferencia: string | null;
  dataRecebimento: string | null;
  status: "apurada" | "recebida";
  origem: string;
  agendaRms?: string | null;
};
export type RentabilidadeDB = {
  modo: "interno" | "fornecedor";
  fonte: "live" | "mock";
  periodo: { de: string; ate: string };
  linhas: RentabilidadeLinhaDB[];
  rebaixas: RentabilidadeRebaixaDB[];
  rebaixasNaoAlocadas: Array<{ fornecedorCodigo: string; valor: number }>;
  estoque: {
    quantidade: number;
    valor: number;
    data: string | null;
    linhasComEstoque: number;
    coberturaDias: number | null;
  };
  benchmark: {
    participantes: number;
    receitaMedia: number;
    resultadoGerencialMedio: number;
    margemGerencialMediaPct: number;
    resultadoRealizadoMedio: number;
    margemRealizadaMediaPct: number;
  } | null;
};
export type TransferenciaCdamDB = {
  sku: string;
  lojaId: string;
  data: string;
  quantidade: number;
};
export type NfePendenteDB = {
  id: string;
  fornecedorCodigo: string;
  numeroNota: string;
  chaveNfe: string;
  lojaId: string;
  destTipo: string;
  situacao: string;
  situacaoDescricao: string;
  agendaRms: string;
  agendaPrevisao?: string | null;
  status: string;
};
export type DocaDB = {
  lojaId: string;
  doca: string;
  tipo: string;
  horaInicio: string;
  horaFim: string;
  diasUteis?: string;
};
export type SolicitacaoAgendamentoDB = {
  id: string;
  fornecedorCodigo: string;
  lojaId: string;
  doca: string;
  dataSolicitada: string;
  horaInicio: string;
  horaFim: string;
  tipoCarga: "paletizada" | "batida";
  paletes: number;
  portas: number;
  status: string;
  criadoEm: string;
};
export type ConciliacaoItemDB = {
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
};
export type NfeXmlItemDB = {
  id: string;
  sku: string;
  descricao: string;
  quantidade: number;
  preco: number;
  pedido: string;
};
export type CapacidadeCargaAgendamentoDB = {
  paletes: number | null;
  caixas: number;
  itens: number;
  itensSemCadastro: string[];
};
export type CompraMesAnteriorDB = {
  mes: string;
  compra: number;
  umPct: number;
  documentos: number;
};
export type RelatorioAcordoAcessoLinhaDB = {
  codigo: string;
  nome: string;
  segmento: string;
  compra: number;
  taxaAcessoPct: number;
  cobrancaAcesso: number;
  fillRatePct: number;
  metaFillRatePct: number;
  multaTresPct: number;
  totalCobranca: number;
  documentos: number;
};
export type RelatorioAcordoAcessoDB = {
  mes: string;
  linhas: RelatorioAcordoAcessoLinhaDB[];
};
export type AcordoCobrancaDB = {
  encontrado: boolean;
  numeroAcordo: string;
  id?: string;
  documento?: string;
  descricao?: string;
  valor?: number;
  status?: string;
  competencia?: string;
  vencimento?: string;
};
export type AcordoAcessoPortalDB = {
  id: string;
  fornecedorCodigo: string;
  mesReferencia: string;
  valorCompra: number;
  valorUmPct: number;
  numeroAcordo: string;
  encontrado: number;
  cobrancaId: string | null;
  cobrancaDescricao: string | null;
  cobrancaValor: number | null;
  usuarioInterno: string;
  criadoEm: string;
  contratoAssinadoEm?: string | null;
  contratoDocumentoRef?: string | null;
};
export type FillratePoliticaDB = {
  taxaMultaPct: number;
  atualizadoEm: string;
};
export type FillrateAcordoDB = {
  codigo: string;
  metaFillRatePct: number;
  taxaMultaPct: number;
};
export type VendasAnualMesDB = {
  mes: number;
  nome: string;
  dias: number;
  pesoAnoPct: number;
  farolAcumPct: number;
  redeValorBase: number;
  redeValorAtual: number;
  redeVolumeBase: number;
  redeVolumeAtual: number;
  fornValorBase: number;
  fornValorAtual: number;
  fornVolumeBase: number;
  fornVolumeAtual: number;
  aberto: boolean;
};
export type VendasAnualSecaoDB = {
  secao: string;
  valorBase: number;
  valorBaseYtd: number;
  valorAtual: number;
  volumeBase: number;
  volumeBaseYtd: number;
  volumeAtual: number;
  crescimentoValorPct: number | null;
  crescimentoVolumePct: number | null;
};
export type VendasAnualItemDB = {
  sku: string;
  descricao: string;
  secao: string;
  codigoProdutoRms: string | null;
  digitoProdutoRms: string | null;
  valorBase: number;
  valorBaseYtd: number;
  valorAtual: number;
  volumeBase: number;
  volumeAtual: number;
  crescimentoValorPct: number | null;
  contribuicaoFuro: number;
};
export type VendasAnualDB = {
  corte: {
    data: string;
    dia: number;
    mes: number;
    anoAtual: number;
    anoBase: number;
  };
  segmento: string;
  farolPct: number;
  cacheAte: string | null;
  temAnoAtual: boolean;
  rede: {
    anualBase: number;
    ytdAtual: number;
    realizadoPct: number | null;
    pontos: number | null;
  };
  fornecedor: {
    anualBase: number;
    ytdAtual: number;
    realizadoPct: number | null;
    pontos: number | null;
  };
  meses: VendasAnualMesDB[];
  secoes: VendasAnualSecaoDB[];
  itens: VendasAnualItemDB[];
};
export type OfertaInteliderDB = {
  id: string;
  tipo: "validade" | "rebaixa";
  fornecedorCodigo: string;
  sku: string;
  descricao: string;
  lojaId: string;
  lojaNome: string;
  precoNormal: number;
  precoOferta: number;
  descontoPercentual: number;
  dataInicio: string | null;
  dataFim: string | null;
  dataVencimento: string | null;
  quantidadeInicial: number;
  quantidadeVendida: number;
  estoqueAtual: number;
  status: "Ativa" | "Próxima ao Fim" | "Expirada" | "Encerrada";
  responsabilidade: "fornecedor" | "lider" | "indefinida";
  reembolsoEstimado: number;
  origemTabela: string;
  atualizadoEm: string;
};
export type OfertasInteliderDB = {
  rebaixas: OfertaInteliderDB[];
  validade: OfertaInteliderDB[];
  fonte: "intelider";
  atualizadoEm: string | null;
};
export type RebaixaSolicitacaoDB = {
  id: string;
  fornecedorCodigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  segmentos: string;
  lojas: string;
  itens: string;
  status: "rascunho" | "enviada" | "em análise" | "aprovada" | "recusada" | "efetivada";
  criadoEm: string;
  enviadoEm: string | null;
  tipo?: "rebaixa" | "tabela_preco";
  compradorCodigo?: string | null;
  compradorNome?: string | null;
  destinatarios?: string | null;
};
export type RebaixaSegmentoEmailDB = {
  segmento: string;
  email: string;
  atualizadoEm: string;
};
export type RebaixaCompradorDB = { codigo: string; nome: string };
export type RebaixaDestinatarioDB = {
  id: string;
  compradorCodigo: string;
  compradorNome: string;
  papel: "comprador" | "auxiliar";
  segmento: string;
  emailPrincipal: string;
  emailAlternativo?: string | null;
  ativo: number;
  criadoEm: string;
  atualizadoEm: string;
};
export type UsuarioInternoDB = {
  username: string;
  nome: string;
  role: string;
  senhaHash?: string;
};
export type UsuarioFornecedorDB = {
  id: string;
  nome: string;
  email: string;
  ativo: number;
  criadoEm: string;
};
export type PropostaPrecoDB = {
  id: number;
  loteId: string;
  fornecedorCodigo: string;
  sku: string;
  descricao: string;
  precoAtual: number;
  precoProposto: number;
  status: string;
  justificativa: string | null;
  respostaAdmin: string | null;
  criadoEm: string;
  respondidoEm: string | null;
};
