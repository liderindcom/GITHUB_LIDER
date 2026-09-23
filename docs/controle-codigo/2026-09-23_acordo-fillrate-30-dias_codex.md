# Controle de Código — Acordo Fill Rate após 30 dias

- Data: 2026-09-23
- Autor: Codex
- Decisão: `agent-memory-20260923-041c99a0b612937f`
- Escopo: cálculo e apresentação do Acordo de Fill Rate Mínimo.

## Alteração

- Falta contratual é pedido de fornecedor, não cancelado, válido, com mais de 30 dias e faturamento zero.
- Parciais permanecem no indicador e no portão julgável, mas não integram a base.
- A competência exibe prévia até transcorrerem 30 dias após seu último dia.

## Arquivos e validação

- `src/lib/mock-data.ts`: helpers civis de elegibilidade, falta e cobrabilidade.
- `src/routes/_portal.acordo-fillrate.tsx`: cálculo, card, faixa e sinais visuais alinhados.
- `git diff --check` e `npm run build`: passaram.
- Sem migration, mudança de API, credencial ou consulta RMS.

## Critérios CODE

- CODE-01/02: cálculo centralizado e build validado.
- CODE-03: 30 dias não entra; 31 dias, faturamento zero e não cancelado entram.
- CODE-04: decisões e revisões DeepSeek/Grok registradas.
- CODE-05/06: sem segredo, LGPD ou acesso às origens.
- CODE-07/08: decisão, commit e checkpoint vinculados.
- CODE-09/10: runtime reiniciado pelo supervisor em 2026-09-23; novo Node escuta 127.0.0.1:18090. Smoke tests local e público de `/acordo-fillrate` responderam HTTP 200.
