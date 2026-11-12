# Registro de Código — código canônico da Cimed no Portal do Fornecedor

**Data:** 2026-11-12
**Autor/agente:** codex
**Projeto:** portal-fornecedor
**Fase/backlog:** correção operacional de identificação do fornecedor Cimed 104949
**Pedido/decisão vinculada:** tickets Harness de commit/deploy aprovados por Oscar; commit `0186fdf`
**Status:** validado

## Objetivo e alteração

Preservar `104949` como código canônico em `src/lib/fornecedor-codigo.ts`; antes, a normalização o convertia indevidamente em `10494`, impedindo a busca correta de pedidos e entradas.

## Arquivos

- Editado: `src/lib/fornecedor-codigo.ts`.
- Criado: este registro de controle.
- Removido: nenhum.

## KPIs CODE

| KPI | Resultado | Evidência |
|---|---|---|
| CODE-01 | Ativo | build passou; smoke local/público 200 |
| CODE-02 | Ativo | tickets, caminho canônico e commit `0186fdf` |
| CODE-03 | Ativo | teste direto da normalização |
| CODE-04 | N/A | correção cirúrgica sem contrato novo |
| CODE-05 | Ativo | bundle/processo conferidos; validação autenticada declarada pendente |
| CODE-06 | N/A | ainda não auditado |
| CODE-07 | Ativo | pedido, commit e checkpoint rastreados |
| CODE-08 | Ativo | exceção mínima |
| CODE-09 | Ativo | comportamento legado preservado |
| CODE-10 | N/A | sem defeito observado no smoke |

## Validações

`npm run build` passou; o bundle carregado contém `104949`; Node ativo em `127.0.0.1:18090`; smoke local e público retornaram HTTP 200; commit `0186fdf` foi publicado em `origin/main`.

## Pendências e decisão

Consulta autenticada da sessão Cimed ainda precisa ser conferida pelo usuário. Alterações preexistentes não relacionadas foram preservadas. Decisão: `apto_para_piloto`.
