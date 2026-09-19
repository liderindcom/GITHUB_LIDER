# Controle de Código — Dimensionamento de estoque por loja

- Data: 2026-09-19
- Autor: Codex
- Escopo: Portal do Fornecedor — menu Estoque, planilha Dimensionamento de Estoque por Loja.
- Solicitação: exibir os títulos das colunas em mais de uma linha e adicionar a quantidade de lojas por produto.

## Alteração

- Os cabeçalhos passaram a aceitar quebra de linha, preservando o texto completo em colunas estreitas.
- Foi incluída a coluna ordenável e configurável `Estoque nas lojas`.
- Na visão de todas as lojas, a coluna soma o estoque de todas as filiais para cada SKU; ao selecionar uma loja, exibe o estoque daquela filial.

## Arquivo de produto

- `src/routes/_portal.estoque.tsx`

## Validação

- `npx prettier --write src/routes/_portal.estoque.tsx` — concluído.
- `npx tsc --noEmit` filtrado para a rota de estoque — sem erro relacionado.
- `npm run build` — concluído.
- Runtime Node reiniciado; `http://127.0.0.1:18090/` e `https://portaldofornecedor.intelider.com.br/` — HTTP 200.

## Rastreabilidade

- Mudanças preexistentes no mesmo arquivo impedem commit isolado seguro nesta sessão; nenhum arquivo externo foi incluído em stage.
