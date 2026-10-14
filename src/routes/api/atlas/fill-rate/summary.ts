import { createFileRoute } from "@tanstack/react-router";
import { fillRateSummary } from "@/lib/atlas-fill-rate-api.server";

export const Route = createFileRoute("/api/atlas/fill-rate/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => fillRateSummary(new URL(request.url).searchParams),
    },
  },
});
