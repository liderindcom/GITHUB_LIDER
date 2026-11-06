import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { soDigitos } from "@/lib/fornecedor-codigo";
import { randomUuid } from "@/lib/uuid";
import { db } from "../server/db";
import {
  codigoFornecedorEfetivo,
  exigirInterno,
  exigirSessaoFornecedor,
  lerSessaoPortal,
} from "../server/sessao-portal";
import { tabelaExiste } from "./db-support";
import type {
  OfertaInteliderDB,
  OfertasInteliderDB,
  RebaixaCompradorDB,
  RebaixaDestinatarioDB,
  RebaixaSegmentoEmailDB,
  RebaixaSolicitacaoDB,
} from "./contracts";

const ensureOfertasIntelider = createServerOnlyFn(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ofertas_intelider (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL CHECK (tipo IN ('validade', 'rebaixa')),
      fornecedorCodigo TEXT NOT NULL,
      sku TEXT NOT NULL,
      descricao TEXT NOT NULL,
      lojaId TEXT NOT NULL,
      lojaNome TEXT NOT NULL,
      precoNormal REAL NOT NULL DEFAULT 0,
      precoOferta REAL NOT NULL DEFAULT 0,
      descontoPercentual REAL NOT NULL DEFAULT 0,
      dataInicio TEXT,
      dataFim TEXT,
      dataVencimento TEXT,
      quantidadeInicial REAL NOT NULL DEFAULT 0,
      quantidadeVendida REAL NOT NULL DEFAULT 0,
      estoqueAtual REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Ativa',
      responsabilidade TEXT NOT NULL DEFAULT 'indefinida',
      reembolsoEstimado REAL NOT NULL DEFAULT 0,
      origemTabela TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ofertas_intelider_forn_tipo
      ON ofertas_intelider (fornecedorCodigo, tipo, dataFim);
  `);
});

export const fetchOfertasIntelider = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const fornecedorCodigo = codigoFornecedorEfetivo(codigoPedido);
    ensureOfertasIntelider();
    const rows = db
      .prepare(
        `SELECT id, tipo, fornecedorCodigo, sku, descricao, lojaId, lojaNome,
                precoNormal, precoOferta, descontoPercentual, dataInicio, dataFim,
                dataVencimento, quantidadeInicial, quantidadeVendida, estoqueAtual,
                status, responsabilidade, reembolsoEstimado, origemTabela, atualizadoEm
         FROM ofertas_intelider
         WHERE fornecedorCodigo = ?
         ORDER BY CASE tipo WHEN 'rebaixa' THEN 1 ELSE 2 END,
                  COALESCE(dataFim, '9999-12-31'), descricao, lojaNome`,
      )
      .all(fornecedorCodigo) as OfertaInteliderDB[];
    const atualizado = rows.reduce<string | null>(
      (max, row) => (!max || row.atualizadoEm > max ? row.atualizadoEm : max),
      null,
    );
    return {
      rebaixas: rows.filter((row) => row.tipo === "rebaixa"),
      validade: rows.filter((row) => row.tipo === "validade"),
      fonte: "intelider" as const,
      atualizadoEm: atualizado,
    } satisfies OfertasInteliderDB;
  });
const validarEmailRebaixa = (valor: unknown, campo: string) => {
  const email = String(valor ?? "")
    .trim()
    .toLowerCase();
  if (!email || /[\s\r\n\\]/.test(email) || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    throw new Error(`${campo} inválido.`);
  }
  return email;
};

const registrarAuditoriaRebaixa = createServerOnlyFn((
  acao: string,
  chave: string,
  valorAnterior: unknown,
  valorNovo: unknown,
) => {
  db.prepare(
    `INSERT INTO rebaixa_destinatarios_auditoria
      (id, ator, acao, chave, valorAnterior, valorNovo, criadoEm)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    randomUuid(),
    String(lerSessaoPortal()?.codigo || "interno"),
    acao,
    chave,
    valorAnterior == null ? null : JSON.stringify(valorAnterior),
    valorNovo == null ? null : JSON.stringify(valorNovo),
  );
});

const ensureSolicitacoesRebaixa = createServerOnlyFn(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rebaixa_solicitacoes (
      id TEXT PRIMARY KEY, fornecedorCodigo TEXT NOT NULL, titulo TEXT NOT NULL,
      dataInicio TEXT NOT NULL, dataFim TEXT NOT NULL, segmentos TEXT NOT NULL,
      lojas TEXT NOT NULL, itens TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'em análise',
      criadoEm TEXT NOT NULL, enviadoEm TEXT,
      tipo TEXT NOT NULL DEFAULT 'rebaixa', compradorCodigo TEXT,
      compradorNome TEXT, destinatarios TEXT
    );
    CREATE TABLE IF NOT EXISTS rebaixa_segmento_emails (
      segmento TEXT PRIMARY KEY, email TEXT NOT NULL, atualizadoEm TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rebaixa_destinatarios (
      id TEXT PRIMARY KEY,
      compradorCodigo TEXT NOT NULL,
      compradorNome TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('comprador', 'auxiliar')),
      segmento TEXT NOT NULL,
      emailPrincipal TEXT NOT NULL,
      emailAlternativo TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criadoEm TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      UNIQUE (compradorCodigo, segmento, papel, emailPrincipal)
    );
    CREATE TABLE IF NOT EXISTS rebaixa_destinatarios_auditoria (
      id TEXT PRIMARY KEY,
      ator TEXT NOT NULL,
      acao TEXT NOT NULL,
      chave TEXT NOT NULL,
      valorAnterior TEXT,
      valorNovo TEXT,
      criadoEm TEXT NOT NULL
    );
  `);
  for (const [coluna, definicao] of [
    ["tipo", "TEXT NOT NULL DEFAULT 'rebaixa'"],
    ["compradorCodigo", "TEXT"],
    ["compradorNome", "TEXT"],
    ["destinatarios", "TEXT"],
  ] as const) {
    try {
      db.exec(`ALTER TABLE rebaixa_solicitacoes ADD COLUMN ${coluna} ${definicao}`);
    } catch {
      // A coluna já existe em instalações atualizadas.
    }
  }
});

type GrupoComunicacaoRebaixa = {
  segmento: string;
  compradorCodigo: string | null;
  compradorNome: string | null;
};

type DestinatarioComunicacaoRebaixa = {
  emailPrincipal: string;
  emailAlternativo: string | null;
  compradorCodigo: string;
  compradorNome: string;
  segmento: string;
};

function normalizarGrupoComunicacao(value: unknown): GrupoComunicacaoRebaixa | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const segmento = String(item.segmento ?? "")
    .trim()
    .toUpperCase();
  if (!segmento) return null;
  const compradorCodigo = String(item.compradorCodigo ?? "").trim() || null;
  const compradorNome = String(item.compradorNome ?? "").trim() || null;
  return { segmento, compradorCodigo, compradorNome };
}

function gruposComunicacaoDosItens(
  itens: unknown[],
  segmentos: string[],
): GrupoComunicacaoRebaixa[] {
  const grupos = new Map<string, GrupoComunicacaoRebaixa>();
  for (const item of itens) {
    const grupo = normalizarGrupoComunicacao(item);
    if (!grupo) continue;
    const chave = `${grupo.compradorCodigo || "SEM_COMPRADOR"}\t${grupo.segmento}`;
    grupos.set(chave, grupo);
  }
  for (const segmento of segmentos) {
    const normalizado = String(segmento ?? "")
      .trim()
      .toUpperCase();
    if (!normalizado) continue;
    const chave = `SEM_COMPRADOR\t${normalizado}`;
    if (!Array.from(grupos.values()).some((grupo) => grupo.segmento === normalizado)) {
      grupos.set(chave, {
        segmento: normalizado,
        compradorCodigo: null,
        compradorNome: null,
      });
    }
  }
  return [...grupos.values()];
}

export const resolverDestinatariosComunicacao = createServerOnlyFn((
  grupos: GrupoComunicacaoRebaixa[],
): {
  porGrupo: Array<GrupoComunicacaoRebaixa & { emails: string[] }>;
  emails: string[];
  faltantes: string[];
} => {
  ensureSolicitacoesRebaixa();
  const cadastrados = db
    .prepare(
      `SELECT compradorCodigo, compradorNome, segmento, emailPrincipal, emailAlternativo
         FROM rebaixa_destinatarios
        WHERE ativo = 1`,
    )
    .all() as DestinatarioComunicacaoRebaixa[];
  const legados = db.prepare("SELECT segmento, email FROM rebaixa_segmento_emails").all() as Array<{
    segmento: string;
    email: string;
  }>;
  const porGrupo: Array<GrupoComunicacaoRebaixa & { emails: string[] }> = [];
  const todos = new Set<string>();
  const faltantes: string[] = [];

  for (const grupo of grupos) {
    const segmento = grupo.segmento.toUpperCase();
    const candidatos = cadastrados.filter(
      (row) =>
        String(row.segmento).toUpperCase() === segmento &&
        (!grupo.compradorCodigo || String(row.compradorCodigo) === grupo.compradorCodigo),
    );
    const emails = new Set<string>();
    for (const row of candidatos) {
      for (const email of [row.emailPrincipal, row.emailAlternativo]) {
        const normalizado = String(email || "")
          .trim()
          .toLowerCase();
        if (normalizado) emails.add(normalizado);
      }
    }
    if (!emails.size) {
      for (const row of legados) {
        if (String(row.segmento).toUpperCase() !== segmento) continue;
        const normalizado = String(row.email || "")
          .trim()
          .toLowerCase();
        if (normalizado) emails.add(normalizado);
      }
    }
    if (!emails.size) {
      faltantes.push(
        grupo.compradorCodigo
          ? `${grupo.compradorNome || grupo.compradorCodigo} · ${segmento}`
          : segmento,
      );
    }
    const lista = [...emails];
    lista.forEach((email) => todos.add(email));
    porGrupo.push({ ...grupo, emails: lista });
  }
  return { porGrupo, emails: [...todos], faltantes };
});

export const criarTransportadorComunicacao = createServerOnlyFn(async () => {
  // Nodemailer e suas dependências usam APIs do Node (como Buffer). O import
  // precisa acontecer somente no servidor, nunca durante o carregamento do
  // bundle client que também expõe os RPCs desta API.
  const { default: nodemailer } = await import("nodemailer");
  return nodemailer.createTransport({
    host: process.env["SMTP_HOST"] || "localhost",
    port: parseInt(process.env["SMTP_PORT"] || "587", 10),
    secure: process.env["SMTP_SECURE"] === "true",
    auth:
      process.env["SMTP_USER"] && process.env["SMTP_PASS"]
        ? { user: process.env["SMTP_USER"], pass: process.env["SMTP_PASS"] }
        : undefined,
    tls: { rejectUnauthorized: false },
  });
});

export const fetchRebaixaSegmentosEmail = createServerFn({
  method: "GET",
}).handler(async () => {
  exigirInterno();
  ensureSolicitacoesRebaixa();
  return db
    .prepare("SELECT segmento, email, atualizadoEm FROM rebaixa_segmento_emails ORDER BY segmento")
    .all() as RebaixaSegmentoEmailDB[];
});

export const saveRebaixaSegmentoEmail = createServerFn({ method: "POST" })
  .validator((data: { segmento: string; email: string }) => data)
  .handler(async ({ data }) => {
    exigirInterno();
    const segmento = String(data.segmento ?? "")
      .trim()
      .toUpperCase();
    const email = String(data.email ?? "")
      .trim()
      .toLowerCase();
    if (!segmento || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))
      throw new Error("Informe segmento e e-mail válidos.");
    ensureSolicitacoesRebaixa();
    db.prepare(
      `INSERT INTO rebaixa_segmento_emails (segmento, email, atualizadoEm) VALUES (?, ?, datetime('now')) ON CONFLICT(segmento) DO UPDATE SET email=excluded.email, atualizadoEm=excluded.atualizadoEm`,
    ).run(segmento, email);
    return { success: true };
  });

export const fetchRebaixaDestinatarios = createServerFn({
  method: "GET",
}).handler(async () => {
  exigirInterno();
  ensureSolicitacoesRebaixa();
  return {
    destinatarios: db
      .prepare(
        `SELECT id, compradorCodigo, compradorNome, papel, segmento, emailPrincipal,
                emailAlternativo, ativo, criadoEm, atualizadoEm
         FROM rebaixa_destinatarios
         ORDER BY compradorNome, segmento, papel, emailPrincipal`,
      )
      .all() as RebaixaDestinatarioDB[],
    compradores: db
      .prepare(
        `SELECT compradorCodigo AS codigo, MAX(compradorNome) AS nome
         FROM produtos
         WHERE compradorCodigo IS NOT NULL AND TRIM(compradorCodigo) <> ''
         GROUP BY compradorCodigo ORDER BY MAX(compradorNome), compradorCodigo`,
      )
      .all() as RebaixaCompradorDB[],
  };
});

export const saveRebaixaDestinatario = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      compradorCodigo: string;
      compradorNome: string;
      papel: "comprador" | "auxiliar";
      segmento: string;
      emailPrincipal: string;
      emailAlternativo?: string | null;
      ativo: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    exigirInterno();
    ensureSolicitacoesRebaixa();
    const compradorCodigo = String(data.compradorCodigo ?? "").trim();
    const compradorNome = String(data.compradorNome ?? "").trim();
    const segmento = String(data.segmento ?? "")
      .trim()
      .toUpperCase();
    if (
      !compradorCodigo ||
      !compradorNome ||
      !segmento ||
      !["comprador", "auxiliar"].includes(data.papel)
    ) {
      throw new Error("Informe comprador, papel e segmento válidos.");
    }
    const emailPrincipal = validarEmailRebaixa(data.emailPrincipal, "E-mail principal");
    const emailAlternativo = data.emailAlternativo?.trim()
      ? validarEmailRebaixa(data.emailAlternativo, "E-mail alternativo")
      : null;
    const ativo = Number(data.ativo) === 1 ? 1 : 0;
    const agora = new Date().toISOString();
    const id = data.id?.trim() || randomUuid();
    const anterior = db.prepare("SELECT * FROM rebaixa_destinatarios WHERE id = ?").get(id) as
      RebaixaDestinatarioDB | undefined;
    db.prepare(
      `INSERT INTO rebaixa_destinatarios
        (id, compradorCodigo, compradorNome, papel, segmento, emailPrincipal,
         emailAlternativo, ativo, criadoEm, atualizadoEm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET compradorCodigo=excluded.compradorCodigo,
         compradorNome=excluded.compradorNome, papel=excluded.papel,
         segmento=excluded.segmento, emailPrincipal=excluded.emailPrincipal,
         emailAlternativo=excluded.emailAlternativo, ativo=excluded.ativo,
         atualizadoEm=excluded.atualizadoEm`,
    ).run(
      id,
      compradorCodigo,
      compradorNome,
      data.papel,
      segmento,
      emailPrincipal,
      emailAlternativo,
      ativo,
      anterior?.criadoEm || agora,
      agora,
    );
    registrarAuditoriaRebaixa(anterior ? "atualizar" : "criar", id, anterior || null, {
      id,
      compradorCodigo,
      compradorNome,
      papel: data.papel,
      segmento,
      emailPrincipal,
      emailAlternativo,
      ativo,
    });
    return { success: true, id };
  });

export const fetchMinhasSolicitacoesRebaixa = createServerFn({
  method: "GET",
}).handler(async () => {
  const sessao = exigirSessaoFornecedor();
  ensureSolicitacoesRebaixa();
  return db
    .prepare("SELECT * FROM rebaixa_solicitacoes WHERE fornecedorCodigo = ? ORDER BY criadoEm DESC")
    .all(sessao.codigo) as RebaixaSolicitacaoDB[];
});

export const submitSolicitacaoRebaixa = createServerFn({ method: "POST" })
  .validator(
    (data: {
      titulo: string;
      dataInicio: string;
      dataFim: string;
      segmentos: string[];
      lojas: string[];
      itens: unknown[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const sessao = exigirSessaoFornecedor();
    const titulo = String(data.titulo ?? "").trim();
    const dataInicio = String(data.dataInicio ?? "");
    const dataFim = String(data.dataFim ?? "");
    if (
      !titulo ||
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(dataInicio) ||
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(dataFim) ||
      dataFim < dataInicio
    )
      throw new Error("Informe título e período válidos.");
    const segmentos = [
      ...new Set(data.segmentos.map((v) => String(v).trim().toUpperCase()).filter(Boolean)),
    ];
    const lojas = [...new Set(data.lojas.map((v) => String(v).trim()).filter(Boolean))];
    if (!segmentos.length || !lojas.length || !data.itens.length)
      throw new Error("Informe segmento, lojas e ao menos um produto.");
    ensureSolicitacoesRebaixa();
    if (tabelaExiste("contas_receber")) {
      const limite = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const bloqueio = db
        .prepare(
          "SELECT 1 FROM contas_receber WHERE fornecedorCodigo = ? AND status <> 'Descontado' AND vencimento IS NOT NULL AND vencimento <> '' AND vencimento < ? LIMIT 1",
        )
        .get(sessao.codigo, limite);
      if (bloqueio)
        throw new Error("Solicitação bloqueada: existe débito vencido há mais de 60 dias.");
    }
    const gruposDestinatarios = gruposComunicacaoDosItens(data.itens, segmentos);
    const resolvidos = resolverDestinatariosComunicacao(gruposDestinatarios);
    if (resolvidos.faltantes.length)
      throw new Error(
        `Não há destinatário ativo para: ${[...new Set(resolvidos.faltantes)].join(", ")}.`,
      );
    const id = `rebaixa-${sessao.codigo}-${Date.now()}`;
    const criadoEm = new Date().toISOString();
    const destinatarios = resolvidos.emails.join(", ");
    const fornecedor = db
      .prepare("SELECT nome FROM fornecedores WHERE codigo = ?")
      .get(sessao.codigo) as { nome?: string } | undefined;
    const transporter = await criarTransportadorComunicacao();
    await transporter.sendMail({
      from: process.env["SMTP_FROM"] || "portal@lidernet.com.br",
      to: destinatarios,
      subject: `[Rebaixa em análise] ${titulo} - ${fornecedor?.nome || sessao.codigo}`,
      text: `Solicitação de rebaixa em análise. Fornecedor: ${fornecedor?.nome || sessao.codigo}. Período: ${dataInicio} a ${dataFim}. Segmentos: ${segmentos.join(", ")}. Produtos: ${data.itens.length}.`,
    });
    db.prepare(
      `INSERT INTO rebaixa_solicitacoes
        (id, fornecedorCodigo, titulo, dataInicio, dataFim, segmentos, lojas, itens,
         status, criadoEm, enviadoEm, tipo, destinatarios)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'em análise', ?, datetime('now'), 'rebaixa', ?)`,
    ).run(
      id,
      sessao.codigo,
      titulo,
      dataInicio,
      dataFim,
      JSON.stringify(segmentos),
      JSON.stringify(lojas),
      JSON.stringify(data.itens),
      criadoEm,
      destinatarios,
    );
    return { success: true, id, status: "em análise" as const };
  });
