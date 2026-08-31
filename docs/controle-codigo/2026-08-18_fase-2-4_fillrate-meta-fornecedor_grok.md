# CODE - Meta de fill rate por fornecedor

- Data: 2026-08-18
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva: meta pactuada é contrato individual; no Fill Rate só espelho; edição no acesso

## Regra

- Meta: pacto por fornecedor, gravada em `fornecedores.metaFillRatePct` (padrão 85%, faixa 85–100).
- Edição: coluna na tabela de `/admin-fornecedores`.
- Fill Rate: somente leitura, com a taxa da rede.

## Arquivos

- `src/api.ts` — `fetchFillrateAcordo`, `updateFillrateMeta`
- `src/routes/_portal.admin-fornecedores.tsx`
- `src/routes/_portal.acordo-fillrate.tsx`
- `db/migrations/007_fillrate_meta_fornecedor.sql`

## Criterios

- CODE-01 Escopo: só persistência e local da meta.
- CODE-05 Cálculo de multa e taxa global intactos.
- Fora: vigência histórica da meta por mês.
