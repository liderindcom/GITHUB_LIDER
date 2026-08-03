# Arquitetura de Domínio — Portal do Fornecedor (Fase 0)

**Data:** 2026-08-03  
**Autor:** grok  
**Bico:** `msg_20260803_151437_314` (BICO_DEV_SCHEMA_PORTAL)  
**Status:** candidato técnico — não homologado

## 1. Bounded contexts

| Contexto | Responsabilidade | Fonte canônica (futura) | Cache portal |
|---|---|---|---|
| Identity & Access | Login CNPJ + código fornecedor, MFA, sessão JWT | Cadastro fornecedores (RM/RMS) via worker | `suppliers`, `users`, `mfa_devices` |
| Stock Visibility | Saldo e movimentos por produto/filial | Oracle RMS (ETL) | `stock_balances`, `stock_movements` |
| Receivables | Títulos a receber, vencimentos, status | RM/financeiro via worker | `receivable_titles` |
| Anticipation | Cotação e pedido de antecipação de títulos | Motor de regras do portal + aceite financeiro | `anticipation_quotes`, `anticipation_requests` |
| Alerts | Action-driven home | Derivado de cache local | `alerts` (materializado ou query) |
| Trade Marketing | Verbas sell-out (fase posterior) | Comercial | `trade_budgets` (stub) |
| Audit | Append-only de aceites e ações sensíveis | Portal | `audit_events` |

## 2. Princípios

1. **Edge security:** API pública só fala com PostgreSQL do portal.
2. **Tenant key:** `supplier_id` (UUID interno) — nunca confiar só em CNPJ no WHERE da app.
3. **Idade da informação:** todo payload de leitura carrega `dataFreshness` (`sourceUpdatedAt`, `syncedAt`, `ageSeconds`, `slaLabel`).
4. **Writes limitados:** fornecedor só grava antecipação, MFA, preferências e aceites; nunca altera saldo/título de origem.
5. **Anti-overclaim:** campos `homologationStatus` ∈ `candidato | aguarda_aceite | restrito | bloqueado`.

## 3. Modelo de identidade (API)

```text
POST /auth/login          { supplierCode, cnpj, password } → challenge MFA ou token
POST /auth/mfa/verify     { challengeId, otp } → accessToken + refreshToken
POST /auth/password/change (obrigatório 1º acesso)
GET  /me                  perfil + flags (mustChangePassword, mfaEnabled)
```

Claims JWT mínimos: `sub` (user_id), `sid` (supplier_id), `roles[]`, `cnpj`, `exp`.  
A sessão PostgreSQL da API seta `SET LOCAL app.supplier_id = '<uuid>'` antes de qualquer query.

## 4. Superfície REST candidata

| Método | Path | RLS | Paginação | Observação |
|---|---|---|---|---|
| GET | `/health` | n/a | — | sem dados de tenant |
| GET | `/v1/dashboard/alerts` | sim | cursor | action-driven home |
| GET | `/v1/stock/balances` | sim | page/limit | filtros: sku, branchId |
| GET | `/v1/stock/movements` | sim | cursor | janela max 90d default |
| GET | `/v1/receivables/titles` | sim | page/limit | status, dueFrom/dueTo |
| POST | `/v1/anticipations/quotes` | sim | — | simulação sem commit |
| POST | `/v1/anticipations/requests` | sim | — | cria pedido (async possível) |
| GET | `/v1/anticipations/requests` | sim | page | histórico |
| GET | `/v1/anticipations/requests/{id}` | sim | — | detalhe |
| GET | `/v1/payments/schedule` | sim | page | agenda de pagamentos |
| GET | `/v1/exports/{jobId}` | sim | — | jobs assíncronos (DeepSeek/BullMQ) |

Todos os endpoints autenticados exigem rate limit por `supplier_id` + IP.

## 5. Contratos

Schemas em `packages/contracts/*.schema.json`.  
Validador: `packages/contracts/validate_contracts.py`.

## 6. RLS e performance

Ver `docs/rls-performance-estoques.md` e `db/migrations/001_rls_core.sql`.

Resumo:

- Todas as tabelas de negócio com `supplier_id NOT NULL`.
- Índice composto alinhado aos filtros da API.
- Policy `USING (supplier_id = current_setting('app.supplier_id')::uuid)`.
- Role app sem BYPASSRLS; worker ETL usa role de escrita com bypass controlado e auditoria.

## 7. Fora de escopo nesta entrega

- UI Next.js (Gemini)
- Worker ETL real (DeepSeek)
- Conexão RMS/RM
- Homologação financeira da taxa de antecipação
- Trade marketing completo
