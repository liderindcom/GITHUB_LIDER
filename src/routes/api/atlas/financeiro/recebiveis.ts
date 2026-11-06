import { createFileRoute } from "@tanstack/react-router";
import { atlasRecebiveis } from "@/lib/atlas-recebiveis-api.server";

export const Route = createFileRoute("/api/atlas/financeiro/recebiveis")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env.ATLAS_ARQUIVO_B_TOKEN;
        const token = request.headers.get("x-atlas-arquivo-b-token");
        if (!expected || !token || token !== expected) {
          return Response.json({ error: "Acesso interno do Atlas exigido." }, { status: 401 });
        }
        return atlasRecebiveis(new URL(request.url).searchParams);
      },
    },
  },
});
