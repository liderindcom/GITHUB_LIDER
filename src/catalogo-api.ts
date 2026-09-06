import { randomUUID } from "crypto";
import { createServerFn } from "@tanstack/react-start";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { codigoFornecedorEfetivo, exigirSessaoFornecedor } from "@/server/sessao-portal";
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

function ensureCatalogoComercial() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogo_comercial_fornecedor (
      id TEXT PRIMARY KEY, fornecedorCodigo TEXT NOT NULL, codigoFornecedor TEXT,
      descricao TEXT NOT NULL, marca TEXT, categoria TEXT, subcategoria TEXT,
      skuReferencia TEXT, imagemUrl TEXT, fichaTecnica TEXT, variacoesJson TEXT,
      precoSugerido REAL, precoValidadeInicio TEXT, precoValidadeFim TEXT,
      estoqueDisponivel REAL, prazoEntregaDias INTEGER, pedidoMinimo REAL,
      colecao TEXT, estacao TEXT, evento TEXT, status TEXT NOT NULL DEFAULT 'RASCUNHO',
      criadoEm TEXT NOT NULL, atualizadoEm TEXT NOT NULL, publicadoEm TEXT,
      origem TEXT NOT NULL DEFAULT 'FORNECEDOR'
    );
    CREATE INDEX IF NOT EXISTS idx_catalogo_comercial_fornecedor
      ON catalogo_comercial_fornecedor (fornecedorCodigo, status, atualizadoEm);
  `);
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
    const agora = new Date().toISOString();
    const id = randomUUID();
    const status = data.status === "PUBLICADO" ? "PUBLICADO" : "RASCUNHO";
    db.prepare(
      `INSERT INTO catalogo_comercial_fornecedor
       (id, fornecedorCodigo, codigoFornecedor, descricao, marca, categoria, subcategoria,
        skuReferencia, imagemUrl, fichaTecnica, variacoesJson, precoSugerido,
        precoValidadeInicio, precoValidadeFim, estoqueDisponivel, prazoEntregaDias,
        pedidoMinimo, colecao, estacao, evento, status, criadoEm, atualizadoEm,
        publicadoEm, origem)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
