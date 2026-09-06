import {
  codigoProdutoComDigito,
  estoque,
  fornecedor,
  lojas,
  pedidos,
  produtos,
  subgrupoMercadologico,
  leadTimeEntregaCdam,
  vendas,
  type PedidoStatus,
  type Produto,
  type VendaItem,
} from "@/lib/mock-data";
import { mapaNomesComprador, nomeComprador } from "@/lib/comprador";

import { formatarClasseComposta, type ClasseAbcd } from "@/lib/classe-abcd";

export type JanelaSugestaoCompra = "30" | "60" | "90";
type ClasseComposta = `${ClasseAbcd}${Lowercase<ClasseAbcd>}`;

export type LinhaSugestaoCompra = {
  produto: Produto;
  codigo: string;
  compradorCodigo: string | null;
  comprador: string;
  fornecedorNome: string;
  subgrupo: string;
  classeValor: ClasseAbcd;
  classeQuantidade: ClasseAbcd;
  classeComposta: ClasseComposta;
  quantidadeVendida: number;
  faturamento: number;
  vendaMediaDiaria: number;
  leadTimeEntregaDias: number;
  coberturaObjetivoDias: number;
  estoqueCdam: number;
  pedidoAberto: number;
  estoqueAlvo: number;
  sugestaoBase: number;
  sugestaoCompra: number;
  embalagemCompra: number;
  tipoEmbalagemCompra: string;
  quantidadeEmbalagens: number;
  coberturaAtual: number | null;
  valorSugerido: number;
};

export const COBERTURA_BEST_SELLER_CDAM_DIAS = 60;

const pedidoAbertoStatus = new Set<PedidoStatus>(["Aberto", "Pendente", "Faturado"]);
const pedidoEntregueStatus = new Set<PedidoStatus>(["Entregue"]);

const inicioJanela = (linhas: VendaItem[], dias: number) => {
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

const embalagensCompraPorSku: Record<string, number> = {
  "10010": 12,
  "10020": 24,
  "10030": 30,
  "4244": 12,
  "1017": 20,
  "3213": 6,
  "37": 30,
};

const tiposEmbalagemCompraPorSku: Record<string, string> = {
  "10010": "CX",
  "10020": "CX",
  "10030": "PCT",
  "4244": "CX",
  "1017": "PCT",
  "3213": "PCT",
  "37": "PCT",
};

const embalagemCompra = (produto: Produto) => {
  if (produto.embalagemCompra && produto.embalagemCompra > 0) return produto.embalagemCompra;
  const embalagem = embalagensCompraPorSku[produto.sku];
  return embalagem && embalagem > 0 ? embalagem : 1;
};

const tipoEmbalagemCompra = (produto: Produto) =>
  produto.tipoEmbalagemCompra?.trim() || tiposEmbalagemCompraPorSku[produto.sku] || "UN";

const arredondarParaEmbalagem = (quantidade: number, embalagem: number) => {
  if (quantidade <= 0) return 0;
  return Math.ceil(quantidade / embalagem) * embalagem;
};

const mediaLeadTime = (valores: number[]) => {
  if (valores.length === 0) return null;
  return valores.reduce((acc, valor) => acc + valor, 0) / valores.length;
};

const leadTimeMedioPorSku = (sku: string, limite = 5) => {
  const pedidosEntregues = Array.from(pedidos)
    .filter((pedido) => {
      if (!pedidoEntregueStatus.has(pedido.status)) return false;
      if (!pedido.entradaCdam) return false;
      return pedido.itens.some((item) => item.sku === sku);
    })
    .sort((a, b) => (b.entradaCdam ?? "").localeCompare(a.entradaCdam ?? ""))
    .slice(0, limite)
    .map((pedido) => leadTimeEntregaCdam(pedido))
    .filter((leadTime): leadTime is number => leadTime !== null);

  return mediaLeadTime(pedidosEntregues);
};

const leadTimeMedioFornecedor = (limite = 5) => {
  const pedidosEntregues = Array.from(pedidos)
    .filter((pedido) => pedidoEntregueStatus.has(pedido.status) && pedido.entradaCdam)
    .sort((a, b) => (b.entradaCdam ?? "").localeCompare(a.entradaCdam ?? ""))
    .slice(0, limite)
    .map((pedido) => leadTimeEntregaCdam(pedido))
    .filter((leadTime): leadTime is number => leadTime !== null);

  return mediaLeadTime(pedidosEntregues) ?? 0;
};

export const compradorResponsavel = (produto: Produto, mapa?: Map<string, string>) => {
  return nomeComprador(produto, mapa);
};

export const calcularSugestoesCompraCdam = (
  janela: JanelaSugestaoCompra = "90",
): LinhaSugestaoCompra[] => {
  const dias = Number(janela);
  const listPedidos = Array.from(pedidos);

  // Pre-calculate lead times map for all SKUs in 1 pass to avoid nested O(N*M) loop performance issues!
  const skuLeadTimes = new Map<string, number[]>();
  const entregues = listPedidos
    .filter((pedido) => pedidoEntregueStatus.has(pedido.status) && pedido.entradaCdam)
    .sort((a, b) => (b.entradaCdam ?? "").localeCompare(a.entradaCdam ?? ""));
    
  for (const p of entregues) {
    const leadTime = leadTimeEntregaCdam(p);
    if (leadTime === null) continue;
    for (const item of p.itens) {
      const list = skuLeadTimes.get(item.sku) || [];
      if (list.length < 5) {
        list.push(leadTime);
        skuLeadTimes.set(item.sku, list);
      }
    }
  }
  
  const leadTimeMap = new Map<string, number>();
  for (const [sku, times] of skuLeadTimes.entries()) {
    leadTimeMap.set(sku, mediaLeadTime(times) ?? 0);
  }

  const produtosAtuais = Array.from(produtos);
  const nomesComprador = mapaNomesComprador(produtosAtuais);
  const produtosPorSku = new Map(produtosAtuais.map((produto) => [produto.sku, produto]));
  const inicio = inicioJanela(Array.from(vendas), dias);
  const vendasPeriodo = Array.from(vendas).filter((venda) => {
    if (!produtosPorSku.has(venda.sku)) return false;
    if (inicio && venda.data < inicio) return false;
    return true;
  });

  const vendaSku = new Map<string, { quantidade: number; faturamento: number }>();
  for (const venda of vendasPeriodo) {
    const atual = vendaSku.get(venda.sku) ?? { quantidade: 0, faturamento: 0 };
    atual.quantidade += venda.quantidade;
    atual.faturamento += venda.quantidade * venda.valorUnitario;
    vendaSku.set(venda.sku, atual);
  }

  const linhasBase = produtosAtuais.map((produto) => {
    const vendaProduto = vendaSku.get(produto.sku) ?? { quantidade: 0, faturamento: 0 };
    const cls = formatarClasseComposta(produto.classeTopStar || produto.classeComposta);
    const clV = cls[0] as ClasseAbcd;
    const clQ = (cls[1] || "d").toUpperCase() as ClasseAbcd;
    
    return {
      produto,
      codigo: codigoProdutoComDigito(produto.sku),
      compradorCodigo: produto.compradorCodigo?.trim() || null,
      comprador: compradorResponsavel(produto, nomesComprador),
      fornecedorNome: fornecedor.nome,
      subgrupo: subgrupoMercadologico(produto),
      quantidadeVendida: vendaProduto.quantidade,
      faturamento: vendaProduto.faturamento,
      classeValor: clV,
      classeQuantidade: clQ,
    };
  });

  const codigosCdam = new Set(
    lojas.filter((loja) => loja.tipo === "D").flatMap((loja) => [loja.id, loja.idLocal]),
  );
  codigosCdam.add(fornecedor.filialEntregaPadrao);
  codigosCdam.add("13");
  const leadTimeFornecedor = leadTimeMedioFornecedor();

  const estoqueCdamPorSku = new Map<string, number>();
  for (const linha of Array.from(estoque)) {
    if (!codigosCdam.has(linha.lojaId)) continue;
    estoqueCdamPorSku.set(linha.sku, (estoqueCdamPorSku.get(linha.sku) ?? 0) + linha.estoqueAtual);
  }

  const pedidoAbertoPorSku = new Map<string, number>();
  for (const pedido of Array.from(pedidos)) {
    if (!pedidoAbertoStatus.has(pedido.status)) continue;

    for (const item of pedido.itens) {
      const saldo = Math.max(0, item.quantidadePedida - item.quantidadeFaturada);
      pedidoAbertoPorSku.set(item.sku, (pedidoAbertoPorSku.get(item.sku) ?? 0) + saldo);
    }
  }

  return linhasBase
    .map((linha) => {
      const classeComposta =
        `${linha.classeValor}${linha.classeQuantidade.toLowerCase()}` as ClasseComposta;
      const vendaMediaDiaria = linha.quantidadeVendida / dias;
      const leadTimeEntregaDias = Math.ceil(
        leadTimeMap.get(linha.produto.sku) ?? leadTimeFornecedor,
      );
      const coberturaObjetivoDias = COBERTURA_BEST_SELLER_CDAM_DIAS + leadTimeEntregaDias;
      const estoqueCdam = Math.round(estoqueCdamPorSku.get(linha.produto.sku) ?? 0);
      const pedidoAberto = Math.round(pedidoAbertoPorSku.get(linha.produto.sku) ?? 0);
      const estoqueAlvo = Math.ceil(vendaMediaDiaria * coberturaObjetivoDias);
      const sugestaoBase = Math.max(0, Math.ceil(estoqueAlvo - estoqueCdam - pedidoAberto));
      const embalagem = embalagemCompra(linha.produto);
      const sugestaoCompra = arredondarParaEmbalagem(sugestaoBase, embalagem);

      return {
        ...linha,
        classeComposta,
        vendaMediaDiaria,
        leadTimeEntregaDias,
        coberturaObjetivoDias,
        estoqueCdam,
        pedidoAberto,
        estoqueAlvo,
        sugestaoBase,
        sugestaoCompra,
        embalagemCompra: embalagem,
        tipoEmbalagemCompra: tipoEmbalagemCompra(linha.produto),
        quantidadeEmbalagens: sugestaoCompra / embalagem,
        coberturaAtual: vendaMediaDiaria > 0 ? estoqueCdam / vendaMediaDiaria : null,
        valorSugerido: sugestaoCompra * linha.produto.precoTabela,
      };
    })
    .filter((linha) => linha.classeComposta === "Aa")
    .sort(
      (a, b) =>
        a.comprador.localeCompare(b.comprador, "pt-BR") || b.sugestaoCompra - a.sugestaoCompra,
    );
};
