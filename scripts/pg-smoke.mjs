import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(join(process.cwd(), ".env.postgres"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const caseMap = JSON.parse(readFileSync(join(process.cwd(), "db", "pg-column-case.json"), "utf8"));
const worker = new Worker(join(process.cwd(), "scripts", "pg-sync-worker.mjs"), {
  workerData: { connectionString: env.DATABASE_URL, caseMap },
});

function rpc(sql, params = []) {
  const replyPath = `/tmp/portal-pg-smoke-${process.pid}-${Date.now()}.json`;
  const lockSab = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockSab);
  Atomics.store(lock, 0, 0);
  worker.postMessage({ mode: "run", sql, params, replyPath, lockSab });
  const w = Atomics.wait(lock, 0, 0, 30_000);
  if (w === "timed-out") throw new Error("timeout " + sql);
  const payload = JSON.parse(readFileSync(replyPath, "utf8"));
  if (!payload.ok) throw new Error(payload.error);
  return payload;
}

const tests = [
  ["fornecedores", "SELECT codigo, nome FROM fornecedores ORDER BY codigo", []],
  ["sqlite_master", "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", ["produto_visibilidade"]],
  ["pragma", "PRAGMA table_info(vendas_mensal)", []],
  ["datetime", "SELECT datetime('now') AS agora", []],
  ["substrNeg", "SELECT substr('1234', -1) AS d", []],
  ["glob", "SELECT 1 AS ok WHERE '12 - x' GLOB '[0-9]*'", []],
  ["alias", "SELECT 1 AS fornecedorValor, 2 AS lojaId", []],
  ["vendas", "SELECT COUNT(*) AS n, MIN(data) AS dmin, MAX(data) AS dmax FROM vendas", []],
  [
    "estoqueVis",
    `SELECT p.sku AS sku, p.lojaId FROM estoque p
     WHERE p.sku IN (SELECT sku FROM produto_visibilidade WHERE fornecedorCodigo = ?)
     LIMIT 3`,
    ["704894"],
  ],
  [
    "isNull",
    "SELECT COUNT(*) AS n FROM vendas WHERE (? IS NULL OR data >= ?)",
    ["2026-05-25", "2026-05-25"],
  ],
  [
    "secao",
    `SELECT substr(p.secao, instr(p.secao, ' - ') + 3) AS secao
     FROM produtos p WHERE p.secao IS NOT NULL AND instr(COALESCE(p.secao,''), ' - ') > 1 LIMIT 2`,
    [],
  ],
];

for (const [name, sql, params] of tests) {
  try {
    const r = rpc(sql, params);
    console.log("OK", name, JSON.stringify(r.rows).slice(0, 240));
  } catch (err) {
    console.log("FAIL", name, err.message);
  }
}
worker.terminate();
