# CODE - Taxa de fill rate como política da rede

- Data: 2026-08-17
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva: taxa da multa sai do editor do Fill Rate e passa a ser parâmetro único no controle de acesso

## Regra

- Meta: pacto por fornecedor, continua editável na tela Acordo Fill Rate.
- Taxa: valor único da rede. Edita em `/admin-fornecedores`. No Fill Rate aparece só como informação do cálculo.

## Aplicado

| Superfície | Antes | Depois |
|---|---|---|
| `/acordo-fillrate` | `+`/`-` da taxa (estado local, 3%) | espelho somente leitura + texto da fórmula |
| `/admin-fornecedores` | só libera/bloqueia acesso | card "Política de Fill Rate" grava a taxa |
| persistência | nenhuma | tabela SQLite `fillrate_politica` (uma linha) |

Padrão: 3%. Faixa: 1% a 10%, passo 0,5.

## Arquivos

- `src/api.ts` — `fetchFillratePolitica`, `updateFillrateTaxa`
- `src/routes/_portal.admin-fornecedores.tsx`
- `src/routes/_portal.acordo-fillrate.tsx`
- `db/migrations/006_fillrate_politica.sql`

## Criterios

- CODE-01 Escopo: só a taxa global e o espelho no Fill Rate.
- CODE-05 Meta por fornecedor e cálculo de multa intactos.
- Fora: persistir meta por fornecedor; alterar fórmula da multa.
