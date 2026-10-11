import { randomUUID } from "crypto";

import type {
  CatalogoComercialDB,
  CatalogoComercialEdicao,
  CatalogoComercialInput,
} from "@/catalogo-api";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";
import { db } from "@/server/db";
import {
  codigoFornecedorEfetivo,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
} from "@/server/sessao-portal";

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

function exigirSessaoCatalogo() {
  const sessao = lerSessaoPortal();
  if (!sessao) throw new Error("Sessão do portal exigida.");
  return sessao;
}

function resolverFornecedorCatalogo(
  options: { fornecedorCodigo?: string },
  sessao: ReturnType<typeof exigirSessaoCatalogo>,
) {
  if (sessao.tipo === "interno") {
    const codigo = resolverCodigoFornecedorDados(
      normalizarCodigoFornecedor(options.fornecedorCodigo),
    );
    if (!codigo) throw new Error("Fornecedor de destino exigido.");
    return codigo;
  }
  return codigoFornecedorEfetivo(normalizarCodigoFornecedor(sessao.codigo));
}

function normalizarIdentificador(valor: unknown) {
  return String(valor ?? "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .replace(/\s+/g, "");
}

function dadosFicha(data: Pick<CatalogoComercialInput, "dadosFichaLiderJson">) {
  if (!data.dadosFichaLiderJson) return {} as Record<string, unknown>;
  try {
    const valor = JSON.parse(data.dadosFichaLiderJson);
    return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function identificadores(
  data: Pick<CatalogoComercialInput, "codigoFornecedor" | "skuReferencia" | "dadosFichaLiderJson">,
) {
  const ficha = dadosFicha(data);
  return [
    ["Código do fornecedor", data.codigoFornecedor],
    ["SKU/referência", data.skuReferencia],
    ["EAN13", ficha.ean13],
    ["DUN14", ficha.dun14],
  ]
    .map(([campo, valor]) => [String(campo), normalizarIdentificador(valor)] as const)
    .filter(([, valor]) => valor.length > 0);
}

export function validarDuplicidadesCatalogo(
  itens: CatalogoComercialInput[],
  options: { fornecedorCodigo?: string; ignorarId?: string } = {},
) {
  ensureCatalogoComercial();
  const sessao = exigirSessaoCatalogo();
  const fornecedorCodigo = resolverFornecedorCatalogo(options, sessao);
  const existentes = db
    .prepare(
      `SELECT id, codigoFornecedor, skuReferencia, dadosFichaLiderJson
       FROM catalogo_comercial_fornecedor
       WHERE fornecedorCodigo = ? AND status <> 'ARQUIVADO' AND id <> ?`,
    )
    .all(fornecedorCodigo, options.ignorarId || "") as Array<{
    id: string;
    codigoFornecedor: string | null;
    skuReferencia: string | null;
    dadosFichaLiderJson: string | null;
  }>;
  const chaves = new Map<string, { campo: string; id: string }>();
  for (const existente of existentes) {
    for (const [campo, valor] of identificadores(existente)) {
      chaves.set(`${campo}:${valor}`, { campo, id: existente.id });
    }
  }
  for (const [indice, item] of itens.entries()) {
    const chavesDoItem = new Set<string>();
    for (const [campo, valor] of identificadores(item)) {
      const chave = `${campo}:${valor}`;
      if (chavesDoItem.has(chave)) continue;
      chavesDoItem.add(chave);
      const conflito = chaves.get(chave);
      if (conflito) {
        throw new Error(
          `Produto duplicado: ${campo} "${valor}" já está no catálogo${
            conflito.id ? ` (registro ${conflito.id.slice(0, 8)})` : ""
          }.`,
        );
      }
      chaves.set(chave, { campo, id: `linha-${indice + 1}` });
    }
  }
  return fornecedorCodigo;
}

function statusPersistido(status: CatalogoComercialInput["status"]) {
  if (status === "ENVIADO_PARA_ANALISE" || status === "PUBLICADO") {
    return "ENVIADO_PARA_ANALISE";
  }
  // Aprovação e rejeição pertencem ao fluxo interno de análise. O fornecedor
  // só pode criar/editar rascunhos ou enviá-los para análise.
  return "RASCUNHO";
}

export async function persistirCatalogoComercial(
  data: CatalogoComercialInput,
  options: { fornecedorCodigo?: string; validarDuplicidade?: boolean } = {},
) {
  ensureCatalogoComercial();
  const sessao = exigirSessaoCatalogo();
  const fornecedorCodigo =
    options.validarDuplicidade === false
      ? resolverFornecedorCatalogo(options, sessao)
      : validarDuplicidadesCatalogo([data], options);
  const agora = new Date().toISOString();
  const id = randomUUID();
  const status = statusPersistido(data.status);
  db.prepare(
    `INSERT INTO catalogo_comercial_fornecedor
     (id, fornecedorCodigo, codigoFornecedor, descricao, marca, categoria, subcategoria,
      skuReferencia, imagemUrl, fichaTecnica, variacoesJson, dadosFichaLiderJson,
      precoSugerido,
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
    status === "ENVIADO_PARA_ANALISE" || status === "APROVADO" ? agora : null,
    "FORNECEDOR",
  );
  return db
    .prepare("SELECT * FROM catalogo_comercial_fornecedor WHERE id = ?")
    .get(id) as CatalogoComercialDB;
}

export async function atualizarCatalogoPersistido(id: string, data: CatalogoComercialEdicao) {
  ensureCatalogoComercial();
  const sessao = exigirSessaoCatalogo();
  const fornecedorCodigo = resolverFornecedorCatalogo({}, sessao);
  const atual = db
    .prepare(
      "SELECT id FROM catalogo_comercial_fornecedor WHERE id = ? AND fornecedorCodigo = ? AND status <> 'ARQUIVADO'",
    )
    .get(id, fornecedorCodigo) as { id?: string } | undefined;
  if (!atual?.id) throw new Error("Produto não encontrado no catálogo deste fornecedor.");
  validarDuplicidadesCatalogo([data], { fornecedorCodigo, ignorarId: id });
  const agora = new Date().toISOString();
  const status = statusPersistido(data.status);
  db.prepare(
    `UPDATE catalogo_comercial_fornecedor SET
      codigoFornecedor = ?, descricao = ?, marca = ?, categoria = ?, subcategoria = ?,
      skuReferencia = ?, imagemUrl = ?, fichaTecnica = ?, variacoesJson = ?,
      dadosFichaLiderJson = ?, precoSugerido = ?, precoValidadeInicio = ?,
      precoValidadeFim = ?, estoqueDisponivel = ?, prazoEntregaDias = ?,
      pedidoMinimo = ?, colecao = ?, estacao = ?, evento = ?, status = ?,
      atualizadoEm = ?, publicadoEm = ?
     WHERE id = ? AND fornecedorCodigo = ?`,
  ).run(
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
    status === "ENVIADO_PARA_ANALISE" || status === "APROVADO" ? agora : null,
    id,
    fornecedorCodigo,
  );
  return db
    .prepare("SELECT * FROM catalogo_comercial_fornecedor WHERE id = ?")
    .get(id) as CatalogoComercialDB;
}

export async function arquivarCatalogoPersistido(id: string) {
  ensureCatalogoComercial();
  const sessao = exigirSessaoCatalogo();
  const fornecedorCodigo = resolverFornecedorCatalogo({}, sessao);
  const agora = new Date().toISOString();
  const resultado = db
    .prepare(
      `UPDATE catalogo_comercial_fornecedor
       SET status = 'ARQUIVADO', atualizadoEm = ?
       WHERE id = ? AND fornecedorCodigo = ? AND status <> 'ARQUIVADO'`,
    )
    .run(agora, id, fornecedorCodigo);
  if (!resultado.changes) throw new Error("Produto não encontrado no catálogo deste fornecedor.");
  return { id, status: "ARQUIVADO" as const };
}
