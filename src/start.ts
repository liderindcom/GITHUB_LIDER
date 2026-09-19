import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { permitirRequisicao } from "./server/request-guard";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const rateLimitMiddleware = createMiddleware().server(
  async ({ request, handlerType, serverFnMeta, next }) => {
    const host = new URL(request.url).hostname.toLowerCase();
    const appCom = host === "appcom.intelider.com.br";
    const nome = serverFnMeta?.name ?? "";
    const login =
      nome === "loginUsuarioFornecedor" ||
      nome === "loginUsuarioInterno" ||
      nome === "primeiroAcessoFornecedor";
    const regra = login
      ? { escopo: "login", maximo: 8, janelaMs: 15 * 60_000 }
      : appCom && handlerType === "serverFn"
        ? { escopo: "appcom-api", maximo: 60, janelaMs: 60_000 }
        : appCom
          ? { escopo: "appcom-page", maximo: 120, janelaMs: 60_000 }
          : handlerType === "serverFn"
            ? { escopo: "api", maximo: 240, janelaMs: 60_000 }
            : null;

    if (!regra) return next();
    const resultado = permitirRequisicao(request, regra.escopo, regra);
    if (resultado.permitido) return next();

    return new Response(
      JSON.stringify({
        error: "Muitas requisições. Aguarde antes de tentar novamente.",
        retryAfter: resultado.retryAfterSegundos,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "retry-after": String(resultado.retryAfterSegundos),
        },
      },
    );
  },
);

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, rateLimitMiddleware, csrfMiddleware],
}));
