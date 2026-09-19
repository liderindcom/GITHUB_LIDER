# CODE - Filtro mercadologico consistente nas abas

- Data: 2026-09-09
- Autor: codex
- Projeto: painel-fornecedor
- Diretiva: manter vendas, vendas anual, perdas e ruptura no mesmo escopo do filtro global

## Entrega

- Vendas e ruptura agora reagem a `dadosFornecedorVersao` quando o filtro global muda.
- Vendas anual recebe o filtro global e recalcula o escopo de segmento/departamentos selecionado.
- Perdas ja usava proxy filtrado e permanece sincronizada pela versao do fornecedor.
- O filtro continua baseado nos SKUs dos produtos, preservando os totais dentro do escopo selecionado.

## Arquivos

- `src/routes/_portal.vendas.tsx`
- `src/routes/_portal.ruptura-venda.tsx`
- `src/routes/_portal.vendas-anual.tsx`
- `src/api.ts`

## Validacao

- `npm run build` — passou.
- `git diff --check` — executado.
- Status: validado_local; aceite funcional comparando valores com RMS ainda recomendado.
