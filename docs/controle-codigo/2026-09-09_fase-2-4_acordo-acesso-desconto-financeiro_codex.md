# CODE - Cláusula de desconto financeiro no acordo de acesso

- Data: 2026-09-09
- Autor: codex
- Projeto: painel-fornecedor
- Diretiva: atualizar o acordo de acesso do Portal do Fornecedor

## Entrega

- O primeiro parágrafo mantém o CNPJ do fornecedor vindo dinamicamente do cadastro RMS (`resultado.fornecedorCnpj`).
- O terceiro parágrafo passa a registrar desconto financeiro de 1% sobre as vendas realizadas ao Grupo Líder.
- A apuração considera as entradas do primeiro ao último dia de cada mês, com cobrança no dia 10 do mês subsequente.

## Arquivos

- `src/routes/_portal.admin-fornecedores.tsx` — texto do acordo impresso.

## Critérios

- CODE-01 Escopo: somente texto do acordo de acesso.
- CODE-05 Regra financeira: percentual e calendário explicitamente descritos; não altera cálculo ou persistência.
- LGPD: nenhum CNPJ foi fixado no código; o documento usa o CNPJ do fornecedor selecionado.
- RM/RMS: nenhuma origem foi consultada ou alterada; apenas preservada a leitura já existente do cadastro.
- Status: validado_local após lint e checagem de formatação.

## Validação

- `npx eslint src/routes/_portal.admin-fornecedores.tsx`
- `npx prettier --check src/routes/_portal.admin-fornecedores.tsx`
