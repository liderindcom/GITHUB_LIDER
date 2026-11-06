import { createServerFn } from "@tanstack/react-start";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import {
  contasReceberFornecedor,
  DEMO_FORNECEDOR_CODIGO,
  estoque as estoqueMock,
  fornecedores as fornecedoresMock,
  getActiveSupplierCode,
  produtos as produtosMock,
  rebaixasMock,
  setActiveSupplierCode,
  vendas as vendasMock,
} from "@/lib/mock-data";
import { segmentoIntelider } from "@/lib/acordo-acesso";
import { db } from "../server/db";
import { exigirInterno, lerSessaoPortal } from "../server/sessao-portal";
import { colunaExiste, sqlSkuVisivel, tabelaExiste } from "./db-support";
import type { RentabilidadeDB, RentabilidadeLinhaDB, RentabilidadeRebaixaDB } from "./contracts";

type RentabilidadeProdutoRow = {
  fornecedorCodigo: string | null;
  sku: string;
  descricao: string | null;
  departamentoCodigo: string | null;
  departamento: string | null;
  secao: string | null;
  grupo: string | null;
  subgrupo: string | null;
  categoria: string | null;
  cmvUnit: number | null;
  data: string;
  quantidade: number;
  valorUnitario: number;
};

type RentabilidadeEstoqueRow = {
  fornecedorCodigo: string | null;
  sku: string;
  descricao: string | null;
  departamentoCodigo: string | null;
  departamento: string | null;
  secao: string | null;
  grupo: string | null;
  subgrupo: string | null;
  categoria: string | null;
  estoqueQuantidade: number;
  estoqueValor: number;
  estoqueData: string | null;
};

type RentabilidadeOfertaRow = {
  id: string;
  fornecedorCodigo: string;
  sku: string;
  descricao: string;
  reembolsoEstimado: number;
  dataInicio: string | null;
  dataFim: string | null;
};

type RentabilidadeContaRow = {
  id: string;
  fornecedorCodigo: string;
  tipo: string;
  descricao: string | null;
  emissao: string | null;
  vencimento: string | null;
  competencia: string | null;
  valor: number;
  status: string;
  agendaRms?: string | number | null;
};

const tiposRebaixaRentabilidade = new Set(["Acordo comercial", "Bonificação", "Verba comercial"]);
const AGENDA_REBAIXA_CREDITO = "159";

const agendaRentabilidade = (valor: unknown): string | null => {
  const agenda = String(valor ?? "")
    .trim()
    .replace(/^0+/, "");
  return agenda || null;
};

const contaEhRebaixaRentabilidade = (conta: RentabilidadeContaRow): boolean =>
  tiposRebaixaRentabilidade.has(conta.tipo) ||
  (agendaRentabilidade(conta.agendaRms) === AGENDA_REBAIXA_CREDITO && Number(conta.valor || 0) > 0);

const dataRentabilidade = (valor: unknown): string | null => {
  const data = String(valor ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
};

const periodoRentabilidade = (valor: unknown, fallback: string): string =>
  dataRentabilidade(valor) ?? fallback;

const sobrepoePeriodoRentabilidade = (
  inicio: string | null,
  fim: string | null,
  de: string,
  ate: string,
) => (!inicio || !fim ? true : inicio <= ate && fim >= de);

const competenciaNoPeriodoRentabilidade = (competencia: string | null, de: string, ate: string) => {
  const match = String(competencia ?? "").match(/^(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const inicio = `${match[2]}-${match[1]}-01`;
  const fim = new Date(Date.UTC(Number(match[2]), Number(match[1]), 0)).toISOString().slice(0, 10);
  return inicio <= ate && fim >= de;
};

const codigoRentabilidade = (valor: unknown): string => {
  const codigo = normalizarCodigoFornecedor(String(valor ?? "").trim());
  return codigo || DEMO_FORNECEDOR_CODIGO;
};

const arredondarRentabilidade = (valor: number) => Number(valor.toFixed(2));

/**
 * A visão interna exibe somente o comparativo por fornecedor. Agrupar por
 * fornecedor e hierarquia mantém todos os filtros gerenciais, mas evita
 * serializar dezenas de milhares de SKUs/rebaixas que só são necessários na
 * visão detalhada do fornecedor.
 */
function agruparLinhasRentabilidadeInterna(linhas: RentabilidadeLinhaDB[]) {
  const grupos = new Map<string, { linha: RentabilidadeLinhaDB }>();
  for (const linha of linhas) {
    const chave = [
      linha.fornecedorCodigo,
      linha.segmento,
      linha.departamento,
      linha.secao,
      linha.grupo,
      linha.subgrupo,
    ].join("\t");
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        linha: {
          ...linha,
          sku: `__GRUPO__:${linha.fornecedorCodigo}:${linha.segmento}:${linha.departamento}:${linha.secao}:${linha.grupo}:${linha.subgrupo}`,
          descricao: "Produtos agrupados",
          quantidade: 0,
          receitaBruta: 0,
          receitaLiquida: 0,
          cmv: 0,
          rebaixaApurada: 0,
          rebaixaRecebida: 0,
          margemBruta: 0,
          resultadoGerencial: 0,
          resultadoRealizado: 0,
          estoqueQuantidade: 0,
          estoqueValor: 0,
          estoqueData: null,
          coberturaDias: null,
        },
      };
      grupos.set(chave, grupo);
    }
    grupo.linha.quantidade += linha.quantidade;
    grupo.linha.receitaBruta += linha.receitaBruta;
    grupo.linha.receitaLiquida += linha.receitaLiquida;
    grupo.linha.cmv += linha.cmv;
    grupo.linha.rebaixaApurada += linha.rebaixaApurada;
    grupo.linha.rebaixaRecebida += linha.rebaixaRecebida;
    grupo.linha.margemBruta += linha.margemBruta;
    grupo.linha.resultadoGerencial += linha.resultadoGerencial;
    grupo.linha.resultadoRealizado += linha.resultadoRealizado;
    grupo.linha.estoqueQuantidade += linha.estoqueQuantidade;
    grupo.linha.estoqueValor += linha.estoqueValor;
    if (!grupo.linha.estoqueData || String(linha.estoqueData || "") > grupo.linha.estoqueData) {
      grupo.linha.estoqueData = linha.estoqueData;
    }
  }
  return [...grupos.values()].map(
    ({ linha }) =>
      ({
        fornecedorCodigo: linha.fornecedorCodigo,
        fornecedorNome: linha.fornecedorNome,
        segmento: linha.segmento,
        departamento: linha.departamento,
        secao: linha.secao,
        grupo: linha.grupo,
        subgrupo: linha.subgrupo,
        quantidade: arredondarRentabilidade(linha.quantidade),
        receitaLiquida: arredondarRentabilidade(linha.receitaLiquida),
        cmv: arredondarRentabilidade(linha.cmv),
        rebaixaApurada: arredondarRentabilidade(linha.rebaixaApurada),
        rebaixaRecebida: arredondarRentabilidade(linha.rebaixaRecebida),
        margemBruta: arredondarRentabilidade(linha.margemBruta),
        resultadoGerencial: arredondarRentabilidade(linha.resultadoGerencial),
        resultadoRealizado: arredondarRentabilidade(linha.resultadoRealizado),
        estoqueQuantidade: arredondarRentabilidade(linha.estoqueQuantidade),
        estoqueValor: arredondarRentabilidade(linha.estoqueValor),
      }) as RentabilidadeLinhaDB,
  );
}

function linhasMockRentabilidade(
  codigos: string[],
  de: string,
  ate: string,
): {
  vendas: RentabilidadeProdutoRow[];
  estoques: RentabilidadeEstoqueRow[];
  ofertas: RentabilidadeOfertaRow[];
  contas: RentabilidadeContaRow[];
} {
  const vendas: RentabilidadeProdutoRow[] = [];
  const estoques: RentabilidadeEstoqueRow[] = [];
  const ofertas: RentabilidadeOfertaRow[] = [];
  const contas: RentabilidadeContaRow[] = [];
  const anterior = getActiveSupplierCode();
  try {
    for (const codigo of codigos) {
      setActiveSupplierCode(codigo);
      const produtosPorSku = new Map(produtosMock.map((produto) => [String(produto.sku), produto]));
      const estoquesPorSku = new Map<string, RentabilidadeEstoqueRow>();
      for (const saldo of estoqueMock) {
        const produto = produtosPorSku.get(String(saldo.sku));
        if (!produto) continue;
        const sku = String(saldo.sku);
        const atual = estoquesPorSku.get(sku) || {
          fornecedorCodigo: codigoRentabilidade(produto.fornecedorCodigo ?? codigo),
          sku,
          descricao: produto.descricao,
          departamentoCodigo: produto.departamentoCodigo,
          departamento: produto.departamento,
          secao: produto.secao,
          grupo: produto.grupo,
          subgrupo: produto.subgrupo,
          categoria: produto.categoria,
          estoqueQuantidade: 0,
          estoqueValor: 0,
          estoqueData: null,
        };
        atual.estoqueQuantidade += Number(saldo.estoqueAtual || 0);
        atual.estoqueValor +=
          Number(saldo.estoqueAtual || 0) * Math.max(0, Number(produto.cmvUnit || 0));
        atual.estoqueData = saldo.dataEstoque || saldo.dataInventario || atual.estoqueData;
        estoquesPorSku.set(sku, atual);
      }
      estoques.push(...estoquesPorSku.values());
      for (const venda of vendasMock) {
        if (venda.data < de || venda.data > ate) continue;
        const produto = produtosPorSku.get(String(venda.sku));
        if (!produto) continue;
        vendas.push({
          fornecedorCodigo: codigoRentabilidade(produto.fornecedorCodigo ?? codigo),
          sku: String(venda.sku),
          descricao: produto.descricao,
          departamentoCodigo: produto.departamentoCodigo,
          departamento: produto.departamento,
          secao: produto.secao,
          grupo: produto.grupo,
          subgrupo: produto.subgrupo,
          categoria: produto.categoria,
          cmvUnit: Number(produto.cmvUnit ?? 0),
          data: venda.data,
          quantidade: Number(venda.quantidade ?? 0),
          valorUnitario: Number(venda.valorUnitario ?? 0),
        });
      }
      // O proxy de demonstração usa Nestlé como fallback para qualquer código;
      // não podemos atribuir essa amostra aos demais fornecedores do benchmark.
      const ofertasDoFornecedor = codigo === DEMO_FORNECEDOR_CODIGO ? rebaixasMock : [];
      for (const oferta of ofertasDoFornecedor) {
        const inicio = dataRentabilidade(oferta.dataInicio);
        const fim = dataRentabilidade(oferta.dataFim);
        if (!sobrepoePeriodoRentabilidade(inicio, fim, de, ate)) continue;
        ofertas.push({
          id: String(oferta.id),
          fornecedorCodigo: codigo,
          sku: String(oferta.sku),
          descricao: oferta.descricao,
          reembolsoEstimado: Number(oferta.reembolsoEstimado ?? 0),
          dataInicio: inicio,
          dataFim: fim,
        });
      }
      for (const conta of contasReceberFornecedor) {
        if (conta.fornecedorCodigo !== codigo || conta.status !== "Descontado") continue;
        const recebimento = dataRentabilidade(conta.vencimento) || dataRentabilidade(conta.emissao);
        if (
          (recebimento && (recebimento < de || recebimento > ate)) ||
          (!recebimento && !competenciaNoPeriodoRentabilidade(conta.competencia, de, ate))
        ) {
          continue;
        }
        contas.push({
          id: String(conta.id),
          fornecedorCodigo: codigo,
          tipo: conta.tipo,
          descricao: conta.descricao,
          emissao: conta.emissao,
          vencimento: conta.vencimento,
          competencia: conta.competencia,
          valor: Number(conta.valor ?? 0),
          status: conta.status,
          agendaRms: conta.agendaRms ?? null,
        });
      }
    }
  } finally {
    setActiveSupplierCode(anterior);
  }
  return { vendas, estoques, ofertas, contas };
}

function montarRentabilidade(
  vendas: RentabilidadeProdutoRow[],
  estoques: RentabilidadeEstoqueRow[],
  ofertas: RentabilidadeOfertaRow[],
  contas: RentabilidadeContaRow[],
  nomes: Map<string, string>,
  de: string,
  ate: string,
  modo: "interno" | "fornecedor",
  fonte: "live" | "mock",
  fornecedorAlvo: string | null,
): RentabilidadeDB {
  const porProduto = new Map<string, RentabilidadeLinhaDB>();
  for (const venda of vendas) {
    const fornecedorCodigo = codigoRentabilidade(venda.fornecedorCodigo);
    const sku = String(venda.sku);
    const chave = `${fornecedorCodigo}\t${sku}`;
    const atual =
      porProduto.get(chave) ||
      ({
        fornecedorCodigo,
        fornecedorNome: nomes.get(fornecedorCodigo) || `Fornecedor ${fornecedorCodigo}`,
        segmento: segmentoIntelider(venda.departamentoCodigo, venda.departamento),
        sku,
        descricao: String(venda.descricao || sku),
        departamento: String(venda.departamento || "Não informado"),
        secao: String(venda.secao || "Não informado"),
        grupo: String(venda.grupo || "Não informado"),
        subgrupo: String(venda.subgrupo || "Não informado"),
        categoria: String(venda.categoria || "Não informado"),
        quantidade: 0,
        receitaBruta: 0,
        receitaLiquida: 0,
        cmv: 0,
        rebaixaApurada: 0,
        rebaixaRecebida: 0,
        margemBruta: 0,
        resultadoGerencial: 0,
        resultadoRealizado: 0,
        estoqueQuantidade: 0,
        estoqueValor: 0,
        estoqueData: null,
        coberturaDias: null,
      } satisfies RentabilidadeLinhaDB);
    const quantidade = Number(venda.quantidade || 0);
    const receita = quantidade * Number(venda.valorUnitario || 0);
    atual.quantidade += quantidade;
    atual.receitaBruta += receita;
    atual.receitaLiquida += receita;
    atual.cmv += quantidade * Math.max(0, Number(venda.cmvUnit || 0));
    porProduto.set(chave, atual);
  }

  for (const saldo of estoques) {
    const fornecedorCodigo = codigoRentabilidade(saldo.fornecedorCodigo);
    const sku = String(saldo.sku);
    const chave = `${fornecedorCodigo}\t${sku}`;
    const atual =
      porProduto.get(chave) ||
      ({
        fornecedorCodigo,
        fornecedorNome: nomes.get(fornecedorCodigo) || `Fornecedor ${fornecedorCodigo}`,
        segmento: segmentoIntelider(saldo.departamentoCodigo, saldo.departamento),
        sku,
        descricao: String(saldo.descricao || sku),
        departamento: String(saldo.departamento || "Não informado"),
        secao: String(saldo.secao || "Não informado"),
        grupo: String(saldo.grupo || "Não informado"),
        subgrupo: String(saldo.subgrupo || "Não informado"),
        categoria: String(saldo.categoria || "Não informado"),
        quantidade: 0,
        receitaBruta: 0,
        receitaLiquida: 0,
        cmv: 0,
        rebaixaApurada: 0,
        rebaixaRecebida: 0,
        margemBruta: 0,
        resultadoGerencial: 0,
        resultadoRealizado: 0,
        estoqueQuantidade: 0,
        estoqueValor: 0,
        estoqueData: null,
        coberturaDias: null,
      } satisfies RentabilidadeLinhaDB);
    atual.estoqueQuantidade += Number(saldo.estoqueQuantidade || 0);
    atual.estoqueValor += Number(saldo.estoqueValor || 0);
    if (!atual.estoqueData || String(saldo.estoqueData || "") > atual.estoqueData) {
      atual.estoqueData = saldo.estoqueData;
    }
    porProduto.set(chave, atual);
  }

  const apuradaPorProduto = new Map<string, number>();
  const apuradaPorFornecedor = new Map<string, number>();
  const rebaixas: RentabilidadeRebaixaDB[] = [];
  for (const oferta of ofertas) {
    const fornecedorCodigo = codigoRentabilidade(oferta.fornecedorCodigo);
    const valor = Math.max(0, Number(oferta.reembolsoEstimado || 0));
    const chave = `${fornecedorCodigo}\t${String(oferta.sku)}`;
    apuradaPorProduto.set(chave, (apuradaPorProduto.get(chave) || 0) + valor);
    apuradaPorFornecedor.set(
      fornecedorCodigo,
      (apuradaPorFornecedor.get(fornecedorCodigo) || 0) + valor,
    );
    rebaixas.push({
      id: String(oferta.id),
      fornecedorCodigo,
      sku: String(oferta.sku),
      descricao: oferta.descricao,
      valor,
      dataReferencia: oferta.dataInicio,
      dataRecebimento: null,
      status: "apurada",
      origem: "Oferta/rebaixa",
    });
  }

  const recebidaPorFornecedor = new Map<string, number>();
  const creditosRecebidosNaoAlocados: Array<{
    conta: RentabilidadeContaRow;
    fornecedorCodigo: string;
    valor: number;
  }> = [];
  for (const conta of contas) {
    if (!contaEhRebaixaRentabilidade(conta)) continue;
    const fornecedorCodigo = codigoRentabilidade(conta.fornecedorCodigo);
    const valor = Math.max(0, Number(conta.valor || 0));
    if (valor <= 0) continue;
    const agendaRms = agendaRentabilidade(conta.agendaRms);
    recebidaPorFornecedor.set(
      fornecedorCodigo,
      (recebidaPorFornecedor.get(fornecedorCodigo) || 0) + valor,
    );
    creditosRecebidosNaoAlocados.push({ conta, fornecedorCodigo, valor });
    rebaixas.push({
      id: String(conta.id),
      fornecedorCodigo,
      sku: null,
      descricao: String(conta.descricao || conta.tipo),
      valor,
      dataReferencia: conta.competencia,
      dataRecebimento: dataRentabilidade(conta.vencimento) || dataRentabilidade(conta.emissao),
      status: "recebida",
      origem: agendaRms === AGENDA_REBAIXA_CREDITO ? "Crédito RMS · agenda 159" : conta.tipo,
      agendaRms,
    });
  }

  // Uma verba pode ser recebida sem que o SKU esteja presente na janela de
  // vendas consultada. Mantemos uma linha explícita para que o DRE não perca
  // o valor; ela aparece como produto não alocado e pode ser conciliada depois.
  for (const [chave, valor] of apuradaPorProduto.entries()) {
    if (porProduto.has(chave)) continue;
    const partesChave = chave.split("\t");
    const fornecedorCodigo = partesChave[0] || DEMO_FORNECEDOR_CODIGO;
    const sku = partesChave[1] || chave;
    const oferta = ofertas.find(
      (item) => codigoRentabilidade(item.fornecedorCodigo) === fornecedorCodigo && item.sku === sku,
    );
    porProduto.set(chave, {
      fornecedorCodigo,
      fornecedorNome: nomes.get(fornecedorCodigo) || `Fornecedor ${fornecedorCodigo}`,
      segmento: "Não alocado",
      sku,
      descricao: oferta?.descricao || `Rebaixa não alocada · SKU ${sku}`,
      departamento: "Não alocado",
      secao: "Não alocado",
      grupo: "Não alocado",
      subgrupo: "Não alocado",
      categoria: "Rebaixa",
      quantidade: 0,
      receitaBruta: 0,
      receitaLiquida: 0,
      cmv: 0,
      rebaixaApurada: valor,
      rebaixaRecebida: 0,
      margemBruta: 0,
      resultadoGerencial: valor,
      resultadoRealizado: 0,
      estoqueQuantidade: 0,
      estoqueValor: 0,
      estoqueData: null,
      coberturaDias: null,
    });
  }

  const diasPeriodo = Math.max(
    1,
    Math.round(
      (new Date(`${ate}T00:00:00Z`).getTime() - new Date(`${de}T00:00:00Z`).getTime()) / 86400000,
    ) + 1,
  );
  const linhasBase = Array.from(porProduto.values()).map((linha) => {
    const chave = `${linha.fornecedorCodigo}\t${linha.sku}`;
    const totalApurado = apuradaPorFornecedor.get(linha.fornecedorCodigo) || 0;
    const rebaixaApurada = apuradaPorProduto.get(chave) || 0;
    const totalRecebido = recebidaPorFornecedor.get(linha.fornecedorCodigo) || 0;
    const rebaixaRecebida = totalApurado > 0 ? (totalRecebido * rebaixaApurada) / totalApurado : 0;
    const margemBruta = linha.receitaLiquida - linha.cmv;
    const coberturaDias =
      linha.estoqueValor > 0 && linha.cmv > 0
        ? linha.estoqueValor / (linha.cmv / diasPeriodo)
        : null;
    return {
      ...linha,
      receitaBruta: arredondarRentabilidade(linha.receitaBruta),
      receitaLiquida: arredondarRentabilidade(linha.receitaLiquida),
      cmv: arredondarRentabilidade(linha.cmv),
      rebaixaApurada: arredondarRentabilidade(rebaixaApurada),
      rebaixaRecebida: arredondarRentabilidade(rebaixaRecebida),
      margemBruta: arredondarRentabilidade(margemBruta),
      resultadoGerencial: arredondarRentabilidade(margemBruta + rebaixaApurada),
      resultadoRealizado: arredondarRentabilidade(margemBruta + rebaixaRecebida),
      estoqueQuantidade: arredondarRentabilidade(linha.estoqueQuantidade),
      estoqueValor: arredondarRentabilidade(linha.estoqueValor),
      estoqueData: linha.estoqueData,
      coberturaDias: coberturaDias === null ? null : arredondarRentabilidade(coberturaDias),
    } satisfies RentabilidadeLinhaDB;
  });

  const alocadaPorFornecedor = new Map<string, number>();
  for (const linha of linhasBase) {
    alocadaPorFornecedor.set(
      linha.fornecedorCodigo,
      (alocadaPorFornecedor.get(linha.fornecedorCodigo) || 0) + linha.rebaixaRecebida,
    );
  }
  const rebaixasNaoAlocadas = Array.from(recebidaPorFornecedor.entries())
    .map(([fornecedorCodigo, valor]) => ({
      fornecedorCodigo,
      valor: arredondarRentabilidade(
        Math.max(0, valor - (alocadaPorFornecedor.get(fornecedorCodigo) || 0)),
      ),
    }))
    .filter((item) => item.valor > 0.009);

  // Qualquer rebaixa recebida pode existir sem uma oferta/SKU correspondente
  // na janela de vendas. Mantemos uma linha explícita para que ela entre no
  // DRE realizado, sem fingir um vínculo de produto que o RMS não forneceu.
  // Antes, somente a agenda 159 recebia essa linha; os demais créditos ficavam
  // visíveis no detalhe de conciliação, mas sumiam da planilha por fornecedor.
  const linhasCreditosRecebidosNaoAlocados: RentabilidadeLinhaDB[] = [];
  for (const credito of creditosRecebidosNaoAlocados) {
    if ((apuradaPorFornecedor.get(credito.fornecedorCodigo) || 0) > 0) continue;
    const conta = credito.conta;
    const agendaRms = agendaRentabilidade(conta.agendaRms);
    const identificadorOrigem = agendaRms === AGENDA_REBAIXA_CREDITO ? "AGENDA_159" : "REBAIXA";
    linhasCreditosRecebidosNaoAlocados.push({
      fornecedorCodigo: credito.fornecedorCodigo,
      fornecedorNome:
        nomes.get(credito.fornecedorCodigo) || `Fornecedor ${credito.fornecedorCodigo}`,
      segmento: "Não alocado",
      sku: `__CREDITO_${identificadorOrigem}__:${String(conta.id)}`,
      descricao:
        agendaRms === AGENDA_REBAIXA_CREDITO
          ? `Crédito agenda 159 · ${String(conta.descricao || "Rebaixa de preço")}`
          : `Crédito de rebaixa · ${String(conta.descricao || conta.tipo)}`,
      departamento: "Não alocado",
      secao: "Não alocado",
      grupo: "Não alocado",
      subgrupo: "Não alocado",
      categoria: "Crédito rebaixa",
      quantidade: 0,
      receitaBruta: 0,
      receitaLiquida: 0,
      cmv: 0,
      rebaixaApurada: 0,
      rebaixaRecebida: arredondarRentabilidade(credito.valor),
      margemBruta: 0,
      resultadoGerencial: 0,
      resultadoRealizado: arredondarRentabilidade(credito.valor),
      estoqueQuantidade: 0,
      estoqueValor: 0,
      estoqueData: null,
      coberturaDias: null,
    });
  }

  const linhas = [...linhasBase, ...linhasCreditosRecebidosNaoAlocados];

  let benchmark: RentabilidadeDB["benchmark"] = null;
  let linhasVisiveis = linhas;
  let rebaixasVisiveis = rebaixas;
  let rebaixasNaoAlocadasVisiveis = rebaixasNaoAlocadas;
  if (modo === "fornecedor" && fornecedorAlvo) {
    const porFornecedor = new Map<string, RentabilidadeLinhaDB[]>();
    for (const linha of linhas) {
      const lista = porFornecedor.get(linha.fornecedorCodigo) || [];
      lista.push(linha);
      porFornecedor.set(linha.fornecedorCodigo, lista);
    }
    const comparaveis = Array.from(porFornecedor.entries())
      .filter(([codigo]) => codigo !== fornecedorAlvo)
      .map(([, lista]) => {
        const receita = lista.reduce((total, linha) => total + linha.receitaLiquida, 0);
        const resultadoGerencial = lista.reduce(
          (total, linha) => total + linha.resultadoGerencial,
          0,
        );
        const resultadoRealizado = lista.reduce(
          (total, linha) => total + linha.resultadoRealizado,
          0,
        );
        return {
          receita,
          resultadoGerencial,
          resultadoRealizado,
          margemGerencialPct: receita > 0 ? (resultadoGerencial / receita) * 100 : 0,
          margemRealizadaPct: receita > 0 ? (resultadoRealizado / receita) * 100 : 0,
        };
      });
    const participantes = comparaveis.length;
    if (participantes > 0) {
      benchmark = {
        participantes,
        receitaMedia: arredondarRentabilidade(
          comparaveis.reduce((total, item) => total + item.receita, 0) / participantes,
        ),
        resultadoGerencialMedio: arredondarRentabilidade(
          comparaveis.reduce((total, item) => total + item.resultadoGerencial, 0) / participantes,
        ),
        margemGerencialMediaPct: arredondarRentabilidade(
          comparaveis.reduce((total, item) => total + item.margemGerencialPct, 0) / participantes,
        ),
        resultadoRealizadoMedio: arredondarRentabilidade(
          comparaveis.reduce((total, item) => total + item.resultadoRealizado, 0) / participantes,
        ),
        margemRealizadaMediaPct: arredondarRentabilidade(
          comparaveis.reduce((total, item) => total + item.margemRealizadaPct, 0) / participantes,
        ),
      };
    }
    linhasVisiveis = linhas.filter((linha) => linha.fornecedorCodigo === fornecedorAlvo);
    rebaixasVisiveis = rebaixas.filter((item) => item.fornecedorCodigo === fornecedorAlvo);
    rebaixasNaoAlocadasVisiveis = rebaixasNaoAlocadas.filter(
      (item) => item.fornecedorCodigo === fornecedorAlvo,
    );
  }

  const linhasEstoqueVisiveis = linhasVisiveis;
  const estoqueVisivel = linhasEstoqueVisiveis.reduce(
    (total, linha) => {
      total.quantidade += linha.estoqueQuantidade;
      total.valor += linha.estoqueValor;
      if (linha.estoqueQuantidade > 0) total.linhasComEstoque += 1;
      if (!total.data || String(linha.estoqueData || "") > total.data) {
        total.data = linha.estoqueData;
      }
      return total;
    },
    {
      quantidade: 0,
      valor: 0,
      data: null as string | null,
      linhasComEstoque: 0,
    },
  );
  const cmvPeriodo = linhasEstoqueVisiveis.reduce((total, linha) => total + linha.cmv, 0);
  const coberturaDias =
    estoqueVisivel.valor > 0 && cmvPeriodo > 0
      ? estoqueVisivel.valor / (cmvPeriodo / diasPeriodo)
      : null;

  if (modo === "interno") {
    linhasVisiveis = agruparLinhasRentabilidadeInterna(linhasVisiveis);
    // A tabela interna usa apenas os totais das linhas e a conciliação
    // resumida; o detalhamento de cada rebaixa fica reservado ao fornecedor.
    rebaixasVisiveis = [];
  }

  return {
    modo,
    fonte,
    periodo: { de, ate },
    linhas: linhasVisiveis,
    rebaixas: rebaixasVisiveis,
    rebaixasNaoAlocadas: rebaixasNaoAlocadasVisiveis,
    estoque: {
      ...estoqueVisivel,
      quantidade: arredondarRentabilidade(estoqueVisivel.quantidade),
      valor: arredondarRentabilidade(estoqueVisivel.valor),
      coberturaDias: coberturaDias === null ? null : arredondarRentabilidade(coberturaDias),
    },
    benchmark,
  };
}

export const fetchRentabilidade = createServerFn({ method: "GET" })
  .validator((data: { de: string; ate: string; modo: "interno" | "fornecedor" }) => {
    const de = data.de.slice(0, 10);
    const ate = data.ate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
      throw new Error("Período inválido para a rentabilidade.");
    }
    const modo = data.modo === "interno" ? ("interno" as const) : ("fornecedor" as const);
    return { de, ate, modo };
  })
  .handler(async ({ data }) => {
    let fornecedorCodigo: string | null = null;
    if (data.modo === "interno") {
      exigirInterno();
    } else {
      const sessao = lerSessaoPortal();
      if (!sessao || sessao.tipo !== "fornecedor") throw new Error("Sessão do fornecedor exigida.");
      fornecedorCodigo = codigoRentabilidade(sessao.codigo);
    }

    const nomes = new Map<string, string>();
    try {
      if (tabelaExiste("fornecedores")) {
        const rows = db.prepare("SELECT codigo, nome FROM fornecedores").all() as Array<{
          codigo: string;
          nome: string | null;
        }>;
        for (const row of rows)
          nomes.set(codigoRentabilidade(row.codigo), String(row.nome || row.codigo));
      }
    } catch {
      /* fallback sintético para o ambiente local */
    }
    for (const row of fornecedoresMock) {
      nomes.set(codigoRentabilidade(row.codigo), row.nome);
    }

    const fornecedoresPermitidos = fornecedorCodigo ? [fornecedorCodigo] : null;
    const vendas: RentabilidadeProdutoRow[] = [];
    const estoques: RentabilidadeEstoqueRow[] = [];
    const ofertas: RentabilidadeOfertaRow[] = [];
    const contas: RentabilidadeContaRow[] = [];
    let fonte: "live" | "mock" = "live";
    let consultouLive = false;

    try {
      if (tabelaExiste("vendas") && tabelaExiste("produtos")) {
        consultouLive = true;
        const filtroFornecedor = fornecedorCodigo ? "AND p.fornecedorCodigo = ?" : "";
        const params: unknown[] = fornecedorCodigo
          ? [data.de, data.ate, fornecedorCodigo]
          : [data.de, data.ate];
        const rows = db
          .prepare(
            `SELECT p.fornecedorCodigo AS fornecedorCodigo, v.sku, p.descricao,
                    p.departamentoCodigo, p.departamento, p.secao, p.grupo, p.subgrupo, p.categoria, p.cmvUnit,
                    MAX(v.data) AS data,
                    SUM(COALESCE(v.quantidade, 0)) AS quantidade,
                    CASE WHEN SUM(COALESCE(v.quantidade, 0)) <> 0
                         THEN SUM(COALESCE(v.quantidade, 0) * COALESCE(v.valorUnitario, 0)) /
                              SUM(COALESCE(v.quantidade, 0))
                         ELSE 0 END AS valorUnitario
               FROM vendas v
               JOIN produtos p ON p.sku = v.sku
              WHERE v.data >= ? AND v.data <= ?
                AND v.lojaId NOT IN (${sqlLojasForaPortal})
                ${filtroFornecedor}
              GROUP BY p.fornecedorCodigo, v.sku, p.descricao,
                       p.departamentoCodigo, p.departamento, p.secao, p.grupo,
                       p.subgrupo, p.categoria, p.cmvUnit`,
          )
          .all(...params) as RentabilidadeProdutoRow[];
        vendas.push(...rows);
      }
      if (tabelaExiste("estoque") && tabelaExiste("produtos")) {
        const estoquePorSku = data.modo !== "interno";
        const filtroFornecedorEstoque = fornecedorCodigo ? `AND ${sqlSkuVisivel("p")}` : "";
        const paramsEstoque: unknown[] = fornecedorCodigo ? [fornecedorCodigo] : [];
        const dataEstoqueSql = colunaExiste("estoque", "dataEstoque")
          ? "MAX(e.dataEstoque)"
          : "NULL";
        const dataInventarioSql = colunaExiste("estoque", "dataInventario")
          ? "MAX(e.dataInventario)"
          : "NULL";
        const estoqueSkuSql = estoquePorSku
          ? "p.sku"
          : "('__ESTOQUE__:' || COALESCE(p.departamento, '') || ':' || COALESCE(p.secao, '') || ':' || COALESCE(p.grupo, '') || ':' || COALESCE(p.subgrupo, '') || ':' || COALESCE(p.categoria, ''))";
        const estoqueDescricaoSql = estoquePorSku ? "p.descricao" : "'Estoque agregado'";
        const estoqueGroupSql = estoquePorSku
          ? `p.fornecedorCodigo, p.sku, p.descricao,
                       p.departamentoCodigo, p.departamento, p.secao, p.grupo, p.subgrupo, p.categoria`
          : `p.fornecedorCodigo, p.departamentoCodigo, p.departamento,
                       p.secao, p.grupo, p.subgrupo, p.categoria`;
        const rows = db
          .prepare(
            `SELECT p.fornecedorCodigo AS fornecedorCodigo, ${estoqueSkuSql} AS sku, ${estoqueDescricaoSql} AS descricao,
                    p.departamentoCodigo, p.departamento, p.secao, p.grupo, p.subgrupo, p.categoria,
                    SUM(COALESCE(e.estoqueAtual, 0)) AS estoqueQuantidade,
                    SUM(COALESCE(e.estoqueAtual, 0) * COALESCE(p.cmvUnit, 0)) AS estoqueValor,
                    COALESCE(${dataEstoqueSql}, ${dataInventarioSql}) AS estoqueData
               FROM estoque e
              JOIN produtos p ON p.sku = e.sku
              WHERE e.lojaId NOT IN (${sqlLojasForaPortal})
                ${filtroFornecedorEstoque}
              GROUP BY ${estoqueGroupSql}`,
          )
          .all(...paramsEstoque) as RentabilidadeEstoqueRow[];
        estoques.push(...rows);
      }
      if (tabelaExiste("ofertas_intelider")) {
        const rows = db
          .prepare(
            `SELECT id, fornecedorCodigo, sku, descricao, reembolsoEstimado, dataInicio, dataFim
               FROM ofertas_intelider
              WHERE tipo = 'rebaixa'`,
          )
          .all() as RentabilidadeOfertaRow[];
        ofertas.push(
          ...rows.filter((row) =>
            sobrepoePeriodoRentabilidade(
              dataRentabilidade(row.dataInicio),
              dataRentabilidade(row.dataFim),
              data.de,
              data.ate,
            ),
          ),
        );
      }
      if (tabelaExiste("contas_receber")) {
        const agendaRmsSql = colunaExiste("contas_receber", "agendaRms") ? "agendaRms" : "NULL";
        const rows = db
          .prepare(
            `SELECT id, fornecedorCodigo, tipo, descricao, emissao, vencimento,
                    competencia, valor, status, ${agendaRmsSql} AS agendaRms
               FROM contas_receber
              WHERE status = 'Descontado'`,
          )
          .all() as RentabilidadeContaRow[];
        contas.push(
          ...rows.filter((row) => {
            const dataRecebimento =
              dataRentabilidade(row.vencimento) || dataRentabilidade(row.emissao);
            return dataRecebimento
              ? dataRecebimento >= data.de && dataRecebimento <= data.ate
              : competenciaNoPeriodoRentabilidade(row.competencia, data.de, data.ate);
          }),
        );
      }
    } catch (err) {
      console.error("fetchRentabilidade live", err);
      consultouLive = false;
    }

    if (!consultouLive) {
      fonte = "mock";
      const codigos = fornecedoresPermitidos
        ? [
            ...new Set([
              ...fornecedoresMock.map((row) => codigoRentabilidade(row.codigo)),
              ...fornecedoresPermitidos,
            ]),
          ]
        : fornecedoresMock.map((row) => codigoRentabilidade(row.codigo));
      const mock = linhasMockRentabilidade(codigos, data.de, data.ate);
      vendas.push(...mock.vendas);
      estoques.push(...mock.estoques);
      ofertas.push(...mock.ofertas);
      contas.push(...mock.contas);
    }

    return montarRentabilidade(
      vendas,
      estoques,
      ofertas,
      contas,
      nomes,
      data.de,
      data.ate,
      data.modo,
      fonte,
      fornecedorCodigo,
    );
  });
