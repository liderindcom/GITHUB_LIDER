import { readFileSync, unlinkSync } from "node:fs";
import { Worker } from "node:worker_threads";

const env = Object.fromEntries(
  readFileSync(".env.postgres", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const caseMap = JSON.parse(readFileSync("db/pg-column-case.json", "utf8"));
const worker = new Worker("./scripts/pg-sync-worker.mjs", {
  workerData: { connectionString: env.DATABASE_URL, caseMap },
});

let seq = 0;
function rpc(sql, params = []) {
  seq += 1;
  const replyPath = `/tmp/va-${process.pid}-${seq}.json`;
  const lockSab = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockSab);
  Atomics.store(lock, 0, 0);
  worker.postMessage({ mode: "run", sql, params, replyPath, lockSab });
  const w = Atomics.wait(lock, 0, 0, 45000);
  if (w === "timed-out") return { ok: false, error: "timeout" };
  const p = JSON.parse(readFileSync(replyPath, "utf8"));
  try {
    unlinkSync(replyPath);
  } catch {
    /* ignore */
  }
  return p;
}

const joinProdutoRms = `LEFT JOIN produtos p
      ON p.codigoProdutoRms = substr(vm.sku, 1, length(vm.sku) - 1)
     AND p.digitoProdutoRms = substr(vm.sku, -1)`;
const nomeSecaoSql = `COALESCE(
      NULLIF(TRIM(
        CASE
          WHEN instr(COALESCE(p.secao, ''), ' - ') > 1
           AND substr(p.secao, 1, instr(p.secao, ' - ') - 1) GLOB '[0-9]*'
          THEN substr(p.secao, instr(p.secao, ' - ') + 3)
          ELSE p.secao
        END
      ), ''),
      'Sem seção'
    )`;
const filtroForn = `(vm.fornecedorCodigo = ? OR vm.fornecedorCodigo LIKE ? || '_')`;

const tests = [
  ["max", "SELECT MAX(anoMes) AS ate FROM vendas_mensal", []],
  ["pragma", "PRAGMA table_info(vendas_mensal)", []],
  [
    "rede",
    `SELECT anoMes, SUM(valor) AS valor, SUM(quantidade) AS volume
     FROM vendas_mensal WHERE anoMes LIKE ? OR anoMes LIKE ? GROUP BY anoMes`,
    ["2025-%", "2026-%"],
  ],
  [
    "forn",
    `SELECT vm.anoMes, SUM(vm.valor) AS valor, SUM(vm.quantidade) AS volume
     FROM vendas_mensal vm ${joinProdutoRms}
     WHERE ${filtroForn} AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
     GROUP BY vm.anoMes`,
    ["704894", "704894", "2025-%", "2026-%"],
  ],
  [
    "secao",
    `SELECT ${nomeSecaoSql} AS secao,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.valor ELSE 0 END) AS valorBase
     FROM vendas_mensal vm ${joinProdutoRms}
     WHERE ${filtroForn} AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
     GROUP BY 1
     HAVING SUM(vm.valor) > 0
     LIMIT 3`,
    ["2025-%", "704894", "704894", "2025-%", "2026-%"],
  ],
  [
    "item",
    `SELECT COALESCE(p.sku, vm.sku) AS sku,
            COALESCE(p.descricao, vm.sku) AS descricao,
            ${nomeSecaoSql} AS secao,
            SUM(CASE WHEN vm.anoMes LIKE ? THEN vm.valor ELSE 0 END) AS valorBase
     FROM vendas_mensal vm ${joinProdutoRms}
     WHERE ${filtroForn} AND (vm.anoMes LIKE ? OR vm.anoMes LIKE ?)
     GROUP BY 1, 2, 3
     HAVING SUM(vm.valor) > 0
     LIMIT 3`,
    ["2025-%", "704894", "704894", "2025-%", "2026-%"],
  ],
];

for (const [name, sql, params] of tests) {
  const r = rpc(sql, params);
  if (r.ok) {
    console.log("OK", name, "rows", (r.rows || []).length, JSON.stringify(r.rows?.[0] || {}).slice(0, 220));
  } else {
    console.log("FAIL", name, r.error);
  }
}
worker.terminate();
