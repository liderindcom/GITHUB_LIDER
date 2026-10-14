import { createFileRoute } from "@tanstack/react-router";
import { fillRateRows } from "@/lib/atlas-fill-rate-api.server";

export const Route = createFileRoute("/api/atlas/fill-rate")({
  server: {
    handlers: {
      GET: async ({ request }) => fillRateRows(new URL(request.url).searchParams),
    },
  },
});
