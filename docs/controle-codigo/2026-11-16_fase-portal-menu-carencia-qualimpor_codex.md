# Registro de Código — Menu durante período de experiência

Espelho do registro canônico em `/home/administrador/RM/docs/controle-codigo/2026-11-16_fase-portal-menu-carencia-qualimpor_codex.md`.

Corrige o contexto do fornecedor para preservar carência, competência inicial de cobrança e último acordo. Sem esses campos, um fornecedor em degustação vigente era restringido indevidamente após o dia 10.

**Arquivos:** `src/context/portal-context.tsx`, `src/lib/mock-data-catalog.ts`
**Fonte do protocolo:** `/lider/.agent-collab/protocol/PROTOCOLO_MAOADC.md`
**Validação:** `git diff --check` e `npx tsc --noEmit` PASS; lint direcionado conserva cinco erros preexistentes fora do diff.
**Ticket de commit:** `tkt_20261116T200603Z_5d8fa3d9`.
