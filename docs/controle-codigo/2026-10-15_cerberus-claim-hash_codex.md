# Controle de Código — Cerberus claim condicionado ao hash

- Data: 2026-10-15 UTC
- Autor: codex
- Projeto: portal-fornecedor / Cerberus
- Escopo: endurecimento do claim de upload staged e gate offline correspondente.

## Alterações

- O `UPDATE` que faz o claim para `PROCESSANDO` agora exige simultaneamente
  `uploadId`, `fornecedorCodigo`, `sha256` e estado `PENDENTE`.
- O hash recebido é passado como parâmetro da atualização atômica, fechando a
  janela entre a leitura da linha e a tomada do claim.
- O gate offline verifica que ownership, hash e estado permanecem no mesmo
  predicado SQL.
- O reset de falha agora exige `uploadId`, `sha256` e estado
  `PROCESSANDO`, evitando reabrir uma linha diferente por engano.
- O gate inclui comportamento real em SQLite: primeiro claim aceito, replay
  rejeitado, hash divergente sem mutação e estado preservado em `PENDENTE`.

## Validação

- `node scripts/cerberus-gates.mjs` — 9/9 PASS.
- `npx prettier --check` nos dois arquivos — PASS após formatação.
- `npx eslint src/server/cerberus-upload-staging.ts scripts/cerberus-gates.mjs` — PASS.
- `npm run build` — PASS.
- `npm run lint` global — bloqueado por `EACCES` pré-existente em `db/pgdata`.
- `npx tsc --noEmit` — ainda falha por erros preexistentes nas alterações
  pendentes do workspace; o novo módulo também herda avisos de strictness já
  existentes no arquivo.
- Build real repetido em contexto privilegiado — PASS, `.output/nitro.json`
  gerado.

## Governança

- Decisão Tier 4: `agent-memory-20261015-440b2241ccbc22b7`.
- Oscar autorizou K3 como substituto formal do Reasonix exclusivamente neste
  Tier 4; parecer técnico: `msg_20261015_011529_100`,
  `APROVADO_COM_AJUSTES`.

## Limites

Não houve ativação de upload, alteração de flag de produção, remoção de
arquivos, acesso a banco corporativo ou deploy.

Follow-ups não bloqueantes: sweeper de registros `PROCESSANDO` órfãos e
quarentena após falhas repetidas de integridade.
