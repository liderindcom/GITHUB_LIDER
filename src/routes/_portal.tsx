import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";

import { usePortal } from "@/context/portal-context";

export const Route = createFileRoute("/_portal")({
  ssr: false,
  component: PortalGate,
});

function PortalGate() {
  const { autenticado } = usePortal();
  if (!autenticado) return <Navigate to="/login" replace />;
  return <Outlet />;
}
