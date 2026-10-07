import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { db } from "./db";

let ensured = false;

function hashSenhaInterna(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function senhaInternaConfere(senha: string, armazenada: string): boolean {
  const [salt, hash] = String(armazenada ?? "").split(":");
  if (!salt || !hash || hash.length !== 64) return false;
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(senha, salt, 32));
  } catch {
    return false;
  }
}

/** Adiciona o hash e converte registros legados sem manter senha em claro. */
export function ensureUsuariosInternos() {
  if (ensured) return;
  try {
    db.exec("ALTER TABLE usuarios_internos ADD COLUMN senhaHash TEXT;");
  } catch {
    // A coluna já existe.
  }
  const legados = db
    .prepare(
      "SELECT username, senha FROM usuarios_internos WHERE COALESCE(senhaHash, '') = '' AND COALESCE(senha, '') <> ''",
    )
    .all() as Array<{ username: string; senha: string }>;
  const atualizar = db.prepare("UPDATE usuarios_internos SET senhaHash = ?, senha = '' WHERE username = ?");
  const migrar = db.transaction((rows: Array<{ username: string; senha: string }>) => {
    for (const row of rows) atualizar.run(hashSenhaInterna(row.senha), row.username);
  });
  migrar(legados);
  ensured = true;
}

export function criarHashSenhaInterna(senha: string): string {
  return hashSenhaInterna(senha);
}
