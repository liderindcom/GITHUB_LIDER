import { randomUUID } from "crypto";

import type { CatalogoComercialDB, CatalogoComercialInput } from "@/catalogo-api";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { db } from "@/server/db";
import { codigoFornecedorEfetivo, lerSessaoPortal } from "@/server/sessao-portal";

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

function exigirSessaoCatalogo() {
  const sessao = lerSessaoPortal();
  if (!sessao) throw new Error("Sessão do portal exigida.");
  return sessao;
}

export async function persistirCatalogoComercial(
  data: CatalogoComercialInput,
  options: { fornecedorCodigo?: string } = {},
) {
  ensureCatalogoComercial();
  const sessao = exigirSessaoCatalogo();
  const fornecedorCodigo = options.fornecedorCodigo
    ? normalizarCodigoFornecedor(options.fornecedorCodigo)
    : codigoFornecedorEfetivo(normalizarCodigoFornecedor(sessao.codigo));
  if (!fornecedorCodigo) throw new Error("Fornecedor de destino exigido.");
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
}
