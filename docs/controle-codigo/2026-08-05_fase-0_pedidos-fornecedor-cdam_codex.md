# Registro de Código — Portal do Fornecedor Fase 0 (pedidos Fornecedor x CDAM)

**Data:** 2026-08-05  
**Autor/agente:** Codex  
**Fase:** 0 — domínio, contrato e UI candidata  
**Pedido/decisão:** separar pedidos feitos para o fornecedor dos pedidos feitos para o CDAM, usando o mapa de agendas RMS como regra de interpretação.  
**Status:** validado_local / candidato

## 1. Objetivo

Organizar a primeira regra operacional de pedidos do Portal do Fornecedor:

- `supplier_direct`: pedido direto ao fornecedor, no contexto de compra/recebimento.
- `cdam_central_depot`: pedido destinado ao CDAM, no contexto de depósito central, trânsito e transferência.

## 2. Arquivos criados

- `portal-fornecedor/packages/contracts/purchase-order.schema.json`
- `portal-fornecedor/db/migrations/004_purchase_orders.sql`
- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-0_pedidos-fornecedor-cdam_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/src/lib/mock-data.ts`
- `portal-fornecedor/src/routes/_portal.pedidos.tsx`
- `portal-fornecedor/packages/contracts/validate_contracts.py`
- `portal-fornecedor/db/seeds/controlled_examples.json`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério                    | Resultado | Evidência                                                          |
| --------------------------- | --------- | ------------------------------------------------------------------ |
| Sem segredo novo em código  | aprovado  | Entrega só adiciona contrato, migration, docs e UI                 |
| Sem hot path RMS/RM na API  | aprovado  | Migration modela cache PostgreSQL; UI usa mock local               |
| RLS por supplier_id         | aprovado  | `purchase_orders` e `purchase_order_lines` têm RLS                 |
| Anti-overclaim              | aprovado  | Status candidato/validado_local                                    |
| LGPD                        | aprovado  | Exemplos controlados sem pessoa física, CNPJ real ou dado sensível |
| Separação Fornecedor x CDAM | aprovado  | `orderKind` no schema, seed e UI                                   |

## 6. KPIs CODE

| KPI     | Resultado | Evidência                           |
| ------- | --------- | ----------------------------------- |
| CODE-01 | Ativo     | Contrato e migration adicionados    |
| CODE-02 | Ativo     | Fase 0 candidata, sem promoção      |
| CODE-03 | Ativo     | Regra de domínio documentada        |
| CODE-04 | Ativo     | Registro CODE                       |
| CODE-05 | Ativo     | Sem homologação funcional declarada |
| CODE-06 | N/A       | Sem KPI RH                          |
| CODE-07 | Ativo     | Caminhos e decisão registrados      |
| CODE-08 | Ativo     | Mudança focada em pedidos           |
| CODE-09 | Ativo     | Portal isolado                      |
| CODE-10 | N/A       | Sem produção                        |

## 7. Validações

Executar:

```text
npm run lint
npm run build
/home/administrador/deepseek-env/bin/python3 packages/contracts/validate_contracts.py
```

## 8. Decisão

`apto_para_revisao`. Não homologado. Próximo passo recomendado: ajustar o worker ETL para classificar `orderKind` a partir das colunas RMS/agendas aprovadas e popular `purchase_orders`.
