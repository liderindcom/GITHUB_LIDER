import { randomBytes } from "crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

import { db } from "./db";
import { normalizarCodigoFornecedor } from "@/lib/fornecedor-codigo";

const COOKIE = "portal_sessao";
const TTL_HORAS = 12;

type SessaoRow = {
  token: string;
  tipo: "interno" | "fornecedor";
  codigo: string;
  expiraEm: string;
  usuarioEmail?: string | null;
};

function ensureSessoes() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessoes_portal (
      token TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      codigo TEXT NOT NULL,
      expiraEm TEXT NOT NULL
    );
  `);
  try {
    db.exec("ALTER TABLE sessoes_portal ADD COLUMN usuarioEmail TEXT;");
  } catch (e) {
    // Coluna já existe ou erro ignorável
  }
}

export function gravarSessaoPortal(
  tipo: "interno" | "fornecedor",
  codigo: string,
  usuarioEmail?: string,
): string {
  ensureSessoes();

  // 1. Limpar sessões expiradas
  db.prepare("DELETE FROM sessoes_portal WHERE expiraEm < ?").run(new Date().toISOString());

  // 2. Prevenir múltiplos logins simultâneos (Destruir sessões anteriores do mesmo usuário)
  if (tipo === "interno") {
    db.prepare("DELETE FROM sessoes_portal WHERE tipo = 'interno' AND codigo = ?").run(codigo);
  } else if (tipo === "fornecedor") {
    if (usuarioEmail) {
      db.prepare(
        "DELETE FROM sessoes_portal WHERE tipo = 'fornecedor' AND codigo = ? AND usuarioEmail = ?",
      ).run(codigo, usuarioEmail);
    } else {
      db.prepare(
        "DELETE FROM sessoes_portal WHERE tipo = 'fornecedor' AND codigo = ? AND (usuarioEmail IS NULL OR usuarioEmail = '')",
      ).run(codigo);
    }
  }

  const token = randomBytes(24).toString("hex");
  const expira = new Date(Date.now() + TTL_HORAS * 3600 * 1000).toISOString();
  db.prepare(
    "INSERT INTO sessoes_portal (token, tipo, codigo, expiraEm, usuarioEmail) VALUES (?,?,?,?,?)",
  ).run(token, tipo, codigo, expira, usuarioEmail || null);
  setCookie(COOKIE, token, {
    httpOnly: true,
    path: "/",
    maxAge: TTL_HORAS * 3600,
    sameSite: "lax",
  });
  return token;
}

export function lerSessaoPortal(): {
  tipo: "interno" | "fornecedor";
  codigo: string;
  usuarioEmail?: string;
} | null {
  ensureSessoes();
  const token = getCookie(COOKIE);
  if (!token) return null;
  const row = db
    .prepare("SELECT token, tipo, codigo, expiraEm, usuarioEmail FROM sessoes_portal WHERE token = ?")
    .get(token) as SessaoRow | undefined;
  if (!row) return null;
  if (row.expiraEm < new Date().toISOString()) {
    db.prepare("DELETE FROM sessoes_portal WHERE token = ?").run(token);
    deleteCookie(COOKIE, { path: "/" });
    return null;
  }
  return {
    tipo: row.tipo,
    codigo: row.codigo,
    ...(row.usuarioEmail ? { usuarioEmail: row.usuarioEmail } : {}),
  };
}

export function apagarSessaoPortal() {
  ensureSessoes();
  const token = getCookie(COOKIE);
  if (token) db.prepare("DELETE FROM sessoes_portal WHERE token = ?").run(token);
  deleteCookie(COOKIE, { path: "/" });
}

type FornecedorCodigoRow = { codigo: string; nome: string | null; cnpj: string | null };

function cadastroFornecedor(codigo: string): FornecedorCodigoRow | undefined {
  return db
    .prepare("SELECT codigo, nome, cnpj FROM fornecedores WHERE codigo = ?")
    .get(codigo) as FornecedorCodigoRow | undefined;
}

function cadastroEhStub(row: FornecedorCodigoRow) {
  const nome = String(row.nome ?? "").trim();
  const cnpj = String(row.cnpj ?? "").trim();
  return !cnpj || /^fornecedor\s/i.test(nome);
}

/** Se digitarem o código com dígito (100561-8 / 1005618), usa o código RMS sem o DV (100561). */
export function resolverCodigoFornecedorDados(code: string): string {
  const n = normalizarCodigoFornecedor(code);
  if (!/^\d{5,}$/.test(n)) return n;
  const exato = cadastroFornecedor(n);
  const base = n.slice(0, -1);
  const pai = /^\d{4,}$/.test(base) ? cadastroFornecedor(base) : undefined;
  if (pai && (!exato || cadastroEhStub(exato))) return pai.codigo;
  if (exato) return exato.codigo;
  return n;
}

/** Fornecedor autenticado só vê o próprio código. Interno (lider) pode trocar. Sem cookie, mantém o pedido (compat). */
export function codigoFornecedorEfetivo(pedido: string): string {
  const pedidoNorm = resolverCodigoFornecedorDados(pedido);
  const sessao = lerSessaoPortal();
  if (!sessao) return pedidoNorm;
  if (sessao.tipo === "interno") return pedidoNorm;
  return resolverCodigoFornecedorDados(sessao.codigo);
}

export function exigirInterno() {
  const sessao = lerSessaoPortal();
  if (!sessao || sessao.tipo !== "interno") {
    throw new Error("Acesso administrativo exigido.");
  }
}

export function exigirSessaoFornecedor() {
  const sessao = lerSessaoPortal();
  if (!sessao || sessao.tipo !== "fornecedor") {
    throw new Error("Sessão do fornecedor exigida.");
  }
  const email = String(sessao.usuarioEmail ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Sessão sem e-mail. Entre de novo com código, e-mail e senha.");
  }
  return { codigo: sessao.codigo, email };
}
