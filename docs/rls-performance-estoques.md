# RLS e performance — Estoques (Portal do Fornecedor)

**Data:** 2026-08-03  
**Autor:** grok  
**Status:** candidato  
**Bico:** `msg_20260803_151437_314`

## 1. Objetivo

Garantir que fornecedor A jamais leia estoque de B, com performance previsível sob RLS no PostgreSQL.

## 2. Modelo de dados (mínimo)

```text
suppliers(id uuid PK, code text UNIQUE, cnpj text, ...)
stock_balances(
  supplier_id uuid NOT NULL,
  branch_id   text NOT NULL,
  sku         text NOT NULL,
  qty_on_hand numeric NOT NULL,
  qty_reserved numeric NOT NULL,
  source_updated_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL,
  PRIMARY KEY (supplier_id, branch_id, sku)
)
stock_movements(
  id uuid PK,
  supplier_id uuid NOT NULL,
  branch_id text NOT NULL,
  sku text NOT NULL,
  moved_at timestamptz NOT NULL,
  qty numeric NOT NULL,
  movement_type text NOT NULL,
  document_ref text,
  synced_at timestamptz NOT NULL
)
```

## 3. Política RLS

Role da API: `portal_app` (sem BYPASSRLS).

```sql
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances FORCE ROW LEVEL SECURITY;

CREATE POLICY stock_balances_tenant_select ON stock_balances
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

-- INSERT/UPDATE/DELETE proibidos para portal_app (só worker)
```

Worker ETL usa role `portal_etl` com grants de escrita e policies próprias; nunca exposta à internet.

### Binding na API

Cada request autenticado:

```sql
BEGIN;
SELECT set_config('app.supplier_id', $1, true);  -- true = local à transação
-- queries...
COMMIT;
```

Nunca confiar em `WHERE supplier_id = $client` sem o GUC: defense-in-depth = RLS + filtro app.

## 4. Índices alinhados à carga

| Query típica        | Índice                                      |
| ------------------- | ------------------------------------------- |
| Saldos do tenant    | PK `(supplier_id, branch_id, sku)` já cobre |
| Filtro por sku      | `(supplier_id, sku)`                        |
| Movimentos recentes | `(supplier_id, moved_at DESC)`              |
| Movimentos por sku  | `(supplier_id, sku, moved_at DESC)`         |

### Anti-padrões (evitar)

1. Policy com subquery em tabela sem índice (`EXISTS (SELECT 1 FROM suppliers ...)` em toda linha).
2. `current_setting` sem cast estável — usar `NULLIF(...,'')::uuid` uma vez.
3. JOIN cross-tenant em views sem `security_barrier`.
4. `COUNT(*)` full table em API síncrona — preferir estimativa ou job async.

## 5. Paginação e limites

| Endpoint              | Estratégia                | Limite default | Max |
| --------------------- | ------------------------- | -------------- | --- |
| `/v1/stock/balances`  | keyset `(branch_id, sku)` | 50             | 200 |
| `/v1/stock/movements` | cursor `moved_at,id`      | 50             | 200 |
| Export massivo        | job async (fila)          | —              | —   |

Janela default de movimentos: **90 dias**. Maior exige export assíncrono.

## 6. Freshness (SLA de informação)

Todo response de estoque inclui:

```json
"dataFreshness": {
  "sourceUpdatedAt": "2026-08-03T12:00:00Z",
  "syncedAt": "2026-08-03T14:00:00Z",
  "ageSeconds": 7200,
  "slaLabel": "atualizado há 2h",
  "slaBreached": false
}
```

`slaBreached = ageSeconds > stockSlaSeconds` (config candidata: 14400 = 4h).

## 7. Alertas derivados (dashboard)

| Código   | Condição candidata                                |
| -------- | ------------------------------------------------- |
| A-STK-01 | `qty_on_hand <= reorder_point` (ruptura iminente) |
| A-STK-02 | `qty_on_hand = 0`                                 |
| A-STK-03 | `slaBreached` no saldo                            |

Cálculo preferencial no worker (materializar `alerts`) para não escanear saldos no request home.

## 8. Testes de isolamento (aceitação técnica)

1. Seed dois suppliers com skus distintos.
2. Sessão A com `app.supplier_id=A` → count = só A.
3. Tentativa de `WHERE supplier_id=B` ainda retorna 0 linhas (RLS).
4. `EXPLAIN ANALYZE` do saldo: Index Only/Index Scan no PK tenant, sem Seq Scan em volume piloto.

## 9. Decisão

Modelagem RLS + índices **aptos para scaffold Fase 1**.  
DDL candidato em `db/migrations/`. Sem dados reais RMS.
