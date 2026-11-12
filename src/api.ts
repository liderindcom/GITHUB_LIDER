import { createServerFn } from "@tanstack/react-start";
import { normalizarCodigoFornecedor, soDigitos } from "@/lib/fornecedor-codigo";
import { sqlLojasForaPortal } from "@/lib/lojas-excluidas-portal";
import { cortePedidosIso, mesFechadoIso } from "@/lib/pedidos-janela";
import { JANELA_SKU_DIA_DIAS } from "@/lib/vendas-graos";
import { db } from "./server/db";
import {
  colunaExiste,
  joinVendasMensalProduto,
  sqlSkuVisivel,
  tabelaExiste,
} from "./api/db-support";
import { mapaNomesComprador } from "./api/catalog-data";
import type {
  MarcaFornecedorDB,
  FornecedorDB,
  ProdutoDB,
  AtualizacaoDadosFornecedorDB,
  FornecedorAcordoCadastroDB,
  NfePendenteDB,
  DocaDB,
  SolicitacaoAgendamentoDB,
  ConciliacaoItemDB,
  NfeXmlItemDB,
  CapacidadeCargaAgendamentoDB,
  CompraMesAnteriorDB,
  RelatorioAcordoAcessoLinhaDB,
  RelatorioAcordoAcessoDB,
  AcordoCobrancaDB,
  AcordoAcessoPortalDB,
  FillratePoliticaDB,
  FillrateAcordoDB,
  UsuarioInternoDB,
  PropostaPrecoDB,
} from "./api/contracts";
export type {
  MarcaFornecedorDB,
  UsuarioFornecedorRow,
  FornecedorDB,
  ProdutoDB,
  PerdaDB,
  VendaDB,
  EstoqueDB,
  FaturaDB,
  PedidoStatusDB,
  PedidoItemDB,
  PedidoDB,
  ShareJanela,
  ShareCategoriaDB,
  ShareMarcaDB,
  ShareResumoDB,
  ShareFornecedorDB,
  AtualizacaoDadosFornecedorDB,
  FornecedorAcordoCadastroDB,
  ProdutoBloqueioDB,
  FaixaPrecoSubgrupoDB,
  ContaReceberDB,
  ComprasAnoMesDB,
  ComprasAnoDestinoDB,
  ComprasAnoDB,
  RentabilidadeLinhaDB,
  RentabilidadeRebaixaDB,
  RentabilidadeDB,
  TransferenciaCdamDB,
  NfePendenteDB,
  DocaDB,
  SolicitacaoAgendamentoDB,
  ConciliacaoItemDB,
  NfeXmlItemDB,
  CapacidadeCargaAgendamentoDB,
  CompraMesAnteriorDB,
  RelatorioAcordoAcessoLinhaDB,
  RelatorioAcordoAcessoDB,
  AcordoCobrancaDB,
  AcordoAcessoPortalDB,
  FillratePoliticaDB,
  FillrateAcordoDB,
  VendasAnualMesDB,
  VendasAnualSecaoDB,
  VendasAnualItemDB,
  VendasAnualDB,
  OfertaInteliderDB,
  OfertasInteliderDB,
  RebaixaSolicitacaoDB,
  RebaixaSegmentoEmailDB,
  RebaixaCompradorDB,
  RebaixaDestinatarioDB,
  UsuarioInternoDB,
  UsuarioFornecedorDB,
  PropostaPrecoDB,
} from "./api/contracts";
import {
  exigirLimite,
  iniciarCargaRmsAssincrona,
  lerRelatorioPortal,
  lerStatusPromotoresInterno,
} from "./api/agenda-support";
export {
  fetchAgendaPromotoresSegmentada,
  criarAgendaCluster,
  salvarAgendaCluster,
  salvarAgendaPromotoresEdicao,
  fetchAgendaPromotoresPresenca,
  fetchStatusPromotoresExecucao,
  forcarAtualizacaoStatusPromotores,
} from "./api/agenda";
export type { AgendaCluster } from "./api/agenda";
export { fetchRentabilidade } from "./api/rentabilidade";
export { fetchShareFornecedor } from "./api/share";
export {
  fetchOfertasIntelider,
  fetchRebaixaSegmentosEmail,
  saveRebaixaSegmentoEmail,
  fetchRebaixaDestinatarios,
  saveRebaixaDestinatario,
  fetchMinhasSolicitacoesRebaixa,
  submitSolicitacaoRebaixa,
} from "./api/rebaixas";
import { criarTransportadorComunicacao, resolverDestinatariosComunicacao } from "./api/rebaixas";
export { fetchVendasAnual } from "./api/vendas-anual";
export { fetchIndicadoresFornecedores } from "./api/indicadores-fornecedores";
export { fetchVendasPorLoja } from "./api/vendas-loja";
export type { VendaPorLojaDiaDB, VendaPorLojaItemDB, VendasPorLojaDB } from "./api/vendas-loja";
export {
  fetchPreferenciaCalculoPromotor,
  solicitarPreferenciaCalculoPromotor,
  fetchPreferenciasCalculoPromotoresAdmin,
  aprovarPreferenciaCalculoPromotor,
} from "./api/promotor-periodicidade";
export type {
  PeriodicidadeCalculoPromotor,
  PreferenciaCalculoPromotor,
  StatusPeriodicidadeCalculo,
} from "./api/promotor-periodicidade";
export {
  fetchProdutos,
  fetchFaixasPrecoSubgrupo,
  fetchProdutosBloqueios,
  fetchPerdas,
  fetchEstoque,
  fetchContasReceber,
  fetchFaturas,
  fetchComprasAno,
  fetchPedidos,
  fetchVendas,
  fetchTransferenciasCdam,
} from "./api/catalog-data";
export {
  searchFornecedores,
  updateSupplierAccess,
  includeSupplier,
  fetchCompraMesAnterior,
  fetchRelatorioAcordoAcesso,
  verificarAcordoCobranca,
  fetchAcordosAcessoPortal,
  registrarAcordoAcessoPortal,
  DESCONTO_ACESSO_PORTAL_PCT,
  FILLRATE_TAXA_PADRAO,
  FILLRATE_TAXA_MIN,
  FILLRATE_TAXA_MAX,
  FILLRATE_META_PADRAO,
  FILLRATE_META_MIN,
  FILLRATE_META_MAX,
  fetchFillratePolitica,
  updateFillrateTaxa,
  fetchFillrateAcordo,
  updateFillrateMeta,
  atualizarStatusCarenciaExpirada,
  ensureFillrateMetaColumn,
  adicionarDiasIso,
  proximaCompetenciaCompleta,
  dataPrimeiraCobranca,
} from "./api/access";
export {
  fetchFornecedor,
  fetchUsuariosFornecedor,
  salvarUsuarioFornecedor,
  excluirUsuarioFornecedor,
  loginUsuarioFornecedor,
  primeiroAcessoFornecedor,
  fetchMinhaContaFornecedor,
  alterarMinhaSenhaFornecedor,
  loginUsuarioInterno,
  iniciarSessaoFornecedor,
  encerrarSessaoPortal,
  restaurarSessaoPortal,
  USUARIOS_FORNECEDOR_MAX,
} from "./api/auth";
import {
  atualizarStatusCarenciaExpirada,
  adicionarDiasIso,
  proximaCompetenciaCompleta,
  dataPrimeiraCobranca,
} from "./api/access";
import { faturasDoFornecedor } from "@/lib/mock-data";
import { faturamentoBloqueiaData, LOJAS_AGENDAMENTO_PERMITIDAS } from "@/lib/reforco-faturamento";
import {
  normalizarTaxaAcessoPortalPct,
  segmentoIntelider,
  valorUmPctCompra,
} from "@/lib/acordo-acesso";
import {
  FILTRO_VAZIO,
  filtroMercadologicoAtivo,
  produtoPassaFiltro,
  type FiltroMercadologico,
} from "@/lib/filtro-mercadologico";
import {
  codigoFornecedorEfetivo,
  gravarSessaoPortal,
  apagarSessaoPortal,
  exigirInterno,
  exigirInternoRole,
  exigirSessaoFornecedor,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
} from "./server/sessao-portal";
import { randomUuid } from "@/lib/uuid";

export function ensureFornecedoresColumns() {
  // Safe migrations run on startup in db.ts
}

function ensureMarcasFornecedor() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fornecedor_produto_marcas (
      fornecedorCodigo TEXT NOT NULL,
      sku TEXT NOT NULL,
      marca TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      PRIMARY KEY (fornecedorCodigo, sku)
    )
  `);
}

function ensureAceiteCelulasDisponibilidade() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS aceite_celulas_disponibilidade (
      id TEXT PRIMARY KEY,
      versao TEXT NOT NULL,
      usuarioInterno TEXT NOT NULL,
      checksJson TEXT NOT NULL,
      criadoEm TEXT NOT NULL
    );
  `);
}

export const fetchAceiteCelulasDisponibilidade = createServerFn({
  method: "GET",
}).handler(async () => {
  exigirInterno();
  ensureAceiteCelulasDisponibilidade();
  return db
    .prepare(
      `SELECT id, versao, usuarioInterno, checksJson, criadoEm
       FROM aceite_celulas_disponibilidade
       ORDER BY criadoEm DESC LIMIT 1`,
    )
    .get() as
    | {
        id: string;
        versao: string;
        usuarioInterno: string;
        checksJson: string;
        criadoEm: string;
      }
    | undefined;
});

export const registrarAceiteCelulasDisponibilidade = createServerFn({
  method: "POST",
})
  .validator((data: { versao: string; checks: string[] }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const sessao = lerSessaoPortal();
    if (!sessao || sessao.tipo !== "interno") throw new Error("Acesso administrativo exigido.");
    if (
      !data.versao.trim() ||
      data.checks.length !== 4 ||
      data.checks.some((item) => !item.trim())
    ) {
      throw new Error("Aceite incompleto.");
    }
    ensureAceiteCelulasDisponibilidade();
    const criadoEm = new Date().toISOString();
    const id = randomUuid();
    db.prepare(
      `INSERT INTO aceite_celulas_disponibilidade (id, versao, usuarioInterno, checksJson, criadoEm)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, data.versao.trim(), sessao.codigo, JSON.stringify(data.checks), criadoEm);
    return {
      id,
      versao: data.versao.trim(),
      usuarioInterno: sessao.codigo,
      criadoEm,
    };
  });

export const fetchMarcasFornecedor = createServerFn({ method: "GET" }).handler(async () => {
  const sessao = exigirSessaoFornecedor();
  ensureMarcasFornecedor();
  return db
    .prepare(
      "SELECT sku, marca, atualizadoEm FROM fornecedor_produto_marcas WHERE fornecedorCodigo = ? ORDER BY sku",
    )
    .all(sessao.codigo) as MarcaFornecedorDB[];
});

export const salvarMarcasFornecedor = createServerFn({ method: "POST" })
  .validator((data: { itens: { sku: string; marca: string }[] }) => ({
    itens: Array.isArray(data.itens)
      ? data.itens.map((item) => ({
          sku: String(item.sku ?? "").trim(),
          marca: String(item.marca ?? "")
            .trim()
            .slice(0, 120),
        }))
      : [],
  }))
  .handler(async ({ data }) => {
    const sessao = exigirSessaoFornecedor();
    ensureMarcasFornecedor();
    const itens = data.itens.filter((item) => item.sku && item.marca);
    if (!itens.length) throw new Error("Informe ao menos uma marca válida.");

    const permitidos = new Set(
      (
        db
          .prepare(`SELECT sku FROM produtos p WHERE ${sqlSkuVisivel("p")}`)
          .all(sessao.codigo) as Array<{ sku: string }>
      ).map((item) => String(item.sku)),
    );
    const agora = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO fornecedor_produto_marcas (fornecedorCodigo, sku, marca, atualizadoEm)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (fornecedorCodigo, sku) DO UPDATE SET marca = excluded.marca, atualizadoEm = excluded.atualizadoEm
    `);
    const gravar = db.transaction(() => {
      for (const item of itens) {
        if (!permitidos.has(item.sku)) continue;
        upsert.run(sessao.codigo, item.sku, item.marca, agora);
      }
    });
    gravar();
    return {
      success: true,
      quantidade: itens.filter((item) => permitidos.has(item.sku)).length,
    };
  });

// Endpoints RPC no lado do servidor (Server Functions)
export const fetchFornecedoresList = createServerFn({ method: "GET" }).handler(async () => {
  exigirInterno();
  const stmt = db.prepare(
    "SELECT codigo, nome, cnpj, cnpjSenhaInicial, acessoLiberado FROM fornecedores ORDER BY nome",
  );
  return stmt.all() as FornecedorDB[];
});

export const fetchAtualizacaoDadosFornecedor = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => normalizarCodigoFornecedor(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    const row = tabelaExiste("portal_atualizacao_diaria_fornecedor")
      ? (db
          .prepare(
            `SELECT ultimo_status AS status,
                    ultimo_sucesso_em AS ultimoSucessoEm,
                    ultima_tentativa_em AS ultimaTentativaEm
             FROM portal_atualizacao_diaria_fornecedor
             WHERE fornecedor_codigo = ?`,
          )
          .get(fornecedorCodigo) as
          | {
              status: string;
              ultimoSucessoEm: string | null;
              ultimaTentativaEm: string | null;
            }
          | undefined)
      : undefined;
    const execucao = tabelaExiste("portal_atualizacao_diaria_execucao")
      ? (db
          .prepare(
            `SELECT status AS execucaoStatus, inicio_em AS execucaoInicioEm,
                    fim_em AS execucaoFimEm, erro AS execucaoErro
             FROM portal_atualizacao_diaria_execucao WHERE id = 1`,
          )
          .get() as
          | {
              execucaoStatus: string;
              execucaoInicioEm: string | null;
              execucaoFimEm: string | null;
              execucaoErro: string | null;
            }
          | undefined)
      : undefined;
    if (!row && !execucao) return null;
    return {
      status: row?.status ?? "SEM_REGISTRO",
      ultimoSucessoEm: row?.ultimoSucessoEm ?? null,
      ultimaTentativaEm: row?.ultimaTentativaEm ?? null,
      execucaoStatus: execucao?.execucaoStatus ?? null,
      execucaoInicioEm: execucao?.execucaoInicioEm ?? null,
      execucaoFimEm: execucao?.execucaoFimEm ?? null,
      execucaoErro: execucao?.execucaoErro ?? null,
    };
  });

/** Lista todos os fornecedores para registrar acordos já assinados, inclusive fora do relatório mensal. */
export const fetchFornecedoresAcordoCadastro = createServerFn({
  method: "GET",
}).handler(async () => {
  exigirInterno();
  atualizarStatusCarenciaExpirada();
  return db
    .prepare(
      `SELECT codigo, nome, acessoLiberado, acessoStatus, acordoNumero,
              contratoAssinadoEm, contratoDocumentoRef, contratoValidadoEm, contratoValidadoPor
       FROM fornecedores
       ORDER BY nome, codigo`,
    )
    .all() as FornecedorAcordoCadastroDB[];
});

const TOKENS_FORNECEDOR_STATUS_IGNORADOS = new Set([
  "A",
  "AS",
  "E",
  "DA",
  "DAS",
  "DE",
  "DO",
  "DOS",
  "LTDA",
  "LTD",
  "SA",
  "S",
  "CIA",
  "COMPANHIA",
  "IND",
  "INDUSTRIA",
  "INDUSTRIAL",
  "INDL",
  "INDS",
  "COM",
  "COML",
  "COMERCIAL",
  "COMERCIO",
  "DISTRIBUIDORA",
  "DISTRIBUIDOR",
  "BRASIL",
]);

function normalizarNomeFornecedorStatus(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function fornecedorStatusCorresponde(origem: unknown, aliases: string[]): boolean {
  const origemNormalizada = normalizarNomeFornecedorStatus(origem);
  if (!origemNormalizada) return false;
  const origemCompacta = origemNormalizada.replace(/ /g, "");
  const tokensOrigem = new Set(
    origemNormalizada
      .split(" ")
      .filter((token) => token.length >= 4 && !TOKENS_FORNECEDOR_STATUS_IGNORADOS.has(token)),
  );

  return aliases.some((alias) => {
    const aliasNormalizado = normalizarNomeFornecedorStatus(alias);
    if (!aliasNormalizado) return false;
    const aliasCompacto = aliasNormalizado.replace(/ /g, "");
    if (origemCompacta === aliasCompacto) return true;

    // Permite sufixos de consolidação e abreviações do cadastro, mas somente
    // quando a parte comum é o início do nome e é suficientemente específica.
    if (
      Math.min(origemCompacta.length, aliasCompacto.length) >= 12 &&
      (origemCompacta.startsWith(aliasCompacto) || aliasCompacto.startsWith(origemCompacta))
    )
      return true;

    const tokensAlias = new Set(
      aliasNormalizado
        .split(" ")
        .filter((token) => token.length >= 4 && !TOKENS_FORNECEDOR_STATUS_IGNORADOS.has(token)),
    );
    const tokensEmComum = [...tokensOrigem].filter((token) => tokensAlias.has(token));
    return tokensEmComum.length >= 2;
  });
}

function aliasesFornecedorStatus(linha: Record<string, unknown>): string[] {
  const canonicos = Array.isArray(linha.fornecedor_nomes_canonicos)
    ? linha.fornecedor_nomes_canonicos.map((item) => String(item ?? "")).filter(Boolean)
    : [];
  return [String(linha.descricao_fornecedor ?? ""), ...canonicos].filter(Boolean);
}

function resumoStatusFornecedor(
  linha: Record<string, unknown>,
  statusRows: Array<Record<string, unknown>>,
) {
  const aliases = aliasesFornecedorStatus(linha);
  const correspondentes = statusRows.filter((promotor) =>
    fornecedorStatusCorresponde(promotor.fornecedor_nome_origem, aliases),
  );
  if (!correspondentes.length) {
    return {
      disponivel: false,
      total: null,
      ativos: null,
      semPresencaMesAnterior: null,
      foraDoSistema: null,
    };
  }

  const quantidade = (status: string) =>
    correspondentes.filter((promotor) => promotor.status_operacional === status).length;
  return {
    disponivel: true,
    total: correspondentes.length,
    ativos: quantidade("ATIVO"),
    semPresencaMesAnterior: quantidade("SEM_PRESENCA_MES_ANTERIOR") + quantidade("DIVERGENTE"),
    foraDoSistema: quantidade("FORA_DO_SISTEMA"),
  };
}

function numeroPromotoresLinha(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.round(numero)) : 0;
}

export const fetchControlePromotoresResumo = createServerFn({
  method: "GET",
}).handler(async () => {
  exigirInterno();
  const controleRelatorio = lerRelatorioPortal("controle-promotores.json");
  const suppliers = Array.isArray(controleRelatorio.suppliers)
    ? (controleRelatorio.suppliers as Array<Record<string, unknown>>)
    : [];
  const statusRelatorio = lerStatusPromotoresInterno();
  const statusRows = Array.isArray(statusRelatorio?.promotores)
    ? (statusRelatorio.promotores as Array<Record<string, unknown>>)
    : [];

  const compradoresPorFornecedor = new Map<string, Set<string>>();
  if (tabelaExiste("produtos")) {
    try {
      const mapaNomes = mapaNomesComprador();
      const compradores = db
        .prepare(
          `SELECT fornecedorCodigo, compradorCodigo, MAX(compradorNome) AS compradorNome
           FROM produtos
           GROUP BY fornecedorCodigo, compradorCodigo`,
        )
        .all() as Array<{
        fornecedorCodigo?: string | number | null;
        compradorCodigo?: string | number | null;
        compradorNome?: string | null;
      }>;

      for (const row of compradores) {
        const fornecedorCodigo = String(row.fornecedorCodigo ?? "").trim();
        if (!fornecedorCodigo) continue;
        const compradorCodigo = String(row.compradorCodigo ?? "").trim();
        const nomeDireto = String(row.compradorNome ?? "").trim();
        const nome =
          nomeDireto && nomeDireto !== `Comprador ${compradorCodigo}`
            ? nomeDireto
            : (compradorCodigo && mapaNomes.get(compradorCodigo)) || nomeDireto;
        const label = nome || (compradorCodigo ? `Comprador ${compradorCodigo}` : "Sem comprador");
        const atuais = compradoresPorFornecedor.get(fornecedorCodigo) ?? new Set<string>();
        atuais.add(label);
        compradoresPorFornecedor.set(fornecedorCodigo, atuais);
      }
    } catch (error) {
      console.error("Erro ao montar compradores da análise de promotores:", error);
    }
  }

  const codigosFornecedor = (linha: Record<string, unknown>) => {
    const exibicao = String(linha.fornecedor_codigo_exibicao ?? "");
    const encontrados = exibicao.match(/\d+/g) ?? [];
    return [String(linha.fornecedor_codigo ?? ""), ...encontrados]
      .map((codigo) => codigo.trim())
      .filter(Boolean);
  };

  return suppliers.map((linha) => {
    const campos = Object.entries(linha).filter(
      ([chave, valor]) =>
        chave === "segmentos_ativos" ||
        chave === "departamentos_ativos" ||
        chave === "compradores_ativos" ||
        valor == null ||
        typeof valor === "string" ||
        typeof valor === "number" ||
        typeof valor === "boolean",
    );

    const compradoresAtivos = new Set<string>();
    for (const codigo of codigosFornecedor(linha)) {
      for (const comprador of compradoresPorFornecedor.get(codigo) ?? []) {
        compradoresAtivos.add(comprador);
      }
      try {
        const efetivo = codigoFornecedorEfetivo(codigo);
        for (const comprador of compradoresPorFornecedor.get(efetivo) ?? []) {
          compradoresAtivos.add(comprador);
        }
      } catch {
        // O código direto já foi consultado; aliases inválidos não bloqueiam o relatório.
      }
    }
    if (compradoresAtivos.size === 0) compradoresAtivos.add("Sem comprador");

    const status = resumoStatusFornecedor(linha, statusRows);
    const presentesRelatorio = numeroPromotoresLinha(linha.promotores_observados);
    const camposNormalizados = campos.map(([chave, valor]) => {
      if (chave === "promotores_observados") {
        // A presença canônica do mês anterior é a referência operacional da
        // análise. O valor antigo fica disponível para auditoria e fallback.
        return [chave, status.disponivel ? status.ativos : presentesRelatorio];
      }
      if (chave === "compradores_ativos") {
        return [chave, [...compradoresAtivos].sort((a, b) => a.localeCompare(b, "pt-BR"))];
      }
      if (chave !== "departamentos_ativos" || !Array.isArray(valor)) {
        return [chave, valor];
      }
      const departamentos = valor
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
        .map((item) => ({
          codigo:
            typeof item.codigo === "string" || typeof item.codigo === "number"
              ? String(item.codigo)
              : null,
          descricao: typeof item.descricao === "string" ? item.descricao : null,
          segmento: typeof item.segmento === "string" ? item.segmento : null,
          skus: typeof item.skus === "number" ? item.skus : null,
        }));
      return [chave, departamentos];
    });
    return Object.fromEntries([
      ...camposNormalizados,
      ["compradores_ativos", [...compradoresAtivos].sort((a, b) => a.localeCompare(b, "pt-BR"))],
      ["promotores_observados_relatorio", presentesRelatorio],
      ["promotores_status_disponivel", status.disponivel],
      ["promotores_status_total", status.total],
      ["promotores_status_ativos", status.ativos],
      ["promotores_status_sem_presenca_mes_anterior", status.semPresencaMesAnterior],
      ["promotores_status_fora_do_sistema", status.foraDoSistema],
      ["promotores_status_gerado_em", statusRelatorio?.generated_at ?? null],
      ["promotores_status_data_referencia", statusRelatorio?.data_referencia ?? null],
    ]);
  });
});

/** O número da NF-e ocupa as posições 26–34 da chave de acesso (9 dígitos). */
function numeroNotaDaChaveNfe(chave: string | null | undefined): string {
  const digitos = String(chave ?? "").replace(/\D/g, "");
  return digitos.length === 44 ? digitos.slice(25, 34).replace(/^0+(?=\d)/, "") : "";
}

export const fetchNfePendentes = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    if (!tabelaExiste("nfe_pendentes")) return [] as NfePendenteDB[];
    const rows = db
      .prepare(
        `SELECT id, fornecedorCodigo, numeroNota, chaveNfe, lojaId, destTipo, situacao,
                situacaoDescricao, agendaRms, agendaPrevisao, status
         FROM nfe_pendentes
         WHERE fornecedorCodigo = ?
         ORDER BY numeroNota DESC`,
      )
      .all(fornecedorCodigo) as NfePendenteDB[];
    return rows.map((row) => ({
      ...row,
      numeroNota: String(row.numeroNota ?? "").trim() || numeroNotaDaChaveNfe(row.chaveNfe),
    }));
  });

export const fetchDocas = createServerFn({ method: "GET" }).handler(async () => {
  if (!tabelaExiste("docas")) return [] as DocaDB[];
  return db
    .prepare(
      `SELECT lojaId, doca, tipo, horaInicio, horaFim, diasUteis FROM docas WHERE horaInicio <> '' ORDER BY lojaId, doca`,
    )
    .all() as DocaDB[];
});

const HORA_RECEBIMENTO_INICIO = "07:00";
const HORA_RECEBIMENTO_FIM = "17:00";
const LIMITE_CARGAS_DIA = 40;

function ensureSolicitacoesAgendamento() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitacoes_agendamento (
      id TEXT PRIMARY KEY,
      fornecedorCodigo TEXT NOT NULL,
      numeroNota TEXT,
      chaveNfe TEXT,
      lojaId TEXT NOT NULL,
      doca TEXT NOT NULL,
      dataSolicitada TEXT NOT NULL,
      horaInicio TEXT NOT NULL,
      horaFim TEXT NOT NULL,
      tipoCarga TEXT NOT NULL,
      paletes INTEGER NOT NULL,
      portas INTEGER NOT NULL,
      prioridade TEXT,
      secoes TEXT,
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'Pendente de confirmação',
      criadoEm TEXT NOT NULL,
      enviadoEm TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_agendamento_fornecedor
      ON solicitacoes_agendamento (fornecedorCodigo, criadoEm);
  `);
  try {
    db.exec("ALTER TABLE solicitacoes_agendamento ADD COLUMN secoes TEXT;");
  } catch {
    /* coluna já existe */
  }
}

export const submitSolicitacaoAgendamento = createServerFn({ method: "POST" })
  .validator(
    (data: {
      lojaId: string;
      doca: string;
      dataSolicitada: string;
      horaInicio: string;
      horaFim: string;
      tipoCarga: "paletizada" | "batida";
      paletes: number;
      portas: number;
      secoes?: string[];
      numeroNota?: string;
      chaveNfe?: string;
      observacoes?: string;
    }) => ({
      ...data,
      lojaId: String(data.lojaId).trim(),
      doca: String(data.doca).trim(),
      dataSolicitada: String(data.dataSolicitada).trim(),
      horaInicio: String(data.horaInicio).trim(),
      horaFim: String(data.horaFim).trim(),
      tipoCarga: data.tipoCarga === "paletizada" ? "paletizada" : "batida",
      paletes: Math.max(0, Math.floor(Number(data.paletes) || 0)),
      portas: Math.max(1, Math.min(2, Math.floor(Number(data.portas) || 1))),
      secoes: Array.isArray(data.secoes)
        ? data.secoes.map((secao) => String(secao).trim()).filter(Boolean)
        : [],
      numeroNota: String(data.numeroNota ?? "").trim(),
      chaveNfe: String(data.chaveNfe ?? "").trim(),
      observacoes: String(data.observacoes ?? "").trim(),
    }),
  )
  .handler(async ({ data }) => {
    const sessao = exigirSessaoFornecedor();
    if (!data.lojaId || !data.doca || !data.dataSolicitada || !data.horaInicio || !data.horaFim) {
      throw new Error("Preencha loja, doca, data e horário da solicitação.");
    }
    if (
      !/^\d{2}:\d{2}$/.test(data.horaInicio) ||
      !/^\d{2}:\d{2}$/.test(data.horaFim) ||
      data.horaInicio < HORA_RECEBIMENTO_INICIO ||
      data.horaFim > HORA_RECEBIMENTO_FIM ||
      data.horaFim <= data.horaInicio
    ) {
      throw new Error(
        `O recebimento funciona das ${HORA_RECEBIMENTO_INICIO} às ${HORA_RECEBIMENTO_FIM}.`,
      );
    }
    if (data.paletes <= 0) {
      throw new Error("Informe a quantidade de paletes da carga.");
    }
    if (
      !LOJAS_AGENDAMENTO_PERMITIDAS.includes(
        data.lojaId as (typeof LOJAS_AGENDAMENTO_PERMITIDAS)[number],
      )
    ) {
      throw new Error(
        "O agendamento está disponível somente para as lojas 201 (CDAM) e 203 (Farmalíder).",
      );
    }
    const gruposBloqueados = faturamentoBloqueiaData(data.secoes, data.dataSolicitada);
    if (gruposBloqueados.length) {
      throw new Error(
        `A data escolhida coincide com faturamento das seções do grupo ${gruposBloqueados.join(", ")}. Escolha outra data.`,
      );
    }
    ensureSolicitacoesAgendamento();
    const cargasNoDia = db
      .prepare(
        `SELECT COUNT(*) AS total FROM solicitacoes_agendamento
         WHERE lojaId = ? AND dataSolicitada = ?
           AND status NOT LIKE '%recusada%'
           AND status NOT LIKE '%cancelada%'`,
      )
      .get(data.lojaId, data.dataSolicitada) as { total?: number };
    if (Number(cargasNoDia?.total || 0) >= LIMITE_CARGAS_DIA) {
      throw new Error(
        `A data escolhida já atingiu o limite médio de ${LIMITE_CARGAS_DIA} cargas. Escolha outra data.`,
      );
    }

    const fornecedor = db
      .prepare("SELECT nome FROM fornecedores WHERE codigo = ?")
      .get(sessao.codigo) as { nome?: string } | undefined;
    const solicitante = lerSessaoPortal()?.usuarioEmail || "não identificado";
    const id = `agendamento-${Date.now()}-${randomUuid().slice(0, 8)}`;
    const criadoEm = new Date().toISOString();
    const prioridade = "Aguardando análise de estoque e reforço de faturamento";
    const assunto = `[Solicitação de agendamento] ${fornecedor?.nome || sessao.codigo} · ${data.dataSolicitada}`;
    const texto = [
      "Solicitação de agendamento de recebimento.",
      `Fornecedor: ${fornecedor?.nome || sessao.codigo} (${sessao.codigo})`,
      `Solicitante: ${solicitante}`,
      `Loja: ${data.lojaId}`,
      `Doca: ${data.doca}`,
      `Data: ${data.dataSolicitada}`,
      `Horário solicitado: ${data.horaInicio}–${data.horaFim}`,
      `Carga: ${data.tipoCarga === "paletizada" ? "Paletizada" : "Batida"}`,
      `Paletes: ${data.paletes}`,
      `Portas necessárias: ${data.portas}`,
      `Seções: ${data.secoes.length ? data.secoes.join(", ") : "não informadas"}`,
      `NF: ${data.numeroNota || "não informada"}`,
      `Chave NF-e: ${data.chaveNfe || "não informada"}`,
      `Observações: ${data.observacoes || "—"}`,
      "Status: pendente de confirmação da logística.",
    ].join("\n");

    db.prepare(
      `INSERT INTO solicitacoes_agendamento
       (id, fornecedorCodigo, numeroNota, chaveNfe, lojaId, doca, dataSolicitada,
        horaInicio, horaFim, tipoCarga, paletes, portas, prioridade, secoes, observacoes,
        status, criadoEm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente de confirmação', ?)`,
    ).run(
      id,
      sessao.codigo,
      data.numeroNota,
      data.chaveNfe,
      data.lojaId,
      data.doca,
      data.dataSolicitada,
      data.horaInicio,
      data.horaFim,
      data.tipoCarga,
      data.paletes,
      data.portas,
      prioridade,
      JSON.stringify(data.secoes),
      data.observacoes,
      criadoEm,
    );

    let emailEnviado = false;
    let erroEmail: string | undefined;
    try {
      const from = process.env["SMTP_FROM"] || "portal@lidernet.com.br";
      const transporter = await criarTransportadorComunicacao();
      const recipients = ["agendamento.lider@lidernet.com.br"];
      if (solicitante.includes("@")) recipients.push(solicitante);
      await transporter.sendMail({
        from: `Portal do Fornecedor <${from}>`,
        to: recipients.join(", "),
        subject: assunto,
        text: texto,
      });
      emailEnviado = true;
      db.prepare("UPDATE solicitacoes_agendamento SET enviadoEm = ?, status = ? WHERE id = ?").run(
        new Date().toISOString(),
        "Solicitação enviada · aguardando confirmação",
        id,
      );
    } catch (erro) {
      erroEmail = erro instanceof Error ? erro.message : "Falha SMTP";
      console.error("Falha ao enviar solicitação de agendamento:", erro);
    }

    return {
      id,
      emailEnviado,
      erroEmail,
      status: emailEnviado ? "Solicitação enviada · aguardando confirmação" : "Pendente de envio",
    };
  });

export const fetchConciliacaoNfePedido = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
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

function normalizarChaveCadastro(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .replace(/\s+/g, "");
}

function numeroFicha(valor: unknown) {
  const numero = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

export const fetchCapacidadeCargaAgendamento = createServerFn({ method: "GET" })
  .validator((data: { chaveNfe?: string; numeroNota?: string }) => ({
    chaveNfe: String(data.chaveNfe ?? "").trim(),
    numeroNota: String(data.numeroNota ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const sessao = exigirSessaoFornecedor();
    const itens = await fetchItensNfe({ data });
    if (!itens.length)
      return {
        paletes: null,
        caixas: 0,
        itens: 0,
        itensSemCadastro: [],
      } satisfies CapacidadeCargaAgendamentoDB;
    if (!tabelaExiste("catalogo_comercial_fornecedor")) {
      return {
        paletes: null,
        caixas: 0,
        itens: itens.length,
        itensSemCadastro: itens.map((item) => item.sku || item.descricao),
      } satisfies CapacidadeCargaAgendamentoDB;
    }
    const catalogo = db
      .prepare(
        `SELECT codigoFornecedor, skuReferencia, dadosFichaLiderJson
         FROM catalogo_comercial_fornecedor
         WHERE fornecedorCodigo = ? AND status <> 'ARQUIVADO'`,
      )
      .all(codigoFornecedorEfetivo(sessao.codigo)) as Array<{
      codigoFornecedor: string | null;
      skuReferencia: string | null;
      dadosFichaLiderJson: string | null;
    }>;
    const porChave = new Map<string, { caixasPorPallet: number; unidadesPorCaixa: number }>();
    for (const produto of catalogo) {
      let ficha: Record<string, unknown> = {};
      try {
        const valor = produto.dadosFichaLiderJson ? JSON.parse(produto.dadosFichaLiderJson) : {};
        if (valor && typeof valor === "object") ficha = valor as Record<string, unknown>;
      } catch {
        ficha = {};
      }
      const caixasPorPallet = numeroFicha(ficha.palletTotalCaixas);
      const unidadesPorCaixa = numeroFicha(ficha.embalagemQuantidade);
      if (!caixasPorPallet || !unidadesPorCaixa) continue;
      for (const chave of [
        produto.codigoFornecedor,
        produto.skuReferencia,
        ficha.codigoInterno,
        ficha.ean13,
        ficha.dun14,
      ]) {
        const normalizada = normalizarChaveCadastro(chave);
        if (normalizada) porChave.set(normalizada, { caixasPorPallet, unidadesPorCaixa });
      }
    }
    let totalPaletes = 0;
    let totalCaixas = 0;
    const itensSemCadastro: string[] = [];
    for (const item of itens) {
      if (
        !normalizarChaveCadastro(item.sku) ||
        normalizarChaveCadastro(item.sku) === "0" ||
        item.quantidade <= 0
      ) {
        itensSemCadastro.push(
          `${item.descricao || item.sku || item.id} (XML sem SKU/quantidade válida)`,
        );
        continue;
      }
      const ficha = porChave.get(normalizarChaveCadastro(item.sku));
      if (!ficha) {
        itensSemCadastro.push(
          `${item.sku || item.descricao || item.id} (sem ficha de paletização)`,
        );
        continue;
      }
      const caixas = Math.ceil(Math.max(0, item.quantidade) / ficha.unidadesPorCaixa);
      totalCaixas += caixas;
      totalPaletes += Math.ceil(caixas / ficha.caixasPorPallet);
    }
    return {
      paletes: itensSemCadastro.length ? null : Math.max(1, totalPaletes),
      caixas: totalCaixas,
      itens: itens.length,
      itensSemCadastro,
    } satisfies CapacidadeCargaAgendamentoDB;
  });

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

function ensureSolicitacoesAntecipacao() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitacoes_antecipacao (
      id TEXT PRIMARY KEY,
      fornecedorCodigo TEXT NOT NULL,
      protocolo TEXT NOT NULL UNIQUE,
      valorBruto REAL NOT NULL,
      valorLiquido REAL NOT NULL,
      descontoTotal REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendente',
      faturas TEXT NOT NULL,
      criadoEm TEXT NOT NULL
    );
  `);
}

async function enviarEmailNotificacao(dados: {
  protocolo: string;
  fornecedorCodigo: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorBruto: number;
  desconto: number;
  valorLiquido: number;
  faturaIds: string[];
  criadoEm: string;
  usuarioEmail?: string | undefined;
}) {
  const from = process.env["SMTP_FROM"] || "portal@lidernet.com.br";

  const transporter = await criarTransportadorComunicacao();

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);

  let faturasHTML = "";
  try {
    const todasFaturas = faturasDoFornecedor(dados.fornecedorCodigo);
    const faturasSelecionadas = todasFaturas.filter((f) => dados.faturaIds.includes(f.id));
    if (faturasSelecionadas.length > 0) {
      faturasHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: sans-serif;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th style="padding: 8px; border: 1px solid #e5e7eb;">Nota Fiscal</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb;">Emissão</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb;">Previsão PGTO</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${faturasSelecionadas
              .map(
                (f) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${f.numeroNota}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${f.emissao}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${f.dataPagamento}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${formatBRL(f.valor)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      faturasHTML = `<p style="font-family: sans-serif; color: #6b7280;">IDs das Faturas: ${dados.faturaIds.join(", ")}</p>`;
    }
  } catch (err) {
    console.error("Erro ao carregar faturas para email:", err);
    faturasHTML = `<p style="font-family: sans-serif; color: #6b7280;">IDs das Faturas: ${dados.faturaIds.join(", ")}</p>`;
  }

  const dataFormatada = new Date(dados.criadoEm).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const subject = `[Antecipação Líder Fomento] Solicitação ${dados.protocolo} - ${dados.fornecedorNome}`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="background-color: #1e3a8a; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">Solicitação de Antecipação de Recebíveis</h2>
        <span style="font-size: 14px; opacity: 0.9;">Líder Fomento / Portal do Fornecedor</span>
      </div>
      <div style="padding: 24px; color: #1f2937; line-height: 1.5;">
        <p style="margin-top: 0;">Olá,</p>
        <p>Uma nova solicitação de antecipação de recebíveis foi registrada através do simulador no Portal do Fornecedor.</p>
        
        <div style="background-color: #f9fafb; border-left: 4px solid #1e3a8a; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #1e3a8a;">Detalhes da Solicitação</h3>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #6b7280; width: 40%;"><strong>Protocolo:</strong></td>
              <td style="padding: 4px 0; font-weight: bold; color: #111827;">${dados.protocolo}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Fornecedor:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${dados.fornecedorNome} (${dados.fornecedorCodigo})</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>CNPJ:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${dados.fornecedorCnpj}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Data/Hora:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${dataFormatada}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;"><strong>Solicitante:</strong></td>
              <td style="padding: 4px 0; color: #111827;">${dados.usuarioEmail || "Não identificado"}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #1d4ed8;">Resumo Financeiro</h3>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #4b5563;"><strong>Valor Bruto:</strong></td>
              <td style="padding: 4px 0; text-align: right; color: #111827;">${formatBRL(dados.valorBruto)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #dc2626;"><strong>Desconto Total:</strong></td>
              <td style="padding: 4px 0; text-align: right; color: #dc2626;">- ${formatBRL(dados.desconto)}</td>
            </tr>
            <tr style="border-top: 1px solid #bfdbfe; font-size: 16px;">
              <td style="padding: 8px 0 0 0; color: #1d4ed8;"><strong>Líquido a Receber:</strong></td>
              <td style="padding: 8px 0 0 0; text-align: right; font-weight: bold; color: #1d4ed8;">${formatBRL(dados.valorLiquido)}</td>
            </tr>
          </table>
        </div>

        <h3 style="font-size: 15px; color: #1f2937; margin-bottom: 5px; margin-top: 25px;">Títulos Selecionados</h3>
        ${faturasHTML}

        <p style="margin-top: 30px; font-size: 13px; color: #6b7280;">
          Este é um e-mail automático gerado pelo Portal do Fornecedor Grupo Líder. Por favor, não responda diretamente a este e-mail.
        </p>
      </div>
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
        &copy; 2026 Grupo Líder. Todos os direitos reservados.
      </div>
    </div>
  `;

  const recipients = ["fomento@lidernet.com.br"];
  if (dados.usuarioEmail && dados.usuarioEmail.trim()) {
    recipients.push(dados.usuarioEmail.trim());
  }

  const mailOptions = {
    from: `"Portal do Fornecedor" <${from}>`,
    to: recipients.join(", "),
    subject,
    html: htmlContent,
  };

  console.log(`[SMTP] Iniciando envio de e-mail de antecipação para: ${recipients.join(", ")}`);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] E-mail enviado com sucesso. MessageID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("[SMTP] Erro ao enviar e-mail de antecipação:", error);
    throw error;
  }
}

export const solicitarAntecipacao = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      faturaIds: string[];
      valorBruto: number;
      desconto: number;
      valorLiquido: number;
    }) => ({
      ...data,
      fornecedorCodigo: soDigitos(data.fornecedorCodigo),
    }),
  )
  .handler(async ({ data }) => {
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    ensureSolicitacoesAntecipacao();

    const { faturaIds, valorBruto, desconto, valorLiquido } = data;
    const id = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const protocolo = `ANT-${Date.now().toString(36).toUpperCase()}`;
    const criadoEm = new Date().toISOString();
    const faturasJson = JSON.stringify(faturaIds);

    // Salvar no SQLite local
    db.prepare(
      `
      INSERT INTO solicitacoes_antecipacao (id, fornecedorCodigo, protocolo, valorBruto, valorLiquido, descontoTotal, status, faturas, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, 'Pendente', ?, ?)
    `,
    ).run(id, codigo, protocolo, valorBruto, valorLiquido, desconto, faturasJson, criadoEm);

    // Buscar info do fornecedor
    let fornecedorNome = "Fornecedor Não Identificado";
    let fornecedorCnpj = "CNPJ Não Cadastrado";
    try {
      const forn = db
        .prepare("SELECT nome, cnpj FROM fornecedores WHERE codigo = ?")
        .get(codigo) as { nome: string; cnpj: string } | undefined;
      if (forn) {
        fornecedorNome = forn.nome;
        fornecedorCnpj = forn.cnpj;
      }
    } catch (err) {
      console.error("Erro ao obter dados do fornecedor para e-mail:", err);
    }

    // Obter email de login atual
    let usuarioEmail: string | undefined;
    try {
      const sessao = lerSessaoPortal();
      if (sessao && sessao.usuarioEmail) {
        usuarioEmail = sessao.usuarioEmail;
      }
    } catch (err) {
      console.error("Erro ao obter e-mail de sessao para e-mail:", err);
    }

    let emailEnviado = false;
    let erroEmail: string | undefined = undefined;

    try {
      await enviarEmailNotificacao({
        protocolo,
        fornecedorCodigo: codigo,
        fornecedorNome,
        fornecedorCnpj,
        valorBruto,
        desconto,
        valorLiquido,
        faturaIds,
        criadoEm,
        usuarioEmail,
      });
      emailEnviado = true;
    } catch (err: any) {
      console.error("Falha no envio do e-mail de antecipação:", err);
      erroEmail = err.message || "Erro de rede / SMTP";
    }

    return {
      codigoAuditoria: protocolo,
      criadoEm,
      faturaIds,
      valorBruto,
      desconto,
      valorLiquido,
      emailEnviado,
      erroEmail,
    };
  });

export const fetchAntecipacoes = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    ensureSolicitacoesAntecipacao();

    const rows = db
      .prepare(
        `
      SELECT id, fornecedorCodigo, protocolo, valorBruto, valorLiquido, descontoTotal, status, faturas, criadoEm
      FROM solicitacoes_antecipacao
      WHERE fornecedorCodigo = ?
      ORDER BY criadoEm DESC
    `,
      )
      .all(codigo) as any[];

    return rows.map((r) => ({
      codigoAuditoria: String(r.protocolo),
      criadoEm: String(r.criadoEm),
      faturaIds: JSON.parse(r.faturas || "[]") as string[],
      valorBruto: Number(r.valorBruto ?? 0),
      desconto: Number(r.descontoTotal ?? 0),
      valorLiquido: Number(r.valorLiquido ?? 0),
    }));
  });

export const ATLAS_PERMISSOES = [
  "consultar_carteira",
  "ver_detalhes",
  "negociar",
  "enviar_mensagens",
  "criar_campanhas",
  "aprovar_campanhas",
  "solicitar_rebaixa",
  "planejar_pedidos",
  "emitir_pedidos",
  "gerenciar_acessos",
] as const;
export type AtlasPermissao = (typeof ATLAS_PERMISSOES)[number];

function ensureAtlasAcessos() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS atlas_acessos_usuarios (
      username TEXT PRIMARY KEY,
      papel TEXT NOT NULL,
      permissoes TEXT NOT NULL,
      segmentos TEXT NOT NULL,
      compradores TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL
    );
  `);
}

export const fetchAtlasAcessosUsuarios = createServerFn({
  method: "GET",
}).handler(async () => {
  exigirInternoRole("admin");
  ensureAtlasAcessos();
  return (
    db.prepare("SELECT * FROM atlas_acessos_usuarios ORDER BY username").all() as Array<
      Record<string, unknown>
    >
  ).map((row) => ({
    username: String(row.username),
    papel: String(row.papel),
    permissoes: JSON.parse(String(row.permissoes || "[]")) as AtlasPermissao[],
    segmentos: JSON.parse(String(row.segmentos || "[]")) as string[],
    compradores: JSON.parse(String(row.compradores || "[]")) as string[],
  }));
});

export const salvarAtlasAcessoUsuario = createServerFn({ method: "POST" })
  .validator(
    (data: {
      username: string;
      papel: string;
      permissoes: AtlasPermissao[];
      segmentos: string[];
      compradores: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    exigirInternoRole("admin");
    ensureAtlasAcessos();
    const username = String(data.username || "")
      .trim()
      .toLowerCase();
    const permissoes = [...new Set(data.permissoes)].filter((item): item is AtlasPermissao =>
      (ATLAS_PERMISSOES as readonly string[]).includes(item),
    );
    if (!username || !data.papel || !permissoes.length)
      throw new Error("Informe usuário, papel e ao menos uma permissão.");
    db.prepare(
      `
      INSERT INTO atlas_acessos_usuarios (username, papel, permissoes, segmentos, compradores, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(username) DO UPDATE SET papel=excluded.papel, permissoes=excluded.permissoes,
        segmentos=excluded.segmentos, compradores=excluded.compradores, atualizadoEm=excluded.atualizadoEm
    `,
    ).run(
      username,
      data.papel,
      JSON.stringify(permissoes),
      JSON.stringify(data.segmentos),
      JSON.stringify(data.compradores),
    );
    return { success: true };
  });

function ensureScanntechImportacao() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scanntech_importacoes (
      runId TEXT PRIMARY KEY,
      competencia TEXT NOT NULL,
      arquivo TEXT NOT NULL,
      checksum TEXT NOT NULL,
      cabecalhos TEXT NOT NULL,
      status TEXT NOT NULL,
      linhas INTEGER NOT NULL DEFAULT 0,
      criadoEm TEXT NOT NULL,
      promovidoEm TEXT
    );
    CREATE TABLE IF NOT EXISTS scanntech_importacao_itens (
      runId TEXT NOT NULL,
      linha INTEGER NOT NULL,
      ean TEXT NOT NULL,
      nome TEXT NOT NULL,
      marca TEXT,
      fabricante TEXT,
      cesta TEXT,
      categoria TEXT,
      subcategoria TEXT,
      metricas TEXT NOT NULL,
      PRIMARY KEY (runId, linha)
    );
  `);
}

export const iniciarImportacaoScanntech = createServerFn({ method: "POST" })
  .validator(
    (data: { competencia: string; arquivo: string; checksum: string; cabecalhos: string[] }) =>
      data,
  )
  .handler(async ({ data }) => {
    exigirInterno();
    ensureScanntechImportacao();
    if (!/^\\d{4}-\\d{2}$/.test(data.competencia) || !data.checksum)
      throw new Error("Competência ou checksum inválido.");
    const runId = `scanntech-${data.competencia}-${Date.now()}`;
    db.prepare(
      "INSERT INTO scanntech_importacoes (runId, competencia, arquivo, checksum, cabecalhos, status, criadoEm) VALUES (?, ?, ?, ?, ?, 'staging', datetime('now'))",
    ).run(runId, data.competencia, data.arquivo, data.checksum, JSON.stringify(data.cabecalhos));
    return { runId };
  });

export const enviarLoteScanntech = createServerFn({ method: "POST" })
  .validator((data: { runId: string; itens: Array<Record<string, unknown>> }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    ensureScanntechImportacao();
    const run = db
      .prepare("SELECT status FROM scanntech_importacoes WHERE runId = ?")
      .get(data.runId) as { status?: string } | undefined;
    if (!run || run.status !== "staging") throw new Error("Lote Scanntech não está em staging.");
    const insert = db.prepare(
      "INSERT OR REPLACE INTO scanntech_importacao_itens (runId, linha, ean, nome, marca, fabricante, cesta, categoria, subcategoria, metricas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const transaction = db.transaction((itens: Array<Record<string, unknown>>) => {
      for (const item of itens)
        insert.run(
          data.runId,
          Number(item.linha),
          String(item.ean),
          String(item.nome || ""),
          item.marca ?? null,
          item.fabricante ?? null,
          item.cesta ?? null,
          item.categoria ?? null,
          item.subcategoria ?? null,
          JSON.stringify(item.metricas || {}),
        );
    });
    transaction(data.itens);
    return { success: true, recebidas: data.itens.length };
  });

export const promoverImportacaoScanntech = createServerFn({ method: "POST" })
  .validator((data: { runId: string; linhasLidas: number; linhasRejeitadas: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    ensureScanntechImportacao();
    const run = db
      .prepare("SELECT status FROM scanntech_importacoes WHERE runId = ?")
      .get(data.runId) as { status?: string } | undefined;
    if (!run || run.status !== "staging") throw new Error("Lote Scanntech não está em staging.");
    const total = db
      .prepare("SELECT COUNT(*) AS n FROM scanntech_importacao_itens WHERE runId = ?")
      .get(data.runId) as { n: number };
    if (Number(total?.n || 0) !== data.linhasLidas || data.linhasRejeitadas > 0)
      throw new Error("Lote Scanntech incompleto ou com rejeições.");
    db.prepare(
      "UPDATE scanntech_importacoes SET status = 'promovido', linhas = ?, promovidoEm = datetime('now') WHERE runId = ?",
    ).run(data.linhasLidas, data.runId);
    return { promovidas: data.linhasLidas };
  });

export const fetchUsuariosInternos = createServerFn({ method: "GET" }).handler(async () => {
  exigirInternoRole("admin");
  const { ensureUsuariosInternos } = await import("./server/usuarios-interno");
  ensureUsuariosInternos();
  const stmt = db.prepare("SELECT username, nome, role FROM usuarios_internos ORDER BY username");
  return stmt.all() as UsuarioInternoDB[];
});

export const createUsuarioInterno = createServerFn({ method: "POST" })
  .validator((data: { username: string; nome: string; senha: string; role: string }) => data)
  .handler(async ({ data }) => {
    exigirInternoRole("admin");
    const { criarHashSenhaInterna, ensureUsuariosInternos } =
      await import("./server/usuarios-interno");
    ensureUsuariosInternos();
    const username = String(data.username ?? "")
      .trim()
      .toLowerCase();
    const nome = String(data.nome ?? "").trim();
    const senha = String(data.senha ?? "").trim();
    const role = data.role === "comprador" || data.role === "colaborador" ? data.role : "admin";
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
      `INSERT INTO usuarios_internos (username, nome, senha, senhaHash, "role") VALUES (?, ?, ?, ?, ?)`,
    ).run(username, nome, "", criarHashSenhaInterna(senha), role);
    return { success: true, username };
  });

export const deleteUsuarioInterno = createServerFn({ method: "POST" })
  .validator((username: string) => username)
  .handler(async ({ data: username }) => {
    exigirInternoRole("admin");
    const stmt = db.prepare("DELETE FROM usuarios_internos WHERE username = ?");
    stmt.run(username);
    return { success: true };
  });

// --- PRICE PROPOSAL & APPROVAL SYSTEM ---

type ProdutoRoteamentoTabelaPreco = {
  sku: string;
  compradorCodigo: string | null;
  compradorNome: string | null;
  departamentoCodigo: string | null;
  departamento: string | null;
};

export const submitPropostaPreco = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      justificativa: string;
      itens: {
        sku: string;
        descricao: string;
        precoAtual: number;
        precoProposto: number;
      }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessao = exigirSessaoFornecedor();
    const fornecedorCodigo = sessao.codigo;
    const justificativa = String(data.justificativa ?? "").trim();
    const itens = (Array.isArray(data.itens) ? data.itens : [])
      .map((item) => ({
        sku: String(item.sku ?? "").trim(),
        descricao: String(item.descricao ?? "").trim(),
        precoAtual: Number(item.precoAtual),
        precoProposto: Number(item.precoProposto),
      }))
      .filter(
        (item) => item.sku && item.descricao && item.precoAtual >= 0 && item.precoProposto > 0,
      );
    if (!justificativa) throw new Error("Informe a justificativa da tabela de preço.");
    if (!itens.length) throw new Error("Informe ao menos um preço válido.");
    const skus = [...new Set(itens.map((item) => item.sku))];
    const cadastroRows: ProdutoRoteamentoTabelaPreco[] = [];
    // Mantém a validação dentro do limite de parâmetros do SQLite e do
    // PostgreSQL quando o fornecedor envia uma tabela grande.
    for (let inicio = 0; inicio < skus.length; inicio += 700) {
      const loteSkus = skus.slice(inicio, inicio + 700);
      const rows = db
        .prepare(
          `SELECT p.sku, p.compradorCodigo, p.compradorNome,
                  p.departamentoCodigo, p.departamento
             FROM produtos p
            WHERE ${sqlSkuVisivel("p")}
              AND p.sku IN (${loteSkus.map(() => "?").join(",")})`,
        )
        .all(fornecedorCodigo, ...loteSkus) as ProdutoRoteamentoTabelaPreco[];
      cadastroRows.push(...rows);
    }
    const cadastroPorSku = new Map(cadastroRows.map((row) => [String(row.sku), row]));
    const semCadastro = skus.filter((sku) => !cadastroPorSku.has(sku));
    if (semCadastro.length) {
      throw new Error(`Produto(s) não pertencente(s) ao fornecedor: ${semCadastro.join(", ")}.`);
    }

    const itensRoteados = itens.map((item) => {
      const cadastro = cadastroPorSku.get(item.sku)!;
      const segmento = segmentoIntelider(cadastro.departamentoCodigo, cadastro.departamento);
      return {
        ...item,
        compradorCodigo: String(cadastro.compradorCodigo ?? "").trim() || null,
        compradorNome: String(cadastro.compradorNome ?? "").trim() || null,
        segmento,
      };
    });
    const grupos = new Map<
      string,
      {
        segmento: string;
        compradorCodigo: string | null;
        compradorNome: string | null;
        itens: typeof itensRoteados;
      }
    >();
    for (const item of itensRoteados) {
      const chave = `${item.compradorCodigo || "SEM_COMPRADOR"}\t${item.segmento}`;
      const grupo = grupos.get(chave) || {
        segmento: item.segmento,
        compradorCodigo: item.compradorCodigo,
        compradorNome: item.compradorNome,
        itens: [],
      };
      grupo.itens.push(item);
      grupos.set(chave, grupo);
    }
    const resolvidos = resolverDestinatariosComunicacao([...grupos.values()]);
    if (resolvidos.faltantes.length) {
      throw new Error(
        `Não há destinatário ativo para: ${[...new Set(resolvidos.faltantes)].join(", ")}. Configure a aba Destinatários de rebaixa e preços.`,
      );
    }
    const now = new Date();
    const formattedDate = now.toISOString().replace(/T/, "-").replace(/[:.]/g, "").slice(0, 15);
    const loteId = `LOTE-${formattedDate}-${Math.floor(100 + Math.random() * 900)}`;
    const fornecedor = db
      .prepare("SELECT nome FROM fornecedores WHERE codigo = ?")
      .get(fornecedorCodigo) as { nome?: string } | undefined;
    const transporter = await criarTransportadorComunicacao();
    const dataEnvio = now.toISOString();

    for (const grupo of resolvidos.porGrupo) {
      const itensGrupo =
        grupos.get(`${grupo.compradorCodigo || "SEM_COMPRADOR"}\t${grupo.segmento}`)?.itens || [];
      await transporter.sendMail({
        from: process.env["SMTP_FROM"] || "portal@lidernet.com.br",
        to: grupo.emails.join(", "),
        subject: `[Tabela de preço em análise] ${loteId} - ${fornecedor?.nome || fornecedorCodigo}`,
        text: [
          "Tabela de preço recebida pelo mesmo protocolo de comunicação das rebaixas.",
          `Fornecedor: ${fornecedor?.nome || fornecedorCodigo}`,
          `Lote: ${loteId}`,
          `Comprador: ${grupo.compradorNome || grupo.compradorCodigo || "Não atribuído"}`,
          `Segmento: ${grupo.segmento}`,
          `Itens: ${itensGrupo.length}`,
          ...itensGrupo.map(
            (item) =>
              `${item.sku} · ${item.descricao} · ${item.precoAtual.toFixed(2)} → ${item.precoProposto.toFixed(2)}`,
          ),
        ].join("\n"),
      });
    }

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
          justificativa,
        );
      }
      for (const grupo of resolvidos.porGrupo) {
        const chave = `${grupo.compradorCodigo || "SEM_COMPRADOR"}\t${grupo.segmento}`;
        const itensGrupo = grupos.get(chave)?.itens || [];
        db.prepare(
          `INSERT INTO rebaixa_solicitacoes
            (id, fornecedorCodigo, titulo, dataInicio, dataFim, segmentos, lojas, itens,
             status, criadoEm, enviadoEm, tipo, compradorCodigo, compradorNome, destinatarios)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'em análise', ?, ?, 'tabela_preco', ?, ?, ?)`,
        ).run(
          `tabela-preco-${randomUuid()}`,
          fornecedorCodigo,
          `Tabela de preço · ${loteId}`,
          dataEnvio.slice(0, 10),
          dataEnvio.slice(0, 10),
          JSON.stringify([grupo.segmento]),
          JSON.stringify([]),
          JSON.stringify(itensGrupo),
          dataEnvio,
          dataEnvio,
          grupo.compradorCodigo,
          grupo.compradorNome,
          grupo.emails.join(", "),
        );
      }
    });

    transaction(itens);
    return {
      success: true,
      loteId,
      grupos: resolvidos.porGrupo.map((grupo) => ({
        compradorCodigo: grupo.compradorCodigo,
        compradorNome: grupo.compradorNome,
        segmento: grupo.segmento,
        itens:
          grupos.get(`${grupo.compradorCodigo || "SEM_COMPRADOR"}\t${grupo.segmento}`)?.itens
            .length || 0,
      })),
    };
  });

export const fetchPropostasPrecos = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo?: string) => fornecedorCodigo)
  .handler(async ({ data: fornecedorCodigo }) => {
    if (fornecedorCodigo) {
      const code = codigoFornecedorEfetivo(fornecedorCodigo);
      const stmt = db.prepare(
        "SELECT * FROM propostas_precos WHERE fornecedorCodigo = ? ORDER BY criadoEm DESC",
      );
      return stmt.all(code) as PropostaPrecoDB[];
    } else {
      exigirInterno();
      const stmt = db.prepare(
        "SELECT * FROM propostas_precos ORDER BY status = 'pendente' DESC, criadoEm DESC",
      );
      return stmt.all() as PropostaPrecoDB[];
    }
  });

export const responderPropostaPreco = createServerFn({ method: "POST" })
  .validator(
    (data: { id: number; status: "aprovado" | "rejeitado"; respostaAdmin: string }) => data,
  )
  .handler(async ({ data }) => {
    exigirInterno();
    const { id, status, respostaAdmin } = data;

    const selectStmt = db.prepare(
      "SELECT sku, precoProposto, status FROM propostas_precos WHERE id = ?",
    );
    const proposal = selectStmt.get(id) as
      { sku: string; precoProposto: number; status: string } | undefined;

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
  .validator((data: { codigo: string; isentoCobranca: number; taxaAcessoPct: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    ensureFornecedoresColumns();
    const { codigo, isentoCobranca } = data;
    const taxaAcessoPct = normalizarTaxaAcessoPortalPct(data.taxaAcessoPct);
    db.prepare(
      `UPDATE fornecedores
       SET isentoCobranca = ?, taxaAcessoPct = ?
       WHERE codigo = ?`,
    ).run(isentoCobranca, taxaAcessoPct, codigo);
    return { success: true };
  });

export const updateSupplierCarencia = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; carenciaDias: number }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    ensureFornecedoresColumns();
    const carenciaDias = Math.trunc(Number(data.carenciaDias));
    if (!Number.isInteger(carenciaDias) || carenciaDias < 0 || carenciaDias > 60) {
      throw new Error("A carência deve ser informada entre 0 e 60 dias.");
    }
    const fornecedor = db
      .prepare("SELECT acessoDataInicio, acessoStatus FROM fornecedores WHERE codigo = ?")
      .get(data.codigo) as
      { acessoDataInicio?: string | null; acessoStatus?: string | null } | undefined;
    const inicio = String(fornecedor?.acessoDataInicio ?? "").slice(0, 10);
    if (!inicio) throw new Error("O fornecedor não possui data inicial de acesso.");

    const carenciaAte = carenciaDias > 0 ? adicionarDiasIso(inicio, carenciaDias - 1) : null;
    const primeiraCompetenciaCobravel = proximaCompetenciaCompleta(carenciaAte || inicio);
    const primeiraCobrancaEm = dataPrimeiraCobranca(primeiraCompetenciaCobravel);
    const status =
      fornecedor?.acessoStatus === "ATIVO_COM_ACORDO"
        ? "ATIVO_COM_ACORDO"
        : carenciaDias > 0
          ? "DEGUSTACAO"
          : "AGUARDANDO_COMPETENCIA";
    db.prepare(
      `UPDATE fornecedores
       SET carenciaDias = ?, carenciaAte = ?, primeiraCompetenciaCobravel = ?,
           primeiraCobrancaEm = ?, degustacaoUsada = 1, acessoStatus = ?
       WHERE codigo = ?`,
    ).run(
      carenciaDias,
      carenciaAte,
      primeiraCompetenciaCobravel,
      primeiraCobrancaEm,
      status,
      data.codigo,
    );
    return {
      success: true,
      carenciaDias,
      carenciaAte,
      primeiraCompetenciaCobravel,
      primeiraCobrancaEm,
      acessoStatus: status,
    };
  });

export const refreshSupplierDataImmediately = createServerFn({ method: "POST" })
  .validator((data: { codigo: string }) => ({ codigo: soDigitos(data.codigo) }))
  .handler(({ data }) => {
    exigirInterno();
    const codigo = resolverCodigoFornecedorDados(data.codigo);
    if (!codigo) throw new Error("Código de fornecedor inválido.");
    iniciarCargaRmsAssincrona(codigo);
    return {
      success: true,
      accepted: true,
      message: "Atualização RMS iniciada em segundo plano. Acompanhe o status da carga.",
    };
  });
