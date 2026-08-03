import { createFileRoute } from "@tanstack/react-router";

import { LoginScreen } from "@/components/login-screen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal do Fornecedor | Grupo Líder" },
      {
        name: "description",
        content:
          "Acesse o Portal do Fornecedor do Grupo Líder: pedidos, sell-out, estoque, logística e antecipação de recebíveis.",
      },
      { property: "og:title", content: "Portal do Fornecedor | Grupo Líder" },
      {
        property: "og:description",
        content: "Pedidos, vendas sell-out, estoque, agendamento de NF-e e antecipação de recebíveis.",
      },
    ],
  }),
  component: LoginScreen,
});
