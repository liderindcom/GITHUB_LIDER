import { createFileRoute } from "@tanstack/react-router";
import { stagePortalUpload } from "@/server/cerberus-upload-staging";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/cerberus/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.CERBERUS_PORTAL_UPLOADS_ENABLED !== "true") {
          return error("Endpoint indisponível.", 404);
        }
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 14_000_000) return error("Arquivo maior que o limite.", 413);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("JSON inválido.", 400);
        }
        if (!body || typeof body !== "object") return error("Corpo inválido.", 400);
        const candidate = body as Record<string, unknown>;
        const originalName = typeof candidate.originalName === "string" ? candidate.originalName : "";
        const mimeType = typeof candidate.mimeType === "string" ? candidate.mimeType : "";
        const bytesBase64 = typeof candidate.bytesBase64 === "string" ? candidate.bytesBase64 : "";
        if (!originalName || !mimeType || !bytesBase64) return error("Campos obrigatórios ausentes.", 422);
        try {
          const receipt = await stagePortalUpload({ originalName, mimeType, bytesBase64, route: "portal-upload" });
          return Response.json(receipt, { headers: { "cache-control": "no-store" } });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Upload recusado.";
          const status = message.includes("Sessão") ? 401 : 422;
          return error(message, status);
        }
      },
    },
  },
});
