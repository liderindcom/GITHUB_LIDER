# Portal do Fornecedor Grupo Líder — Protótipo de UI (Next.js & Tailwind)

Este repositório contém a especificação executiva e a modelagem visual do **Portal do Fornecedor do Grupo Líder**.

## 🚀 Como gerar a UI no Lovable (Passo a Passo)
1. Conecte este repositório git à sua conta do **GitHub**.
2. Acesse o **[Lovable.dev](https://lovable.dev)**.
3. Importe este repositório do GitHub.
4. O Lovable lerá o arquivo `LOVABLE_SPECIFICATION.md` e criará automaticamente a aplicação Next.js com as páginas, menus, gráficos, dados mockados e interações solicitados!

---

## 🎨 Escopo de Telas Especificadas
- **Login e Primeiro Acesso:** Autenticação por Código de Fornecedor, com troca forçada de senha inicial (CNPJ) e Onboarding de MFA.
- **Home / Dashboard:** Indicadores rápidos, alertas de rupturas, notas pendentes de agendamento e previsão financeira.
- **Painel de Pedidos:** Listagem paginada e detalhamento lateral (Drawer) de itens de pedidos de compras.
- **Painel de Vendas (Sell-out):** Filtros por período e filial de vendas de produtos item por item, incluindo cálculos de CMV e Margem Bruta.
- **Painel de Estoques:** Monitor de estoque loja a loja com identificadores visuais de ruptura de estoque (verde, amarelo, vermelho).
- **Módulo Logístico:** Calendário de agendamento de recebimento de Notas Fiscais e anexação de chaves NF-e.
- **Módulo Financeiro:** Fluxo de contas a receber e simulador interativo de **Antecipação de Recebíveis** com desconto em tempo real.
