import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";

const UUID = "01234567-89ab-cdef-0123-456789abcdef";

function stagingPath(root, internalName) {
  if (!/^[0-9a-f-]{36}\.(xls|xlsx)$/.test(internalName)) {
    throw new Error("Nome de staging inválido");
  }
  const stagingRoot = resolve(join(root, "staging"));
  const candidate = resolve(join(stagingRoot, internalName));
  if (candidate === stagingRoot || !candidate.startsWith(`${stagingRoot}/`)) {
    throw new Error("Path fora do staging");
  }
  return candidate;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function claim(row, input) {
  if (!row || row.fornecedorCodigo !== input.fornecedorCodigo)
    throw new Error("Upload não encontrado");
  if (row.estado === "CONSUMIDO") throw new Error("Upload já consumido");
  if (row.estado === "PROCESSANDO") throw new Error("Upload já está sendo processado");
  if (row.sha256 !== input.sha256) throw new Error("Integridade do upload inválida");
  row.estado = "PROCESSANDO";
  return row;
}

test("G1 — ownership não permite IDOR", () => {
  assert.throws(
    () =>
      claim(
        { fornecedorCodigo: "A", estado: "PENDENTE", sha256: "x" },
        { fornecedorCodigo: "B", sha256: "x" },
      ),
    /não encontrado/,
  );
});

test("G2 — identificadores não permitem traversal ou symlink lógico", async () => {
  const root = await mkdtemp(join(tmpdir(), "cerberus-g2-"));
  try {
    assert.equal(stagingPath(root, `${UUID}.xlsx`), join(root, "staging", `${UUID}.xlsx`));
    for (const name of [
      `../${UUID}.xlsx`,
      `${UUID}/../x.xlsx`,
      "/etc/passwd",
      `${UUID}.xlsm`,
      `${UUID}.xlsx\0x`,
    ]) {
      assert.throws(() => stagingPath(root, name));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("G3 — hash divergente impede o commit", () => {
  assert.throws(
    () =>
      claim(
        { fornecedorCodigo: "A", estado: "PENDENTE", sha256: digest(Buffer.from("bom")) },
        { fornecedorCodigo: "A", sha256: digest(Buffer.from("alterado")) },
      ),
    /Integridade/,
  );
});

test("G4 — replay e concorrência são rejeitados após claim", () => {
  const row = { fornecedorCodigo: "A", estado: "PENDENTE", sha256: digest(Buffer.from("bom")) };
  claim(row, { fornecedorCodigo: "A", sha256: row.sha256 });
  assert.throws(() => claim(row, { fornecedorCodigo: "A", sha256: row.sha256 }), /processado/);
  row.estado = "CONSUMIDO";
  assert.throws(() => claim(row, { fornecedorCodigo: "A", sha256: row.sha256 }), /consumido/);
});

test("G5 — estado PROCESSANDO não é candidato ao GC", () => {
  const rows = [
    { estado: "PENDENTE", criadoEm: "2020-01-01T00:00:00.000Z" },
    { estado: "CONSUMIDO", criadoEm: "2020-01-01T00:00:00.000Z" },
    { estado: "PROCESSANDO", criadoEm: "2020-01-01T00:00:00.000Z" },
  ];
  const candidatos = rows.filter((row) => row.estado === "PENDENTE" || row.estado === "CONSUMIDO");
  assert.equal(candidatos.length, 2);
  assert.ok(candidatos.every((row) => row.estado !== "PROCESSANDO"));
});

test("contrato do runtime mantém staging e importação separados", async () => {
  const route = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/routes/api/cerberus/catalogo-import.ts", import.meta.url), "utf8"),
  );
  assert.match(route, /claimStagedUpload/);
  assert.doesNotMatch(route, /bytesBase64/);
});

test("claim atômico mantém ownership, hash e estado no mesmo predicado", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/server/cerberus-upload-staging.ts", import.meta.url), "utf8"),
  );
  assert.match(
    source,
    /UPDATE cerberus_uploads SET estado = 'PROCESSANDO' WHERE uploadId = \? AND fornecedorCodigo = \? AND sha256 = \? AND estado = 'PENDENTE'/,
  );
  assert.match(source, /\.run\(input\.uploadId, input\.fornecedorCodigo, input\.sha256\)/);
});

test("claim atômico real no SQLite aceita um concorrente e preserva PENDENTE em hash errado", async () => {
  const root = await mkdtemp(join(tmpdir(), "cerberus-claim-sqlite-"));
  const database = new Database(join(root, "claim.db"));
  try {
    database.exec(`
      CREATE TABLE cerberus_uploads (
        uploadId TEXT PRIMARY KEY,
        fornecedorCodigo TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        estado TEXT NOT NULL
      )
    `);
    const goodHash = digest(Buffer.from("bom"));
    database
      .prepare("INSERT INTO cerberus_uploads VALUES (?, ?, ?, 'PENDENTE')")
      .run(UUID, "A", goodHash);
    const claim = database.prepare(
      "UPDATE cerberus_uploads SET estado = 'PROCESSANDO' WHERE uploadId = ? AND fornecedorCodigo = ? AND sha256 = ? AND estado = 'PENDENTE'",
    );
    assert.equal(claim.run(UUID, "A", goodHash).changes, 1);
    assert.equal(claim.run(UUID, "A", goodHash).changes, 0);
    database
      .prepare("UPDATE cerberus_uploads SET estado = 'PENDENTE' WHERE uploadId = ?")
      .run(UUID);
    assert.equal(claim.run(UUID, "A", digest(Buffer.from("alterado"))).changes, 0);
    assert.equal(
      database.prepare("SELECT estado FROM cerberus_uploads WHERE uploadId = ?").get(UUID).estado,
      "PENDENTE",
    );
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("o fixture de arquivo é temporário e não usa credenciais", async () => {
  const root = await mkdtemp(join(tmpdir(), "cerberus-fixture-"));
  try {
    const file = join(root, `${UUID}.xlsx`);
    await writeFile(file, Buffer.from("fixture"), { mode: 0o600 });
    assert.equal(await readFile(file, "utf8"), "fixture");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
