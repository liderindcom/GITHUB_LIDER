import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("pg");
const env = Object.fromEntries(
  readFileSync(".env.postgres", "utf8").split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const pos = line.indexOf("=");
      return [line.slice(0, pos), line.slice(pos + 1)];
    }),
);
const client = new pg.Client({ connectionString: env.DATABASE_URL });
const indexName = "idx_vendas_mensal_fornecedor_anomes";

try {
  await client.connect();
  await client.query(
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS " + indexName +
    " ON public.vendas_mensal (fornecedorcodigo, anomes) WHERE fornecedorcodigo IS NOT NULL",
  );
  const result = await client.query(
    "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " +
    "SELECT vm.anomes, SUM(vm.valor) AS valor, SUM(vm.quantidade) AS volume " +
    "FROM public.vendas_mensal vm " +
    "WHERE vm.fornecedorcodigo = $1 AND (vm.anomes LIKE $2 OR vm.anomes LIKE $3) " +
    "GROUP BY vm.anomes",
    ["704894", "2025-%", "2026-%"],
  );
  const plan = result.rows.map((row) => row["QUERY PLAN"]);
  if (plan.some((line) => /Seq Scan on vendas_mensal/.test(line))) {
    throw new Error("NO-GO: index created but supplier query still uses sequential scan");
  }
  console.log(JSON.stringify({ status: "ok", index: indexName, plan }));
} finally {
  await client.end();
}
