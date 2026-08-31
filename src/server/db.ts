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

  rpc(mode: string, sql: string, params: unknown[] | TxStep[] = []): {
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
          return { changes: res.rowCount, lastInsertRowid: res.lastInsertRowid };
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

export const db = usePostgres()
  ? createPgDatabase(resolveDatabaseUrl())
  : createSqliteDatabase();

// Auto-run migrations on startup (safe schema setup)
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN isentoCobranca INTEGER DEFAULT 0;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN acessoDataInicio TEXT;");
} catch (e) {}
try {
  db.exec("ALTER TABLE fornecedores ADD COLUMN acessoDataFim TEXT;");
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
