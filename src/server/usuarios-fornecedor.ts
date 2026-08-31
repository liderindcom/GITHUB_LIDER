import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { USUARIOS_FORNECEDOR_MAX } from "@/lib/usuarios-fornecedor";
import { db } from "./db";

export { USUARIOS_FORNECEDOR_MAX };

export type UsuarioFornecedorRow = {
  id: string;
  fornecedorCodigo: string;
  nome: string;
  email: string;
  senhaHash: string;
  ativo: number;
  criadoEm: string;
  precisaTrocarSenha?: number;
};

export function ensureUsuariosFornecedor() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios_fornecedor (
      id TEXT PRIMARY KEY,
      fornecedorCodigo TEXT NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      senhaHash TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criadoEm TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_forn_email
      ON usuarios_fornecedor (fornecedorCodigo, email);
  `);
  try {
    db.exec("ALTER TABLE usuarios_fornecedor ADD COLUMN precisaTrocarSenha INTEGER DEFAULT 0;");
  } catch {
    /* coluna já existe */
  }
}

export function normalizarEmail(email: string) {
  return String(email ?? "").trim().toLowerCase();
}

export function hashSenhaFornecedor(senha: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function senhaFornecedorConfere(senha: string, armazenada: string) {
  const partes = String(armazenada ?? "").split(":");
  const salt = partes[0];
  const hash = partes[1];
  if (!salt || !hash || hash.length !== 64) return false;
  try {
    const teste = scryptSync(senha, salt, 32);
    return timingSafeEqual(Buffer.from(hash, "hex"), teste);
  } catch {
    return false;
  }
}

export function novoIdUsuarioFornecedor() {
  return randomBytes(8).toString("hex");
}
