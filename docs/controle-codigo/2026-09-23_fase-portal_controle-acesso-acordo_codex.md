# Controle de Código — Lista de acesso e impressão de acordo

- Data: 2026-09-23
- Autor: Codex
- Fase: Portal do Fornecedor / controle administrativo de acesso.
- Solicitação: permitir imprimir o acordo dos fornecedores liberados e remover da relação os fornecedores bloqueados.

## Alteração

- `searchFornecedores` agora aplica `acessoLiberado = 1` quando a tela administrativa solicita somente acessos ativos; a contagem usa o mesmo filtro.
- O Controle de Acesso pede explicitamente a relação ativa e remove a linha da tela depois que o bloqueio é confirmado pela API.
- A ação **Imprimir acordo** fica disponível para fornecedores ativos em degustação e para acordos já validados. O documento distingue os dois estados e escapa os campos exibidos antes de montar a impressão.

## Arquivos

- `src/api.ts`
- `src/routes/_portal.admin-fornecedores.tsx`
- `docs/controle-codigo/2026-09-23_fase-portal_controle-acesso-acordo_codex.md`

## Validação

- `git diff --check`: concluído.
- `npx prettier --check src/api.ts src/routes/_portal.admin-fornecedores.tsx`: concluído.
- `npm run build`: concluído.

## Pendências

- O lint global está bloqueado por permissão preexistente em `db/pgdata`; o lint focalizado encontrou ocorrências preexistentes de `any` fora deste diff.
- O deploy do Portal depende do caminho operacional ainda não definido no mapa canônico.
