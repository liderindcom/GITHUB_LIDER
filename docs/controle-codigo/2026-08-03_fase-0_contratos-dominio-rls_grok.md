# Registro de Código — Portal do Fornecedor Fase 0 (contratos + domínio + RLS)

**Data:** 2026-08-03  
**Autor/agente:** grok  
**Fase:** 0 — design de domínio e contratos  
**Pedido/msg_id:** `msg_20260803_151437_314` (BICO_DEV_SCHEMA_PORTAL)  
**Status:** validado_local / candidato  

## 1. Objetivo

Entregar design arquitetural de domínio, contratos JSON Schema da API, regras de antecipação de títulos e modelagem RLS/performance de estoques, sem conectar ERPs e sem overclaim.

## 2. Arquivos criados

- `portal-fornecedor/README.md`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/docs/regras-antecipacao-titulos.md`
- `portal-fornecedor/docs/rls-performance-estoques.md`
- `portal-fornecedor/packages/contracts/*.schema.json` (9 arquivos)
- `portal-fornecedor/packages/contracts/validate_contracts.py`
- `portal-fornecedor/db/migrations/001_rls_core.sql`
- `portal-fornecedor/db/migrations/002_stock.sql`
- `portal-fornecedor/db/migrations/003_receivables_anticipation.sql`
- `portal-fornecedor/db/seeds/controlled_examples.json`
- `portal-fornecedor/docs/controle-codigo/2026-08-03_fase-0_contratos-dominio-rls_grok.md`

## 3. Arquivos editados

- `maoadc-protocol-panel/data.js` (card Grok — tarefa Portal)

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério | Resultado | Evidência |
|---|---|---|
| Sem segredo em código | aprovado | Validador proíbe tokens de conexão/senha |
| Sem hot path RMS/RM na API | aprovado | Design: API só PostgreSQL portal |
| RLS por supplier_id | aprovado | Migrations + doc RLS |
| Anti-overclaim | aprovado | Status candidato/aguarda_aceite; writesToErp false |
| Testes locais | aprovado | `validate_contracts.py` |

## 6. KPIs CODE

| KPI | Resultado | Evidência |
|---|---|---|
| CODE-01 | Ativo | Validador OK |
| CODE-02 | Ativo | Fase 0 design; sem promoção |
| CODE-03 | Ativo | Exemplos + regras de elegibilidade/preço documentadas |
| CODE-04 | Ativo | Bico Gemini; registro CODE |
| CODE-05 | Ativo | Taxas e piloto não homologados |
| CODE-06 | N/A | — |
| CODE-07 | Ativo | msg_id e caminhos |
| CODE-08 | Ativo | Schemas + SQL enxutos |
| CODE-09 | Ativo | Repo novo isolado |
| CODE-10 | N/A | Sem produção |

## 7. Validações

```text
python3 /home/administrador/portal-fornecedor/packages/contracts/validate_contracts.py
```

## 8. Decisão

`apto_para_revisao` (Codex gestor / Gemini auditor).  
**Não** homologado. **Não** conectado a ERP. Próximo: DeepSeek dry-run ETL alinhado aos seeds; Codex CODE Fase 0 scaffold se ainda não emitiu.
