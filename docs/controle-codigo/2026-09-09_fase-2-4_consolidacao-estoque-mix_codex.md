# Controle de Código — Consolidação de Estoque e Mix

- Data: 2026-09-09
- Fase: 2.4
- Responsável: Codex
- Escopo: reorganização da navegação dos menus de estoque

## Entrega

Os menus Estoque, Meus Itens e Relatório MIX passaram a ser apresentados como um único agrupamento chamado **Estoque e Mix**, com três acessos:

- Visão de Estoque — rota /estoque
- Itens e Cobertura — rota /itens
- Mix por Loja — rota /relatorio-mix

As rotas foram preservadas para manter compatibilidade com favoritos, links diretos e integrações existentes. O agrupamento permanece destacado quando qualquer uma das três telas está aberta.

## Arquivos alterados

- src/components/app-sidebar.tsx
- src/routes/_portal.estoque.tsx
- src/routes/_portal.itens.tsx
- src/routes/_portal.relatorio-mix.tsx

## Validação

- git diff --check: aprovado
- npm run build: aprovado para client, SSR e Nitro
- Avisos existentes do build permanecem relacionados a plugin de caminhos do TypeScript, externalização de node:util, chunks grandes e tempos de plugins.

## Revisão de navegação

A navegação foi refinada após validação visual:

- O menu lateral agora exibe somente Estoque e Mix.
- As opções Visão de Estoque, Itens e Cobertura e Mix por Loja foram transformadas em abas no conteúdo das telas.
- A aba ativa é destacada e usa navegação interna do portal.
- As rotas existentes foram mantidas para compatibilidade.

Arquivos adicionais:

- src/components/estoque-mix-tabs.tsx
