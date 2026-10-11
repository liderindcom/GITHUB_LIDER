import { db } from "./db";

type Limite = { maximo: number; janelaMs: number };
type Registro = { inicio: number; total: number; tocado_em: number };
let tabelaPronta = false;

function identificarCliente(request: Request): string {
  // Cloudflare e o Nginx local sobrescrevem estes headers antes do runtime.
  const cfRay = request.headers.get("cf-ray")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfRay && cfIp) return "cf:" + cfIp;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return "proxy:" + realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? "proxy:" + forwarded : "origem-nao-verificada";
}

function garantirTabela() {
  if (tabelaPronta) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_contadores (
      chave TEXT PRIMARY KEY,
      inicio BIGINT NOT NULL,
      total INTEGER NOT NULL,
      tocado_em BIGINT NOT NULL
    );
  `);
  tabelaPronta = true;
}

/** Limitador compartilhado no banco; a borda Cloudflare aplica a segunda camada. */
export function permitirRequisicao(
  request: Request,
  escopo: string,
  limite: Limite,
  identidade?: string,
): { permitido: true } | { permitido: false; retryAfterSegundos: number } {
  garantirTabela();
  const agora = Date.now();
  db.prepare("DELETE FROM rate_limit_contadores WHERE tocado_em < ?").run(agora - 15 * 60_000);
  const chaveBase = identidade?.trim()
    ? `identidade:${identidade.trim()}`
    : `origem:${identificarCliente(request)}`;
  const chave = `${escopo}:${chaveBase}`;
  const anterior = db
    .prepare("SELECT inicio, total, tocado_em FROM rate_limit_contadores WHERE chave = ?")
    .get(chave) as Registro | undefined;

  if (!anterior || agora - anterior.inicio >= limite.janelaMs) {
    db.prepare(
      `INSERT INTO rate_limit_contadores (chave, inicio, total, tocado_em)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(chave) DO UPDATE SET inicio = excluded.inicio, total = 1, tocado_em = excluded.tocado_em`,
    ).run(chave, agora, agora);
    return { permitido: true };
  }

  if (anterior.total >= limite.maximo) {
    return {
      permitido: false,
      retryAfterSegundos: Math.max(
        1,
        Math.ceil((limite.janelaMs - (agora - anterior.inicio)) / 1000),
      ),
    };
  }
  const atualizado = db
    .prepare(
      `UPDATE rate_limit_contadores SET total = total + 1, tocado_em = ?
       WHERE chave = ? AND inicio = ? AND total < ?`,
    )
    .run(agora, chave, anterior.inicio, limite.maximo);
  if (atualizado.changes > 0) return { permitido: true };

  const atual = db
    .prepare("SELECT inicio, total, tocado_em FROM rate_limit_contadores WHERE chave = ?")
    .get(chave) as Registro | undefined;
  if (!atual || atual.total < limite.maximo) return { permitido: true };
  return {
    permitido: false,
    retryAfterSegundos: Math.max(
      1,
      Math.ceil((limite.janelaMs - (agora - atual.inicio)) / 1000),
    ),
  };
}
