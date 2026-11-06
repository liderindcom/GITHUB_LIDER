import fs from "node:fs/promises";

const target = "/lider/portal-fornecedor/.output/server/index.mjs";
const source = await fs.readFile(target, "utf8");
if (source.includes("globalThis.__portalNitroServer__")) {
  console.log("Nitro runtime já mantém a referência do servidor.");
  if (source.includes("__portalNitroKeepAlive__")) process.exit(0);
}

const marker = "serve({\n\tport,";
if (!source.includes(marker)) {
  throw new Error("Não foi possível localizar a criação do servidor Nitro no bundle.");
}

let patched = source.replace(
  marker,
  "globalThis.__portalNitroServer__ = serve({\n\tport,",
);
patched = patched.replace(
  "trapUnhandledErrors();",
  "trapUnhandledErrors();\nconst __portalNitroKeepAlive__ = setInterval(() => {}, 2147483647);\nprocess.once(\"SIGTERM\", () => clearInterval(__portalNitroKeepAlive__));\nprocess.once(\"SIGINT\", () => clearInterval(__portalNitroKeepAlive__));",
);
await fs.writeFile(target, patched);
console.log("Nitro runtime corrigido: referência e ciclo de vida do servidor preservados.");
