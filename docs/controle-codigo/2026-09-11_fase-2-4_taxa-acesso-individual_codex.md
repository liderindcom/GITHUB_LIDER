# CODE — taxa de acesso individual por fornecedor

- Data: 2026-09-11
- Executor: Codex
- Escopo: Portal do Fornecedor / cobrança de acesso
- Status: implementado e validado em build

## Entrega

Substituída a cobrança fixa de 1% por taxa configurável por fornecedor, com as opções:

`0,25%`, `0,5%`, `0,75%`, `1%`, `1,5%`, `2%`, `2,5%`, `3%`, `4%`, `5%`.

## Controles aplicados

- coluna `fornecedores.taxaAcessoPct`, com compatibilidade para registros existentes em 1%;
- validação server-side contra a lista permitida;
- cálculo da taxa na tela do fornecedor, relatório administrativo e registro de acordo;
- seletor individual no cadastro administrativo;
- auditoria registra taxa anterior e nova;
- isenção legada preservada;
- build de produção concluído com sucesso.

## Pendência operacional

A coluna será criada automaticamente na inicialização da aplicação. A definição das taxas de cada fornecedor ainda precisa ser feita pelo administrador; nenhum fornecedor foi alterado automaticamente nesta entrega.
