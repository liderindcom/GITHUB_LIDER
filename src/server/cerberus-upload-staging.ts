import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, rename, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { exigirSessaoFornecedor } from "./sessao-portal";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".xls", ".xlsx"]);
const ALLOWED_MIME = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const BLOCKED_EXTENSIONS = new Set([".csv", ".xlsm"]);

export type CerberusUploadDecision =
  | "staging"
  | "quarantined"
  | "rejected";

export type CerberusUploadReceipt = {
  uploadId: string;
  decision: CerberusUploadDecision;
  sha256: string;
  bytes: number;
  internalName: string;
};

type StageInput = {
  originalName: string;
  mimeType: string;
  bytesBase64: string;
  route: string;
};

function rootFromEnv(): string {
  const root = process.env.CERBERUS_UPLOAD_ROOT?.trim();
  if (!root || !isAbsolute(root)) {
    throw new Error("Cerberus upload staging desabilitado: raiz não configurada.");
  }
  const resolved = resolve(root);
  if (
    resolved.includes("/public/") ||
    resolved.includes("/db/") ||
    resolved.includes("/secrets/") ||
    resolved.includes("/node_modules/")
  ) {
    throw new Error("Raiz de staging inválida.");
  }
  if (resolved === "/" || resolved === "/tmp" || resolved === "/var/tmp") {
    throw new Error("Raiz de staging ampla demais.");
  }
  return resolved;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function magicOk(extension: string, bytes: Buffer): boolean {
  if (extension === ".xlsx") return bytes.subarray(0, 2).equals(Buffer.from("PK"));
  if (extension === ".xls") return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  return false;
}

async function appendAudit(root: string, record: Record<string, unknown>) {
  const audit = join(root, "events.log");
  const line = `${JSON.stringify({
    timestamp: new Date().toISOString(),
    ...record,
  })}\n`;
  const handle = await open(audit, constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(line, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function stagePortalUpload(input: StageInput): Promise<CerberusUploadReceipt> {
  if (process.env.CERBERUS_PORTAL_UPLOADS_ENABLED !== "true") {
    throw new Error("Cerberus upload staging está desativado.");
  }

  const root = rootFromEnv();
  const sessao = exigirSessaoFornecedor();
  if (!/^[a-z0-9._-]{1,80}$/.test(input.route)) {
    throw new Error("Rota de staging inválida.");
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.bytesBase64) || input.bytesBase64.length % 4 === 1) {
    throw new Error("Conteúdo codificado inválido.");
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmodPrivate(root);
  const staging = join(root, "staging");
  const quarantine = join(root, "quarantine");
  await mkdir(staging, { recursive: true, mode: 0o700 });
  await mkdir(quarantine, { recursive: true, mode: 0o700 });

  const originalName = input.originalName.trim();
  const extension = extname(originalName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Tipo de arquivo não permitido.");
  }
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new Error("MIME não permitido.");
  }
  if (!/^[a-zA-Z0-9 ._()\-]{1,180}$/.test(originalName)) {
    throw new Error("Nome de arquivo inválido.");
  }
  if (input.bytesBase64.length > Math.ceil(MAX_BYTES * 4 / 3) + 16) {
    throw new Error("Arquivo excede o limite.");
  }

  const bytes = Buffer.from(input.bytesBase64, "base64");
  if (!bytes.length || bytes.length > MAX_BYTES || !magicOk(extension, bytes)) {
    throw new Error("Conteúdo do arquivo rejeitado.");
  }

  const uploadId = randomUUID();
  const internalName = `${uploadId}${extension}`;
  const target = join(staging, internalName);
  const receipt: CerberusUploadReceipt = {
    uploadId,
    decision: "staging",
    sha256: sha256(bytes),
    bytes: bytes.length,
    internalName,
  };

  const handle = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  const observed = await stat(target);
  if (observed.size !== bytes.length || observed.mode & 0o077) {
    await rename(target, join(quarantine, internalName));
    await appendAudit(root, { type: "upload_rejected", uploadId, reason: "post_effect_mismatch", route: input.route });
    throw new Error("Falha na verificação pós-efeito.");
  }
  await appendAudit(root, {
    type: "upload_staged",
    uploadId,
    route: input.route,
    subject: sessao.codigo,
    bytes: receipt.bytes,
    sha256: receipt.sha256,
    decision: receipt.decision,
  });
  return receipt;
}

export async function readStagedUpload(uploadId: string, internalName: string) {
  const root = rootFromEnv();
  const safeName = `${uploadId}${extname(internalName).toLowerCase()}`;
  if (safeName !== internalName || !/^[0-9a-f-]{36}\.(xls|xlsx)$/.test(safeName)) {
    throw new Error("Identificador de upload inválido.");
  }
  const path = join(root, "staging", safeName);
  const realRoot = resolve(root);
  if (!resolve(dirname(path)).startsWith(`${realRoot}/`)) throw new Error("Path fora do staging.");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function chmodPrivate(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    await handle.chmod(0o700);
  } finally {
    await handle.close();
  }
}
