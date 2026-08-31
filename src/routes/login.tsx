import { createFileRoute } from "@tanstack/react-router";

import { LoginScreen } from "@/components/login-screen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login do Fornecedor | Grupo Líder" },
      {
        name: "description",
        content: "Entre com código RMS ou CNPJ, e-mail e senha. No primeiro acesso o portal pede para corrigir a senha.",
      },
      { property: "og:title", content: "Login do Fornecedor | Grupo Líder" },
      {
        property: "og:description",
        content: "Acesso seguro com senha forte e autenticação de dois fatores.",
      },
    ],
  }),
  component: LoginScreen,
});
