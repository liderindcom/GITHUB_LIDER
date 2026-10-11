# Controle de código — Cerberus Fase 2

- Autor: Codex
- Data UTC: 2026-10-11
- Plano: Cerberus d691892
- Decisão Tier 4: `agent-memory-20261011-e4154fd261e90e29`
- Réplica independente: Z.AI, lastro `msg_20261011_153612_287`
- Escopo: rate limit do upload e da importação Cerberus antes do parse do corpo.

## Alterações

- `request-guard.ts`: aceita identidade autenticada e mantém fallback por origem,
  com contadores compartilhados no SQLite.
- `api/cerberus/upload.ts`: exige sessão de fornecedor e aplica limites por
  identidade e origem antes de ler o JSON; responde 429 com `Retry-After`.
- `api/cerberus/catalogo-import.ts`: exige sessão interna com role `admin` e
  aplica limites por identidade e origem antes de ler o JSON.

## Validação

- `git diff --check`: aprovado.
- `npm run build`: aprovado.
- Flag de produção `CERBERUS_PORTAL_UPLOADS_ENABLED`: permanece `false`.
- Ativação, importação e persistência em produção: não executadas nesta fase.

## Pendências

- Validar 401/404/429 em ambiente controlado com sessões sintéticas.
- Completar gates de staging, dry-run, idempotência, ZIP/XLSX e auditoria antes
  de qualquer ativação real.
