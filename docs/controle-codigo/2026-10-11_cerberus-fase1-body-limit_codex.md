# Controle de código — Cerberus Fase 1: limite de corpo

- Data: 2026-10-11 UTC
- Autor: codex
- Projeto: portal-fornecedor / Cerberus
- Fase: Fase 1 — barreira de corpo antes do parsing
- Decisão: `agent-memory-20261011-2370399188ebb8d4`
- Red team: Z.AI, bico `msg_20261011_154152_980`
- Escopo: limite antecipado por `Content-Length` e limite efetivo por streaming nas rotas `/api/cerberus/upload` e `/api/cerberus/catalogo-import`.
- Segurança: uploads permanecem desligados; nenhuma persistência ou deploy foi executado.
- Validação: `git diff --check` passou; `npm run build` passou; os endpoints de produção permanecem 404 com a flag desligada.
- Pendências: rate limit, hardening ZIP/XLSX, separação staging/import, dry-run e validação em staging antes de qualquer ativação.
