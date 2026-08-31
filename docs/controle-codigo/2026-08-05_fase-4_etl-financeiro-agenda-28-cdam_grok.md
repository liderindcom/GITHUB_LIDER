# Registro de Código — Portal do Fornecedor (ETL financeiro agenda 28 + CDAM)

**Data:** 2026-08-05  
**Autor/agente:** Grok  
**Fase:** 4 — worker ETL financeiro  
**Status:** candidato / validado_local

## 1. Objetivo

Alinhar o sincronizador para o financeiro do portal listar **somente** NF-e do fornecedor (Nestlé) com:

- agenda de recebimento **28** (configurável);
- destinacão **depósito/CD** (`TIP_LOJ_CLI = D`, ex. filial 201);
- exclusão de transferências **65/66/148** e notas em loja.

Data de pagamento e desconto financeiro vêm do **cadastro** (prazo e % configuráveis).

## 2. Arquivos

- `portal-fornecedor/packages/sync_worker.py` (extração RMS, filtro, payload payments)
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md` (§2.0 agendas)
- UI/mock já alinhados em sessão anterior (`mock-data.ts`, `_portal.financeiro.tsx`)

## 3. Variáveis de ambiente

| Variável | Default | Uso |
| --- | --- | --- |
| `PORTAL_SUPPLIER_RECEIPT_AGENDAS` | `28` | Agendas de recebimento elegíveis |
| `PORTAL_CDAM_BRANCH_IDS` | `201,213,214,203,210,13` | Filiais depósito/CD |
| `PORTAL_SUPPLIER_CNPJ_ROOT` | `60409075` | Raiz CNPJ emitente Nestlé |
| `PORTAL_SUPPLIER_DELIVERY_MODEL` | `somente_cdam` | Modelo de entrega |
| `PORTAL_SUPPLIER_PRAZO_DIAS` | `28` | Prazo pagamento cadastro |
| `PORTAL_SUPPLIER_DESC_FIN_PCT` | `1.5` | Desconto financeiro % |

## 4. Fonte de dados

1. **Primária:** `RMS.VW03_NFEENTRADA` + `RMS.AA2CTIPO` (agenda + destino D).
2. **Fallback:** `fallback_supplier_cdam_payments()` com ruído filtrável (TRF 66 / loja agenda 2).
3. **FLAN (RM):** não entra no modelo `somente_cdam` sem agenda/destino (evita falso positivo).

## 5. Validação local

```bash
export LD_LIBRARY_PATH=/home/administrador/instantclient_19_25:$LD_LIBRARY_PATH
/home/administrador/deepseek-env/bin/python3 -c "
from packages.sync_worker import fallback_supplier_cdam_payments, build_payments_payload, utc_now
p = build_payments_payload(fallback_supplier_cdam_payments(), utc_now())
print(len(p['rows']), p['filterPolicy']['receiptAgendas'], [r['agendaRms'] for r in p['rows']])
"
```

Esperado: 4 linhas, todas agenda 28; TRF/loja excluídos.
