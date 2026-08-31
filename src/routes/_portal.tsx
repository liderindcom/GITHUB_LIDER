import { Navigate, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { usePortal } from "@/context/portal-context";

export const Route = createFileRoute("/_portal")({
  ssr: false,
  component: PortalGate,
});

function PortalGate() {
  const { autenticado, carregandoSessao, usuarioInterno, usuarioFornecedor } = usePortal();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (carregandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando portal...
      </div>
    );
  }
  if (!autenticado) return <Navigate to="/login" replace />;
  if (
    !usuarioInterno &&
    usuarioFornecedor?.precisaTrocarSenha &&
    pathname !== "/corrigir-senha"
  ) {
    return <Navigate to="/corrigir-senha" replace />;
  }
  return <Outlet />;
}
