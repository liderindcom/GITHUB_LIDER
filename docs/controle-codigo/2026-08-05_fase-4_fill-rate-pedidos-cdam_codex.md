# Registro de Código — Portal do Fornecedor Fase 4 (fill rate de pedidos)

**Data:** 2026-08-05  
**Autor/agente:** Codex  
**Fase:** 4 — worker + contrato + UI candidata  
**Pedido/decisão:** calcular fill rate por pedido e fill rate geral, tratando CDAM como fornecedor interno das lojas.  
**Status:** validado_local / candidato

## 1. Objetivo

Adicionar a métrica operacional:

```text
fillRatePct = sum(qtyInvoiced) / sum(qtyOrdered) * 100
```

Aplicação:

- por pedido;
- por item;
- geral da visão, excluindo pedidos cancelados;
- CDAM com a mesma regra de fornecedor direto, como fornecedor interno da loja.

## 2. Arquivos criados

- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-4_fill-rate-pedidos-cdam_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/src/lib/mock-data.ts`
- `portal-fornecedor/src/routes/_portal.pedidos.tsx`
- `portal-fornecedor/packages/contracts/purchase-order.schema.json`
- `portal-fornecedor/db/migrations/004_purchase_orders.sql`
- `portal-fornecedor/db/seeds/controlled_examples.json`
- `portal-fornecedor/packages/sync_worker.py`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério             | Resultado | Evidência                                       |
| -------------------- | --------- | ----------------------------------------------- |
| Sem segredo novo     | aprovado  | Nenhuma credencial adicionada                   |
| Sem hot path API/RMS | aprovado  | UI usa mock/cache; worker só transforma payload |
| LGPD                 | aprovado  | Sem dado pessoal novo                           |
| RLS/cache            | aprovado  | Campos adicionados à migration candidata        |
| Anti-overclaim       | aprovado  | Status candidato/validado_local                 |

## 6. Validações

```text
/home/administrador/deepseek-env/bin/python3 -m py_compile packages/sync_worker.py
/usr/bin/env PORTAL_CDAM_BRANCH_IDS=13 /home/administrador/deepseek-env/bin/python3 -c "from packages.sync_worker import enrich_orders, build_purchase_orders_payload; orders=enrich_orders([{'codFilial': 1, 'numPedido': 1, 'status': 'Aberto', 'dataEmissao': '2026-08-01', 'itens': [{'sku': 'A', 'quantidadePedida': 100, 'quantidadeFaturada': 80, 'precoUnitario': 1}]}, {'codFilial': 13, 'numPedido': 2, 'status': 'Pendente', 'dataEmissao': '2026-08-01', 'itens': [{'sku': 'B', 'quantidadePedida': 200, 'quantidadeFaturada': 150, 'precoUnitario': 1}]}]); rows=build_purchase_orders_payload(orders, '2026-08-05T13:00:00Z')['rows']; print(rows[0]['orderKind'], rows[0]['fillRatePct']); print(rows[1]['orderKind'], rows[1]['fillRatePct'])"
/home/administrador/deepseek-env/bin/python3 packages/contracts/validate_contracts.py
npm run lint
npm run build
```

Resultado do smoke: `supplier_direct 80.0` e `cdam_central_depot 75.0`.

## 7. Riscos e pendências

- A extração real de itens do pedido RMS ainda precisa de mapeamento aprovado; sem linhas, o worker emite placeholder candidato.
- A regra de excluir cancelados do geral é candidata e precisa de aceite funcional.

## 8. Decisão

`apto_para_revisao`. Não homologado. Não executado contra RMS/RM.
