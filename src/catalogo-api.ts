import { createServerFn } from "@tanstack/react-start";

import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { persistirCatalogoComercial } from "@/server/catalogo-comercial-persist";
import {
  codigoFornecedorEfetivo,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
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

function exigirSessaoCatalogo() {
  const sessao = lerSessaoPortal();
  if (!sessao) throw new Error("Sessão do portal exigida.");
  return sessao;
}

function resolverFornecedorCatalogo(
  codigoSolicitado: string | undefined,
  sessao: ReturnType<typeof exigirSessaoCatalogo>,
) {
  if (sessao.tipo !== "interno") {
    return codigoFornecedorEfetivo(normalizarCodigoFornecedor(sessao.codigo));
  }
  const codigo = resolverCodigoFornecedorDados(normalizarCodigoFornecedor(codigoSolicitado));
  if (!codigo) throw new Error("Fornecedor de destino exigido.");
  const cadastro = db.prepare("SELECT codigo FROM fornecedores WHERE codigo = ?").get(codigo) as
    { codigo?: string } | undefined;
  if (!cadastro?.codigo) throw new Error("Fornecedor de destino não encontrado.");
  return cadastro.codigo;
}

export const fetchCatalogoComercial = createServerFn({ method: "GET" })
  .validator((data: { fornecedorCodigo?: string }) => data)
  .handler(async ({ data }) => {
    ensureCatalogoComercial();
    const sessao = exigirSessaoCatalogo();
    return db
      .prepare(
        `SELECT * FROM catalogo_comercial_fornecedor
     WHERE fornecedorCodigo = ? AND status <> 'ARQUIVADO'
     ORDER BY atualizadoEm DESC`,
      )
      .all(resolverFornecedorCatalogo(data.fornecedorCodigo, sessao)) as CatalogoComercialDB[];
  });

export type CatalogoComercialInput = Omit<
  CatalogoComercialDB,
  "id" | "fornecedorCodigo" | "criadoEm" | "atualizadoEm" | "publicadoEm"
>;

export const salvarCatalogoComercial = createServerFn({ method: "POST" })
  .validator((data: CatalogoComercialInput) => data)
  .handler(async ({ data }) => {
    return persistirCatalogoComercial(data);
  });
