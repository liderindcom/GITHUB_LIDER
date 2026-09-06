import { randomUUID } from "crypto";
import { createServerFn } from "@tanstack/react-start";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import {
  codigoFornecedorEfetivo,
  exigirInterno,
  exigirSessaoFornecedor,
} from "@/server/sessao-portal";
import { db } from "@/server/db";

export type CatalogoComercialDB = {
  id: string;
  fornecedorCodigo: string;
  codigoFornecedor: string | null;
  descricao: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  skuReferencia: string | null;
  imagemUrl: string | null;
  fichaTecnica: string | null;
  variacoesJson: string | null;
  dadosFichaLiderJson: string | null;
  precoSugerido: number | null;
  precoValidadeInicio: string | null;
  precoValidadeFim: string | null;
  estoqueDisponivel: number | null;
  prazoEntregaDias: number | null;
  pedidoMinimo: number | null;
  colecao: string | null;
  estacao: string | null;
  evento: string | null;
  status: "RASCUNHO" | "PUBLICADO" | "ARQUIVADO";
  criadoEm: string;
  atualizadoEm: string;
  publicadoEm: string | null;
  origem: string;
};

const LIMITE_CATALOGO_COMERCIAL = 200;

function liberarEspacoCatalogo(fornecedorCodigo: string, novosItens: number) {
  const total = db
    .prepare(
      "SELECT COUNT(*) AS total FROM catalogo_comercial_fornecedor WHERE fornecedorCodigo = ?",
    )
    .get(fornecedorCodigo) as { total: number };
  const excesso = Number(total.total) + novosItens - LIMITE_CATALOGO_COMERCIAL;
  if (excesso <= 0) return { removidos: 0, arquivados: 0 };
  const ids = db
    .prepare(
      "SELECT id FROM catalogo_comercial_fornecedor WHERE fornecedorCodigo = ? AND status = 'RASCUNHO' ORDER BY atualizadoEm ASC LIMIT ?",
    )
    .all(fornecedorCodigo, excesso) as Array<{ id: string }>;
  if (ids.length < excesso) {
    ids.push(
      ...(db
        .prepare(
          "SELECT id FROM catalogo_comercial_fornecedor WHERE fornecedorCodigo = ? AND status = 'ARQUIVADO' ORDER BY atualizadoEm ASC LIMIT ?",
        )
        .all(fornecedorCodigo, excesso - ids.length) as Array<{ id: string }>),
    );
  }
  if (ids.length < excesso)
    throw new Error(
      "O catálogo deste fornecedor atingiu o limite de 200 itens. Itens publicados não são apagados automaticamente.",
    );
  const remover = db.prepare(
    "DELETE FROM catalogo_comercial_fornecedor WHERE id = ? AND fornecedorCodigo = ? AND status IN ('RASCUNHO', 'ARQUIVADO')",
  );
  db.transaction((items: Array<{ id: string }>) =>
    items.forEach(({ id }) => remover.run(id, fornecedorCodigo)),
  )(ids);
  return { removidos: ids.length, arquivados: 0 };
}

export type CatalogoComercialImportInput = Omit<
  CatalogoComercialDB,
  "id" | "fornecedorCodigo" | "criadoEm" | "atualizadoEm" | "publicadoEm" | "status" | "origem"
>;

function ensureCatalogoComercial() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogo_comercial_fornecedor (
      id TEXT PRIMARY KEY, fornecedorCodigo TEXT NOT NULL, codigoFornecedor TEXT,
      descricao TEXT NOT NULL, marca TEXT, categoria TEXT, subcategoria TEXT,
      skuReferencia TEXT, imagemUrl TEXT, fichaTecnica TEXT, variacoesJson TEXT,
      dadosFichaLiderJson TEXT,
      precoSugerido REAL, precoValidadeInicio TEXT, precoValidadeFim TEXT,
      estoqueDisponivel REAL, prazoEntregaDias INTEGER, pedidoMinimo REAL,
      colecao TEXT, estacao TEXT, evento TEXT, status TEXT NOT NULL DEFAULT 'RASCUNHO',
      criadoEm TEXT NOT NULL, atualizadoEm TEXT NOT NULL, publicadoEm TEXT,
      origem TEXT NOT NULL DEFAULT 'FORNECEDOR'
    );
    CREATE INDEX IF NOT EXISTS idx_catalogo_comercial_fornecedor
      ON catalogo_comercial_fornecedor (fornecedorCodigo, status, atualizadoEm);
  `);
  const colunas = db.prepare("PRAGMA table_info(catalogo_comercial_fornecedor)").all() as Array<{
    name: string;
  }>;
  if (!colunas.some((coluna) => coluna.name === "dadosFichaLiderJson")) {
    db.exec("ALTER TABLE catalogo_comercial_fornecedor ADD COLUMN dadosFichaLiderJson TEXT");
  }
}

export const fetchCatalogoComercial = createServerFn({ method: "GET" }).handler(async () => {
  ensureCatalogoComercial();
  const sessao = exigirSessaoFornecedor();
  return db
    .prepare(
      `SELECT * FROM catalogo_comercial_fornecedor
     WHERE fornecedorCodigo = ? AND status <> 'ARQUIVADO'
     ORDER BY atualizadoEm DESC`,
    )
    .all(codigoFornecedorEfetivo(sessao.codigo)) as CatalogoComercialDB[];
});

type CatalogoComercialInput = Omit<
  CatalogoComercialDB,
  "id" | "fornecedorCodigo" | "criadoEm" | "atualizadoEm" | "publicadoEm"
>;

export const salvarCatalogoComercial = createServerFn({ method: "POST" })
  .validator((data: CatalogoComercialInput) => data)
  .handler(async ({ data }) => {
    ensureCatalogoComercial();
    const sessao = exigirSessaoFornecedor();
    const fornecedorCodigo = codigoFornecedorEfetivo(normalizarCodigoFornecedor(sessao.codigo));
    liberarEspacoCatalogo(fornecedorCodigo, 1);
    const agora = new Date().toISOString();
    const id = randomUUID();
    const status = data.status === "PUBLICADO" ? "PUBLICADO" : "RASCUNHO";
    db.prepare(
      `INSERT INTO catalogo_comercial_fornecedor
       (id, fornecedorCodigo, codigoFornecedor, descricao, marca, categoria, subcategoria,
        skuReferencia, imagemUrl, fichaTecnica, variacoesJson, dadosFichaLiderJson, precoSugerido,
        precoValidadeInicio, precoValidadeFim, estoqueDisponivel, prazoEntregaDias,
        pedidoMinimo, colecao, estacao, evento, status, criadoEm, atualizadoEm,
        publicadoEm, origem)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      fornecedorCodigo,
      data.codigoFornecedor || null,
      data.descricao.trim(),
      data.marca || null,
      data.categoria || null,
      data.subcategoria || null,
      data.skuReferencia || null,
      data.imagemUrl || null,
      data.fichaTecnica || null,
      data.variacoesJson || null,
      data.dadosFichaLiderJson || null,
      data.precoSugerido ?? null,
      data.precoValidadeInicio || null,
      data.precoValidadeFim || null,
      data.estoqueDisponivel ?? null,
      data.prazoEntregaDias ?? null,
      data.pedidoMinimo ?? null,
      data.colecao || null,
      data.estacao || null,
      data.evento || null,
      status,
      agora,
      agora,
      status === "PUBLICADO" ? agora : null,
      "FORNECEDOR",
    );
    return db
      .prepare("SELECT * FROM catalogo_comercial_fornecedor WHERE id = ?")
      .get(id) as CatalogoComercialDB;
  });

export const importarCatalogoComercial = createServerFn({ method: "POST" })
  .validator((data: { itens: CatalogoComercialImportInput[] }) => data)
  .handler(async ({ data }) => {
    ensureCatalogoComercial();
    const sessao = exigirSessaoFornecedor();
    const fornecedorCodigo = codigoFornecedorEfetivo(normalizarCodigoFornecedor(sessao.codigo));
    if (!Array.isArray(data.itens) || data.itens.length === 0) {
      throw new Error("A planilha não contém itens válidos para importar.");
    }
    if (data.itens.length > 500) {
      throw new Error("A importação está limitada a 500 itens por arquivo.");
    }
    const limpeza = liberarEspacoCatalogo(fornecedorCodigo, data.itens.length);
    const agora = new Date().toISOString();
    const inserir = db.prepare(
      `INSERT INTO catalogo_comercial_fornecedor
       (id, fornecedorCodigo, codigoFornecedor, descricao, marca, categoria, subcategoria,
        skuReferencia, imagemUrl, fichaTecnica, variacoesJson, dadosFichaLiderJson, precoSugerido,
        precoValidadeInicio, precoValidadeFim, estoqueDisponivel, prazoEntregaDias,
        pedidoMinimo, colecao, estacao, evento, status, criadoEm, atualizadoEm,
        publicadoEm, origem)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const inserirLote = db.transaction((itens: CatalogoComercialImportInput[]) =>
      itens.map((item) => {
        const id = randomUUID();
        inserir.run(
          id,
          fornecedorCodigo,
          item.codigoFornecedor || null,
          item.descricao.trim(),
          item.marca || null,
          item.categoria || null,
          item.subcategoria || null,
          item.skuReferencia || null,
          item.imagemUrl || null,
          item.fichaTecnica || null,
          item.variacoesJson || null,
          item.dadosFichaLiderJson || null,
          item.precoSugerido ?? null,
          item.precoValidadeInicio || null,
          item.precoValidadeFim || null,
          item.estoqueDisponivel ?? null,
          item.prazoEntregaDias ?? null,
          item.pedidoMinimo ?? null,
          item.colecao || null,
          item.estacao || null,
          item.evento || null,
          "RASCUNHO",
          agora,
          agora,
          null,
          "FORNECEDOR_IMPORTACAO",
        );
        return id;
      }),
    );
    return { ...limpeza, importados: inserirLote(data.itens).length };
  });

export const removerPropostaCatalogoPorReferencia = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; referencia: string }) => data)
  .handler(async ({ data }) => {
    ensureCatalogoComercial();
    exigirInterno();
    const fornecedorCodigo = normalizarCodigoFornecedor(data.fornecedorCodigo);
    const referencia = data.referencia.trim();
    if (!fornecedorCodigo || !referencia)
      throw new Error("Fornecedor e referência são obrigatórios.");
    const removidos = db
      .prepare(
        "DELETE FROM catalogo_comercial_fornecedor WHERE fornecedorCodigo = ? AND (LOWER(TRIM(codigoFornecedor)) = LOWER(TRIM(?)) OR LOWER(TRIM(skuReferencia)) = LOWER(TRIM(?))) AND status IN ('RASCUNHO', 'ARQUIVADO')",
      )
      .run(fornecedorCodigo, referencia, referencia).changes;
    const arquivados = db
      .prepare(
        "UPDATE catalogo_comercial_fornecedor SET status = 'ARQUIVADO', atualizadoEm = ? WHERE fornecedorCodigo = ? AND (LOWER(TRIM(codigoFornecedor)) = LOWER(TRIM(?)) OR LOWER(TRIM(skuReferencia)) = LOWER(TRIM(?))) AND status = 'PUBLICADO'",
      )
      .run(new Date().toISOString(), fornecedorCodigo, referencia, referencia).changes;
    return { removidos, arquivados };
  });
