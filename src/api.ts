import { createServerFn } from "@tanstack/react-start";
import { normalizarCodigoFornecedor, soDigitos } from "@/lib/fornecedor-codigo";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import { cortePedidosIso, mesFechadoIso } from "@/lib/pedidos-janela";
import { JANELA_SKU_DIA_DIAS, shareJanelaCurta, shareUsaMensal } from "@/lib/vendas-graos";
import { classificarCurvaAbcd } from "@/lib/classe-abcd";
import { USUARIOS_FORNECEDOR_MAX } from "@/lib/usuarios-fornecedor";
import { db } from "./server/db";
import { DESCONTO_ACESSO_PORTAL_PCT, segmentoIntelider, valorUmPctCompra } from "@/lib/acordo-acesso";
import {
  codigoFornecedorEfetivo,
  gravarSessaoPortal,
  apagarSessaoPortal,
  exigirInterno,
  exigirSessaoFornecedor,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
} from "./server/sessao-portal";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function ensureFornecedoresColumns() {
  // Safe migrations run on startup in db.ts
}

function ensureUsuariosFornecedor() {
  try {
    db.exec("ALTER TABLE usuarios_fornecedor ADD COLUMN precisaTrocarSenha INTEGER DEFAULT 0;");
  } catch {
    /* coluna já existe */
  }
}

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

function flagPrecisaTrocarSenha(row: {
  precisaTrocarSenha?: number;
  precisatrocarsenha?: number;
}) {
  return Number(row.precisaTrocarSenha ?? row.precisatrocarsenha ?? 0) === 1;
}


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
  itens: PedidoItemDB[];
};

type PedidoRow = {
  numero: string;
  lojaId: string;
  destino: string;
  origemOperacional: string;
  destinoOperacional: string;
  emissao: string | null;
  entregaPrevista: string | null;
  entradaCdam: string | null;
  status: string;
  agendaEntrada: string | null;
  agendaParidade: string | null;
  agendaRegra: string | null;
};

type PedidoItemRow = {
  numero: string;
  lojaId: string;
  sku: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  precoUnitario: number;
};

const tabelaExiste = (nome: string) =>
  Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(nome),
  );

/** Sortimento: fiscal ∪ grupo ∪ gabarito. Pedido/NF/financeiro continuam fiscais. */
const sqlSkuVisivel = (alias = "p") =>
  tabelaExiste("produto_visibilidade")
    ? `EXISTS (SELECT 1 FROM produto_visibilidade WHERE fornecedorCodigo = ? AND sku = ${alias}.sku)`
    : `${alias}.fornecedorCodigo = ?`;

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

type ShareCategoriaRow = Omit<ShareCategoriaDB, "shareValor" | "shareQuantidade">;

const marcaReal = (marca: string | null | undefined) => {
  const limpa = (marca ?? "").trim();
  return limpa || "Marca não informada";
};

const inicioShare = (janela: ShareJanela, fim: string | null) => {
  if (janela === "tudo" || !fim) return null;
  const data = new Date(`${fim}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - (Number(janela) - 1));
  return data.toISOString().slice(0, 10);
};

const anoMesDe = (iso: string | null) => (iso && iso.length >= 7 ? iso.slice(0, 7) : null);

const ultimoDiaMes = (anoMes: string) => {
  const y = Number(anoMes.slice(0, 4));
  const m = Number(anoMes.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const joinVendasMensalProduto = `LEFT JOIN produtos p
      ON p.sku = vm.sku
      OR (
        length(vm.sku) > 1
        AND p.codigoProdutoRms = substr(vm.sku, 1, length(vm.sku) - 1)
        AND p.digitoProdutoRms = substr(vm.sku, -1)
      )`;

// Endpoints RPC no lado do servidor (Server Functions)
export const fetchFornecedoresList = createServerFn({ method: "GET" }).handler(async () => {
  exigirInterno();
  const stmt = db.prepare(
    "SELECT codigo, nome, cnpj, cnpjSenhaInicial, acessoLiberado FROM fornecedores WHERE acessoLiberado = 1 ORDER BY nome",
  );
  return stmt.all() as FornecedorDB[];
});

function vigenciaAcessoOk(row: {
  isentoCobranca?: number | null;
  acessoDataInicio?: string | null;
  acessoDataFim?: string | null;
}) {
  if (Number(row.isentoCobranca) === 1) return true;
  const inicio = String(row.acessoDataInicio ?? "").slice(0, 10);
  const fim = String(row.acessoDataFim ?? "").slice(0, 10);
  if (!inicio || !fim) return true;
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return hojeIso >= inicio && hojeIso <= fim;
}

function buscarFornecedorPorLogin(ident: string): FornecedorDB | undefined {
  ensureFornecedoresColumns();
  const codigo = resolverCodigoFornecedorDados(normalizarCodigoFornecedor(ident));
  const porCodigo = db.prepare("SELECT * FROM fornecedores WHERE codigo = ?").get(codigo) as
    | FornecedorDB
    | undefined;
  if (porCodigo) return porCodigo;
  const cnpj = soDigitos(ident);
  if (cnpj.length < 11) return undefined;
  return db
    .prepare(
      `SELECT * FROM fornecedores
        WHERE cnpjSenhaInicial = ?
           OR replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ?`,
    )
    .get(cnpj, cnpj) as FornecedorDB | undefined;
}

function cnpjDoFornecedor(forn: FornecedorDB): string {
  return soDigitos(forn.cnpjSenhaInicial || forn.cnpj);
}

function senhaCnpjConfere(senha: string, forn: FornecedorDB): boolean {
  const cadastro = cnpjDoFornecedor(forn);
  return cadastro.length >= 11 && soDigitos(senha) === cadastro;
}

function exigirFornecedorLiberado(ident: string): FornecedorDB {
  const forn = buscarFornecedorPorLogin(ident);
  if (!forn) {
    throw new Error("Fornecedor não encontrado. Use o código RMS (ex.: 20922-8) ou o CNPJ.");
  }
  if (forn.acessoLiberado !== 1) {
    throw new Error("Acesso não liberado. Entre em contato com a equipe comercial do Grupo Líder.");
  }
  if (!vigenciaAcessoOk(forn)) {
    throw new Error("Acesso fora do período de vigência contratado.");
  }
  return forn;
}

function emailLoginValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nomeUsuarioDoEmail(email: string, fallback: string): string {
  const local = String(email.split("@")[0] || "").replace(/[._-]+/g, " ").trim();
  if (!local) return fallback.slice(0, 80);
  const titulo = local.replace(/\b\w/g, (c) => c.toUpperCase());
  return titulo.slice(0, 80);
}

export const fetchFornecedor = createServerFn({ method: "GET" })
  .validator((codigo: string) => soDigitos(codigo) || String(codigo ?? "").trim())
  .handler(async ({ data: ident }) => {
    return buscarFornecedorPorLogin(ident);
  });

let cachedLiderAbcMap: Map<string, string> | null = null;

function getLiderWideAbcClasses() {
  if (cachedLiderAbcMap) return cachedLiderAbcMap;

  const map = new Map<string, string>();
  try {
    const fimRow = db.prepare("SELECT MAX(data) AS fim FROM vendas").get() as { fim: string | null };
    const fim = fimRow?.fim ?? null;
    let inicio: string | null = null;
    if (fim) {
      const d = new Date(`${fim}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 89);
      inicio = d.toISOString().slice(0, 10);
    }

    const rows = db
      .prepare(
        `
        SELECT
          v.sku AS sku,
          p.subgrupoCodigo,
          p.grupoCodigo,
          p.secaoCodigo,
          p.departamentoCodigo,
          SUM(v.quantidade * v.valorUnitario) AS valor,
          SUM(v.quantidade) AS volume
        FROM vendas v
        JOIN produtos p ON p.sku = v.sku
        WHERE (? IS NULL OR v.data >= ?)
        GROUP BY v.sku, p.subgrupoCodigo, p.grupoCodigo, p.secaoCodigo, p.departamentoCodigo
      `,
      )
      .all(inicio, inicio) as Array<{
      sku: string;
      subgrupoCodigo: string;
      grupoCodigo: string;
      secaoCodigo: string;
      departamentoCodigo: string;
      valor: number;
      volume: number;
    }>;

    const classificados = classificarCurvaAbcd(
      rows.map((r) => ({
        sku: r.sku,
        grupo: `${r.departamentoCodigo}.${r.secaoCodigo}.${r.grupoCodigo}.${r.subgrupoCodigo}`,
        valor: r.valor || 0,
        volume: r.volume || 0,
      })),
    );
    for (const [sku, resultado] of classificados) {
      map.set(sku, resultado.classeComposta);
    }
  } catch (err) {
    console.error("Erro ao calcular Lider-wide ABC classes:", err);
  }

  cachedLiderAbcMap = map;
  return map;
}

let cachedNomesComprador: Map<string, string> | null = null;

function mapaNomesComprador(): Map<string, string> {
  if (cachedNomesComprador) return cachedNomesComprador;
  const mapa = new Map<string, string>();
  try {
    const rows = db
      .prepare(
        `SELECT compradorCodigo AS codigo, MAX(compradorNome) AS nome
         FROM produtos
         WHERE compradorCodigo IS NOT NULL AND TRIM(compradorCodigo) <> ''
           AND compradorNome IS NOT NULL AND TRIM(compradorNome) <> ''
         GROUP BY compradorCodigo`,
      )
      .all() as { codigo: string; nome: string }[];
    for (const row of rows) {
      const codigo = String(row.codigo ?? "").trim();
      const nome = String(row.nome ?? "").trim();
      if (!codigo || !nome || nome === `Comprador ${codigo}`) continue;
      mapa.set(codigo, nome);
    }
  } catch (err) {
    console.error("Erro ao montar mapa de compradores:", err);
  }
  cachedNomesComprador = mapa;
  return mapa;
}

export const fetchProdutos = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const stmt = db.prepare(`SELECT * FROM produtos p WHERE ${sqlSkuVisivel("p")}`);
    const products = stmt.all(fornecedorCodigo);
    const abcMap = getLiderWideAbcClasses();
    const nomesComprador = mapaNomesComprador();
    return products.map((p) => {
      const storedCls = String((p as any).abc || "").trim();
      const dynamicCls = abcMap.get(p.sku);
      const fatClass = (
        (dynamicCls && dynamicCls[0]) ||
        storedCls[0] ||
        "D"
      ).toUpperCase();
      const volClass = (
        (dynamicCls && dynamicCls.length > 1 && dynamicCls[1]) ||
        storedCls[1] ||
        "d"
      ).toLowerCase();
      const cls = fatClass + volClass;
      const codigo = String((p as any).compradorCodigo ?? "").trim();
      const nomeDireto = String((p as any).compradorNome ?? "").trim();
      const nome = nomeDireto && nomeDireto !== `Comprador ${codigo}`
        ? nomeDireto
        : (codigo && nomesComprador.get(codigo)) || nomeDireto;
      return {
        ...p,
        compradorNome: nome || (p as any).compradorNome,
        classeComposta: cls,
      };
    }) as any[];
  });

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

export const fetchFaixasPrecoSubgrupo = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("subgrupo_preco_faixa")) return [] as FaixaPrecoSubgrupoDB[];
    const rows = db
      .prepare(
        `SELECT DISTINCT
            f.departamentoCodigo AS departamentoCodigo,
            f.secaoCodigo AS secaoCodigo,
            f.grupoCodigo AS grupoCodigo,
            f.subgrupoCodigo AS subgrupoCodigo,
            f.preco_min AS precoMin,
            f.preco_max AS precoMax,
            f.n_sku AS nSku
         FROM subgrupo_preco_faixa f
         JOIN produtos p
           ON CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) = f.departamentoCodigo
          AND CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) = f.secaoCodigo
          AND CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) = f.grupoCodigo
          AND CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) = f.subgrupoCodigo
        WHERE ${sqlSkuVisivel("p")}`,
      )
      .all(fornecedorCodigo) as FaixaPrecoSubgrupoDB[];
    return rows;
  });

export const fetchProdutosBloqueios = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const stmt = db.prepare(
      `SELECT b.sku, b.lojaId, b.bloqueio FROM produtos_lojas_bloqueios b JOIN produtos p ON p.sku = b.sku WHERE ${sqlSkuVisivel("p")} AND b.lojaId NOT IN (${sqlLojasForaPortal})`,
    );
    return stmt.all(fornecedorCodigo) as ProdutoBloqueioDB[];
  });

export const fetchPerdas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const stmt = db.prepare(
      `SELECT d.* FROM perdas d JOIN produtos p ON p.sku = d.sku WHERE ${sqlSkuVisivel("p")} AND d.lojaId NOT IN (${sqlLojasForaPortal})`,
    );
    return stmt.all(fornecedorCodigo) as PerdaDB[];
  });

export const fetchEstoque = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const stmt = db.prepare(
      `SELECT e.sku, e.lojaId, e.estoqueAtual
       FROM estoque e
       JOIN produtos p ON p.sku = e.sku
       WHERE ${sqlSkuVisivel("p")}
         AND e.lojaId NOT IN (${sqlLojasForaPortal})`,
    );
    return stmt.all(fornecedorCodigo) as EstoqueDB[];
  });

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
};

export const fetchContasReceber = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("contas_receber")) return [] as ContaReceberDB[];
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const rows = db
      .prepare(
        `SELECT id, documento, tipo, descricao, emissao, competencia, vencimento,
                valor, status, abatimentoProximoPagamento, origem, observacao, fornecedorCodigo
         FROM contas_receber
         WHERE fornecedorCodigo = ?
           AND status <> 'Descontado'
           AND (vencimento IS NULL OR vencimento = '' OR vencimento >= ?)
         ORDER BY vencimento ASC, id DESC`,
      )
      .all(fornecedorCodigo, hojeIso) as Array<{
      id: string;
      documento: string;
      tipo: string;
      descricao: string | null;
      emissao: string | null;
      competencia: string | null;
      vencimento: string | null;
      valor: number;
      status: string;
      abatimentoProximoPagamento: number;
      origem: string | null;
      observacao: string | null;
      fornecedorCodigo: string;
    }>;
    const tipos = new Set([
      "Acordo comercial",
      "Bonificação",
      "Devolução",
      "Avaria",
      "Verba comercial",
    ]);
    const statuses = new Set(["Aberto", "Programado", "Em análise", "Descontado"]);
    return rows.map((row) => ({
      id: row.id,
      documento: row.documento,
      tipo: (tipos.has(row.tipo) ? row.tipo : "Acordo comercial") as ContaReceberDB["tipo"],
      descricao: row.descricao || "",
      emissao: row.emissao || "",
      competencia: row.competencia || "",
      vencimento: row.vencimento || "",
      valor: Number(row.valor ?? 0),
      status: (statuses.has(row.status) ? row.status : "Aberto") as ContaReceberDB["status"],
      abatimentoProximoPagamento: Boolean(row.abatimentoProximoPagamento),
      origem: row.origem || "",
      observacao: row.observacao || "",
      fornecedorCodigo: String(row.fornecedorCodigo),
    }));
  });

export const fetchFaturas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("notas_fiscais")) return [] as FaturaDB[];
    const rows = db
      .prepare(
        `SELECT id, numeroNota, serie, chaveNfe, emissao, recebimento, dataPagamento,
                valor, descontoFinanceiro, valorLiquido, status, lojaId, destTipo,
                fornecedorCodigo, agendaRms, prazoTipo
         FROM notas_fiscais
         WHERE fornecedorCodigo = ?
           AND lojaId NOT IN (${sqlLojasForaPortal})
         ORDER BY emissao DESC, numeroNota DESC`,
      )
      .all(fornecedorCodigo) as Array<{
      id: string;
      numeroNota: string;
      serie: string | null;
      chaveNfe: string | null;
      emissao: string | null;
      recebimento: string | null;
      dataPagamento: string | null;
      valor: number;
      descontoFinanceiro: number;
      valorLiquido: number;
      status: string;
      lojaId: string;
      destTipo: string | null;
      fornecedorCodigo: string;
      agendaRms: number | null;
      prazoTipo: string | null;
    }>;
    return rows.map((row) => {
      const destTipo = row.destTipo === "D" ? "D" : "L";
      const fatura: FaturaDB = {
        id: row.id,
        numeroNota: row.serie ? `${row.numeroNota}-${row.serie}` : String(row.numeroNota),
        emissao: row.emissao || "",
        dataPagamento: row.dataPagamento || "",
        valor: Number(row.valor ?? 0),
        descontoFinanceiro: Number(row.descontoFinanceiro ?? 0),
        valorLiquido: Number(row.valorLiquido ?? 0),
        status: row.status === "Pago" ? "Pago" : "A vencer",
        lojaId: String(row.lojaId),
        fornecedorCodigo: String(row.fornecedorCodigo),
        direcao: "fornecedor_para_lider",
        destinatario: "Grupo Líder",
        agendaRms: Number(row.agendaRms ?? 0),
        natureza:
          destTipo === "D" ? "recebimento_fornecedor_cdam" : "recebimento_fornecedor_loja",
      };
      if (row.serie) fatura.serie = row.serie;
      if (row.chaveNfe) fatura.chaveNfe = row.chaveNfe;
      if (row.recebimento) fatura.recebimento = row.recebimento;
      if (row.destTipo) fatura.destTipo = row.destTipo;
      if (row.prazoTipo === "DDE" || row.prazoTipo === "DDR") fatura.prazoTipo = row.prazoTipo;
      return fatura;
    });
  });

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

export const fetchComprasAno = createServerFn({ method: "GET" })
  .validator((data: { fornecedorCodigo: string; ano: number }) => ({
    fornecedorCodigo: normalizarCodigoFornecedor(data.fornecedorCodigo),
    ano: Number(data.ano),
  }))
  .handler(async ({ data }) => {
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const ateMes = mesFechadoIso();
    const ano = Number(ateMes.slice(0, 4)) || new Date().getFullYear();
    const vazio = (): ComprasAnoDB => ({
      ano,
      ateMes,
      pedido: 0,
      entregue: 0,
      perda: 0,
      documentos: 0,
      documentosEmAberto: 0,
      meses: [],
      destinos: [],
    });
    if (!tabelaExiste("pedidos") || !tabelaExiste("pedido_itens")) return vazio();
    const rows = db
      .prepare(
        `SELECT substr(p.emissao, 1, 7) AS mes, p.lojaId AS lojaId,
                COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
                COUNT(DISTINCT CASE
                  WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                  THEN p.numero || '-' || p.lojaId
                END) AS documentosEmAberto,
                SUM(COALESCE(i.quantidadePedida, 0) * COALESCE(i.precoUnitario, 0)) AS pedido,
                SUM(
                  CASE
                    WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                    THEN COALESCE(i.quantidadeFaturada, 0)
                    ELSE COALESCE(i.quantidadePedida, 0)
                  END * COALESCE(i.precoUnitario, 0)
                ) AS entregue,
                SUM(
                  CASE
                    WHEN COALESCE(i.quantidadePedida, 0) > COALESCE(i.quantidadeFaturada, 0)
                    THEN (COALESCE(i.quantidadePedida, 0) - COALESCE(i.quantidadeFaturada, 0))
                    ELSE 0
                  END * COALESCE(i.precoUnitario, 0)
                ) AS perda
         FROM pedidos p
         INNER JOIN pedido_itens i
           ON i.numero = p.numero
          AND i.lojaId = p.lojaId
          AND i.fornecedorCodigo = p.fornecedorCodigo
         WHERE p.fornecedorCodigo = ?
           AND p.destino = 'Fornecedor'
           AND p.status <> 'Cancelado'
           AND p.lojaId NOT IN (${sqlLojasForaPortal})
           AND substr(p.emissao, 1, 7) >= ?
           AND substr(p.emissao, 1, 7) <= ?
           AND COALESCE(i.quantidadePedida, 0) > 0
         GROUP BY substr(p.emissao, 1, 7), p.lojaId`,
      )
      .all(codigo, `${ano}-01`, ateMes) as Array<{
      mes: string;
      lojaId: string;
      documentos: number;
      documentosEmAberto: number;
      pedido: number;
      entregue: number;
      perda: number;
    }>;
    const porMes = new Map<
      string,
      { pedido: number; entregue: number; perda: number; documentos: number }
    >();
    const porLoja = new Map<string, { pedido: number; entregue: number; perda: number }>();
    let pedido = 0;
    let entregue = 0;
    let perda = 0;
    let documentos = 0;
    let documentosEmAberto = 0;
    for (const row of rows) {
      const vPedido = Number(row.pedido || 0);
      const vEntregue = Number(row.entregue || 0);
      const vPerda = Number(row.perda || 0);
      pedido += vPedido;
      entregue += vEntregue;
      perda += vPerda;
      documentos += Number(row.documentos || 0);
      documentosEmAberto += Number(row.documentosEmAberto || 0);
      const mes = String(row.mes || "");
      const atualMes = porMes.get(mes) ?? { pedido: 0, entregue: 0, perda: 0, documentos: 0 };
      atualMes.pedido += vPedido;
      atualMes.entregue += vEntregue;
      atualMes.perda += vPerda;
      atualMes.documentos += Number(row.documentos || 0);
      porMes.set(mes, atualMes);
      const lojaId = String(row.lojaId || "");
      const atualLoja = porLoja.get(lojaId) ?? { pedido: 0, entregue: 0, perda: 0 };
      atualLoja.pedido += vPedido;
      atualLoja.entregue += vEntregue;
      atualLoja.perda += vPerda;
      porLoja.set(lojaId, atualLoja);
    }
    return {
      ano,
      ateMes,
      pedido,
      entregue,
      perda,
      documentos,
      documentosEmAberto,
      meses: [...porMes.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, v]) => ({
          mes,
          pedido: v.pedido,
          entregue: v.entregue,
          perda: v.perda,
          documentos: v.documentos,
        })),
      destinos: [...porLoja.entries()]
        .map(([lojaId, v]) => ({ lojaId, ...v }))
        .sort((a, b) => b.perda - a.perda),
    };
  });

export const fetchPedidos = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("pedidos") || !tabelaExiste("pedido_itens")) {
      return [] as PedidoDB[];
    }
    const corteEmissao = cortePedidosIso();
    const capas = db
      .prepare(
        `SELECT numero, lojaId, destino, origemOperacional, destinoOperacional,
                emissao, entregaPrevista, entradaCdam, status,
                agendaEntrada, agendaParidade, agendaRegra
         FROM pedidos
         WHERE fornecedorCodigo = ?
           AND destino = 'Fornecedor'
           AND lojaId NOT IN (${sqlLojasForaPortal})
           AND substr(emissao, 1, 10) >= ?
         ORDER BY emissao DESC, numero DESC`,
      )
      .all(fornecedorCodigo, corteEmissao) as PedidoRow[];
    const itens = db
      .prepare(
        `SELECT i.numero, i.lojaId, i.sku, i.quantidadePedida, i.quantidadeFaturada, i.precoUnitario
         FROM pedido_itens i
         INNER JOIN pedidos p
           ON p.numero = i.numero
          AND p.lojaId = i.lojaId
          AND p.fornecedorCodigo = i.fornecedorCodigo
         WHERE i.fornecedorCodigo = ?
           AND i.lojaId NOT IN (${sqlLojasForaPortal})
           AND p.destino = 'Fornecedor'
           AND substr(p.emissao, 1, 10) >= ?`,
      )
      .all(fornecedorCodigo, corteEmissao) as PedidoItemRow[];
    const porPedido = new Map<string, PedidoItemDB[]>();
    for (const item of itens) {
      const chave = `${item.numero}\t${item.lojaId}`;
      const lista = porPedido.get(chave) ?? [];
      lista.push({
        sku: String(item.sku),
        quantidadePedida: Number(item.quantidadePedida ?? 0),
        quantidadeFaturada: Number(item.quantidadeFaturada ?? 0),
        precoUnitario: Number(item.precoUnitario ?? 0),
      });
      porPedido.set(chave, lista);
    }
    return capas.map((capa) => {
      const pedido: PedidoDB = {
        numero: String(capa.numero),
        destino: "Fornecedor",
        origemOperacional: capa.origemOperacional,
        destinoOperacional: capa.destinoOperacional,
        agenda: {
          contexto: "Compras/Recebimento",
          agendaEntrada: capa.agendaEntrada || "Recebimento de NF-e",
          agendaParidade: capa.agendaParidade || "Conforme origem fiscal da compra",
          regra:
            capa.agendaRegra ||
            "Pedido emitido pelo Grupo Lider ao fornecedor. Transferencias internas loja/CDAM ficam de fora.",
        },
        emissao: capa.emissao || "",
        entregaPrevista: capa.entregaPrevista || capa.emissao || "",
        lojaId: String(capa.lojaId),
        status: (capa.status || "Pendente") as PedidoStatusDB,
        itens: porPedido.get(`${capa.numero}\t${capa.lojaId}`) ?? [],
      };
      if (capa.entradaCdam) pedido.entradaCdam = capa.entradaCdam;
      return pedido;
    });
  });

export const fetchVendas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const corte = db
      .prepare(
        `SELECT MIN(d) AS inicio FROM (SELECT DISTINCT data AS d FROM vendas ORDER BY d DESC LIMIT ${Number(JANELA_SKU_DIA_DIAS)})`,
      )
      .get() as { inicio: string | null };
    const inicio = corte?.inicio;
    const stmt = db.prepare(`
      SELECT v.data, v.lojaId, v.sku, v.quantidade, v.valorUnitario
      FROM vendas v
      JOIN produtos p ON v.sku = p.sku
      WHERE ${sqlSkuVisivel("p")}
        AND v.lojaId NOT IN (${sqlLojasForaPortal})
        AND (? IS NULL OR v.data >= ?)
      ORDER BY v.data DESC
    `);
    return stmt.all(fornecedorCodigo, inicio, inicio) as VendaDB[];
  });

export type TransferenciaCdamDB = {
  sku: string;
  lojaId: string;
  data: string;
  quantidade: number;
};

export const fetchTransferenciasCdam = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    try {
      if (!tabelaExiste("transferencias_cdam")) return [] as TransferenciaCdamDB[];
      const inicio = new Date();
      inicio.setUTCDate(inicio.getUTCDate() - Number(JANELA_SKU_DIA_DIAS));
      const inicioIso = inicio.toISOString().slice(0, 10);
      return db
        .prepare(
          `SELECT t.sku, t.lojaId, t.data, t.quantidade
           FROM transferencias_cdam t
           JOIN produtos p ON p.sku = t.sku
           WHERE ${sqlSkuVisivel("p")}
             AND t.lojaId NOT IN (${sqlLojasForaPortal})
             AND t.data >= ?`,
        )
        .all(fornecedorCodigo, inicioIso) as TransferenciaCdamDB[];
    } catch (err) {
      console.error("fetchTransferenciasCdam", err);
      return [] as TransferenciaCdamDB[];
    }
  });

export const fetchShareFornecedor = createServerFn({ method: "GET" })
  .validator((data: { fornecedorCodigo: string; janela: ShareJanela }) => ({
    ...data,
    fornecedorCodigo: normalizarCodigoFornecedor(data.fornecedorCodigo),
  }))
  .handler(async ({ data }) => {
    const janela = data.janela;
    const fornecedorCodigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const temSubgrupo = tabelaExiste("vendas_subgrupo");
    const temMensal = tabelaExiste("vendas_mensal");
    let fim: string | null = null;
    if (shareUsaMensal(janela) && temMensal) {
      const ate = db.prepare("SELECT MAX(anoMes) AS ate FROM vendas_mensal").get() as {
        ate: string | null;
      };
      fim = ate?.ate ? ultimoDiaMes(ate.ate) : null;
    }
    if (!fim) {
      const fimRow = db.prepare("SELECT MAX(data) AS fim FROM vendas").get() as { fim: string | null };
      fim = fimRow?.fim ?? null;
    }
    const inicio = inicioShare(janela, fim);
    const coberturaSubgrupo = temSubgrupo
      ? (db
          .prepare("SELECT MIN(data) AS dmin, MAX(data) AS dmax FROM vendas_subgrupo")
          .get() as { dmin: string | null; dmax: string | null })
      : { dmin: null, dmax: null };
    const subgrupoCobre =
      Boolean(temSubgrupo && coberturaSubgrupo.dmin && coberturaSubgrupo.dmax) &&
      (inicio == null || inicio >= String(coberturaSubgrupo.dmin)) &&
      (fim == null || fim <= String(coberturaSubgrupo.dmax));
    const usarMensal =
      temMensal && (shareUsaMensal(janela) || (shareJanelaCurta(janela) && !subgrupoCobre));
    const inicioMes = anoMesDe(inicio);
    const fimMes = anoMesDe(fim);

    const joinMensalProd = joinVendasMensalProduto;
    const filtroFornMensal = `(vm.fornecedorCodigo = ? OR ${sqlSkuVisivel("p")})`;

    const temTotalCategoria = tabelaExiste("vendas_subgrupo");
    const categoriaRows = usarMensal
      ? (db
          .prepare(
            `
        WITH forn AS (
          SELECT
            CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            COALESCE(NULLIF(MAX(p.categoria), ''), NULLIF(MAX(p.subgrupo), ''), 'Sem categoria') AS categoria,
            COALESCE(NULLIF(MAX(p.departamento), ''), 'Sem departamento') AS departamento,
            COALESCE(NULLIF(MAX(p.secao), ''), 'Sem secao') AS secao,
            COALESCE(NULLIF(MAX(p.grupo), ''), 'Sem grupo') AS grupo,
            COALESCE(NULLIF(MAX(p.subgrupo), ''), 'Sem subgrupo') AS subgrupo,
            SUM(vm.valor) AS fornecedorValor,
            SUM(vm.quantidade) AS fornecedorQuantidade,
            COUNT(DISTINCT COALESCE(p.sku, vm.sku)) AS fornecedorSkus
          FROM vendas_mensal vm
          ${joinMensalProd}
          WHERE ${filtroFornMensal}
            AND (? IS NULL OR vm.anoMes >= ?)
            AND (? IS NULL OR vm.anoMes <= ?)
          GROUP BY 1, 2, 3, 4
        ),
        lider AS (
          SELECT
            CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            SUM(vm.valor) AS liderValor,
            SUM(vm.quantidade) AS liderQuantidade
          FROM vendas_mensal vm
          ${joinMensalProd}
          WHERE (? IS NULL OR vm.anoMes >= ?)
            AND (? IS NULL OR vm.anoMes <= ?)
          GROUP BY 1, 2, 3, 4
        )
        SELECT
          f.categoria,
          f.departamento,
          f.secao,
          f.grupo,
          f.subgrupo,
          f.fornecedorValor,
          COALESCE(l.liderValor, f.fornecedorValor) AS liderValor,
          f.fornecedorQuantidade,
          COALESCE(l.liderQuantidade, f.fornecedorQuantidade) AS liderQuantidade,
          f.fornecedorSkus,
          f.fornecedorSkus AS liderSkus
        FROM forn f
        LEFT JOIN lider l
          ON l.depto = f.depto
         AND l.secaoCod = f.secaoCod
         AND l.grupoCod = f.grupoCod
         AND l.subCod = f.subCod
        ORDER BY f.fornecedorValor DESC
      `,
          )
          .all(
            fornecedorCodigo,
            fornecedorCodigo,
            inicioMes,
            inicioMes,
            fimMes,
            fimMes,
            inicioMes,
            inicioMes,
            fimMes,
            fimMes,
          ) as ShareCategoriaRow[])
      : temTotalCategoria
      ? (db
          .prepare(
            `
        WITH forn AS (
          SELECT
            CAST(CAST(p.departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(p.secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(p.grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(p.subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            COALESCE(NULLIF(MAX(p.categoria), ''), NULLIF(MAX(p.subgrupo), ''), 'Sem categoria') AS categoria,
            COALESCE(NULLIF(MAX(p.departamento), ''), 'Sem departamento') AS departamento,
            COALESCE(NULLIF(MAX(p.secao), ''), 'Sem secao') AS secao,
            COALESCE(NULLIF(MAX(p.grupo), ''), 'Sem grupo') AS grupo,
            COALESCE(NULLIF(MAX(p.subgrupo), ''), 'Sem subgrupo') AS subgrupo,
            SUM(v.quantidade * v.valorUnitario) AS fornecedorValor,
            SUM(v.quantidade) AS fornecedorQuantidade,
            COUNT(DISTINCT p.sku) AS fornecedorSkus
          FROM vendas v
          JOIN produtos p ON p.sku = v.sku
          WHERE ${sqlSkuVisivel("p")}
            AND (? IS NULL OR v.data >= ?)
            AND v.lojaId NOT IN (${sqlLojasForaPortal})
          GROUP BY 1, 2, 3, 4
        ),
        lider AS (
          SELECT
            CAST(CAST(departamentoCodigo AS INTEGER) AS TEXT) AS depto,
            CAST(CAST(secaoCodigo AS INTEGER) AS TEXT) AS secaoCod,
            CAST(CAST(grupoCodigo AS INTEGER) AS TEXT) AS grupoCod,
            CAST(CAST(subgrupoCodigo AS INTEGER) AS TEXT) AS subCod,
            SUM(valor) AS liderValor,
            SUM(quantidade) AS liderQuantidade
          FROM vendas_subgrupo
          WHERE (? IS NULL OR data >= ?)
            AND (? IS NULL OR data <= ?)
          GROUP BY 1, 2, 3, 4
        )
        SELECT
          f.categoria,
          f.departamento,
          f.secao,
          f.grupo,
          f.subgrupo,
          f.fornecedorValor,
          COALESCE(l.liderValor, f.fornecedorValor) AS liderValor,
          f.fornecedorQuantidade,
          COALESCE(l.liderQuantidade, f.fornecedorQuantidade) AS liderQuantidade,
          f.fornecedorSkus,
          f.fornecedorSkus AS liderSkus
        FROM forn f
        LEFT JOIN lider l
          ON l.depto = f.depto
         AND l.secaoCod = f.secaoCod
         AND l.grupoCod = f.grupoCod
         AND l.subCod = f.subCod
        ORDER BY f.fornecedorValor DESC
      `,
          )
          .all(fornecedorCodigo, inicio, inicio, inicio, inicio, fim, fim) as ShareCategoriaRow[])
      : (db
          .prepare(
            `
        WITH vendas_periodo AS (
          SELECT sku, quantidade, valorUnitario
          FROM vendas
          WHERE (? IS NULL OR data >= ?)
            AND lojaId NOT IN (${sqlLojasForaPortal})
        )
        SELECT
          COALESCE(NULLIF(MAX(p.categoria), ''), NULLIF(MAX(p.subgrupo), ''), 'Sem categoria') AS categoria,
          COALESCE(NULLIF(MAX(p.departamento), ''), 'Sem departamento') AS departamento,
          COALESCE(NULLIF(MAX(p.secao), ''), 'Sem secao') AS secao,
          COALESCE(NULLIF(MAX(p.grupo), ''), 'Sem grupo') AS grupo,
          COALESCE(NULLIF(MAX(p.subgrupo), ''), 'Sem subgrupo') AS subgrupo,
          SUM(CASE WHEN ${sqlSkuVisivel("p")} THEN vp.quantidade * vp.valorUnitario ELSE 0 END) AS fornecedorValor,
          SUM(vp.quantidade * vp.valorUnitario) AS liderValor,
          SUM(CASE WHEN ${sqlSkuVisivel("p")} THEN vp.quantidade ELSE 0 END) AS fornecedorQuantidade,
          SUM(vp.quantidade) AS liderQuantidade,
          COUNT(DISTINCT CASE WHEN ${sqlSkuVisivel("p")} THEN p.sku END) AS fornecedorSkus,
          COUNT(DISTINCT p.sku) AS liderSkus
        FROM vendas_periodo vp
        JOIN produtos p ON p.sku = vp.sku
        GROUP BY p.departamentoCodigo, p.secaoCodigo, p.grupoCodigo, p.subgrupoCodigo
        HAVING SUM(CASE WHEN ${sqlSkuVisivel("p")} THEN vp.quantidade * vp.valorUnitario ELSE 0 END) > 0
        ORDER BY fornecedorValor DESC
      `,
          )
          .all(
            inicio,
            inicio,
            fornecedorCodigo,
            fornecedorCodigo,
            fornecedorCodigo,
            fornecedorCodigo,
          ) as ShareCategoriaRow[]);

    const categorias: ShareCategoriaDB[] = categoriaRows.map((item) => {
      const fornecedorValor = Number(item.fornecedorValor ?? 0);
      const liderValor = Number(item.liderValor ?? 0);
      const fornecedorQuantidade = Number(item.fornecedorQuantidade ?? 0);
      const liderQuantidade = Number(item.liderQuantidade ?? 0);
      return {
        ...item,
        fornecedorValor,
        liderValor,
        fornecedorQuantidade,
        liderQuantidade,
        fornecedorSkus: Number(item.fornecedorSkus ?? 0),
        liderSkus: Number(item.liderSkus ?? 0),
        shareValor: liderValor > 0 ? (fornecedorValor / liderValor) * 100 : 0,
        shareQuantidade: liderQuantidade > 0 ? (fornecedorQuantidade / liderQuantidade) * 100 : 0,
      } satisfies ShareCategoriaDB;
    });

    const produtosFornecedor = (
      usarMensal
        ? db
            .prepare(
              `
        SELECT
          COALESCE(p.sku, vm.sku) AS sku,
          COALESCE(p.descricao, vm.sku) AS descricao,
          p.marca,
          COALESCE(NULLIF(p.categoria, ''), NULLIF(p.subgrupo, ''), 'Sem categoria') AS categoria,
          SUM(vm.valor) AS fornecedorValor,
          SUM(vm.quantidade) AS fornecedorQuantidade
        FROM vendas_mensal vm
        ${joinMensalProd}
        WHERE ${filtroFornMensal}
          AND (? IS NULL OR vm.anoMes >= ?)
          AND (? IS NULL OR vm.anoMes <= ?)
        GROUP BY COALESCE(p.sku, vm.sku), COALESCE(p.descricao, vm.sku), p.marca, categoria
      `,
            )
            .all(fornecedorCodigo, fornecedorCodigo, inicioMes, inicioMes, fimMes, fimMes)
        : db
            .prepare(
              `
        SELECT
          p.sku,
          p.descricao,
          p.marca,
          COALESCE(NULLIF(p.categoria, ''), NULLIF(p.subgrupo, ''), 'Sem categoria') AS categoria,
          SUM(v.quantidade * v.valorUnitario) AS fornecedorValor,
          SUM(v.quantidade) AS fornecedorQuantidade
        FROM vendas v
        JOIN produtos p ON p.sku = v.sku
        WHERE ${sqlSkuVisivel("p")}
          AND (? IS NULL OR v.data >= ?)
          AND v.lojaId NOT IN (${sqlLojasForaPortal})
        GROUP BY p.sku, p.descricao, p.marca, categoria
      `,
            )
            .all(fornecedorCodigo, inicio, inicio)
    ) as Array<{
      sku: string;
      descricao: string;
      marca: string | null;
      categoria: string;
      fornecedorValor: number;
      fornecedorQuantidade: number;
    }>;

    const totalFornecedor = produtosFornecedor.reduce(
      (acc, item) => acc + Number(item.fornecedorValor ?? 0),
      0,
    );
    const marcasMap = new Map<
      string,
      {
        fornecedorValor: number;
        fornecedorQuantidade: number;
        produtos: Set<string>;
        categorias: Set<string>;
      }
    >();

    for (const item of produtosFornecedor) {
      const marca = marcaReal(item.marca);
      const atual = marcasMap.get(marca) ?? {
        fornecedorValor: 0,
        fornecedorQuantidade: 0,
        produtos: new Set<string>(),
        categorias: new Set<string>(),
      };
      atual.fornecedorValor += Number(item.fornecedorValor ?? 0);
      atual.fornecedorQuantidade += Number(item.fornecedorQuantidade ?? 0);
      atual.produtos.add(item.sku);
      atual.categorias.add(item.categoria);
      marcasMap.set(marca, atual);
    }

    const marcas = Array.from(marcasMap.entries())
      .map(([marca, item]) => ({
        marca,
        fornecedorValor: item.fornecedorValor,
        fornecedorQuantidade: item.fornecedorQuantidade,
        produtos: item.produtos.size,
        categorias: item.categorias.size,
        sharePortfolio: totalFornecedor > 0 ? (item.fornecedorValor / totalFornecedor) * 100 : 0,
      }))
      .sort((a, b) => b.fornecedorValor - a.fornecedorValor)
      .slice(0, 24) satisfies ShareMarcaDB[];

    const resumo: ShareResumoDB = {
      fornecedorValor: categorias.reduce((acc, item) => acc + item.fornecedorValor, 0),
      liderValorCategorias: categorias.reduce((acc, item) => acc + item.liderValor, 0),
      fornecedorQuantidade: categorias.reduce((acc, item) => acc + item.fornecedorQuantidade, 0),
      liderQuantidadeCategorias: categorias.reduce((acc, item) => acc + item.liderQuantidade, 0),
      categorias: categorias.length,
      marcas: marcas.length,
      produtos: produtosFornecedor.length,
      shareValorMedio: 0,
      shareQuantidadeMedio: 0,
    };
    resumo.shareValorMedio =
      resumo.liderValorCategorias > 0
        ? (resumo.fornecedorValor / resumo.liderValorCategorias) * 100
        : 0;
    resumo.shareQuantidadeMedio =
      resumo.liderQuantidadeCategorias > 0
        ? (resumo.fornecedorQuantidade / resumo.liderQuantidadeCategorias) * 100
        : 0;

    return {
      periodo: { janela, inicio, fim },
      categorias,
      marcas,
      resumo,
    } satisfies ShareFornecedorDB;
  });

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
};

export const fetchNfePendentes = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("nfe_pendentes")) return [] as NfePendenteDB[];
    return db
      .prepare(
        `SELECT id, fornecedorCodigo, numeroNota, chaveNfe, lojaId, destTipo, situacao,
                situacaoDescricao, agendaRms, agendaPrevisao, status
         FROM nfe_pendentes
         WHERE fornecedorCodigo = ?
         ORDER BY numeroNota DESC`,
      )
      .all(fornecedorCodigo) as NfePendenteDB[];
  });

export const fetchDocas = createServerFn({ method: "GET" }).handler(async () => {
  if (!tabelaExiste("docas")) return [] as DocaDB[];
  return db
    .prepare(
      `SELECT lojaId, doca, tipo, horaInicio, horaFim FROM docas WHERE horaInicio <> '' ORDER BY lojaId, doca`,
    )
    .all() as DocaDB[];
});

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

export const fetchConciliacaoNfePedido = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("nfe_pedido_conciliacao")) return [] as ConciliacaoItemDB[];
    return db
      .prepare(
        `SELECT id, fornecedorCodigo, numeroNota, chaveNfe, pedido, sku, descricaoXml,
                quantidadeXml, quantidadePedida, precoXml, precoPedido,
                divergenciaPreco, divergenciaQuantidade, itemDesacordo
         FROM nfe_pedido_conciliacao
         WHERE fornecedorCodigo = ?
         ORDER BY (divergenciaPreco + divergenciaQuantidade + itemDesacordo) DESC, numeroNota DESC`,
      )
      .all(fornecedorCodigo) as ConciliacaoItemDB[];
  });

export type NfeXmlItemDB = {
  id: string;
  sku: string;
  descricao: string;
  quantidade: number;
  preco: number;
  pedido: string;
};

export const fetchItensNfe = createServerFn({ method: "GET" })
  .validator((data: { chaveNfe?: string; numeroNota?: string }) => ({
    chaveNfe: String(data.chaveNfe ?? "").trim(),
    numeroNota: String(data.numeroNota ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const chave = data.chaveNfe;
    const nota = data.numeroNota;
    if (!chave && !nota) return [] as NfeXmlItemDB[];

    const mapRow = (row: {
      id: string;
      sku?: string | null;
      descricao?: string | null;
      descricaoXml?: string | null;
      quantidade?: number | null;
      quantidadeXml?: number | null;
      preco?: number | null;
      precoXml?: number | null;
      pedido?: string | null;
    }): NfeXmlItemDB => ({
      id: String(row.id),
      sku: String(row.sku ?? "").trim(),
      descricao: String(row.descricao ?? row.descricaoXml ?? "").trim(),
      quantidade: Number(row.quantidade ?? row.quantidadeXml ?? 0),
      preco: Number(row.preco ?? row.precoXml ?? 0),
      pedido: String(row.pedido ?? "").trim(),
    });

    if (tabelaExiste("nfe_xml_itens")) {
      const rows = (
        chave
          ? db
              .prepare(
                `SELECT id, sku, descricao, quantidade, preco, pedido
                 FROM nfe_xml_itens WHERE chaveNfe = ? ORDER BY nitem, id`,
              )
              .all(chave)
          : db
              .prepare(
                `SELECT id, sku, descricao, quantidade, preco, pedido
                 FROM nfe_xml_itens WHERE numeroNota = ? ORDER BY nitem, id`,
              )
              .all(nota)
      ) as Array<{
        id: string;
        sku: string;
        descricao: string;
        quantidade: number;
        preco: number;
        pedido: string;
      }>;
      if (rows.length) return rows.map(mapRow);
    }

    if (!tabelaExiste("nfe_pedido_conciliacao")) return [] as NfeXmlItemDB[];
    const concil = (
      chave
        ? db
            .prepare(
              `SELECT id, sku, descricaoXml, quantidadeXml, precoXml, pedido
               FROM nfe_pedido_conciliacao WHERE chaveNfe = ? ORDER BY id`,
            )
            .all(chave)
        : db
            .prepare(
              `SELECT id, sku, descricaoXml, quantidadeXml, precoXml, pedido
               FROM nfe_pedido_conciliacao WHERE numeroNota = ? ORDER BY id`,
            )
            .all(nota)
    ) as Array<{
      id: string;
      sku: string;
      descricaoXml: string;
      quantidadeXml: number;
      precoXml: number;
      pedido: string;
    }>;
    return concil.map(mapRow);
  });

// Novos Endpoints para o Painel Administrativo de Controle de Acesso
export const searchFornecedores = createServerFn({ method: "GET" })
  .validator(
    (data: { search: string; limit: number; offset: number; onlyActive?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    exigirInterno();
    const { search, limit, offset, onlyActive } = data;
    const digitado = normalizarCodigoFornecedor(search) || search.trim();
    const resolvido = resolverCodigoFornecedorDados(digitado);
    const cleanSearch = `%${resolvido || digitado}%`;

    ensureFornecedoresColumns();
    ensureFillrateMetaColumn();
    let query =
      "SELECT codigo, nome, cnpj, acessoLiberado, metaFillRatePct, isentoCobranca, acessoDataInicio, acessoDataFim FROM fornecedores WHERE (codigo LIKE ? OR nome LIKE ? OR cnpj LIKE ?) AND acessoLiberado = 1";
    const params: Array<string | number> = [cleanSearch, cleanSearch, cleanSearch];

    query += " ORDER BY codigo LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as FornecedorDB[];

    // Obter contagem total
    let countQuery =
      "SELECT COUNT(*) AS total FROM fornecedores WHERE (codigo LIKE ? OR nome LIKE ? OR cnpj LIKE ?) AND acessoLiberado = 1";
    const countParams: string[] = [cleanSearch, cleanSearch, cleanSearch];
    const countStmt = db.prepare(countQuery);
    const total = countStmt.get(...countParams) as { total: number } | undefined;

    return {
      rows: rows as FornecedorDB[],
      total: Number(total?.total ?? 0),
    };
  });

export const updateSupplierAccess = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; acessoLiberado: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const { codigo, acessoLiberado } = data;
    const codigoNorm = normalizarCodigoFornecedor(codigo);
    
    if (acessoLiberado === 0) {
      // 1. Apagar todos os dados operacionais e cadastros do fornecedor
      db.prepare("DELETE FROM estoque WHERE sku IN (SELECT sku FROM produtos WHERE fornecedorCodigo = ?)").run(codigoNorm);
      db.prepare("DELETE FROM vendas WHERE sku IN (SELECT sku FROM produtos WHERE fornecedorCodigo = ?)").run(codigoNorm);
      db.prepare("DELETE FROM produtos WHERE fornecedorCodigo = ?").run(codigoNorm);
      db.prepare("DELETE FROM pedidos WHERE fornecedorCodigo = ?").run(codigoNorm);
      db.prepare("DELETE FROM pedido_itens WHERE fornecedorCodigo = ?").run(codigoNorm);
      db.prepare("DELETE FROM usuarios_fornecedor WHERE fornecedorCodigo = ?").run(codigoNorm);
      db.prepare("DELETE FROM sessoes_portal WHERE tipo = 'fornecedor' AND codigo = ?").run(codigoNorm);
      db.prepare("DELETE FROM acordos_acesso_portal WHERE fornecedorCodigo = ?").run(codigoNorm);
      db.prepare("DELETE FROM fornecedores WHERE codigo = ?").run(codigoNorm);
    } else {
      db.prepare("UPDATE fornecedores SET acessoLiberado = ? WHERE codigo = ?").run(acessoLiberado, codigoNorm);
    }
    return { success: true };
  });

export const includeSupplier = createServerFn({ method: "POST" })
  .validator((data: { codigo: string }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const codigo = resolverCodigoFornecedorDados(data.codigo);
    if (!codigo) {
      throw new Error("Informe o código RMS do fornecedor.");
    }
    const existente = db
      .prepare("SELECT codigo, acessoLiberado FROM fornecedores WHERE codigo = ?")
      .get(codigo) as { codigo: string; acessoLiberado?: number } | undefined;
    if (existente) {
      db.prepare("UPDATE fornecedores SET acessoLiberado = 1 WHERE codigo = ?").run(codigo);
      return { success: true, created: false, codigo };
    }
    ensureFillrateMetaColumn();
    db.prepare(
      "INSERT INTO fornecedores (codigo, nome, acessoLiberado, metaFillRatePct) VALUES (?, ?, 1, ?)",
    ).run(codigo, `Fornecedor ${codigo}`, FILLRATE_META_PADRAO);
    return { success: true, created: true, codigo };
  });

export { DESCONTO_ACESSO_PORTAL_PCT };

function ensureAcordosAcessoPortal() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS acordos_acesso_portal (
      id TEXT PRIMARY KEY,
      fornecedorCodigo TEXT NOT NULL,
      mesReferencia TEXT NOT NULL,
      valorCompra REAL NOT NULL,
      valorUmPct REAL NOT NULL,
      numeroAcordo TEXT NOT NULL,
      encontrado INTEGER NOT NULL,
      cobrancaId TEXT,
      cobrancaDescricao TEXT,
      cobrancaValor REAL,
      usuarioInterno TEXT NOT NULL,
      criadoEm TEXT NOT NULL
    );
  `);
}

function normalizarNumeroAcordo(raw: string) {
  return String(raw ?? "").trim().replace(/\s+/g, "");
}

export type CompraMesAnteriorDB = {
  mes: string;
  compra: number;
  umPct: number;
  documentos: number;
};

export const fetchCompraMesAnterior = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    const mes = mesFechadoIso();
    const vazio = (): CompraMesAnteriorDB => ({
      mes,
      compra: 0,
      umPct: 0,
      documentos: 0,
    });
    if (!tabelaExiste("pedidos") || !tabelaExiste("pedido_itens")) return vazio();
    const row = db
      .prepare(
        `SELECT COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
                SUM(
                  CASE
                    WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                    THEN COALESCE(i.quantidadeFaturada, 0)
                    ELSE COALESCE(i.quantidadePedida, 0)
                  END * COALESCE(i.precoUnitario, 0)
                ) AS compra
         FROM pedidos p
         INNER JOIN pedido_itens i
           ON i.numero = p.numero
          AND i.lojaId = p.lojaId
          AND i.fornecedorCodigo = p.fornecedorCodigo
         WHERE p.fornecedorCodigo = ?
           AND p.destino = 'Fornecedor'
           AND p.status <> 'Cancelado'
           AND p.lojaId NOT IN (${sqlLojasForaPortal})
           AND substr(p.emissao, 1, 7) = ?
           AND COALESCE(i.quantidadePedida, 0) > 0
           AND COALESCE(i.quantidadeFaturada, 0) > 0`,
      )
      .get(codigo, mes) as { documentos: number; compra: number } | undefined;
    const compra = Number(row?.compra || 0);
    return {
      mes,
      compra,
      umPct: valorUmPctCompra(compra),
      documentos: Number(row?.documentos || 0),
    };
  });

export type RelatorioAcordoAcessoLinhaDB = {
  codigo: string;
  nome: string;
  segmento: string;
  compra: number;
  umPct: number;
  documentos: number;
};

export type RelatorioAcordoAcessoDB = {
  mes: string;
  linhas: RelatorioAcordoAcessoLinhaDB[];
};

export const fetchRelatorioAcordoAcesso = createServerFn({ method: "GET" }).handler(async () => {
  exigirInterno();
  const mes = mesFechadoIso();
  const vazio = (): RelatorioAcordoAcessoDB => ({ mes, linhas: [] });
  if (!tabelaExiste("pedidos") || !tabelaExiste("pedido_itens") || !tabelaExiste("fornecedores")) {
    return vazio();
  }
  const temProdutos = tabelaExiste("produtos");
  const joinProduto = temProdutos ? "LEFT JOIN produtos pr ON pr.sku = i.sku" : "";
  const joinForn =
    "INNER JOIN fornecedores f ON f.codigo = p.fornecedorCodigo AND f.acessoLiberado = 1";
  const campoDeptoCod = temProdutos ? "COALESCE(pr.departamentoCodigo, '')" : "''";
  const campoDeptoNome = temProdutos ? "COALESCE(pr.departamento, '')" : "''";
  const campoNomeForn = "MAX(NULLIF(TRIM(f.nome), ''))";
  const campoNomeProd = temProdutos ? "MAX(NULLIF(TRIM(pr.fornecedorComercialNome), ''))" : "NULL";
  const campoNome = `COALESCE(${campoNomeForn}, ${campoNomeProd}, '')`;
  const rows = db
    .prepare(
      `SELECT p.fornecedorCodigo AS codigo,
              ${campoNome} AS nome,
              ${campoDeptoCod} AS departamentoCodigo,
              ${campoDeptoNome} AS departamento,
              COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
              SUM(
                CASE
                  WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                  THEN COALESCE(i.quantidadeFaturada, 0)
                  ELSE COALESCE(i.quantidadePedida, 0)
                END * COALESCE(i.precoUnitario, 0)
              ) AS compra
       FROM pedidos p
       INNER JOIN pedido_itens i
         ON i.numero = p.numero
        AND i.lojaId = p.lojaId
        AND i.fornecedorCodigo = p.fornecedorCodigo
       ${joinProduto}
       ${joinForn}
       WHERE p.destino = 'Fornecedor'
         AND p.status <> 'Cancelado'
         AND p.lojaId NOT IN (${sqlLojasForaPortal})
         AND substr(p.emissao, 1, 7) = ?
         AND COALESCE(i.quantidadePedida, 0) > 0
         AND COALESCE(i.quantidadeFaturada, 0) > 0
       GROUP BY p.fornecedorCodigo, ${campoDeptoCod}, ${campoDeptoNome}
       HAVING SUM(
         CASE
           WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
           THEN COALESCE(i.quantidadeFaturada, 0)
           ELSE COALESCE(i.quantidadePedida, 0)
         END * COALESCE(i.precoUnitario, 0)
       ) > 0`,
    )
    .all(mes) as Array<{
    codigo: string;
    nome: string;
    departamentoCodigo: string;
    departamento: string;
    documentos: number;
    compra: number;
  }>;

  const agregadas = new Map<string, RelatorioAcordoAcessoLinhaDB>();
  for (const row of rows) {
    const codigo = String(row.codigo || "");
    if (!codigo) continue;
    const segmento = segmentoIntelider(row.departamentoCodigo, row.departamento);
    const chave = `${codigo}\t${segmento}`;
    const compra = Number(row.compra || 0);
    const atual = agregadas.get(chave);
    if (atual) {
      atual.compra += compra;
      atual.documentos += Number(row.documentos || 0);
      atual.umPct = valorUmPctCompra(atual.compra);
      const nome = String(row.nome || "").trim();
      if (nome && (!atual.nome || atual.nome.startsWith("Fornecedor "))) atual.nome = nome;
    } else {
      agregadas.set(chave, {
        codigo,
        nome: String(row.nome || "").trim() || `Fornecedor ${codigo}`,
        segmento,
        compra,
        umPct: valorUmPctCompra(compra),
        documentos: Number(row.documentos || 0),
      });
    }
  }

  const linhas = [...agregadas.values()].sort(
    (a, b) => a.segmento.localeCompare(b.segmento, "pt-BR") || b.compra - a.compra,
  );
  return { mes, linhas };
});

export type AcordoCobrancaDB = {
  encontrado: boolean;
  numeroAcordo: string;
  id?: string;
  documento?: string;
  descricao?: string;
  valor?: number;
  status?: string;
  competencia?: string;
};

export const verificarAcordoCobranca = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; numeroAcordo: string }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const numeroAcordo = normalizarNumeroAcordo(data.numeroAcordo);
    const vazio = (): AcordoCobrancaDB => ({ encontrado: false, numeroAcordo });
    if (!numeroAcordo) return vazio();
    if (!tabelaExiste("contas_receber")) return vazio();
    const row = db
      .prepare(
        `SELECT id, documento, descricao, valor, status, competencia, contrato
         FROM contas_receber
         WHERE fornecedorCodigo = ?
           AND tipo = 'Acordo comercial'
           AND (
             contrato = ?
             OR ltrim(contrato, '0') = ltrim(?, '0')
           )
         ORDER BY emissao DESC
         LIMIT 1`,
      )
      .get(codigo, numeroAcordo, numeroAcordo) as
      | {
          id: string;
          documento: string;
          descricao: string | null;
          valor: number;
          status: string;
          competencia: string | null;
          contrato: string | null;
        }
      | undefined;
    if (!row) return vazio();
    return {
      encontrado: true,
      numeroAcordo: row.contrato || numeroAcordo,
      id: row.id,
      documento: row.documento,
      descricao: row.descricao || "",
      valor: Number(row.valor || 0),
      status: row.status,
      competencia: row.competencia || "",
    };
  });

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
};

export const fetchAcordosAcessoPortal = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    exigirInterno();
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    ensureAcordosAcessoPortal();
    return db
      .prepare(
        `SELECT id, fornecedorCodigo, mesReferencia, valorCompra, valorUmPct, numeroAcordo,
                encontrado, cobrancaId, cobrancaDescricao, cobrancaValor, usuarioInterno, criadoEm
         FROM acordos_acesso_portal
         WHERE fornecedorCodigo = ?
         ORDER BY criadoEm DESC`,
      )
      .all(codigo) as AcordoAcessoPortalDB[];
  });

export const registrarAcordoAcessoPortal = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; numeroAcordo: string }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const sessao = lerSessaoPortal();
    if (!sessao || sessao.tipo !== "interno") {
      throw new Error("Acesso administrativo exigido.");
    }
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const numeroAcordo = normalizarNumeroAcordo(data.numeroAcordo);
    if (!numeroAcordo) throw new Error("Informe o número do acordo.");

    const mes = mesFechadoIso();
    const compraRow = db
      .prepare(
        `SELECT COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
                SUM(
                  CASE
                    WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                    THEN COALESCE(i.quantidadeFaturada, 0)
                    ELSE COALESCE(i.quantidadePedida, 0)
                  END * COALESCE(i.precoUnitario, 0)
                ) AS compra
         FROM pedidos p
         INNER JOIN pedido_itens i
           ON i.numero = p.numero
          AND i.lojaId = p.lojaId
          AND i.fornecedorCodigo = p.fornecedorCodigo
         WHERE p.fornecedorCodigo = ?
           AND p.destino = 'Fornecedor'
           AND p.status <> 'Cancelado'
           AND p.lojaId NOT IN (${sqlLojasForaPortal})
           AND substr(p.emissao, 1, 7) = ?
           AND COALESCE(i.quantidadePedida, 0) > 0
           AND COALESCE(i.quantidadeFaturada, 0) > 0`,
      )
      .get(codigo, mes) as { documentos: number; compra: number } | undefined;
    const valorCompra = Number(compraRow?.compra || 0);
    const umPct = valorUmPctCompra(valorCompra);

    if (!tabelaExiste("contas_receber")) {
      throw new Error("Cobrança do Líder indisponível.");
    }
    const cobranca = db
      .prepare(
        `SELECT id, descricao, valor, contrato
         FROM contas_receber
         WHERE fornecedorCodigo = ?
           AND tipo = 'Acordo comercial'
           AND (contrato = ? OR ltrim(contrato, '0') = ltrim(?, '0'))
         ORDER BY emissao DESC
         LIMIT 1`,
      )
      .get(codigo, numeroAcordo, numeroAcordo) as
      | { id: string; descricao: string | null; valor: number; contrato: string | null }
      | undefined;
    if (!cobranca) {
      throw new Error("Acordo não encontrado no sistema de cobrança do Líder.");
    }

    ensureAcordosAcessoPortal();
    const id = `acesso-${codigo}-${mes}-${Date.now()}`;
    db.prepare(
      `INSERT INTO acordos_acesso_portal (
          id, fornecedorCodigo, mesReferencia, valorCompra, valorUmPct, numeroAcordo,
          encontrado, cobrancaId, cobrancaDescricao, cobrancaValor, usuarioInterno, criadoEm
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      codigo,
      mes,
      valorCompra,
      umPct,
      cobranca.contrato || numeroAcordo,
      cobranca.id,
      cobranca.descricao || "",
      Number(cobranca.valor || 0),
      sessao.codigo,
      new Date().toISOString(),
    );
    return { success: true, id, numeroAcordo: cobranca.contrato || numeroAcordo };
  });

export const FILLRATE_TAXA_PADRAO = 3;
export const FILLRATE_TAXA_MIN = 1;
export const FILLRATE_TAXA_MAX = 10;
export const FILLRATE_META_PADRAO = 85;
export const FILLRATE_META_MIN = 85;
export const FILLRATE_META_MAX = 100;

export type FillratePoliticaDB = {
  taxaMultaPct: number;
  atualizadoEm: string;
};

export type FillrateAcordoDB = {
  codigo: string;
  metaFillRatePct: number;
  taxaMultaPct: number;
};

function normalizarTaxaMulta(valor: number) {
  if (!Number.isFinite(valor)) return FILLRATE_TAXA_PADRAO;
  const arredondada = Math.round(valor * 2) / 2;
  return Math.min(FILLRATE_TAXA_MAX, Math.max(FILLRATE_TAXA_MIN, arredondada));
}

function normalizarMetaFillRate(valor: number) {
  if (!Number.isFinite(valor)) return FILLRATE_META_PADRAO;
  const arredondada = Math.round(valor);
  return Math.min(FILLRATE_META_MAX, Math.max(FILLRATE_META_MIN, arredondada));
}

function ensureFillrateMetaColumn() {
  const cols = db.prepare("PRAGMA table_info(fornecedores)").all() as { name: string }[];
  if (!cols.some((col) => col.name === "metaFillRatePct")) {
    db.exec(`ALTER TABLE fornecedores ADD COLUMN metaFillRatePct REAL NOT NULL DEFAULT ${FILLRATE_META_PADRAO}`);
  }
}

function ensureFillratePolitica() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fillrate_politica (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      taxaMultaPct REAL NOT NULL,
      atualizadoEm TEXT NOT NULL
    );
    INSERT OR IGNORE INTO fillrate_politica (id, taxaMultaPct, atualizadoEm)
    VALUES (1, ${FILLRATE_TAXA_PADRAO}, datetime('now'));
  `);
}

function lerFillratePolitica(): FillratePoliticaDB {
  ensureFillratePolitica();
  const row = db
    .prepare("SELECT taxaMultaPct, atualizadoEm FROM fillrate_politica WHERE id = 1")
    .get() as FillratePoliticaDB | undefined;
  return {
    taxaMultaPct: normalizarTaxaMulta(row?.taxaMultaPct ?? FILLRATE_TAXA_PADRAO),
    atualizadoEm: row?.atualizadoEm ?? "",
  };
}

export const fetchFillratePolitica = createServerFn({ method: "GET" }).handler(async () => {
  return lerFillratePolitica();
});

export const updateFillrateTaxa = createServerFn({ method: "POST" })
  .validator((data: { taxaMultaPct: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const taxaMultaPct = normalizarTaxaMulta(data.taxaMultaPct);
    ensureFillratePolitica();
    db.prepare(
      "UPDATE fillrate_politica SET taxaMultaPct = ?, atualizadoEm = datetime('now') WHERE id = 1",
    ).run(taxaMultaPct);
    return lerFillratePolitica();
  });

export const fetchFillrateAcordo = createServerFn({ method: "GET" })
  .validator((codigo: string) => normalizarCodigoFornecedor(codigo))
  .handler(async ({ data: codigoPedido }) => {
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    ensureFillrateMetaColumn();
    const row = db
      .prepare("SELECT codigo, metaFillRatePct FROM fornecedores WHERE codigo = ?")
      .get(codigo) as { codigo: string; metaFillRatePct?: number } | undefined;
    const politica = lerFillratePolitica();
    return {
      codigo: row?.codigo ?? codigo,
      metaFillRatePct: normalizarMetaFillRate(row?.metaFillRatePct ?? FILLRATE_META_PADRAO),
      taxaMultaPct: politica.taxaMultaPct,
    } satisfies FillrateAcordoDB;
  });

export const updateFillrateMeta = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; metaFillRatePct: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const codigo = normalizarCodigoFornecedor(data.codigo);
    const metaFillRatePct = normalizarMetaFillRate(data.metaFillRatePct);
    ensureFillrateMetaColumn();
    const result = db
      .prepare("UPDATE fornecedores SET metaFillRatePct = ? WHERE codigo = ?")
      .run(metaFillRatePct, codigo);
    if (!result.changes) {
      throw new Error("Fornecedor não encontrado no portal.");
    }
    return { codigo, metaFillRatePct };
  });

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

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
  corte: { data: string; dia: number; mes: number; anoAtual: number; anoBase: number };
  farolPct: number;
  cacheAte: string | null;
  temAnoAtual: boolean;
  rede: { anualBase: number; ytdAtual: number; realizadoPct: number | null; pontos: number | null };
  fornecedor: { anualBase: number; ytdAtual: number; realizadoPct: number | null; pontos: number | null };
  meses: VendasAnualMesDB[];
  secoes: VendasAnualSecaoDB[];
  itens: VendasAnualItemDB[];
};

function diasNoMes(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

function crescimentoPct(atual: number, base: number): number | null {
  if (base === 0) return atual > 0 ? null : 0;
  return (atual / base - 1) * 100;
}

export const fetchVendasAnual = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const hoje = new Date();
    const anoAtual = hoje.getUTCFullYear();
    const mesCorte = hoje.getUTCMonth() + 1;
    const diaCorte = hoje.getUTCDate();
    const anoBase = anoAtual - 1;
    const corteIso = `${anoAtual}-${String(mesCorte).padStart(2, "0")}-${String(diaCorte).padStart(2, "0")}`;

    const vazio = (cacheAte: string | null, temAnoAtual: boolean): VendasAnualDB => ({
      corte: { data: corteIso, dia: diaCorte, mes: mesCorte, anoAtual, anoBase },
      farolPct: 0,
      cacheAte,
      temAnoAtual,
      rede: { anualBase: 0, ytdAtual: 0, realizadoPct: null, pontos: null },
      fornecedor: { anualBase: 0, ytdAtual: 0, realizadoPct: null, pontos: null },
      meses: [],
      secoes: [],
      itens: [],
    });

    if (!tabelaExiste("vendas_mensal")) {
      return vazio(null, false);
    }

    const cacheAteRow = db.prepare("SELECT MAX(anoMes) AS ate FROM vendas_mensal").get() as {
      ate: string | null;
    };
    const cacheAte = cacheAteRow?.ate ?? null;
    const temAnoAtual = Boolean(cacheAte && cacheAte.startsWith(String(anoAtual)));

    type MesAgg = { valor: number; volume: number };
    const zeroMes = (): MesAgg => ({ valor: 0, volume: 0 });
    const redeBase: MesAgg[] = Array.from({ length: 12 }, zeroMes);
    const redeAtual: MesAgg[] = Array.from({ length: 12 }, zeroMes);
    const fornBase: MesAgg[] = Array.from({ length: 12 }, zeroMes);
    const fornAtual: MesAgg[] = Array.from({ length: 12 }, zeroMes);

    const redeRows = db
      .prepare(
        `SELECT anoMes, SUM(valor) AS valor, SUM(quantidade) AS volume
         FROM vendas_mensal
         WHERE anoMes LIKE ? OR anoMes LIKE ?
         GROUP BY anoMes`,
      )
      .all(`${anoBase}-%`, `${anoAtual}-%`) as { anoMes: string; valor: number; volume: number }[];

    for (const row of redeRows) {
      const ano = Number(row.anoMes.slice(0, 4));
      const mes = Number(row.anoMes.slice(5, 7));
      const alvo = ano === anoBase ? redeBase : ano === anoAtual ? redeAtual : null;
      if (!alvo || mes < 1 || mes > 12) continue;
      alvo[mes - 1].valor += row.valor || 0;
      alvo[mes - 1].volume += row.volume || 0;
    }

    const temFornCol = Boolean(
      (db.prepare("PRAGMA table_info(vendas_mensal)").all() as { name: string }[]).some(
        (c) => c.name === "fornecedorCodigo",
      ),
    );
    // Planilha: SKU = codigo RMS + dígito. Refresh RMS grava o SKU do portal (sem dígito).
    const joinProdutoRms = joinVendasMensalProduto;
    const nomeSecaoSql = `COALESCE(
      NULLIF(TRIM(
        CASE
          WHEN instr(COALESCE(p.secao, ''), ' - ') > 1
           AND substr(p.secao, 1, instr(p.secao, ' - ') - 1) GLOB '[0-9]*'
          THEN substr(p.secao, instr(p.secao, ' - ') + 3)
          ELSE p.secao
        END
      ), ''),
      'Sem seção'
    )`;
    const filtroForn = temFornCol
      ? `(vm.fornecedorCodigo = ? OR vm.fornecedorCodigo LIKE ? || '_')`
      : sqlSkuVisivel("p");
    const bindsForn = temFornCol ? [fornecedorCodigo, fornecedorCodigo] : [fornecedorCodigo];
    const joinProdObrigatorio = joinProdutoRms;

    const fornRows = db
      .prepare(
        `SELECT vm.anoMes, SUM(vm.valor) AS valor, SUM(vm.quantidade) AS volume
         FROM vendas_mensal vm
         ${joinProdutoRms}
         WHERE ${filtroForn}
           AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
         GROUP BY vm.anoMes`,
      )
      .all(...bindsForn, `${anoBase}-%`, `${anoAtual}-%`) as {
      anoMes: string;
      valor: number;
      volume: number;
    }[];

    for (const row of fornRows) {
      const ano = Number(row.anoMes.slice(0, 4));
      const mes = Number(row.anoMes.slice(5, 7));
      const alvo = ano === anoBase ? fornBase : ano === anoAtual ? fornAtual : null;
      if (!alvo || mes < 1 || mes > 12) continue;
      alvo[mes - 1].valor += row.valor || 0;
      alvo[mes - 1].volume += row.volume || 0;
    }

    const anualRedeBase = redeBase.reduce((acc, m) => acc + m.valor, 0);
    const anualFornBase = fornBase.reduce((acc, m) => acc + m.valor, 0);
    const pesos = redeBase.map((m) => (anualRedeBase > 0 ? m.valor / anualRedeBase : 0));

    let farolPct = 0;
    const meses: VendasAnualMesDB[] = [];
    for (let i = 0; i < 12; i++) {
      const mes = i + 1;
      const dias = diasNoMes(anoAtual, mes);
      const aberto = mes === mesCorte;
      const fechado = mes < mesCorte;
      let farolAcum = pesos.slice(0, i).reduce((acc, p) => acc + p, 0);
      if (aberto) farolAcum += (pesos[i] / dias) * diaCorte;
      else if (fechado || mes < mesCorte) farolAcum += pesos[i];
      if (aberto) farolPct = farolAcum * 100;
      if (mes === 12 && mesCorte === 12 && diaCorte >= dias) farolPct = 100;

      meses.push({
        mes,
        nome: NOMES_MES[i],
        dias,
        pesoAnoPct: pesos[i] * 100,
        farolAcumPct: farolAcum * 100,
        redeValorBase: redeBase[i].valor,
        redeValorAtual: redeAtual[i].valor,
        redeVolumeBase: redeBase[i].volume,
        redeVolumeAtual: redeAtual[i].volume,
        fornValorBase: fornBase[i].valor,
        fornValorAtual: fornAtual[i].valor,
        fornVolumeBase: fornBase[i].volume,
        fornVolumeAtual: fornAtual[i].volume,
        aberto,
      });
    }
    if (mesCorte === 12 && diaCorte >= diasNoMes(anoAtual, 12)) farolPct = 100;

    const ytdMeses = (arr: MesAgg[]) =>
      arr.reduce((acc, m, i) => {
        const mes = i + 1;
        if (mes < mesCorte) return acc + m.valor;
        if (mes === mesCorte) return acc + m.valor;
        return acc;
      }, 0);

    const ytdRede = ytdMeses(redeAtual);
    const ytdForn = ytdMeses(fornAtual);
    const realizadoRede = anualRedeBase > 0 && temAnoAtual ? (ytdRede / anualRedeBase) * 100 : null;
    const realizadoForn = anualFornBase > 0 && temAnoAtual ? (ytdForn / anualFornBase) * 100 : null;

    const ytdBaseFim = `${anoBase}-${String(mesCorte).padStart(2, "0")}`;
    const ytdAtualFim = `${anoAtual}-${String(mesCorte).padStart(2, "0")}`;

    const secaoRows = db
      .prepare(
        `SELECT
            ${nomeSecaoSql} AS secao,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.valor ELSE 0 END) AS valorBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorBaseYtd,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorAtual,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.quantidade ELSE 0 END) AS volumeBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.quantidade ELSE 0 END) AS volumeBaseYtd,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.quantidade ELSE 0 END) AS volumeAtual
         FROM vendas_mensal vm
         ${joinProdObrigatorio}
         WHERE ${filtroForn}
           AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
         GROUP BY 1
         HAVING SUM(vm.valor) > 0
         ORDER BY valorBase DESC
         LIMIT 40`,
      )
      .all(
        `${anoBase}-%`,
        `${anoBase}-01`,
        ytdBaseFim,
        `${anoAtual}-01`,
        ytdAtualFim,
        `${anoBase}-%`,
        `${anoBase}-01`,
        ytdBaseFim,
        `${anoAtual}-01`,
        ytdAtualFim,
        ...bindsForn,
        `${anoBase}-%`,
        `${anoAtual}-%`,
      ) as VendasAnualSecaoDB[];

    const secoes: VendasAnualSecaoDB[] = secaoRows.map((s) => ({
      ...s,
      crescimentoValorPct: crescimentoPct(s.valorAtual, s.valorBaseYtd),
      crescimentoVolumePct: crescimentoPct(s.volumeAtual, s.volumeBaseYtd),
    }));

    const itemRows = db
      .prepare(
        `SELECT
            COALESCE(p.sku, vm.sku) AS sku,
            COALESCE(p.descricao, vm.sku) AS descricao,
            p.codigoProdutoRms AS codigoProdutoRms,
            p.digitoProdutoRms AS digitoProdutoRms,
            ${nomeSecaoSql} AS secao,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.valor ELSE 0 END) AS valorBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorBaseYtd,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.valor ELSE 0 END) AS valorAtual,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.quantidade ELSE 0 END) AS volumeBase,
            SUM(CASE WHEN vm.anoMes BETWEEN ? AND ? THEN vm.quantidade ELSE 0 END) AS volumeAtual
         FROM vendas_mensal vm
         ${joinProdObrigatorio}
         WHERE ${filtroForn}
           AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
         GROUP BY 1, 2, 3, 4, 5
         HAVING SUM(vm.valor) > 0
         ORDER BY valorBase DESC
         LIMIT 80`,
      )
      .all(
        `${anoBase}-%`,
        `${anoBase}-01`,
        ytdBaseFim,
        `${anoAtual}-01`,
        ytdAtualFim,
        `${anoBase}-%`,
        `${anoAtual}-01`,
        ytdAtualFim,
        ...bindsForn,
        `${anoBase}-%`,
        `${anoAtual}-%`,
      ) as Omit<VendasAnualItemDB, "crescimentoValorPct" | "contribuicaoFuro">[];

    const esperadoItem = (base: number) => base * (farolPct / 100);
    const itens: VendasAnualItemDB[] = itemRows
      .map((item) => ({
        ...item,
        crescimentoValorPct: crescimentoPct(item.valorAtual, item.valorBaseYtd),
        contribuicaoFuro: esperadoItem(item.valorBase) - item.valorAtual,
      }))
      .sort((a, b) => {
        const valA = a.crescimentoValorPct === null ? 0 : a.crescimentoValorPct;
        const valB = b.crescimentoValorPct === null ? 0 : b.crescimentoValorPct;
        return valA - valB;
      })
      .slice(0, 40);

    return {
      corte: { data: corteIso, dia: diaCorte, mes: mesCorte, anoAtual, anoBase },
      farolPct,
      cacheAte,
      temAnoAtual,
      rede: {
        anualBase: anualRedeBase,
        ytdAtual: ytdRede,
        realizadoPct: realizadoRede,
        pontos: realizadoRede === null ? null : realizadoRede - farolPct,
      },
      fornecedor: {
        anualBase: anualFornBase,
        ytdAtual: ytdForn,
        realizadoPct: realizadoForn,
        pontos: realizadoForn === null ? null : realizadoForn - farolPct,
      },
      meses,
      secoes,
      itens,
    } satisfies VendasAnualDB;
  });

export type UsuarioInternoDB = {
  username: string;
  nome: string;
  role: string;
};

export { USUARIOS_FORNECEDOR_MAX };

export type UsuarioFornecedorDB = {
  id: string;
  nome: string;
  email: string;
  ativo: number;
  criadoEm: string;
};

function publicUsuarioFornecedor(row: UsuarioFornecedorRow): UsuarioFornecedorDB {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    ativo: Number(row.ativo ?? 0),
    criadoEm: row.criadoEm,
  };
}

export const fetchUsuariosFornecedor = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    ensureUsuariosFornecedor();
    const rows = db
      .prepare(
        `SELECT id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm
         FROM usuarios_fornecedor
         WHERE fornecedorCodigo = ?
         ORDER BY criadoEm ASC, email ASC`,
      )
      .all(codigo) as UsuarioFornecedorRow[];
    return rows.map(publicUsuarioFornecedor);
  });

export const salvarUsuarioFornecedor = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      id?: string;
      nome: string;
      email: string;
      senha?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { normalizarEmail, hashSenhaFornecedor, novoIdUsuarioFornecedor } = await import("./server/usuarios-fornecedor");
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const nome = String(data.nome ?? "").trim();
    const email = normalizarEmail(data.email);
    const senha = String(data.senha ?? "");
    const idExistente = String(data.id ?? "").trim();
    if (!nome) throw new Error("Informe o nome do usuário.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Informe um e-mail válido.");
    }
    ensureUsuariosFornecedor();

    const duplicado = db
      .prepare(
        `SELECT id FROM usuarios_fornecedor WHERE fornecedorCodigo = ? AND email = ? AND id <> ?`,
      )
      .get(codigo, email, idExistente || "-") as { id: string } | undefined;
    if (duplicado) throw new Error("Este e-mail já está cadastrado neste fornecedor.");

    if (idExistente) {
      const atual = db
        .prepare(
          `SELECT id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm
           FROM usuarios_fornecedor WHERE id = ? AND fornecedorCodigo = ?`,
        )
        .get(idExistente, codigo) as UsuarioFornecedorRow | undefined;
      if (!atual) throw new Error("Usuário não encontrado.");
      const senhaHash = senha
        ? (() => {
            if (senha.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres.");
            return hashSenhaFornecedor(senha);
          })()
        : atual.senhaHash;
      if (senha) {
        db.prepare(
          `UPDATE usuarios_fornecedor SET nome = ?, email = ?, senhaHash = ?, precisaTrocarSenha = 0
           WHERE id = ? AND fornecedorCodigo = ?`,
        ).run(nome, email, senhaHash, idExistente, codigo);
      } else {
        db.prepare(
          `UPDATE usuarios_fornecedor SET nome = ?, email = ? WHERE id = ? AND fornecedorCodigo = ?`,
        ).run(nome, email, idExistente, codigo);
      }
      return publicUsuarioFornecedor({ ...atual, nome, email, senhaHash });
    }

    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM usuarios_fornecedor WHERE fornecedorCodigo = ?`)
      .get(codigo) as { total: number } | undefined;
    if (Number(total?.total ?? 0) >= USUARIOS_FORNECEDOR_MAX) {
      throw new Error(`Limite de ${USUARIOS_FORNECEDOR_MAX} usuários por fornecedor.`);
    }
    if (senha.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres.");
    const id = novoIdUsuarioFornecedor();
    const criadoEm = new Date().toISOString();
    const senhaHash = hashSenhaFornecedor(senha);
    db.prepare(
      `INSERT INTO usuarios_fornecedor (id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).run(id, codigo, nome, email, senhaHash, criadoEm);
    return publicUsuarioFornecedor({
      id,
      fornecedorCodigo: codigo,
      nome,
      email,
      senhaHash,
      ativo: 1,
      criadoEm,
    });
  });

export const excluirUsuarioFornecedor = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; id: string }) => data)
  .handler(async ({ data }) => {
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    ensureUsuariosFornecedor();
    db.prepare(`DELETE FROM usuarios_fornecedor WHERE id = ? AND fornecedorCodigo = ?`).run(
      data.id,
      codigo,
    );
    return { success: true };
  });

export const loginUsuarioFornecedor = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; email: string; senha: string }) => ({
    codigo: String(data.codigo ?? "").trim(),
    email: String(data.email ?? "").trim().toLowerCase(),
    senha: String(data.senha ?? ""),
  }))
  .handler(async ({ data }) => {
    const { senhaFornecedorConfere } = await import("./server/usuarios-fornecedor");
    const { email, senha } = data;
    const forn = buscarFornecedorPorLogin(data.codigo);
    if (!forn || forn.acessoLiberado !== 1) return null;
    if (!vigenciaAcessoOk(forn)) return null;
    ensureUsuariosFornecedor();
    const row = db
      .prepare(
        `SELECT id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm, precisaTrocarSenha
         FROM usuarios_fornecedor
         WHERE fornecedorCodigo = ? AND email = ?`,
      )
      .get(forn.codigo, email) as UsuarioFornecedorRow | undefined;
    if (!row || Number(row.ativo) !== 1) return null;
    const senhaOk =
      senhaFornecedorConfere(senha, row.senhaHash) ||
      (() => {
        const digits = soDigitos(senha);
        return Boolean(digits) && digits !== senha && senhaFornecedorConfere(digits, row.senhaHash);
      })();
    if (!senhaOk) return null;
    const usouSenhaInicial = senhaCnpjConfere(senha, forn);
    if (usouSenhaInicial && !flagPrecisaTrocarSenha(row)) {
      db.prepare(`UPDATE usuarios_fornecedor SET precisaTrocarSenha = 1 WHERE id = ?`).run(row.id);
    }
    gravarSessaoPortal("fornecedor", forn.codigo, email);
    return {
      codigo: forn.codigo,
      nome: row.nome,
      email: row.email,
      precisaTrocarSenha: usouSenhaInicial || flagPrecisaTrocarSenha(row),
    };
  });

export const primeiroAcessoFornecedor = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; email: string; senha: string }) => ({
    codigo: String(data.codigo ?? "").trim(),
    email: String(data.email ?? "").trim().toLowerCase(),
    senha: String(data.senha ?? ""),
  }))
  .handler(async ({ data }) => {
    const { normalizarEmail, hashSenhaFornecedor, novoIdUsuarioFornecedor } = await import(
      "./server/usuarios-fornecedor"
    );
    const email = normalizarEmail(data.email);
    if (!emailLoginValido(email)) {
      throw new Error("Informe um e-mail válido. O e-mail é o login da sua conta.");
    }
    const forn = exigirFornecedorLiberado(data.codigo);
    ensureUsuariosFornecedor();
    const existente = db
      .prepare(
        `SELECT id FROM usuarios_fornecedor WHERE fornecedorCodigo = ? AND email = ?`,
      )
      .get(forn.codigo, email) as { id: string } | undefined;
    if (existente) {
      throw new Error("EMAIL_JA_CADASTRADO");
    }
    if (!senhaCnpjConfere(data.senha, forn)) {
      const digitouOCodigo =
        soDigitos(data.senha) === soDigitos(data.codigo) ||
        soDigitos(data.senha) === soDigitos(forn.codigo);
      if (digitouOCodigo) {
        throw new Error(
          `A senha não é o código ${forn.codigo}. No primeiro acesso use o CNPJ ${forn.cnpj} (14 números, com ou sem pontuação).`,
        );
      }
      throw new Error(
        `No primeiro acesso a senha é o CNPJ ${forn.cnpj}. Você digitou ${soDigitos(data.senha).length} número(s); o CNPJ tem ${cnpjDoFornecedor(forn).length}.`,
      );
    }

    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM usuarios_fornecedor WHERE fornecedorCodigo = ?`)
      .get(forn.codigo) as { total: number } | undefined;
    if (Number(total?.total ?? 0) >= USUARIOS_FORNECEDOR_MAX) {
      throw new Error(
        `Limite de ${USUARIOS_FORNECEDOR_MAX} usuários neste fornecedor. Peça a alguém já cadastrado para incluir você.`,
      );
    }

    const id = novoIdUsuarioFornecedor();
    const criadoEm = new Date().toISOString();
    const senhaHash = hashSenhaFornecedor(cnpjDoFornecedor(forn));
    const jaTemUsuario = Number(total?.total ?? 0) > 0;
    const nome = jaTemUsuario ? nomeUsuarioDoEmail(email, forn.nome) : forn.nome;
    db.prepare(
      `INSERT INTO usuarios_fornecedor
        (id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm, precisaTrocarSenha)
       VALUES (?, ?, ?, ?, ?, 1, ?, 1)`,
    ).run(id, forn.codigo, nome, email, senhaHash, criadoEm);
    gravarSessaoPortal("fornecedor", forn.codigo, email);
    return { codigo: forn.codigo, nome, email, precisaTrocarSenha: true };
  });

export const fetchMinhaContaFornecedor = createServerFn({ method: "GET" }).handler(async () => {
  const sessao = lerSessaoPortal();
  if (!sessao || sessao.tipo !== "fornecedor" || !sessao.usuarioEmail) return null;
  ensureUsuariosFornecedor();
  const row = db
    .prepare(
      `SELECT id, nome, email, precisaTrocarSenha FROM usuarios_fornecedor
       WHERE fornecedorCodigo = ? AND email = ?`,
    )
    .get(sessao.codigo, sessao.usuarioEmail) as
    | { id: string; nome: string; email: string; precisaTrocarSenha?: number; precisatrocarsenha?: number }
    | undefined;
  if (!row) return null;
  return {
    codigo: sessao.codigo,
    nome: row.nome,
    email: row.email,
    precisaTrocarSenha: flagPrecisaTrocarSenha(row),
  };
});

export const alterarMinhaSenhaFornecedor = createServerFn({ method: "POST" })
  .validator((data: { novaSenha: string; senhaAtual?: string }) => ({
    novaSenha: String(data.novaSenha ?? ""),
    senhaAtual: String(data.senhaAtual ?? ""),
  }))
  .handler(async ({ data }) => {
    const { senhaFornecedorConfere, hashSenhaFornecedor } = await import(
      "./server/usuarios-fornecedor"
    );
    const sessao = exigirSessaoFornecedor();
    if (data.novaSenha.length < 8) {
      throw new Error("A nova senha precisa ter no mínimo 8 caracteres.");
    }
    ensureUsuariosFornecedor();
    const row = db
      .prepare(
        `SELECT id, senhaHash, precisaTrocarSenha FROM usuarios_fornecedor
         WHERE fornecedorCodigo = ? AND email = ?`,
      )
      .get(sessao.codigo, sessao.email) as
      | {
          id: string;
          senhaHash: string;
          precisaTrocarSenha?: number;
          precisatrocarsenha?: number;
        }
      | undefined;
    if (!row) throw new Error("Usuário não encontrado. Entre de novo.");
    const precisa = flagPrecisaTrocarSenha(row);
    if (!precisa) {
      if (!data.senhaAtual) throw new Error("Informe a senha atual.");
      const atualOk =
        senhaFornecedorConfere(data.senhaAtual, row.senhaHash) ||
        (() => {
          const digits = soDigitos(data.senhaAtual);
          return (
            Boolean(digits) &&
            digits !== data.senhaAtual &&
            senhaFornecedorConfere(digits, row.senhaHash)
          );
        })();
      if (!atualOk) throw new Error("A senha atual não confere.");
    }
    const forn = db
      .prepare("SELECT codigo, cnpj, cnpjSenhaInicial FROM fornecedores WHERE codigo = ?")
      .get(sessao.codigo) as FornecedorDB | undefined;
    if (forn && senhaCnpjConfere(data.novaSenha, forn)) {
      throw new Error("Não use o CNPJ como senha definitiva. Escolha uma senha sua.");
    }
    const senhaHash = hashSenhaFornecedor(data.novaSenha);
    db.prepare(
      `UPDATE usuarios_fornecedor SET senhaHash = ?, precisaTrocarSenha = 0 WHERE id = ?`,
    ).run(senhaHash, row.id);
    return { ok: true as const, precisaTrocarSenha: false };
  });

export const loginUsuarioInterno = createServerFn({ method: "POST" })
  .validator((data: { username: string; senha: string }) => data)
  .handler(async ({ data }) => {
    const username = String(data.username ?? "")
      .trim()
      .toLowerCase();
    const senha = String(data.senha ?? "");
    const stmt = db.prepare(
      "SELECT username, nome, role FROM usuarios_internos WHERE lower(username) = ? AND senha = ?",
    );
    const user = stmt.get(username, senha) as UsuarioInternoDB | undefined;
    if (user) gravarSessaoPortal("interno", user.username);
    return user;
  });

export const iniciarSessaoFornecedor = createServerFn({ method: "POST" })
  .validator((data: { codigo: string }) => ({ codigo: String(data.codigo ?? "").trim() }))
  .handler(async ({ data }) => {
    const forn = buscarFornecedorPorLogin(data.codigo);
    if (!forn || forn.acessoLiberado !== 1) {
      throw new Error("Acesso não liberado.");
    }
    if (!vigenciaAcessoOk(forn)) {
      throw new Error("Acesso fora do período de vigência contratado.");
    }
    gravarSessaoPortal("fornecedor", forn.codigo);
    return { ok: true, codigo: forn.codigo };
  });

export const encerrarSessaoPortal = createServerFn({ method: "POST" }).handler(async () => {
  apagarSessaoPortal();
  return { ok: true };
});

/** Recoloca o cookie em login antigo (sessionStorage) sem pedir senha de novo. */
export const restaurarSessaoPortal = createServerFn({ method: "POST" })
  .validator((data: { tipo: "interno" | "fornecedor"; codigo: string }) => ({
    tipo: data.tipo,
    codigo: String(data.codigo ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const sessaoAtual = lerSessaoPortal();
    if (sessaoAtual && sessaoAtual.tipo === data.tipo) {
      const codigoEfetivo =
        data.tipo === "interno" ? data.codigo : resolverCodigoFornecedorDados(data.codigo);
      if (sessaoAtual.codigo === codigoEfetivo) {
        return { ok: true, tipo: data.tipo, codigo: sessaoAtual.codigo };
      }
    }

    if (data.tipo === "interno") {
      const user = db
        .prepare("SELECT username FROM usuarios_internos WHERE username = ?")
        .get(data.codigo) as { username: string } | undefined;
      if (!user) throw new Error("Sessão interna inválida.");
      gravarSessaoPortal("interno", user.username);
      return { ok: true, tipo: "interno" as const, codigo: user.username };
    }
    const codigo = resolverCodigoFornecedorDados(data.codigo);
    const row = db
      .prepare("SELECT codigo, acessoLiberado FROM fornecedores WHERE codigo = ?")
      .get(codigo) as { codigo: string; acessoLiberado?: number } | undefined;
    if (!row || row.acessoLiberado !== 1) {
      throw new Error("Acesso não liberado.");
    }
    gravarSessaoPortal("fornecedor", codigo);
    return { ok: true, tipo: "fornecedor" as const, codigo };
  });

export const fetchUsuariosInternos = createServerFn({ method: "GET" }).handler(async () => {
  exigirInterno();
  const stmt = db.prepare("SELECT username, nome, role FROM usuarios_internos ORDER BY username");
  return stmt.all() as UsuarioInternoDB[];
});

export const createUsuarioInterno = createServerFn({ method: "POST" })
  .validator((data: { username: string; nome: string; senha: string; role: string }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const username = String(data.username ?? "")
      .trim()
      .toLowerCase();
    const nome = String(data.nome ?? "").trim();
    const senha = String(data.senha ?? "").trim();
    const role = data.role === "colaborador" ? "colaborador" : "admin";
    if (!username || !nome || !senha) {
      throw new Error("Preencha usuário, nome e senha.");
    }
    if (!/^[a-z0-9._-]+$/.test(username)) {
      throw new Error("Use só letras, números, ponto, hífen ou underline no login.");
    }
    const existe = db
      .prepare("SELECT username FROM usuarios_internos WHERE lower(username) = ?")
      .get(username) as { username: string } | undefined;
    if (existe) {
      throw new Error(`O usuário ${username} já está cadastrado.`);
    }
    db.prepare(
      `INSERT INTO usuarios_internos (username, nome, senha, "role") VALUES (?, ?, ?, ?)`,
    ).run(username, nome, senha, role);
    return { success: true, username };
  });

export const deleteUsuarioInterno = createServerFn({ method: "POST" })
  .validator((username: string) => username)
  .handler(async ({ data: username }) => {
    exigirInterno();
    const stmt = db.prepare("DELETE FROM usuarios_internos WHERE username = ?");
    stmt.run(username);
    return { success: true };
  });

// --- PRICE PROPOSAL & APPROVAL SYSTEM ---

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

export const submitPropostaPreco = createServerFn({ method: "POST" })
  .validator((data: {
    fornecedorCodigo: string;
    justificativa: string;
    itens: { sku: string; descricao: string; precoAtual: number; precoProposto: number }[];
  }) => data)
  .handler(async ({ data }) => {
    const { justificativa, itens } = data;
    const fornecedorCodigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const now = new Date();
    const formattedDate = now.toISOString().replace(/T/, "-").replace(/[:.]/g, "").slice(0, 15);
    const loteId = `LOTE-${formattedDate}-${Math.floor(100 + Math.random() * 900)}`;

    const insertStmt = db.prepare(`
      INSERT INTO propostas_precos (loteId, fornecedorCodigo, sku, descricao, precoAtual, precoProposto, status, justificativa)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?)
    `);

    const transaction = db.transaction((itemsList: typeof itens) => {
      for (const item of itemsList) {
        insertStmt.run(
          loteId,
          fornecedorCodigo,
          item.sku,
          item.descricao,
          item.precoAtual,
          item.precoProposto,
          justificativa
        );
      }
    });

    transaction(itens);
    return { success: true, loteId };
  });

export const fetchPropostasPrecos = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo?: string) => fornecedorCodigo)
  .handler(async ({ data: fornecedorCodigo }) => {
    if (fornecedorCodigo) {
      const code = codigoFornecedorEfetivo(fornecedorCodigo);
      const stmt = db.prepare("SELECT * FROM propostas_precos WHERE fornecedorCodigo = ? ORDER BY criadoEm DESC");
      return stmt.all(code) as PropostaPrecoDB[];
    } else {
      exigirInterno();
      const stmt = db.prepare("SELECT * FROM propostas_precos ORDER BY status = 'pendente' DESC, criadoEm DESC");
      return stmt.all() as PropostaPrecoDB[];
    }
  });

export const responderPropostaPreco = createServerFn({ method: "POST" })
  .validator((data: { id: number; status: "aprovado" | "rejeitado"; respostaAdmin: string }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const { id, status, respostaAdmin } = data;

    const selectStmt = db.prepare("SELECT sku, precoProposto, status FROM propostas_precos WHERE id = ?");
    const proposal = selectStmt.get(id) as { sku: string; precoProposto: number; status: string } | undefined;

    if (!proposal) {
      throw new Error("Proposta não encontrada.");
    }

    if (proposal.status !== "pendente") {
      throw new Error("Esta proposta já foi respondida.");
    }

    const updateProposalStmt = db.prepare(`
      UPDATE propostas_precos
      SET status = ?, respostaAdmin = ?, respondidoEm = datetime('now')
      WHERE id = ?
    `);

    const updateProductStmt = db.prepare(`
      UPDATE produtos
      SET cmvUnit = ?
      WHERE sku = ?
    `);

    const transaction = db.transaction(() => {
      updateProposalStmt.run(status, respostaAdmin, id);
      if (status === "aprovado") {
        updateProductStmt.run(proposal.precoProposto, proposal.sku);
      }
    });

    transaction();
    return { success: true };
  });

export const updateSupplierAccessConfig = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; isentoCobranca: number; acessoDataInicio: string | null; acessoDataFim: string | null }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    ensureFornecedoresColumns();
    const { codigo, isentoCobranca, acessoDataInicio, acessoDataFim } = data;
    db.prepare(
      "UPDATE fornecedores SET isentoCobranca = ?, acessoDataInicio = ?, acessoDataFim = ? WHERE codigo = ?"
    ).run(isentoCobranca, acessoDataInicio, acessoDataFim, codigo);
    return { success: true };
  });

export const refreshSupplierDataImmediately = createServerFn({ method: "POST" })
  .validator((data: { codigo: string }) => ({ codigo: normalizarCodigoFornecedor(data.codigo) }))
  .handler(async ({ data }) => {
    exigirInterno();
    const codigo = resolverCodigoFornecedorDados(data.codigo);
    if (!codigo) throw new Error("Código de fornecedor inválido.");

    try {
      const cmd = `LD_LIBRARY_PATH=/home/administrador/instantclient_19_25 /home/administrador/deepseek-env/bin/python3 /home/administrador/rms/scripts/apply_portal_refresh_fornecedor.py --codigo ${codigo}`;
      const { stdout, stderr } = await execAsync(cmd);
      console.log("Atualização RMS imediata:", stdout, stderr);
      return { success: true, message: "Atualização no RMS realizada com sucesso!" };
    } catch (err) {
      console.error("Erro ao sincronizar fornecedor imediatamente:", err);
      throw new Error("Erro de execução no script de sincronização do RMS.");
    }
  });
