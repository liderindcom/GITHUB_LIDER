import { createServerFn } from "@tanstack/react-start";
import { soDigitos } from "@/lib/fornecedor-codigo";
import { fornecedorAcessoRestrito } from "@/lib/acordo-acesso";
import { USUARIOS_FORNECEDOR_MAX } from "@/lib/usuarios-fornecedor";
import { db } from "../server/db";
import {
  apagarSessaoPortal,
  codigoFornecedorEfetivo,
  exigirSessaoFornecedor,
  gravarSessaoPortal,
  lerSessaoPortal,
  resolverCodigoFornecedorDados,
} from "../server/sessao-portal";
import { exigirLimite } from "./agenda-support";
import { atualizarStatusCarenciaExpirada } from "./access";
import type {
  FornecedorDB,
  UsuarioFornecedorDB,
  UsuarioFornecedorRow,
  UsuarioInternoDB,
} from "./contracts";

function ensureFornecedoresColumns() {
  // Safe migrations run on startup in db.ts
}

function ensureUsuariosFornecedor() {
  try {
    db.exec("ALTER TABLE usuarios_fornecedor ADD COLUMN precisaTrocarSenha INTEGER DEFAULT 0;");
  } catch {
    /* coluna já existe */
  }
}

function flagPrecisaTrocarSenha(row: { precisaTrocarSenha?: number; precisatrocarsenha?: number }) {
  return Number(row.precisaTrocarSenha ?? row.precisatrocarsenha ?? 0) === 1;
}

function vigenciaAcessoOk(row: {
  isentoCobranca?: number | null;
  acessoDataInicio?: string | null;
  acessoDataFim?: string | null;
  acessoStatus?: string | null;
}) {
  return !fornecedorAcessoRestrito(row);
}

function buscarFornecedorPorLogin(ident: string): FornecedorDB | undefined {
  ensureFornecedoresColumns();
  atualizarStatusCarenciaExpirada();
  const codigo = resolverCodigoFornecedorDados(ident);
  const porCodigo = db.prepare("SELECT * FROM fornecedores WHERE codigo = ?").get(codigo) as
    FornecedorDB | undefined;
  if (porCodigo) return porCodigo;
  const cnpj = soDigitos(ident);
  if (cnpj.length < 11) return undefined;
  return db
    .prepare(
      `SELECT * FROM fornecedores
        WHERE cnpjSenhaInicial = ?
           OR replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ?`,
    )
    .get(cnpj, cnpj) as FornecedorDB | undefined;
}

function cnpjDoFornecedor(forn: FornecedorDB): string {
  return soDigitos(forn.cnpjSenhaInicial || forn.cnpj);
}

function senhaCnpjConfere(senha: string, forn: FornecedorDB): boolean {
  const cadastro = cnpjDoFornecedor(forn);
  return cadastro.length >= 11 && soDigitos(senha) === cadastro;
}

function exigirFornecedorLiberado(ident: string): FornecedorDB {
  const forn = buscarFornecedorPorLogin(ident);
  if (!forn) {
    throw new Error("Fornecedor não encontrado. Use o código RMS (ex.: 20922-8) ou o CNPJ.");
  }
  if (forn.acessoLiberado !== 1) {
    throw new Error("Acesso não liberado. Entre em contato com a equipe comercial do Grupo Líder.");
  }
  if (!vigenciaAcessoOk(forn)) {
    throw new Error("Acesso fora do período de vigência contratado.");
  }
  return forn;
}

function emailLoginValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nomeUsuarioDoEmail(email: string, fallback: string): string {
  const local = String(email.split("@")[0] || "")
    .replace(/[._-]+/g, " ")
    .trim();
  if (!local) return fallback.slice(0, 80);
  const titulo = local.replace(/\b\w/g, (c) => c.toUpperCase());
  return titulo.slice(0, 80);
}

export const fetchFornecedor = createServerFn({ method: "GET" })
  .validator((codigo: string) => soDigitos(codigo) || String(codigo ?? "").trim())
  .handler(async ({ data: ident }) => {
    const sessao = lerSessaoPortal();
    if (!sessao) throw new Error("Sessão exigida.");
    const codigoSolicitado = resolverCodigoFornecedorDados(ident);
    if (
      sessao.tipo === "fornecedor" &&
      codigoSolicitado !== resolverCodigoFornecedorDados(sessao.codigo)
    ) {
      throw new Error("Fornecedor não autorizado.");
    }
    return buscarFornecedorPorLogin(codigoSolicitado);
  });
function publicUsuarioFornecedor(row: UsuarioFornecedorRow): UsuarioFornecedorDB {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    ativo: Number(row.ativo ?? 0),
    criadoEm: row.criadoEm,
  };
}

export const fetchUsuariosFornecedor = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => soDigitos(fornecedorCodigo))
  .handler(async ({ data: codigoPedido }) => {
    const codigo = codigoFornecedorEfetivo(codigoPedido);
    ensureUsuariosFornecedor();
    const rows = db
      .prepare(
        `SELECT id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm
         FROM usuarios_fornecedor
         WHERE fornecedorCodigo = ?
         ORDER BY criadoEm ASC, email ASC`,
      )
      .all(codigo) as UsuarioFornecedorRow[];
    return rows.map(publicUsuarioFornecedor);
  });

export const salvarUsuarioFornecedor = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fornecedorCodigo: string;
      id?: string;
      nome: string;
      email: string;
      senha?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { normalizarEmail, hashSenhaFornecedor, novoIdUsuarioFornecedor } =
      await import("../server/usuarios-fornecedor");
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    const nome = String(data.nome ?? "").trim();
    const email = normalizarEmail(data.email);
    const senha = String(data.senha ?? "");
    const idExistente = String(data.id ?? "").trim();
    if (!nome) throw new Error("Informe o nome do usuário.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Informe um e-mail válido.");
    }
    ensureUsuariosFornecedor();

    const duplicado = db
      .prepare(
        `SELECT id FROM usuarios_fornecedor WHERE fornecedorCodigo = ? AND email = ? AND id <> ?`,
      )
      .get(codigo, email, idExistente || "-") as { id: string } | undefined;
    if (duplicado) throw new Error("Este e-mail já está cadastrado neste fornecedor.");

    if (idExistente) {
      const atual = db
        .prepare(
          `SELECT id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm
           FROM usuarios_fornecedor WHERE id = ? AND fornecedorCodigo = ?`,
        )
        .get(idExistente, codigo) as UsuarioFornecedorRow | undefined;
      if (!atual) throw new Error("Usuário não encontrado.");
      const senhaHash = senha
        ? (() => {
            if (senha.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres.");
            return hashSenhaFornecedor(senha);
          })()
        : atual.senhaHash;
      if (senha) {
        db.prepare(
          `UPDATE usuarios_fornecedor SET nome = ?, email = ?, senhaHash = ?, precisaTrocarSenha = 0
           WHERE id = ? AND fornecedorCodigo = ?`,
        ).run(nome, email, senhaHash, idExistente, codigo);
      } else {
        db.prepare(
          `UPDATE usuarios_fornecedor SET nome = ?, email = ? WHERE id = ? AND fornecedorCodigo = ?`,
        ).run(nome, email, idExistente, codigo);
      }
      return publicUsuarioFornecedor({ ...atual, nome, email, senhaHash });
    }

    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM usuarios_fornecedor WHERE fornecedorCodigo = ?`)
      .get(codigo) as { total: number } | undefined;
    if (Number(total?.total ?? 0) >= USUARIOS_FORNECEDOR_MAX) {
      throw new Error(`Limite de ${USUARIOS_FORNECEDOR_MAX} usuários por fornecedor.`);
    }
    if (senha.length < 8) throw new Error("A senha precisa ter no mínimo 8 caracteres.");
    const id = novoIdUsuarioFornecedor();
    const criadoEm = new Date().toISOString();
    const senhaHash = hashSenhaFornecedor(senha);
    db.prepare(
      `INSERT INTO usuarios_fornecedor (id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).run(id, codigo, nome, email, senhaHash, criadoEm);
    return publicUsuarioFornecedor({
      id,
      fornecedorCodigo: codigo,
      nome,
      email,
      senhaHash,
      ativo: 1,
      criadoEm,
    });
  });

export const excluirUsuarioFornecedor = createServerFn({ method: "POST" })
  .validator((data: { fornecedorCodigo: string; id: string }) => data)
  .handler(async ({ data }) => {
    const codigo = codigoFornecedorEfetivo(data.fornecedorCodigo);
    ensureUsuariosFornecedor();
    db.prepare(`DELETE FROM usuarios_fornecedor WHERE id = ? AND fornecedorCodigo = ?`).run(
      data.id,
      codigo,
    );
    return { success: true };
  });

export const loginUsuarioFornecedor = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; email: string; senha: string }) => ({
    codigo: String(data.codigo ?? "").trim(),
    email: String(data.email ?? "")
      .trim()
      .toLowerCase(),
    senha: String(data.senha ?? ""),
  }))
  .handler(async ({ data }) => {
    exigirLimite("login-fornecedor", 10, 15 * 60_000);
    const { senhaFornecedorConfere } = await import("../server/usuarios-fornecedor");
    const { email, senha } = data;
    const forn = buscarFornecedorPorLogin(data.codigo);
    if (!forn || forn.acessoLiberado !== 1 || fornecedorAcessoRestrito(forn)) return null;
    ensureUsuariosFornecedor();
    const row = db
      .prepare(
        `SELECT id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm, precisaTrocarSenha
         FROM usuarios_fornecedor
         WHERE fornecedorCodigo = ? AND email = ?`,
      )
      .get(forn.codigo, email) as UsuarioFornecedorRow | undefined;
    if (!row || Number(row.ativo) !== 1) return null;
    const senhaOk =
      senhaFornecedorConfere(senha, row.senhaHash) ||
      (() => {
        const digits = soDigitos(senha);
        return Boolean(digits) && digits !== senha && senhaFornecedorConfere(digits, row.senhaHash);
      })();
    if (!senhaOk) return null;
    const usouSenhaInicial = senhaCnpjConfere(senha, forn);
    if (usouSenhaInicial && !flagPrecisaTrocarSenha(row)) {
      db.prepare(`UPDATE usuarios_fornecedor SET precisaTrocarSenha = 1 WHERE id = ?`).run(row.id);
    }
    gravarSessaoPortal("fornecedor", forn.codigo, email);
    return {
      codigo: forn.codigo,
      nome: row.nome,
      email: row.email,
      precisaTrocarSenha: usouSenhaInicial || flagPrecisaTrocarSenha(row),
    };
  });

export const primeiroAcessoFornecedor = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; email: string; senha: string }) => ({
    codigo: String(data.codigo ?? "").trim(),
    email: String(data.email ?? "")
      .trim()
      .toLowerCase(),
    senha: String(data.senha ?? ""),
  }))
  .handler(async ({ data }) => {
    exigirLimite("primeiro-acesso-fornecedor", 5, 15 * 60_000);
    const { normalizarEmail, hashSenhaFornecedor, novoIdUsuarioFornecedor } =
      await import("../server/usuarios-fornecedor");
    const email = normalizarEmail(data.email);
    if (!emailLoginValido(email)) {
      throw new Error("Informe um e-mail válido. O e-mail é o login da sua conta.");
    }
    const forn = exigirFornecedorLiberado(data.codigo);
    ensureUsuariosFornecedor();
    const existente = db
      .prepare(`SELECT id FROM usuarios_fornecedor WHERE fornecedorCodigo = ? AND email = ?`)
      .get(forn.codigo, email) as { id: string } | undefined;
    if (existente) {
      throw new Error("EMAIL_JA_CADASTRADO");
    }
    if (!senhaCnpjConfere(data.senha, forn)) {
      const digitouOCodigo =
        soDigitos(data.senha) === soDigitos(data.codigo) ||
        soDigitos(data.senha) === soDigitos(forn.codigo);
      if (digitouOCodigo) {
        throw new Error(
          `A senha não é o código ${forn.codigo}. No primeiro acesso use o CNPJ ${forn.cnpj} (14 números, com ou sem pontuação).`,
        );
      }
      throw new Error(
        `No primeiro acesso a senha é o CNPJ ${forn.cnpj}. Você digitou ${soDigitos(data.senha).length} número(s); o CNPJ tem ${cnpjDoFornecedor(forn).length}.`,
      );
    }

    const total = db
      .prepare(`SELECT COUNT(*) AS total FROM usuarios_fornecedor WHERE fornecedorCodigo = ?`)
      .get(forn.codigo) as { total: number } | undefined;
    if (Number(total?.total ?? 0) >= USUARIOS_FORNECEDOR_MAX) {
      throw new Error(
        `Limite de ${USUARIOS_FORNECEDOR_MAX} usuários neste fornecedor. Peça a alguém já cadastrado para incluir você.`,
      );
    }

    const id = novoIdUsuarioFornecedor();
    const criadoEm = new Date().toISOString();
    const senhaHash = hashSenhaFornecedor(cnpjDoFornecedor(forn));
    const jaTemUsuario = Number(total?.total ?? 0) > 0;
    const nome = jaTemUsuario ? nomeUsuarioDoEmail(email, forn.nome) : forn.nome;
    db.prepare(
      `INSERT INTO usuarios_fornecedor
        (id, fornecedorCodigo, nome, email, senhaHash, ativo, criadoEm, precisaTrocarSenha)
       VALUES (?, ?, ?, ?, ?, 1, ?, 1)`,
    ).run(id, forn.codigo, nome, email, senhaHash, criadoEm);
    gravarSessaoPortal("fornecedor", forn.codigo, email);
    return { codigo: forn.codigo, nome, email, precisaTrocarSenha: true };
  });

export const fetchMinhaContaFornecedor = createServerFn({
  method: "GET",
}).handler(async () => {
  const sessao = lerSessaoPortal();
  if (!sessao || sessao.tipo !== "fornecedor" || !sessao.usuarioEmail) return null;
  ensureUsuariosFornecedor();
  const row = db
    .prepare(
      `SELECT id, nome, email, precisaTrocarSenha FROM usuarios_fornecedor
       WHERE fornecedorCodigo = ? AND email = ?`,
    )
    .get(sessao.codigo, sessao.usuarioEmail) as
    | {
        id: string;
        nome: string;
        email: string;
        precisaTrocarSenha?: number;
        precisatrocarsenha?: number;
      }
    | undefined;
  if (!row) return null;
  return {
    codigo: sessao.codigo,
    nome: row.nome,
    email: row.email,
    precisaTrocarSenha: flagPrecisaTrocarSenha(row),
  };
});

export const alterarMinhaSenhaFornecedor = createServerFn({ method: "POST" })
  .validator((data: { novaSenha: string; senhaAtual?: string }) => ({
    novaSenha: String(data.novaSenha ?? ""),
    senhaAtual: String(data.senhaAtual ?? ""),
  }))
  .handler(async ({ data }) => {
    const { senhaFornecedorConfere, hashSenhaFornecedor } =
      await import("../server/usuarios-fornecedor");
    const sessao = exigirSessaoFornecedor();
    if (data.novaSenha.length < 8) {
      throw new Error("A nova senha precisa ter no mínimo 8 caracteres.");
    }
    ensureUsuariosFornecedor();
    const row = db
      .prepare(
        `SELECT id, senhaHash, precisaTrocarSenha FROM usuarios_fornecedor
         WHERE fornecedorCodigo = ? AND email = ?`,
      )
      .get(sessao.codigo, sessao.email) as
      | {
          id: string;
          senhaHash: string;
          precisaTrocarSenha?: number;
          precisatrocarsenha?: number;
        }
      | undefined;
    if (!row) throw new Error("Usuário não encontrado. Entre de novo.");
    const precisa = flagPrecisaTrocarSenha(row);
    if (!precisa) {
      if (!data.senhaAtual) throw new Error("Informe a senha atual.");
      const atualOk =
        senhaFornecedorConfere(data.senhaAtual, row.senhaHash) ||
        (() => {
          const digits = soDigitos(data.senhaAtual);
          return (
            Boolean(digits) &&
            digits !== data.senhaAtual &&
            senhaFornecedorConfere(digits, row.senhaHash)
          );
        })();
      if (!atualOk) throw new Error("A senha atual não confere.");
    }
    const forn = db
      .prepare("SELECT codigo, cnpj, cnpjSenhaInicial FROM fornecedores WHERE codigo = ?")
      .get(sessao.codigo) as FornecedorDB | undefined;
    if (forn && senhaCnpjConfere(data.novaSenha, forn)) {
      throw new Error("Não use o CNPJ como senha definitiva. Escolha uma senha sua.");
    }
    const senhaHash = hashSenhaFornecedor(data.novaSenha);
    db.prepare(
      `UPDATE usuarios_fornecedor SET senhaHash = ?, precisaTrocarSenha = 0 WHERE id = ?`,
    ).run(senhaHash, row.id);
    return { ok: true as const, precisaTrocarSenha: false };
  });

export const loginUsuarioInterno = createServerFn({ method: "POST" })
  .validator((data: { username: string; senha: string }) => data)
  .handler(async ({ data }) => {
    exigirLimite("login-interno", 5, 5 * 60_000);
    const { ensureUsuariosInternos, senhaInternaConfere } =
      await import("../server/usuarios-interno");
    ensureUsuariosInternos();
    const username = String(data.username ?? "")
      .trim()
      .toLowerCase();
    const senha = String(data.senha ?? "");
    const stmt = db.prepare(
      "SELECT username, nome, role, senhaHash FROM usuarios_internos WHERE lower(username) = ?",
    );
    const user = stmt.get(username) as UsuarioInternoDB | undefined;
    if (!user || !user.senhaHash || !senhaInternaConfere(senha, user.senhaHash)) return undefined;
    const { senhaHash: _senhaHash, ...publicUser } = user;
    gravarSessaoPortal("interno", publicUser.username);
    return publicUser;
  });

export const iniciarSessaoFornecedor = createServerFn({ method: "POST" })
  .validator((data: { codigo: string }) => ({
    codigo: String(data.codigo ?? "").trim(),
  }))
  .handler(async () => {
    throw new Error("Login descontinuado. Use e-mail e senha.");
  });

export const encerrarSessaoPortal = createServerFn({ method: "POST" }).handler(async () => {
  apagarSessaoPortal();
  return { ok: true };
});

/** Valida a sessão atual; não reemite sessão com dados vindos do navegador. */
export const restaurarSessaoPortal = createServerFn({ method: "POST" })
  .validator((data: { tipo: "interno" | "fornecedor"; codigo: string }) => ({
    tipo: data.tipo,
    codigo: String(data.codigo ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    exigirLimite("restaurar-sessao", 20, 15 * 60_000);
    const sessaoAtual = lerSessaoPortal();
    if (sessaoAtual && sessaoAtual.tipo === data.tipo) {
      const codigoEfetivo =
        data.tipo === "interno" ? data.codigo : resolverCodigoFornecedorDados(data.codigo);
      if (sessaoAtual.codigo === codigoEfetivo) {
        return { ok: true, tipo: data.tipo, codigo: sessaoAtual.codigo };
      }
    }

    throw new Error("Sessão inválida ou expirada. Entre novamente com suas credenciais.");
  });
export { USUARIOS_FORNECEDOR_MAX };
