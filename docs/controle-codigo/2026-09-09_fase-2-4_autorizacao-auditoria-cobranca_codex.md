# CODE - Autorizacao e auditoria da cobranca de 1%

- Data: 2026-09-09
- Autor: codex
- Projeto: painel-fornecedor
- Diretiva: restringir a desativacao da cobranca e registrar o responsavel

## Entrega

- Somente usuarios internos com role `admin` podem alterar o estado da cobranca de 1%.
- Colaboradores continuam podendo atualizar vigencias sem alterar a cobranca.
- Cada alteracao do estado da cobranca e registrada em `auditoria_cobranca_fornecedor` com fornecedor, usuario, role, valores anterior/novo e timestamp.
- A interface desabilita o botao de cobranca para usuarios que nao sao administradores.

## Arquivos

- `src/api.ts`
- `src/routes/_portal.admin-fornecedores.tsx`

## Criterios

- CODE-01 Escopo: autorizacao e auditoria da cobranca de 1%.
- CODE-05 Seguranca: regra validada no backend, nao apenas na interface.
- LGPD: log registra somente identificadores do usuario interno e fornecedor necessarios para rastreabilidade.
- RM/RMS: nenhuma origem foi consultada ou alterada.
- Status: candidato; build local validado, teste funcional com roles pendente.

## Validacao

- `npm run build` — passou.
- `git diff --check` — passou.
- Lint do projeto permanece com erros preexistentes de `any` e formatacao; nao foi aplicado reformatador global.
