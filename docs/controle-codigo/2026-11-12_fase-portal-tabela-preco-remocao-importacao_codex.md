# Registro de Código — Remoção da importação de tabela de preços

**Data:** 2026-11-12
**Autor/agente:** codex
**Projeto:** portal-fornecedor
**Fase/backlog:** controle de entrada da Tabela de Preço
**Pedido/decisão vinculada:** ticket Harness `tkt_20261112T205351Z_bcebccec`
**Protocolo aplicado:** `/home/administrador/AGENTS.md`, bloco `PROTOCOLO_MAOADC`, fonte canônica `/lider/.agent-collab/protocol/PROTOCOLO_MAOADC.md` (Tier 3).
**Status:** submetido_a_revisao

## Objetivo

Remover do menu Tabela de Preço o card de importação que permitia enviar uma tabela diretamente para análise sem o controle operacional definido.

## Arquivos editados

- `src/routes/_portal.preco-sistema.tsx`
- `/home/administrador/maoadc-protocol-panel/data.js`
- `/home/administrador/maoadc-protocol-panel/index.html`

## Alterações

- Removido o card “Importar tabela de preços” e todos os controles de arquivo, modelo, exportação XLSX e envio associado.
- Preservado o fluxo manual de proposta de reajuste e a exportação CSV já existente.
- Atualizado o card do Codex no painel de Controle de Código e o cache-bust do painel.

## Validação

- `npx eslint src/routes/_portal.preco-sistema.tsx`: PASS.
- `npm run build`: PASS (client, SSR e Nitro).
- `npm run lint`: bloqueado por `EACCES` ao varrer o diretório externo `db/pgdata`; não houve diagnóstico de lint no arquivo-alvo.

## Revisão de qualidade e complexidade

- Revisão linha a linha do diff: apenas o card e seus estados/funções XLSX foram removidos; o fluxo manual de proposta e a exportação CSV permanecem referenciados e compilados.
- Nenhuma dependência nova, contrato de API, schema, permissão ou dado foi alterado.

## KPIs CODE

| KPI | Resultado | Evidência |
|---|---|---|
| CODE-01 | Ativo | build client/SSR/Nitro PASS |
| CODE-02 | Ativo | ticket Harness ativo e caminho canônico |
| CODE-05 | Ativo | limitação do lint global registrada; lint direcionado PASS |
| CODE-07 | Ativo | registro físico, espelho no produto e painel atualizados |
| CODE-08 | N/A | mudança cirúrgica de frontend, sem integração nova |
| CODE-09 | Ativo | fluxo manual preservado e diff revisado |

## Pendências

- Commit/push aguardando fechamento do ticket Harness.
- Deploy requer ticket Harness separado.
