# Registro de Código — Rentabilidade exclusiva da área interna

Espelho do registro canônico em
`/home/administrador/RM/docs/controle-codigo/2026-11-16_fase-portal-rentabilidade-interna_codex.md`.

**Decisão Tier 4:** `agent-memory-20261116-427d9b4bfb3e597a`
**Revisões:** Grok `msg_20261116_125456_635`; Gemini CLI `6b4e0c68-2c7a-4a03-a9b9-1f2f91ce3b50`.
**Commit/push:** `2ff99f6` em `main`; deploy pendente de ticket Harness próprio.

**Fonte do protocolo:** `/lider/.agent-collab/protocol/PROTOCOLO_MAOADC.md`.

O patch exige sessão interna no servidor, impede a consulta na rota de fornecedor e move o menu Rentabilidade para “Área interna · Líder”. Validação local: Prettier e ESLint direcionado PASS; typecheck global mantém falhas preexistentes fora do escopo.
