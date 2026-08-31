# CODE - Vendas Anual (farol) no portal

- Data: 2026-08-18
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva: reproduzir o farol da planilha Vendas Anual por fornecedor

## Regra

- Farol da rede = acumulado do calendário do ano passado até o dia do corte (mês fechado + mês aberto proporcional aos dias).
- Realizado do fornecedor = YTD deste ano dos itens visíveis ÷ anual dele no ano passado.
- Mesma régua para o supermercado (soma de todos os SKUs do cache).
- Valor e volume. Seção (que a planilha não fechou). Item com contribuição ao furo.
- Uma linha mês a mês; a grade numérica permanece.

## Dados

Tabela `vendas_mensal` carregada das abas `2025` e `2026` da planilha Vendas Anual (COD_FORN + COD_PROD + mês). Farol 17/08 = 60,47% (bate com F1). Rede anual 2025 = R$ 3,355 bi.

## Arquivos

- `src/api.ts` — `fetchVendasAnual`
- `src/routes/_portal.vendas-anual.tsx`
- `src/components/app-sidebar.tsx`
- `db/migrations/008_vendas_mensal.sql`

## Criterios

- CODE-01 Escopo: tela e agregação mensal. Sem mutar RMS.
- CODE-05 Pedido/NF/financeiro intactos.
- Fora: recarga 2026 de AGG_VDA_PROD; gráfico de seção; financeiro da planilha.
