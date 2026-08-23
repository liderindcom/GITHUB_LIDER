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
}

export function gravarSessaoPortal(tipo: "interno" | "fornecedor", codigo: string): string {
  ensureSessoes();
  const token = randomBytes(24).toString("hex");
  const expira = new Date(Date.now() + TTL_HORAS * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO sessoes_portal (token, tipo, codigo, expiraEm) VALUES (?,?,?,?)").run(
    token,
    tipo,
    codigo,
    expira,
  );
  setCookie(COOKIE, token, {
    httpOnly: true,
    path: "/",
    maxAge: TTL_HORAS * 3600,
    sameSite: "lax",
  });
  return token;
}

export function lerSessaoPortal(): { tipo: "interno" | "fornecedor"; codigo: string } | null {
  ensureSessoes();
  const token = getCookie(COOKIE);
  if (!token) return null;
  const row = db
    .prepare("SELECT token, tipo, codigo, expiraEm FROM sessoes_portal WHERE token = ?")
    .get(token) as SessaoRow | undefined;
  if (!row) return null;
  if (row.expiraEm < new Date().toISOString()) {
    db.prepare("DELETE FROM sessoes_portal WHERE token = ?").run(token);
    deleteCookie(COOKIE, { path: "/" });
    return null;
  }
  return { tipo: row.tipo, codigo: row.codigo };
}

export function apagarSessaoPortal() {
  ensureSessoes();
  const token = getCookie(COOKIE);
  if (token) db.prepare("DELETE FROM sessoes_portal WHERE token = ?").run(token);
  deleteCookie(COOKIE, { path: "/" });
}

/** Fornecedor autenticado só vê o próprio código. Interno (lider) pode trocar. Sem cookie, mantém o pedido (compat). */
export function codigoFornecedorEfetivo(pedido: string): string {
  const pedidoNorm = normalizarCodigoFornecedor(pedido);
  const sessao = lerSessaoPortal();
  if (!sessao) return pedidoNorm;
  if (sessao.tipo === "interno") return pedidoNorm;
  return normalizarCodigoFornecedor(sessao.codigo);
}
