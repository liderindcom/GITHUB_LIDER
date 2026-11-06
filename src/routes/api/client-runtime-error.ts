import { createFileRoute } from "@tanstack/react-router";

/**
 * Recebe o breadcrumb redigido dos erros de renderização no navegador.
 * O diagnóstico continua disponível no access log; a resposta 204 evita que
 * a própria telemetria gere um erro 404 adicional no DevTools.
 */
export const Route = createFileRoute("/api/client-runtime-error")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } }),
    },
  },
});
