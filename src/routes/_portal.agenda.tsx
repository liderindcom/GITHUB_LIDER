import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda | Portal do Fornecedor" },
      {
        name: "description",
        content: "Calendário de entrada agora fica em Logística.",
      },
    ],
  }),
  component: AgendaRedirect,
});

function AgendaRedirect() {
  return <Navigate to="/logistica" search={{ aba: "agenda" }} replace />;
}
