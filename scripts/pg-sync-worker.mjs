/**
 * Worker síncrono para PostgreSQL. O thread principal bloqueia em Atomics.wait;
 * o resultado vai para um arquivo (postMessage não chega com o event loop parado).
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parentPort, workerData } from "node:worker_threads";
import { writeFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const pg = require("pg");

const { connectionString, caseMap } = workerData;
const CASE = caseMap && typeof caseMap === "object" ? caseMap : {};

pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(21, (v) => Number(v));
pg.types.setTypeParser(23, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

const pool = new pg.Pool({
  connectionString,
  max: 4,
  idleTimeoutMillis: 30_000,
});

function collectSqlCase(sql) {
  const extra = { ...CASE };
  const re = /\b([A-Za-z_][A-Za-z0-9]*)\b/g;
  let m;
  while ((m = re.exec(sql))) {
    const id = m[1];
    if (/[a-z]/.test(id) && /[A-Z]/.test(id)) extra[id.toLowerCase()] = extra[id.toLowerCase()] || id;
  }
  extra["count(*)"] = "COUNT(*)";
  return extra;
}

function remapRow(row, sql) {
  if (!row || typeof row !== "object") return row;
  const names = collectSqlCase(sql || "");
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const orig = names[key.toLowerCase()] || key;
    out[orig] = value;
  }
  if (Object.keys(out).length === 1) {
    const only = Object.keys(out)[0];
    if (only.toLowerCase() === "count" || only === "COUNT(*)") out["COUNT(*)"] = out[only];
  }
  return out;
}

function replacePlaceholders(sql) {
  let n = 0;
  let out = "";
  let i = 0;
  let quote = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "?") {
      n += 1;
      out += `$${n}`;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function translateSql(sql) {
  let s = sql.trim();
  const pragma = s.match(/^PRAGMA\s+table_info\((\w+)\)\s*;?$/i);
  if (pragma) {
    const table = pragma[1].toLowerCase();
    return {
      text: `SELECT column_name AS name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = '${table}'
             ORDER BY ordinal_position`,
      valuesLocked: true,
      kind: "pragma",
    };
  }
  if (/FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s*=\s*\?/i.test(s)) {
    return {
      text: `SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = $1`,
      valuesLocked: true,
      forceLowerParams: true,
    };
  }

  const ignore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(s);
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO");
  s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, "INSERT INTO");
  s = s.replace(/\bdatetime\s*\(\s*'now'\s*\)/gi, "to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')");
  s = s.replace(/\binstr\s*\(/gi, "strpos(");
  s = s.replace(/\bGLOB\s+'\[\d-\d\]\*'/gi, "~ '^[0-9]'");
  s = s.replace(/substr\s*\(\s*([^,]+),\s*-1\s*\)/gi, "right($1, 1)");
  s = s.replace(/\bLIKE\b/gi, "ILIKE");
  // PG cannot infer the type of `$n IS NULL`. Dates/codes in this schema are text.
  s = s.replace(/\?\s+IS\s+NULL/gi, "CAST(? AS text) IS NULL");
  s = s.replace(/\?\s+IS\s+NOT\s+NULL/gi, "CAST(? AS text) IS NOT NULL");
  if (ignore && !/ON\s+CONFLICT/i.test(s)) {
    s = s.replace(/;+\s*$/, "");
    s += " ON CONFLICT DO NOTHING";
  }
  return { text: replacePlaceholders(s), valuesLocked: false };
}

function splitStatements(sql) {
  return sql
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
}

parentPort.on("message", async (msg) => {
  const { replyPath, lockSab, mode, sql, params } = msg;
  const lock = new Int32Array(lockSab);
  try {
    let payload;
    if (mode === "exec") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const part of splitStatements(sql)) {
          const t = translateSql(part);
          await client.query(t.text, []);
        }
        await client.query("COMMIT");
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        client.release();
      }
      payload = { ok: true, rows: [], rowCount: 0, lastInsertRowid: 0 };
    } else if (mode === "tx") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const step of params) {
          const t = translateSql(step.sql);
          const values = Array.isArray(step.params) ? step.params : [];
          const res = await client.query(t.text, values);
          results.push({
            rows: (res.rows || []).map((row) => remapRow(row, step.sql)),
            rowCount: res.rowCount ?? 0,
          });
        }
        await client.query("COMMIT");
        payload = { ok: true, results };
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        client.release();
      }
    } else {
      const t = translateSql(sql);
      let values = Array.isArray(params) ? params : [];
      if (t.forceLowerParams) values = values.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
      const res = await pool.query(t.text, t.valuesLocked ? (t.forceLowerParams ? values : []) : values);
      let rows = (res.rows || []).map((row) => remapRow(row, sql));
      if (t.kind === "pragma") {
        rows = rows.map((row) => {
          const name = row && row.name;
          if (typeof name === "string") {
            return { ...row, name: CASE[name.toLowerCase()] || name };
          }
          return row;
        });
      }
      let lastInsertRowid = 0;
      if (rows[0] && rows[0].id != null) lastInsertRowid = Number(rows[0].id) || 0;
      payload = { ok: true, rows, rowCount: res.rowCount ?? 0, lastInsertRowid };
    }
    writeFileSync(replyPath, JSON.stringify(payload));
  } catch (err) {
    writeFileSync(
      replyPath,
      JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }),
    );
  }
  Atomics.store(lock, 0, 1);
  Atomics.notify(lock, 0);
});
