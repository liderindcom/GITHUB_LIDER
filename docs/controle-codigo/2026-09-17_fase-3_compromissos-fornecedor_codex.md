# Registro de Código — Portal do Fornecedor (Compromissos a Pagar por Fornecedor)

**Data:** 2026-09-17
**Autor/agente:** codex (harness task-0005)
**Fase:** 3 — candidata
**Pedido/decisão:** adaptador candidato de compromissos a pagar por fornecedor/horizonte, usando exclusivamente o cache documentado do portal (`contas_receber` populada assincronamente de RMS.AA1RTITU com `fornecedorCodigo`, `vencimento`, `valor` e status `Programado`/`Aberto`).
**Status:** candidato / sem_base_financeira

## 1. Objetivo

Expor somente um agregado interno de compromissos a pagar por fornecedor e horizonte para comprador autorizado. O agregado soma `Programado` e `Aberto` em faixas de vencimento (vencido, 0-30, 31-60, 61-90, 91-180, 181+ dias). Não expõe reserva, saldo ou custo de capital; não escreve em ERP; não expõe nada a fornecedor/AppCom.

## 2. Arquivos criados

- `packages/contracts/commitment-aggregate.schema.json`
- `db/migrations/010_commitment_aggregates.sql`
- `src/lib/commitments-core.ts`
- `src/lib/commitments-core.test.ts`
- `src/commitments-api.ts`
- `scripts/etl_commitments.py`
- `scripts/test_etl_commitments.py`
- `docs/controle-codigo/2026-09-17_fase-3_compromissos-fornecedor_codex.md`

## 3. Arquivos editados

- `packages/contracts/validate_contracts.py` (registra o novo schema)

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério                     | Resultado | Evidência                                                                 |
| ---------------------------- | --------- | ------------------------------------------------------------------------- |
| Sem base financeira de reserva/saldo/custo | aprovado | Contrato e motor não possuem campos de reserva/saldo/custo de capital     |
| Comprador interno autorizado | aprovado | API chama `exigirInterno()` no servidor; role `portal_comprador` na migração |
| Sem exposição a fornecedor/AppCom | aprovado | `portal_app` sem GRANT; API não recebe sessão de fornecedor               |
| Migração somente aditiva     | aprovado | 010 contém apenas DDL, sem INSERT/UPDATE/DELETE                           |
| ETL somente-leitura          | aprovado | `sqlite3.connect(file:...?mode=ro)` e `--sqlite` obrigatório              |
| Sem credencial/RMS//lider    | aprovado | Nenhuma conexão corporativa ou credencial adicionada                      |
| Anti-overclaim               | aprovado | `homologationStatus: candidato`, `writesToErp: false`                     |

## 6. Validações

```text
node --test src/lib/commitments-core.test.ts src/lib/financial-core.test.ts   # 11 passed
python3 scripts/test_etl_commitments.py                                      # 3 passed
python3 -m py_compile scripts/etl_commitments.py scripts/test_etl_commitments.py
python3 packages/contracts/validate_contracts.py                             # 16 schemas, 10 migrations
npx eslint src/commitments-api.ts src/lib/commitments-core.ts src/lib/commitments-core.test.ts
npx prettier --check src/commitments-api.ts src/lib/commitments-core.ts src/lib/commitments-core.test.ts packages/contracts/commitment-aggregate.schema.json
npm run build
```

## 7. Limitações

- Migração 010 não executada (governança; não altera a base viva).
- O cache documentado não fornece `sourceCutId` estável; o motor então resolve `corte_ausente` → `sem_base_financeira`, coerente com a exigência de resultado SEM BASE FINANCEIRA.
- Autorização de comprador usa a sessão interna existente (`exigirInterno`); não há cadastro de vínculo comprador↔fornecedor nesta fase.
- ETL emite JSON no stdout e não grava PostgreSQL; a carga do agregado no schema 010 é um passo de homologia posterior.
