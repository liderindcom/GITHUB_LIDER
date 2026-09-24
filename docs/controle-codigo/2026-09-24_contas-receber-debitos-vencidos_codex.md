# Controle de Código — Contas a Receber: débitos vencidos

- Data: 2026-09-24
- Autor: Codex
- Escopo: Portal do Fornecedor / Contas a Receber.
- Solicitação: exibir para a COMPAR e demais fornecedores os débitos vencidos que já aparecem no simulador de antecipação.

## Correção

- A lista deixou de excluir títulos vencidos; continua excluindo somente títulos baixados (`Descontado`).
- A linha de título vencido recebe realce e a etiqueta `Vencido`, preservando valor, status e regra de abatimento originais.
- Não houve alteração de dados, saldo, cálculo de antecipação ou lançamento financeiro.

## Evidência observada

- A COMPAR (código 101354) possui quatro títulos `Programado` vencidos que totalizam R$ 166.787,36.
- O simulador já os considerava porque consulta a mesma fonte sem o filtro visual que antes os removia da tela de Contas a Receber.

## Validação

- `npx prettier --write src/lib/mock-data.ts src/routes/_portal.contas-receber.tsx`
- `git diff --check`
- `npm run build` concluído com sucesso.

## Resultado

- A tela e o simulador passam a expor a mesma base de débitos em aberto; o atraso fica explícito na tela de Contas a Receber.
