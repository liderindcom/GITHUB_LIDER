import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LoginScreen } from "@/components/login-screen";

type SiteMode = "portal" | "appcom";

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
        content:
          "Pedidos, vendas sell-out, estoque, agendamento de NF-e e antecipação de recebíveis.",
      },
    ],
  }),
  component: RootLanding,
});

function RootLanding() {
  // O hostname define o produto. Mantemos o primeiro render neutro para não
  // causar diferença de hidratação entre o servidor e o navegador.
  const [site, setSite] = useState<SiteMode | null>(null);
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    setSite(host === "appcom.intelider.com.br" ? "appcom" : "portal");
  }, []);

  if (!site) {
    return <main aria-busy="true" style={{ minHeight: "100vh", background: "#fff" }} />;
  }

  if (site === "appcom") {
    return <Navigate to="/comunicacao" replace />;
  }
  return <LoginScreen />;
}
