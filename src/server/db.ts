import { createRequire } from "module";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { Worker } from "worker_threads";

const nodeRequire = createRequire(join(process.cwd(), "package.json"));

type RunResult = { changes: number; lastInsertRowid: number | bigint };

type Statement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => RunResult;
};

type TxStep = { sql: string; params: unknown[] };

function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = readEnvFile(join(process.cwd(), ".env.postgres"));
  return file.DATABASE_URL || "";
}

function usePostgres(): boolean {
  const engine = (process.env.PORTAL_DB_ENGINE || "").toLowerCase();
  if (engine === "sqlite") return false;
  if (engine === "postgres" || engine === "postgresql") return true;
  return /^postgres(ql)?:\/\//i.test(resolveDatabaseUrl());
}

class PgBridge {
  private worker: Worker;
  private seq = 0;
  inTx = false;
  txQueue: TxStep[] = [];

  constructor(connectionString: string) {
    const casePath = join(process.cwd(), "db", "pg-column-case.json");
    let caseMap: Record<string, string> = {};
    if (existsSync(casePath)) {
      caseMap = JSON.parse(readFileSync(casePath, "utf8")) as Record<string, string>;
    }
    const root = process.cwd();
    this.worker = new Worker(join(root, "scripts", "pg-sync-worker.mjs"), {
      workerData: { connectionString, caseMap },
      env: { ...process.env, NODE_PATH: join(root, "node_modules") },
    });
    this.worker.on("error", (err) => {
      console.error("pg-sync-worker", err);
    });
  }

  rpc(
    mode: string,
    sql: string,
    params: unknown[] | TxStep[] = [],
  ): {
    rows: unknown[];
    rowCount: number;
    lastInsertRowid: number;
    results?: { rows: unknown[]; rowCount: number }[];
  } {
    this.seq += 1;
    const replyPath = `/tmp/portal-pg-${process.pid}-${this.seq}.json`;
    const lockSab = new SharedArrayBuffer(4);
    const lock = new Int32Array(lockSab);
    Atomics.store(lock, 0, 0);
    this.worker.postMessage({ mode, sql, params, replyPath, lockSab });
    const waited = Atomics.wait(lock, 0, 0, 180_000);
    if (waited === "timed-out") {
      throw new Error(`PostgreSQL timeout (${mode})`);
    }
    const raw = readFileSync(replyPath, "utf8");
    try {
      unlinkSync(replyPath);
    } catch {
      /* ignore */
    }
    const payload = JSON.parse(raw) as {
      ok: boolean;
      error?: string;
      rows?: unknown[];
      rowCount?: number;
      lastInsertRowid?: number;
      results?: { rows: unknown[]; rowCount: number }[];
    };
    if (!payload.ok) throw new Error(payload.error || "PostgreSQL error");
    return {
      rows: payload.rows || [],
      rowCount: payload.rowCount || 0,
      lastInsertRowid: payload.lastInsertRowid || 0,
      results: payload.results,
    };
  }
}

function createPgDatabase(connectionString: string) {
  const bridge = new PgBridge(connectionString);
  const db = {
    prepare(sql: string): Statement {
      return {
        get(...params: unknown[]) {
          const res = bridge.rpc("run", sql, params);
          return res.rows[0];
        },
        all(...params: unknown[]) {
          const res = bridge.rpc("run", sql, params);
          return res.rows;
        },
        run(...params: unknown[]) {
          if (bridge.inTx) {
            bridge.txQueue.push({ sql, params });
            return { changes: 1, lastInsertRowid: 0 };
          }
          const res = bridge.rpc("run", sql, params);
          return {
            changes: res.rowCount,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
      };
    },
    exec(sql: string) {
      bridge.rpc("exec", sql, []);
    },
    transaction<T extends unknown[], R>(fn: (...args: T) => R) {
      return (...args: T): R => {
        bridge.inTx = true;
        bridge.txQueue = [];
        try {
          const out = fn(...args);
          if (bridge.txQueue.length) bridge.rpc("tx", "", bridge.txQueue);
          return out;
        } finally {
          bridge.inTx = false;
          bridge.txQueue = [];
        }
      };
    },
  };
  writeFileSync("/tmp/portal-db-engine.txt", "postgres\n");
  return db;
}

function createSqliteDatabase() {
  const Database = nodeRequire("better-sqlite3");
  const dbPath = join(process.cwd(), "db", "portal.db");
  writeFileSync("/tmp/portal-db-engine.txt", `sqlite ${dbPath}\n`);
  return new Database(dbPath);
}

export const db = usePostgres() ? createPgDatabase(resolveDatabaseUrl()) : createSqliteDatabase();

// Preferência operacional da agenda: fornecedores podem solicitar o modo
// mensal, mas a publicação só o aplica depois da aprovação administrativa.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS portalPromotorCalculoPreferencias (
      fornecedorCodigo TEXT PRIMARY KEY,
      periodicidade TEXT NOT NULL DEFAULT 'DIARIO',
      periodicidadeAtiva TEXT NOT NULL DEFAULT 'DIARIO',
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      observacao TEXT,
      solicitadoPor TEXT,
      solicitadoEm TEXT NOT NULL,
      aprovadoPor TEXT,
      aprovadoEm TEXT,
      atualizadoEm TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_portalPromotorCalculoPreferencias_status
      ON portalPromotorCalculoPreferencias (status, periodicidade);
  `);
  try {
    db.exec(
      "ALTER TABLE portalPromotorCalculoPreferencias ADD COLUMN periodicidadeAtiva TEXT NOT NULL DEFAULT 'DIARIO'",
    );
  } catch (error) {
    void error;
  }
  try {
    db.prepare(
      "UPDATE portalPromotorCalculoPreferencias SET periodicidadeAtiva = periodicidade WHERE status = 'APROVADA'",
    ).run();
  } catch (error) {
    void error;
  }
} catch (error) {
  console.error("portalPromotorCalculoPreferencias migration", error);
}

// Auto-run migrations on startup (safe schema setup)
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN isentoCobranca INTEGER DEFAULT 0;");
} catch (e) {
  void e;
}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN acessoDataInicio TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN acessoDataFim TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN acessoStatus TEXT DEFAULT 'SEM_ACORDO';");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN acordoNumero TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN degustacaoUsada INTEGER DEFAULT 0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN taxaAcessoPct REAL DEFAULT 1;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN carenciaDias INTEGER;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN carenciaAte TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN primeiraCompetenciaCobravel TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN primeiraCobrancaEm TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN contratoAssinadoEm TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN contratoDocumentoRef TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN contratoValidadoEm TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN contratoValidadoPor TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN ultimoAcordoMes TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE perdas ADD COLUMN numeroNota TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE perdas ADD COLUMN serie TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE estoque ADD COLUMN dataEstoque TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE estoque ADD COLUMN dataInventario TEXT;");
} catch (e) {}
try {
  // Agenda financeira preservada para distinguir créditos RMS de outros
  // lançamentos que também chegam à tabela de contas a receber.
  db.exec("ALTER TABLE contas_receber ADD COLUMN agendaRms TEXT;");
} catch (e) {
  void e;
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS produto_fornecedor_relacoes (
      sku TEXT NOT NULL,
      fornecedorFiscalCodigo TEXT NOT NULL,
      fornecedorRelacionadoCodigo TEXT NOT NULL,
      tipoRelacao TEXT NOT NULL,
      validadeInicio TEXT NOT NULL,
      validadeFim TEXT,
      fonte TEXT NOT NULL,
      aprovadoPor TEXT,
      atualizadoEm TEXT NOT NULL,
      PRIMARY KEY (sku, fornecedorFiscalCodigo,
                   fornecedorRelacionadoCodigo, tipoRelacao, validadeInicio)
    );
    CREATE INDEX IF NOT EXISTS idx_produto_fornecedor_relacoes_relacionado
      ON produto_fornecedor_relacoes (fornecedorRelacionadoCodigo, validadeFim);
    CREATE INDEX IF NOT EXISTS idx_produto_fornecedor_relacoes_sku
      ON produto_fornecedor_relacoes (sku, validadeInicio, validadeFim);
  `);
} catch (e) {}

try {
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
} catch (e) {}
try {
  db.exec("ALTER TABLE usuarios_fornecedor ADD COLUMN precisaTrocarSenha INTEGER DEFAULT 0;");
} catch (e) {}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agenda_promotor_edicoes (
      fornecedorCodigo TEXT NOT NULL,
      periodo TEXT NOT NULL,
      versao INTEGER NOT NULL DEFAULT 1,
      assignmentsJson TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      atualizadoPor TEXT NOT NULL,
      PRIMARY KEY (fornecedorCodigo, periodo)
    );
    CREATE TABLE IF NOT EXISTS agenda_promotor_edicoes_historico (
      id TEXT PRIMARY KEY,
      fornecedorCodigo TEXT NOT NULL,
      periodo TEXT NOT NULL,
      versao INTEGER NOT NULL,
      assignmentsJson TEXT NOT NULL,
      criadoEm TEXT NOT NULL,
      criadoPor TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agenda_promotor_edicoes_historico
      ON agenda_promotor_edicoes_historico (fornecedorCodigo, periodo, versao);
  `);
} catch (e) {}

// Clusters da rede: a política publicada continua sendo a base, enquanto
// alterações administrativas ficam persistidas sem editar o JSON publicado.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agenda_clusters (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      lojasJson TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criadoEm TEXT NOT NULL,
      atualizadoEm TEXT NOT NULL,
      atualizadoPor TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agenda_clusters_ativo
      ON agenda_clusters (ativo, atualizadoEm);
  `);
} catch (e) {}
