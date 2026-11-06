import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { normalizarCodigoFornecedor, soDigitos } from "@/lib/fornecedor-codigo";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import { mesFechadoIso } from "@/lib/pedidos-janela";
import {
  normalizarTaxaAcessoPortalPct,
  segmentoIntelider,
  valorUmPctCompra,
  DESCONTO_ACESSO_PORTAL_PCT,
} from "@/lib/acordo-acesso";
import { db } from "../server/db";
import {
  codigoFornecedorEfetivo,
  exigirInterno,
  exigirInternoRole,
  resolverCodigoFornecedorDados,
} from "../server/sessao-portal";
import { iniciarCargaRmsAssincrona } from "./agenda-support";
import { tabelaExiste } from "./db-support";
import type {
  AcordoAcessoPortalDB,
  AcordoCobrancaDB,
  CompraMesAnteriorDB,
  FillrateAcordoDB,
  FillratePoliticaDB,
  FornecedorDB,
  RelatorioAcordoAcessoDB,
  RelatorioAcordoAcessoLinhaDB,
} from "./contracts";

function ensureFornecedoresColumns() {
  // Safe migrations run on startup in db.ts
}

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
    atualizarStatusCarenciaExpirada();
    let query =
      "SELECT codigo, nome, cnpj, acessoLiberado, metaFillRatePct, isentoCobranca, taxaAcessoPct, acessoDataInicio, acessoDataFim, acessoStatus, acordoNumero, degustacaoUsada, carenciaDias, carenciaAte, primeiraCompetenciaCobravel, primeiraCobrancaEm FROM fornecedores WHERE (codigo LIKE ? OR nome LIKE ? OR cnpj LIKE ?)";
    const params: Array<string | number> = [cleanSearch, cleanSearch, cleanSearch];

    query += " ORDER BY codigo LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as FornecedorDB[];

    // Obter contagem total
    const countQuery =
      "SELECT COUNT(*) AS total FROM fornecedores WHERE (codigo LIKE ? OR nome LIKE ? OR cnpj LIKE ?)";
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
      // Bloqueio preserva cadastro e histórico; a degustação não pode ser reiniciada.
      db.prepare(
        "UPDATE fornecedores SET acessoLiberado = 0, acessoStatus = CASE WHEN acessoStatus = 'DEGUSTACAO' THEN 'EXPIRADO' ELSE acessoStatus END WHERE codigo = ?",
      ).run(codigoNorm);
    } else {
      const row = db
        .prepare("SELECT acessoStatus, degustacaoUsada FROM fornecedores WHERE codigo = ?")
        .get(codigoNorm) as { acessoStatus?: string; degustacaoUsada?: number } | undefined;
      if (row?.acessoStatus === "EXPIRADO" || Number(row?.degustacaoUsada) === 1) {
        throw new Error(
          "A degustação já foi utilizada ou expirou. Valide o acordo assinado antes de liberar o acesso.",
        );
      }
      db.prepare("UPDATE fornecedores SET acessoLiberado = 1 WHERE codigo = ?").run(codigoNorm);
    }
    return { success: true };
  });

export function adicionarDiasIso(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function proximaCompetenciaCompleta(dataIso: string) {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCMonth(data.getUTCMonth() + 1, 1);
  return data.toISOString().slice(0, 7);
}

export function dataPrimeiraCobranca(competencia: string) {
  const [ano = 0, mes = 0] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
}

/**
 * Fecha a degustação no primeiro acesso administrativo ou login posterior ao
 * seu último dia. A transição gravada impede que a tela continue chamando de
 * degustação um fornecedor que já precisa apresentar contrato assinado.
 */
export const atualizarStatusCarenciaExpirada = createServerOnlyFn(() => {
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate(),
  ).padStart(2, "0")}`;
  const competenciaObrigatoria = mesFechadoIso(hoje);
  const passouDoPrazo = hoje.getDate() > 10;
  db.prepare(
    `UPDATE fornecedores
     SET acessoLiberado = CASE
           WHEN ? = 1
            AND (primeiraCompetenciaCobravel IS NULL OR primeiraCompetenciaCobravel <= ?)
            AND COALESCE(ultimoAcordoMes, '') < ? THEN 0
           ELSE 1 END,
         acessoStatus = CASE
           WHEN ? = 1
            AND (primeiraCompetenciaCobravel IS NULL OR primeiraCompetenciaCobravel <= ?)
            AND COALESCE(ultimoAcordoMes, '') < ? THEN 'ACORDO_MENSAL_PENDENTE'
           ELSE 'AGUARDANDO_ACORDO_MENSAL' END
     WHERE acessoStatus = 'DEGUSTACAO'
       AND COALESCE(carenciaAte, '') <> ''
       AND carenciaAte < ?`,
  ).run(
    passouDoPrazo ? 1 : 0,
    competenciaObrigatoria,
    competenciaObrigatoria,
    passouDoPrazo ? 1 : 0,
    competenciaObrigatoria,
    competenciaObrigatoria,
    hojeIso,
  );
});

export const includeSupplier = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; nome?: string; cnpj?: string; carenciaDias: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const codigo = resolverCodigoFornecedorDados(data.codigo);
    if (!codigo) throw new Error("Informe o código RMS do fornecedor.");
    const nomeNovo = String(data.nome ?? "").trim();
    const cnpjNovo = String(data.cnpj ?? "").trim();
    ensureFornecedoresColumns();
    const carenciaDias = Math.trunc(Number(data.carenciaDias));
    if (!Number.isInteger(carenciaDias) || carenciaDias < 0 || carenciaDias > 60) {
      throw new Error("A carência deve ser informada entre 0 e 60 dias.");
    }
    const inicioNovo = new Date().toISOString().slice(0, 10);
    const existente = db
      .prepare(
        "SELECT codigo, nome, cnpj, acessoLiberado, acessoStatus, degustacaoUsada, acessoDataInicio FROM fornecedores WHERE codigo = ?",
      )
      .get(codigo) as
      | {
          codigo: string;
          nome?: string;
          cnpj?: string;
          acessoLiberado?: number;
          acessoStatus?: string;
          degustacaoUsada?: number;
          acessoDataInicio?: string | null;
        }
      | undefined;
    if (existente) {
      if (existente.acessoStatus === "ATIVO_COM_ACORDO")
        throw new Error("Fornecedor já possui acordo de acesso ativo.");
      if (Number(existente.degustacaoUsada) === 1)
        throw new Error("A degustação já foi utilizada e não pode ser reiniciada ou prorrogada.");
      const inicio = String(existente.acessoDataInicio || inicioNovo).slice(0, 10);
      const carenciaAte = carenciaDias > 0 ? adicionarDiasIso(inicio, carenciaDias - 1) : null;
      const primeiraCompetenciaCobravel = proximaCompetenciaCompleta(carenciaAte || inicio);
      const primeiraCobrancaEm = dataPrimeiraCobranca(primeiraCompetenciaCobravel);
      const status = carenciaDias > 0 ? "DEGUSTACAO" : "AGUARDANDO_COMPETENCIA";
      db.prepare(
        "UPDATE fornecedores SET acessoLiberado = 1, acessoDataInicio = COALESCE(acessoDataInicio, ?), acessoDataFim = NULL, acessoStatus = ?, degustacaoUsada = 1, carenciaDias = ?, carenciaAte = ?, primeiraCompetenciaCobravel = ?, primeiraCobrancaEm = ? WHERE codigo = ?",
      ).run(
        inicio,
        status,
        carenciaDias,
        carenciaAte,
        primeiraCompetenciaCobravel,
        primeiraCobrancaEm,
        codigo,
      );
      iniciarCargaRmsAssincrona(codigo);
      return {
        success: true,
        created: false,
        codigo,
        status,
        acessoDataInicio: inicio,
        carenciaDias,
        carenciaAte,
        primeiraCompetenciaCobravel,
        primeiraCobrancaEm,
        fornecedorNome: existente.nome || `Fornecedor ${codigo}`,
        fornecedorCnpj: existente.cnpj || "",
      };
    }
    ensureFillrateMetaColumn();
    const inicio = inicioNovo;
    const carenciaAte = carenciaDias > 0 ? adicionarDiasIso(inicio, carenciaDias - 1) : null;
    const primeiraCompetenciaCobravel = proximaCompetenciaCompleta(carenciaAte || inicio);
    const primeiraCobrancaEm = dataPrimeiraCobranca(primeiraCompetenciaCobravel);
    const status = carenciaDias > 0 ? "DEGUSTACAO" : "AGUARDANDO_COMPETENCIA";
    db.prepare(
      "INSERT INTO fornecedores (codigo, nome, cnpj, acessoLiberado, metaFillRatePct, acessoDataInicio, acessoDataFim, acessoStatus, degustacaoUsada, carenciaDias, carenciaAte, primeiraCompetenciaCobravel, primeiraCobrancaEm) VALUES (?, ?, ?, 1, ?, ?, NULL, ?, 1, ?, ?, ?, ?)",
    ).run(
      codigo,
      nomeNovo,
      cnpjNovo,
      FILLRATE_META_PADRAO,
      inicio,
      status,
      carenciaDias,
      carenciaAte,
      primeiraCompetenciaCobravel,
      primeiraCobrancaEm,
    );
    iniciarCargaRmsAssincrona(codigo);
    return {
      success: true,
      created: true,
      codigo,
      status,
      acessoDataInicio: inicio,
      carenciaDias,
      carenciaAte,
      primeiraCompetenciaCobravel,
      primeiraCobrancaEm,
      fornecedorNome: nomeNovo,
      fornecedorCnpj: cnpjNovo,
    };
  });
export { DESCONTO_ACESSO_PORTAL_PCT };

const ensureAcordosAcessoPortal = createServerOnlyFn(() => {
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
  try {
    db.exec("ALTER TABLE acordos_acesso_portal ADD COLUMN contratoAssinadoEm TEXT;");
  } catch {
    // A coluna já existe em instalações atualizadas.
  }
  try {
    db.exec("ALTER TABLE acordos_acesso_portal ADD COLUMN contratoDocumentoRef TEXT;");
  } catch {
    // A coluna já existe em instalações atualizadas.
  }
});

function normalizarNumeroAcordo(raw: string) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
}

export const fetchCompraMesAnterior = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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
                  END * COALESCE(i.precoUnitario, 0) * COALESCE(
                    (
                      SELECT p.totLiq / SUM(pi.quantidadePedida * pi.precoUnitario)
                      FROM pedido_itens pi
                      WHERE pi.numero = p.numero AND pi.lojaId = p.lojaId AND pi.fornecedorCodigo = p.fornecedorCodigo
                      HAVING SUM(pi.quantidadePedida * pi.precoUnitario) > 0 AND p.totLiq IS NOT NULL AND p.totLiq > 0.0
                    ),
                    1.0
                  )
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

function elegivelParaCobrancaAcesso(
  row: {
    acessoStatus?: string | null;
    acessoDataInicio?: string | null;
    acessoDataFim?: string | null;
    isentoCobranca?: number | null;
    primeiraCompetenciaCobravel?: string | null;
    contratoValidadoEm?: string | null;
  },
  mesReferencia: string,
) {
  if (Number(row.isentoCobranca) === 1) return false;
  if (String(row.acessoStatus ?? "") !== "ATIVO_COM_ACORDO") return false;
  if (!String(row.contratoValidadoEm ?? "").slice(0, 10)) return false;
  const primeiraCompetencia = String(row.primeiraCompetenciaCobravel ?? "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(primeiraCompetencia)) {
    return mesReferencia >= primeiraCompetencia;
  }
  if (String(row.acessoStatus ?? "") === "DEGUSTACAO") return false;
  const inicio = String(row.acessoDataInicio ?? "").slice(0, 10);
  if (!inicio) return false;
  const inicioUtc = Date.parse(`${inicio}T00:00:00Z`);
  if (!Number.isFinite(inicioUtc)) return false;
  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (Math.floor((hojeUtc - inicioUtc) / 86_400_000) <= 30) return false;
  const fim = String(row.acessoDataFim ?? "").slice(0, 10);
  return !fim || hojeUtc <= Date.parse(`${fim}T00:00:00Z`);
}

export const fetchRelatorioAcordoAcesso = createServerFn({
  method: "GET",
}).handler(async () => {
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
  ensureFillrateMetaColumn();
  const pedidosFillRate = db
    .prepare(
      `SELECT p.fornecedorCodigo AS codigo,
              p.numero,
              p.lojaId,
              MAX(COALESCE(f.metaFillRatePct, ${FILLRATE_META_PADRAO})) AS metaFillRatePct,
              MAX(COALESCE(p.totLiq, 0)) AS totLiq,
              SUM(COALESCE(i.quantidadePedida, 0)) AS quantidadePedida,
              SUM(COALESCE(i.quantidadeFaturada, 0)) AS quantidadeFaturada,
              SUM(COALESCE(i.quantidadePedida, 0) * COALESCE(i.precoUnitario, 0)) AS valorPedido
         FROM pedidos p
         INNER JOIN pedido_itens i
           ON i.numero = p.numero
          AND i.lojaId = p.lojaId
          AND i.fornecedorCodigo = p.fornecedorCodigo
         INNER JOIN fornecedores f ON f.codigo = p.fornecedorCodigo
        WHERE p.destino = 'Fornecedor'
          AND p.status <> 'Cancelado'
          AND p.lojaId NOT IN (${sqlLojasForaPortal})
          AND substr(p.emissao, 1, 7) = ?
          AND COALESCE(i.quantidadePedida, 0) > 0
        GROUP BY p.fornecedorCodigo, p.numero, p.lojaId`,
    )
    .all(mes) as Array<{
    codigo: string;
    numero: string;
    lojaId: string;
    metaFillRatePct: number;
    totLiq: number;
    quantidadePedida: number;
    quantidadeFaturada: number;
    valorPedido: number;
  }>;
  const fillRatePorFornecedor = new Map<
    string,
    {
      quantidadePedida: number;
      quantidadeFaturada: number;
      metaFillRatePct: number;
      valorPedidosAbaixo: number;
    }
  >();
  for (const pedido of pedidosFillRate) {
    const codigo = String(pedido.codigo || "");
    const quantidadePedida = Number(pedido.quantidadePedida || 0);
    const quantidadeFaturada = Number(pedido.quantidadeFaturada || 0);
    const metaFillRatePct = normalizarMetaFillRate(pedido.metaFillRatePct);
    const atual = fillRatePorFornecedor.get(codigo) ?? {
      quantidadePedida: 0,
      quantidadeFaturada: 0,
      metaFillRatePct,
      valorPedidosAbaixo: 0,
    };
    atual.quantidadePedida += quantidadePedida;
    atual.quantidadeFaturada += quantidadeFaturada;
    atual.metaFillRatePct = metaFillRatePct;
    const fillRatePedido = quantidadePedida > 0 ? (quantidadeFaturada / quantidadePedida) * 100 : 0;
    if (fillRatePedido < metaFillRatePct) {
      atual.valorPedidosAbaixo += Number(pedido.totLiq || pedido.valorPedido || 0);
    }
    fillRatePorFornecedor.set(codigo, atual);
  }
  const rows = db
    .prepare(
      `SELECT p.fornecedorCodigo AS codigo,
              ${campoNome} AS nome,
              ${campoDeptoCod} AS departamentoCodigo,
              ${campoDeptoNome} AS departamento,
              f.acessoStatus AS acessoStatus,
              f.acessoDataInicio AS acessoDataInicio,
              f.acessoDataFim AS acessoDataFim,
              f.isentoCobranca AS isentoCobranca,
              f.primeiraCompetenciaCobravel AS primeiraCompetenciaCobravel,
              f.contratoValidadoEm AS contratoValidadoEm,
              COALESCE(f.taxaAcessoPct, ${DESCONTO_ACESSO_PORTAL_PCT}) AS taxaAcessoPct,
              COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
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
       GROUP BY p.fornecedorCodigo, ${campoDeptoCod}, ${campoDeptoNome},
                f.acessoStatus, f.acessoDataInicio, f.acessoDataFim, f.isentoCobranca,
                f.primeiraCompetenciaCobravel,
                f.contratoValidadoEm,
                f.taxaAcessoPct
       HAVING SUM(
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
       ) > 0`,
    )
    .all(mes) as Array<{
    codigo: string;
    nome: string;
    departamentoCodigo: string;
    departamento: string;
    acessoStatus: string | null;
    acessoDataInicio: string | null;
    acessoDataFim: string | null;
    isentoCobranca: number | null;
    primeiraCompetenciaCobravel: string | null;
    contratoValidadoEm: string | null;
    taxaAcessoPct: number | null;
    documentos: number;
    compra: number;
  }>;

  const agregadas = new Map<string, RelatorioAcordoAcessoLinhaDB>();
  for (const row of rows) {
    if (!elegivelParaCobrancaAcesso(row, mes)) continue;
    const codigo = String(row.codigo || "");
    if (!codigo) continue;
    const segmento = segmentoIntelider(row.departamentoCodigo, row.departamento);
    const chave = `${codigo}\t${segmento}`;
    const compra = Number(row.compra || 0);
    const taxaAcessoPct = normalizarTaxaAcessoPortalPct(row.taxaAcessoPct);
    const atual = agregadas.get(chave);
    if (atual) {
      atual.compra += compra;
      atual.documentos += Number(row.documentos || 0);
      atual.cobrancaAcesso = valorUmPctCompra(atual.compra, atual.taxaAcessoPct);
      const nome = String(row.nome || "").trim();
      if (nome && (!atual.nome || atual.nome.startsWith("Fornecedor "))) atual.nome = nome;
    } else {
      agregadas.set(chave, {
        codigo,
        nome: String(row.nome || "").trim() || `Fornecedor ${codigo}`,
        segmento,
        compra,
        taxaAcessoPct,
        cobrancaAcesso: valorUmPctCompra(compra, taxaAcessoPct),
        fillRatePct: 0,
        metaFillRatePct: FILLRATE_META_PADRAO,
        multaTresPct: 0,
        totalCobranca: valorUmPctCompra(compra, taxaAcessoPct),
        documentos: Number(row.documentos || 0),
      });
    }
  }

  const linhas = [...agregadas.values()];
  const linhasPorFornecedor = new Map<string, RelatorioAcordoAcessoLinhaDB[]>();
  for (const linha of linhas) {
    const lista = linhasPorFornecedor.get(linha.codigo) ?? [];
    lista.push(linha);
    linhasPorFornecedor.set(linha.codigo, lista);
  }
  for (const [codigo, lista] of linhasPorFornecedor) {
    const metricas = fillRatePorFornecedor.get(codigo);
    const fillRatePct = metricas?.quantidadePedida
      ? (metricas.quantidadeFaturada / metricas.quantidadePedida) * 100
      : 0;
    const metaFillRatePct = metricas?.metaFillRatePct ?? FILLRATE_META_PADRAO;
    const multaFornecedor =
      fillRatePct < metaFillRatePct ? valorUmPctCompra(metricas?.valorPedidosAbaixo ?? 0, 3) : 0;
    const compraFornecedor = lista.reduce((total, linha) => total + linha.compra, 0);
    let multaDistribuida = 0;
    lista.forEach((linha, indice) => {
      linha.fillRatePct = fillRatePct;
      linha.metaFillRatePct = metaFillRatePct;
      linha.multaTresPct =
        indice === lista.length - 1
          ? Math.round((multaFornecedor - multaDistribuida) * 100) / 100
          : valorUmPctCompra(
              multaFornecedor,
              compraFornecedor > 0 ? (linha.compra / compraFornecedor) * 100 : 0,
            );
      multaDistribuida += linha.multaTresPct;
      linha.totalCobranca = Math.round((linha.cobrancaAcesso + linha.multaTresPct) * 100) / 100;
    });
  }
  linhas.sort((a, b) => a.segmento.localeCompare(b.segmento, "pt-BR") || b.compra - a.compra);
  return { mes, linhas };
});

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
        `SELECT id, documento, descricao, valor, status, competencia, vencimento, contrato
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
          vencimento: string | null;
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
      vencimento: row.vencimento || "",
    };
  });

export const fetchAcordosAcessoPortal = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    exigirInterno();
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    ensureAcordosAcessoPortal();
    return db
      .prepare(
        `SELECT id, fornecedorCodigo, mesReferencia, valorCompra, valorUmPct, numeroAcordo,
                encontrado, cobrancaId, cobrancaDescricao, cobrancaValor, usuarioInterno, criadoEm,
                contratoAssinadoEm, contratoDocumentoRef
         FROM acordos_acesso_portal
         WHERE fornecedorCodigo = ?
         ORDER BY criadoEm DESC`,
      )
      .all(codigo) as AcordoAcessoPortalDB[];
  });

export const registrarAcordoAcessoPortal = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      numeroAcordo: string;
      contratoAssinadoEm: string;
      contratoDocumentoRef: string;
      confirmouContratoAssinado: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessao = exigirInternoRole("admin");
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const numeroAcordo = normalizarNumeroAcordo(data.numeroAcordo);
    if (!numeroAcordo) throw new Error("Informe o número do acordo.");
    const contratoAssinadoEm = String(data.contratoAssinadoEm ?? "").slice(0, 10);
    const contratoDocumentoRef = String(data.contratoDocumentoRef ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(contratoAssinadoEm)) {
      throw new Error("Informe a data de assinatura do contrato.");
    }
    if (!contratoDocumentoRef) {
      throw new Error("Informe a referência do contrato assinado.");
    }
    if (!data.confirmouContratoAssinado) {
      throw new Error("Confirme que o contrato assinado foi conferido.");
    }

    const mes = mesFechadoIso();
    const compraRow = db
      .prepare(
        `SELECT COUNT(DISTINCT p.numero || '-' || p.lojaId) AS documentos,
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
        `SELECT id, descricao, valor, contrato, vencimento
         FROM contas_receber
         WHERE fornecedorCodigo = ?
           AND tipo = 'Acordo comercial'
           AND (contrato = ? OR ltrim(contrato, '0') = ltrim(?, '0'))
         ORDER BY emissao DESC
         LIMIT 1`,
      )
      .get(codigo, numeroAcordo, numeroAcordo) as
      | {
          id: string;
          descricao: string | null;
          valor: number;
          contrato: string | null;
          vencimento: string | null;
        }
      | undefined;
    if (!cobranca) {
      throw new Error("Acordo não encontrado no sistema de cobrança do Líder.");
    }

    ensureAcordosAcessoPortal();
    const validadoEm = new Date().toISOString();
    db.prepare(
      `UPDATE fornecedores
       SET acessoLiberado = 1, acessoStatus = 'ATIVO_COM_ACORDO', acordoNumero = ?,
           acessoDataFim = NULL, ultimoAcordoMes = ?, contratoAssinadoEm = ?, contratoDocumentoRef = ?,
           contratoValidadoEm = ?, contratoValidadoPor = ?
       WHERE codigo = ?`,
    ).run(
      cobranca.contrato || numeroAcordo,
      mes,
      contratoAssinadoEm,
      contratoDocumentoRef,
      validadoEm,
      sessao.codigo,
      codigo,
    );
    const id = `acesso-${codigo}-${mes}-${Date.now()}`;
    db.prepare(
      `INSERT INTO acordos_acesso_portal (
          id, fornecedorCodigo, mesReferencia, valorCompra, valorUmPct, numeroAcordo,
          encontrado, cobrancaId, cobrancaDescricao, cobrancaValor, usuarioInterno, criadoEm,
          contratoAssinadoEm, contratoDocumentoRef
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
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
      validadoEm,
      contratoAssinadoEm,
      contratoDocumentoRef,
    );
    return {
      success: true,
      id,
      numeroAcordo: cobranca.contrato || numeroAcordo,
    };
  });

export const FILLRATE_TAXA_PADRAO = 3;
export const FILLRATE_TAXA_MIN = 1;
export const FILLRATE_TAXA_MAX = 10;
export const FILLRATE_META_PADRAO = 85;
export const FILLRATE_META_MIN = 50;
export const FILLRATE_META_MAX = 100;

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

export const ensureFillrateMetaColumn = createServerOnlyFn(() => {
  const cols = db.prepare("PRAGMA table_info(fornecedores)").all() as {
    name: string;
  }[];
  if (!cols.some((col) => col.name === "metaFillRatePct")) {
    db.exec(
      `ALTER TABLE fornecedores ADD COLUMN metaFillRatePct REAL NOT NULL DEFAULT ${FILLRATE_META_PADRAO}`,
    );
  }
});

const ensureFillratePolitica = createServerOnlyFn(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fillrate_politica (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      taxaMultaPct REAL NOT NULL,
      atualizadoEm TEXT NOT NULL
    );
    INSERT OR IGNORE INTO fillrate_politica (id, taxaMultaPct, atualizadoEm)
    VALUES (1, ${FILLRATE_TAXA_PADRAO}, datetime('now'));
  `);
});

const lerFillratePolitica = createServerOnlyFn((): FillratePoliticaDB => {
  ensureFillratePolitica();
  const row = db
    .prepare("SELECT taxaMultaPct, atualizadoEm FROM fillrate_politica WHERE id = 1")
    .get() as FillratePoliticaDB | undefined;
  return {
    taxaMultaPct: normalizarTaxaMulta(row?.taxaMultaPct ?? FILLRATE_TAXA_PADRAO),
    atualizadoEm: row?.atualizadoEm ?? "",
  };
});

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
  .validator((codigo: string) => soDigitos(codigo))
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
