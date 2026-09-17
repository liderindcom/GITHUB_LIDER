# Registro de Código — Portal do Fornecedor (Fluxo Operacional Projetado Atlas)

**Data:** 2026-09-17
**Autor/agente:** deepseek (harness task-0006)
**Fase:** 3 — candidata
**Pedido/decisão:** projeção candidata do fluxo operacional Atlas por fornecedor/horizonte, com entradas realizadas de vendas e entradas financeiras previstas, menos compromissos a pagar agregados. Cada série exige fonte, corte, regra e permissão; série ausente devolve SEM BASE FINANCEIRA para a respectiva dimensão, sem preencher lacunas.
**Status:** candidato / sem_base_financeira

## 1. Objetivo

Expor somente uma projeção interna de fluxo operacional por fornecedor e horizonte para comprador autorizado:

`vendas_realizadas + entradas_financeiras_previstas - compromissos_a_pagar`

As três séries usam exclusivamente os caches documentados do portal: `vendas` (populada de RMS) para vendas realizadas, `notas_fiscais` para entradas financeiras previstas e `contas_receber` para compromissos a pagar. Conteúdo é distinguido de saldo bancário e de caixa disponível; nunca declara caixa disponível. Não escreve em ERP; não expõe nada a fornecedor/AppCom.

## 2. Arquivos criados

- `packages/contracts/operational-flow-projection.schema.json`
- `db/migrations/011_operational_flow_projection.sql`
- `src/lib/operational-flow-core.ts`
- `src/lib/operational-flow-core.test.ts`
- `src/operational-flow-api.ts`
- `scripts/etl_operational_flow.py`
- `scripts/test_etl_operational_flow.py`
- `docs/controle-codigo/2026-09-17_fase-3_fluxo-operacional-atlas_deepseek.md`

## 3. Arquivos editados

- `packages/contracts/validate_contracts.py` (registra o novo schema)

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério                                      | Resultado | Evidência                                                                                 |
| --------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| Fonte, corte, regra e permissão por série     | aprovado  | `resolveOperationalFlowSeriesBasis` exige os quatro por série                             |
| Série ausente → SEM BASE FINANCEIRA           | aprovado  | `series_ausente` derruba a projeção da faixa para NULL, sem preencher lacunas             |
| Distinto de saldo bancário / caixa disponível | aprovado  | Contrato e motor não possuem campos `bankBalance`/`availableCash` e não citam saldo/caixa |
| Comprador interno autorizado                  | aprovado  | API chama `exigirInterno()` no servidor; role `portal_comprador` na migração              |
| Sem exposição a fornecedor/AppCom             | aprovado  | `portal_app` sem GRANT; API não recebe sessão de fornecedor                               |
| Migração somente aditiva                      | aprovado  | 011 contém apenas DDL, sem INSERT/UPDATE/DELETE                                           |
| ETL somente-leitura                           | aprovado  | `sqlite3.connect(file:...?mode=ro)` e `--sqlite` obrigatório                              |
| Sem credencial/RMS//lider                     | aprovado  | Nenhuma conexão corporativa ou credencial adicionada                                      |
| Anti-overclaim                                | aprovado  | `homologationStatus: candidato`, `writesToErp: false`                                     |

## 6. Validações

```text
node --test src/lib/operational-flow-core.test.ts            # 7 passed
python3 scripts/test_etl_operational_flow.py                 # 3 passed
python3 -m py_compile scripts/etl_operational_flow.py scripts/test_etl_operational_flow.py
python3 packages/contracts/validate_contracts.py             # 17 schemas, 11 migrations
```

## 7. Limitações

- Migração 011 não executada (governança; não altera a base viva).
- O cache documentado não fornece `sourceCutId` estável por série; sem corte explícito o motor/ETL devolve `corte_ausente` → SEM BASE FINANCEIRA para a série.
- `vendas` real é `quantidade * valorUnitario`, com o fornecedor identificado via `produtos`; a série de vendas usa valor consolidado por data e fornecedor.
- Entradas financeiras previstas usam o vencimento lacrado no cache (`dataPagamento`, depois `vencimento`, depois `emissao`) e `valorLiquido` quando presente.
