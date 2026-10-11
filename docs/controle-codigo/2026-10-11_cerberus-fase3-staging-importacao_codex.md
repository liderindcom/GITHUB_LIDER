# Controle de código — Cerberus Fase 3

- Plano: Cerberus d691892
- Decisão Tier 4: `agent-memory-20261011-00ec8b31ac52355b`
- Réplica independente: Z.AI, `msg_20261011_180822_899`
- Commit: a preencher no fechamento

## Escopo

Separar o recebimento do arquivo em staging privado da importação que grava o
catálogo. O upload devolve um recibo; a importação aceita apenas o recibo,
confere ownership, hash e consumo único e grava em transação. A flag de
produção permanece desligada.

## Gates atendidos nesta etapa

- ownership por fornecedor no registro do upload;
- nome físico derivado do UUID e allowlist de identificadores;
- hash recalculado antes da importação;
- estado `PENDENTE`/`PROCESSANDO`/`CONSUMIDO` contra replay e concorrência;
- persistência e consumo no mesmo bloco transacional.

## Pendências bloqueantes de ativação

- TTL/GC do staging;
- métricas de tamanho, consumo e abortos;
- testes automatizados G1-G7 do parecer Z.AI;
- validação controlada de sessões e ausência de mutação quando o fluxo falha.
