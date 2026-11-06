import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { soDigitos } from "@/lib/fornecedor-codigo";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import { cortePedidosIso, mesFechadoIso } from "@/lib/pedidos-janela";
import { JANELA_SKU_DIA_DIAS } from "@/lib/vendas-graos";
import { classificarCurvaAbcd, classificarCurvaTopStar } from "@/lib/classe-abcd";
import {
  FILTRO_VAZIO,
  filtroMercadologicoAtivo,
  produtoPassaFiltro,
  type FiltroMercadologico,
} from "@/lib/filtro-mercadologico";
import { db } from "../server/db";
import { codigoFornecedorEfetivo, exigirInterno } from "../server/sessao-portal";
import { colunaExiste, sqlSkuVisivel, tabelaExiste } from "./db-support";
import type {
  ContaReceberDB,
  ComprasAnoDB,
  EstoqueDB,
  FaixaPrecoSubgrupoDB,
  FaturaDB,
  PedidoDB,
  PedidoItemDB,
  PedidoStatusDB,
  PerdaDB,
  ProdutoBloqueioDB,
  TransferenciaCdamDB,
  VendaDB,
} from "./contracts";

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
  totLiq: number | null;
};

type PedidoItemRow = {
  numero: string;
  lojaId: string;
  sku: string;
  quantidadePedida: number;
  quantidadeFaturada: number;
  precoUnitario: number;
};

type ProdutoCatalogRow = Record<string, unknown> & {
  sku: string;
  abc?: string | null;
  compradorCodigo?: string | number | null;
  compradorNome?: string | null;
};

let cachedLiderAbcMap: Map<string, string> | null = null;
let cachedLiderTopStarMap: Map<string, string> | null = null;

const getLiderWideAbcClasses = createServerOnlyFn(() => {
  if (cachedLiderAbcMap) return cachedLiderAbcMap;

  const map = new Map<string, string>();
  try {
    const fimRow = db.prepare("SELECT MAX(data) AS fim FROM vendas").get() as {
      fim: string | null;
    };
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

    const itens = rows.map((r) => ({
      sku: r.sku,
      grupo: `${r.departamentoCodigo}.${r.secaoCodigo}.${r.grupoCodigo}.${r.subgrupoCodigo}`,
      grupoQuantidade: `${r.departamentoCodigo}.${r.secaoCodigo}.${r.grupoCodigo}`,
      valor: r.valor || 0,
      volume: r.volume || 0,
    }));
    const classificados = classificarCurvaAbcd(itens);
    const topStars = classificarCurvaTopStar(itens);
    for (const [sku, resultado] of classificados) {
      map.set(sku, resultado.classeComposta);
    }
    cachedLiderTopStarMap = new Map(
      Array.from(topStars, ([sku, resultado]) => [sku, resultado.classeComposta]),
    );
  } catch (err) {
    console.error("Erro ao calcular Lider-wide ABC classes:", err);
  }

  cachedLiderAbcMap = map;
  return map;
});

let cachedNomesComprador: Map<string, string> | null = null;

export const mapaNomesComprador = createServerOnlyFn((): Map<string, string> => {
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
});

export const fetchProdutos = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const stmt = db.prepare(`SELECT * FROM produtos p WHERE ${sqlSkuVisivel("p")}`);
    const products = stmt.all(fornecedorCodigo) as ProdutoCatalogRow[];
    const abcMap = getLiderWideAbcClasses();
    const topStarMap = cachedLiderTopStarMap ?? new Map<string, string>();
    const nomesComprador = mapaNomesComprador();
    return products.map((p) => {
      const storedCls = String(p.abc || "").trim();
      const dynamicCls = abcMap.get(p.sku);
      const fatClass = ((dynamicCls && dynamicCls[0]) || storedCls[0] || "D").toUpperCase();
      const volClass = (
        (dynamicCls && dynamicCls.length > 1 && dynamicCls[1]) ||
        storedCls[1] ||
        "d"
      ).toLowerCase();
      const cls = fatClass + volClass;
      const codigo = String(p.compradorCodigo ?? "").trim();
      const nomeDireto = String(p.compradorNome ?? "").trim();
      const nome =
        nomeDireto && nomeDireto !== `Comprador ${codigo}`
          ? nomeDireto
          : (codigo && nomesComprador.get(codigo)) || nomeDireto;
      return {
        ...p,
        compradorNome: nome || p.compradorNome,
        classeComposta: cls,
        classeTopStar: topStarMap.get(p.sku) || storedCls || cls,
      };
    });
  });

export const fetchFaixasPrecoSubgrupo = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const stmt = db.prepare(
      `SELECT b.sku, b.lojaId, b.bloqueio FROM produtos_lojas_bloqueios b JOIN produtos p ON p.sku = b.sku WHERE ${sqlSkuVisivel("p")} AND b.lojaId NOT IN (${sqlLojasForaPortal})`,
    );
    return stmt.all(fornecedorCodigo) as ProdutoBloqueioDB[];
  });

export const fetchPerdas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const inicioJanela = new Date();
    inicioJanela.setDate(1);
    inicioJanela.setMonth(inicioJanela.getMonth() - 12);
    const inicioJanelaIso = `${inicioJanela.getFullYear()}-${String(inicioJanela.getMonth() + 1).padStart(2, "0")}-01`;

    // O lote canônico é o espelho validado da Agenda 520. Enquanto ele não
    // estiver carregado, mantemos a leitura compatível com a tabela legada.
    const temLoteCanonico =
      tabelaExiste("perdas_rms_520_canonicas") &&
      tabelaExiste("perdas_rms_520_controle") &&
      Boolean(
        db.prepare("SELECT 1 FROM perdas_rms_520_controle WHERE chave = ? LIMIT 1").get("ativo"),
      );
    const tabela = temLoteCanonico ? "perdas_rms_520_canonicas" : "perdas";
    const numeroNotaSql =
      temLoteCanonico || colunaExiste("perdas", "numeroNota") ? "d.numeroNota" : "NULL";
    const serieSql = temLoteCanonico || colunaExiste("perdas", "serie") ? "d.serie" : "NULL";
    const loteJoin = temLoteCanonico
      ? "JOIN perdas_rms_520_controle c ON c.chave = 'ativo' AND c.loteCarga = d.loteCarga"
      : "";
    const stmt = db.prepare(
      `SELECT d.*,
              d.fornecedorCodigo AS "fornecedorCodigo",
              d.lojaId AS "lojaId",
              d.lojaNome AS "lojaNome",
              d.sku AS "sku",
              d.produtoDescricao AS "produtoDescricao",
              d.quantidade AS "quantidade",
              d.valorUnitario AS "valorUnitario",
              d.valorTotal AS "valorTotal",
              d.data AS "data",
              d.ocorrencias AS "ocorrencias",
              ${numeroNotaSql} AS "numeroNota", ${serieSql} AS "serie"
        FROM ${tabela} d
        ${loteJoin}
        WHERE d.fornecedorCodigo = ?
          AND d.data >= ?
          AND d.lojaId NOT IN (${sqlLojasForaPortal})`,
    );
    return stmt.all(fornecedorCodigo, inicioJanelaIso) as PerdaDB[];
  });

export const fetchEstoque = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const postgresRuntime = (process.env.PORTAL_DB_ENGINE || "").toLowerCase() === "postgres";
    const dataEstoqueSql = tabelaExiste("atlas_estoque_snapshot_status")
      ? `COALESCE(${postgresRuntime ? "NULLIF(e.dataEstoque::text, '')::date" : "e.dataEstoque"}, (SELECT CAST(last_success_at AS DATE)
           FROM atlas_estoque_snapshot_status
          WHERE stream_name = 'global_active_products'))`
      : "e.dataEstoque";
    const dataInventarioSql = colunaExiste("estoque", "datainventario")
      ? "e.dataInventario"
      : "NULL";
    const stmt = db.prepare(
      `SELECT e.sku, e.lojaId, e.estoqueAtual,
              ${dataEstoqueSql} AS dataEstoque,
              ${dataInventarioSql} AS dataInventario
         FROM estoque e
       JOIN produtos p ON p.sku = e.sku
       WHERE ${sqlSkuVisivel("p")}
         AND e.lojaId NOT IN (${sqlLojasForaPortal})`,
    );
    try {
      return stmt.all(fornecedorCodigo) as EstoqueDB[];
    } catch (error) {
      // A posição de estoque não pode desaparecer por incompatibilidade nas
      // colunas opcionais de snapshot/data. Mantém a carga principal disponível.
      console.error("fetchEstoque: consulta de snapshot falhou; usando carga básica", error);
      const fallback = db.prepare(
        `SELECT e.sku, e.lojaId, e.estoqueAtual,
                NULL AS dataEstoque,
                NULL AS dataInventario
           FROM estoque e
           JOIN produtos p ON p.sku = e.sku
          WHERE ${sqlSkuVisivel("p")}
            AND e.lojaId NOT IN (${sqlLojasForaPortal})`,
      );
      return fallback.all(fornecedorCodigo) as EstoqueDB[];
    }
  });

export const fetchContasReceber = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("contas_receber")) return [] as ContaReceberDB[];
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const agendaRmsSql = colunaExiste("contas_receber", "agendaRms") ? "agendaRms" : "NULL";
    const rows = db
      .prepare(
        `SELECT id, documento, tipo, descricao, emissao, competencia, vencimento,
                valor, status, abatimentoProximoPagamento, origem, observacao, fornecedorCodigo,
                ${agendaRmsSql} AS agendaRms
         FROM contas_receber
         WHERE fornecedorCodigo = ?
           AND status <> 'Descontado'
         ORDER BY vencimento ASC, id DESC`,
      )
      .all(fornecedorCodigo) as Array<{
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
      agendaRms: string | number | null;
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
      agendaRms: row.agendaRms == null ? null : String(row.agendaRms),
    }));
  });

export const fetchFaturas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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
        natureza: destTipo === "D" ? "recebimento_fornecedor_cdam" : "recebimento_fornecedor_loja",
      };
      if (row.serie) fatura.serie = row.serie;
      if (row.chaveNfe) fatura.chaveNfe = row.chaveNfe;
      if (row.recebimento) fatura.recebimento = row.recebimento;
      if (row.destTipo) fatura.destTipo = row.destTipo;
      if (row.prazoTipo === "DDE" || row.prazoTipo === "DDR") fatura.prazoTipo = row.prazoTipo;
      return fatura;
    });
  });

function chavesSkuDoProduto(p: {
  sku?: string | null;
  codigoProdutoRms?: string | null;
  digitoProdutoRms?: string | null;
}) {
  const chaves = new Set<string>();
  const sku = String(p.sku ?? "").trim();
  if (sku) chaves.add(sku);
  const rms = String(p.codigoProdutoRms ?? "").trim();
  const dv = String(p.digitoProdutoRms ?? "").trim();
  if (rms && dv) {
    chaves.add(`${rms}${dv}`);
    chaves.add(`${rms}-${dv}`);
  }
  return chaves;
}

function skusPedidoDoFiltroMix(codigo: string, filtro: FiltroMercadologico): string[] | null {
  if (!filtroMercadologicoAtivo(filtro)) return null;
  if (!tabelaExiste("produtos")) return [];
  const rows = db
    .prepare(
      `SELECT sku, codigoProdutoRms, digitoProdutoRms,
              departamentoCodigo, departamento, secaoCodigo, secao,
              grupoCodigo, grupo, subgrupoCodigo, subgrupo,
              compradorCodigo, compradorNome
       FROM produtos WHERE fornecedorCodigo = ?`,
    )
    .all(codigo) as Array<{
    sku: string;
    codigoProdutoRms?: string | null;
    digitoProdutoRms?: string | null;
    departamentoCodigo?: string | null;
    departamento?: string | null;
    secaoCodigo?: string | null;
    secao?: string | null;
    grupoCodigo?: string | null;
    grupo?: string | null;
    subgrupoCodigo?: string | null;
    subgrupo?: string | null;
    compradorCodigo?: string | null;
    compradorNome?: string | null;
  }>;
  const chaves = new Set<string>();
  for (const row of rows) {
    if (!produtoPassaFiltro(row, filtro)) continue;
    for (const chave of chavesSkuDoProduto(row)) chaves.add(chave);
  }
  return [...chaves];
}

export const fetchComprasAno = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; ano: number; filtro?: FiltroMercadologico }) => ({
    fornecedorCodigo: soDigitos(data.fornecedorCodigo),
    ano: Number(data.ano),
    filtro: data.filtro ?? FILTRO_VAZIO,
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
    const skusMix = skusPedidoDoFiltroMix(codigo, data.filtro);
    if (skusMix && skusMix.length === 0) return vazio();
    const sqlSkuMix = skusMix?.length ? `AND i.sku IN (${skusMix.map(() => "?").join(",")})` : "";
    const rows = db
      .prepare(
        `SELECT substr(p.emissao, 1, 7) AS mes, p.lojaId AS lojaId,
                COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
                COUNT(DISTINCT CASE
                  WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                  THEN p.numero || '-' || p.lojaId
                END) AS documentosEmAberto,
                SUM(COALESCE(i.quantidadePedida, 0) * COALESCE(i.precoUnitario, 0) * COALESCE(
                  (
                    SELECT p.totLiq / SUM(pi.quantidadePedida * pi.precoUnitario)
                    FROM pedido_itens pi
                    WHERE pi.numero = p.numero AND pi.lojaId = p.lojaId AND pi.fornecedorCodigo = p.fornecedorCodigo
                    HAVING SUM(pi.quantidadePedida * pi.precoUnitario) > 0 AND p.totLiq IS NOT NULL AND p.totLiq > 0.0
                  ),
                  1.0
                )) AS pedido,
                SUM(
                  CASE
                    WHEN COALESCE(i.quantidadeFaturada, 0) < COALESCE(i.quantidadePedida, 0)
                    THEN COALESCE(i.quantidadeFaturada, 0)
                    ELSE COALESCE(i.quantidadePedida, 0)
                  END * COALESCE(i.precoUnitario, 0) * COALESCE(
                    (
                      SELECT p.totLiq / SUM(pi.quantidadePedida * pi.precoUnitario)
                      FROM pedido_itens pi
                      WHERE pi.numero = p.numero AND pi.lojaId = p.lojaId AND pi.fornecedorCodigo = p.fornecedorCodigo
                      HAVING SUM(pi.quantidadePedida * pi.precoUnitario) > 0 AND p.totLiq IS NOT NULL AND p.totLiq > 0.0
                    ),
                    1.0
                  )
                ) AS entregue,
                SUM(
                  CASE
                    WHEN COALESCE(i.quantidadePedida, 0) > COALESCE(i.quantidadeFaturada, 0)
                    THEN (COALESCE(i.quantidadePedida, 0) - COALESCE(i.quantidadeFaturada, 0))
                    ELSE 0
                  END * COALESCE(i.precoUnitario, 0) * COALESCE(
                    (
                      SELECT p.totLiq / SUM(pi.quantidadePedida * pi.precoUnitario)
                      FROM pedido_itens pi
                      WHERE pi.numero = p.numero AND pi.lojaId = p.lojaId AND pi.fornecedorCodigo = p.fornecedorCodigo
                      HAVING SUM(pi.quantidadePedida * pi.precoUnitario) > 0 AND p.totLiq IS NOT NULL AND p.totLiq > 0.0
                    ),
                    1.0
                  )
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
           ${sqlSkuMix}
         GROUP BY substr(p.emissao, 1, 7), p.lojaId`,
      )
      .all(codigo, `${ano}-01`, ateMes, ...(skusMix ?? [])) as Array<{
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
      const atualMes = porMes.get(mes) ?? {
        pedido: 0,
        entregue: 0,
        perda: 0,
        documentos: 0,
      };
      atualMes.pedido += vPedido;
      atualMes.entregue += vEntregue;
      atualMes.perda += vPerda;
      atualMes.documentos += Number(row.documentos || 0);
      porMes.set(mes, atualMes);
      const lojaId = String(row.lojaId || "");
      const atualLoja = porLoja.get(lojaId) ?? {
        pedido: 0,
        entregue: 0,
        perda: 0,
      };
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
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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
                agendaEntrada, agendaParidade, agendaRegra, totLiq
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
      if (capa.totLiq !== null) pedido.totLiq = Number(capa.totLiq);
      return pedido;
    });
  });

export const fetchVendas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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

export const fetchTransferenciasCdam = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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
