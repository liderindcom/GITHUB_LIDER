# Controle de Código — Sessão interna sem fornecedor

- Data: 2026-09-17
- Autor: Codex
- Fase: 2.4 — Portal do Fornecedor
- Decisão: `agent-memory-20260917-e32269ab2c86e00b`

## Entrega

Usuários internos iniciam sem fornecedor ativo. O Portal limpa o contexto comercial persistido, mostra `Grupo Líder · Admin` e bloqueia páginas comerciais até a seleção explícita de um fornecedor. Sessões de fornecedor e o backend/cookies não foram alterados.

## Arquivos alterados

- `src/context/portal-context.tsx`
- `src/lib/mock-data.ts`
- `src/components/portal-layout.tsx`

## Controles e validação

- Sem segredo, acesso a RM/RMS ou alteração de schema.
- Revisão independente Grok: aprovada com ajustes; Gemini dispensado explicitamente por Oscar por indisponibilidade de crédito, registrada na decisão.
- `npx prettier --check` nos três arquivos: aprovado.
- `git diff --check`: aprovado.
- `npm run build`: aprovado.
- Novo processo Node supervisionado ativo; `/login` local e público retornaram HTTP 200.

## Pendências

- O repositório já possui alterações paralelas não relacionadas. Nenhum commit/push foi realizado para não incluir escopo alheio.
