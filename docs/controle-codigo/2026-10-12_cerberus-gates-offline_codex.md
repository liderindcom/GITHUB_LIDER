# Controle de código — Cerberus gates offline

- Plano: Cerberus d691892
- Decisão Tier 4: `agent-memory-20261012-daf062d45bb76594`
- Réplica independente: Z.AI, `msg_20261011_191652_155`
- Escopo: suíte offline sem banco, DSN, credenciais ou rede.

## Cobertura

- G1: ownership/IDOR;
- G2: traversal e identificadores inválidos;
- G3: divergência de hash;
- G4: replay e concorrência de claim;
- G5: proteção de `PROCESSANDO` no GC;
- contrato estrutural que impede bytes no endpoint de importação.

Execução: `node scripts/cerberus-gates.mjs`.

## Limites

Esta suíte não prova sessão HTTP real, PostgreSQL, transação entre processos,
symlink físico, corrida real, métricas ou observabilidade. Esses gates continuam
pendentes para staging controlado. O script usa apenas diretórios temporários e
é removido pelo próprio teardown dos testes.
