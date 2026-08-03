import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";

import { usePortal } from "@/context/portal-context";

export const Route = createFileRoute("/_portal")({
  ssr: false,
  component: PortalGate,
});

function PortalGate() {
  const { autenticado, carregandoSessao } = usePortal();
  if (carregandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando portal...
      </div>
    );
  }
  if (!autenticado) return <Navigate to="/login" replace />;
  return <Outlet />;
}

