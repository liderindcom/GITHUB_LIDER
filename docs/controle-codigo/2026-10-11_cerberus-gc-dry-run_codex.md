# Controle de código — Cerberus GC em dry-run

- Plano: Cerberus d691892
- Decisão Tier 4: `agent-memory-20261011-75d71fce0e5a1499`
- Réplica independente: Z.AI, `msg_20261011_191652_155`
- Escopo: planejamento do GC do staging, sem remoção real.

## Implementado

- TTL de 48 horas com margem de 2 horas.
- Fonte de tempo preferencial no banco (`CURRENT_TIMESTAMP`), com relógio
  injetável para testes.
- Limite de 100 registros por plano.
- `PROCESSANDO` não é candidato; a janela de proteção documentada é de 7 dias.
- Validação única de nome e caminho por `resolve`, prefixo canônico e allowlist.
- Função `planStagedUploadGc()` somente leitura, retornando candidatos e paths
  rejeitados.

## Bloqueios preservados

Não existe ainda runner de remoção real, lock de liderança única, soft-delete
transacional seguido de `unlink`, sweep de órfãos, métrica ou cron. Portanto não
há exclusão de arquivos nem mudança de produção nesta etapa.
