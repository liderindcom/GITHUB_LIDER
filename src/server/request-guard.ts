type Limite = { maximo: number; janelaMs: number };
type Registro = { inicio: number; total: number; tocadoEm: number };

const registros = new Map<string, Registro>();
const MAX_REGISTROS = 10_000;

function identificarCliente(request: Request): string {
  // Só confiamos em CF-Connecting-IP quando a requisição traz o identificador
  // da borda Cloudflare. Headers X-Forwarded-For/X-Real-IP podem ser forjados.
  const cfRay = request.headers.get("cf-ray")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  return cfRay && cfIp ? "cf:" + cfIp : "origem-nao-verificada";
}

function limparExpirados(agora: number) {
  if (registros.size < MAX_REGISTROS) return;
  for (const [chave, registro] of registros) {
    if (agora - registro.tocadoEm > 15 * 60_000) registros.delete(chave);
  }
  if (registros.size > MAX_REGISTROS) {
    const excedente = registros.size - MAX_REGISTROS;
    let removidos = 0;
    for (const chave of registros.keys()) {
      registros.delete(chave);
      removidos += 1;
      if (removidos >= excedente) break;
    }
  }
}

/** Limitador local fail-closed. A borda Cloudflare aplica a segunda camada. */
export function permitirRequisicao(
  request: Request,
  escopo: string,
  limite: Limite,
): { permitido: true } | { permitido: false; retryAfterSegundos: number } {
  const agora = Date.now();
  limparExpirados(agora);
  const chave = `${escopo}:${identificarCliente(request)}`;
  const anterior = registros.get(chave);

  if (!anterior || agora - anterior.inicio >= limite.janelaMs) {
    registros.set(chave, { inicio: agora, total: 1, tocadoEm: agora });
    return { permitido: true };
  }

  anterior.tocadoEm = agora;
  if (anterior.total >= limite.maximo) {
    return {
      permitido: false,
      retryAfterSegundos: Math.max(
        1,
        Math.ceil((limite.janelaMs - (agora - anterior.inicio)) / 1000),
      ),
    };
  }
  anterior.total += 1;
  return { permitido: true };
}
