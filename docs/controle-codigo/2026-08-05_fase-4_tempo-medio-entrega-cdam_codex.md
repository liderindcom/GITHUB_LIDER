# Registro de Código — Portal do Fornecedor Fase 4 (tempo médio de entrega CDAM)

**Data:** 2026-08-05  
**Executor:** Codex  
**Status:** candidato técnico — não homologado

## Pedido

Calcular o tempo médio de entrega como a média dos últimos 5 pedidos entregues, medindo o prazo da data de emissão do pedido até a data de entrada no CDAM.

## Decisão

Adicionar `cdamEntryDate` e `deliveryLeadTimeDays` ao contrato de pedidos. A UI calcula:

```text
deliveryLeadTimeDays = cdamEntryDate - issueDate
averageDeliveryLeadTimeDays = media dos 5 pedidos mais recentes por cdamEntryDate
```

Pedidos sem entrada no CDAM ficam fora da média.

## Arquivos alterados

- `portal-fornecedor/src/lib/mock-data.ts`
- `portal-fornecedor/src/routes/_portal.pedidos.tsx`
- `portal-fornecedor/packages/contracts/purchase-order.schema.json`
- `portal-fornecedor/packages/sync_worker.py`
- `portal-fornecedor/db/migrations/004_purchase_orders.sql`
- `portal-fornecedor/db/seeds/controlled_examples.json`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`
- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-4_tempo-medio-entrega-cdam_codex.md`

## Validação esperada

- Contratos JSON continuam válidos.
- Worker calcula `deliveryLeadTimeDays` quando recebe `dataEntradaCdam`.
- `/pedidos` exibe card de tempo médio, coluna Entrada CDAM e detalhe por pedido.

## Pendências

- Confirmar no RMS a coluna/tabela oficial que representa a entrada física no CDAM.
- Validar funcionalmente se pedidos diretos com entrega física no CDAM devem compor a mesma janela de 5 entregues.
