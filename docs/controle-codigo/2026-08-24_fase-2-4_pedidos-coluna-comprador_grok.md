# CODE - Pedidos: comprador no lugar de agenda

- Data: 2026-08-24
- Autor: grok
- Projeto: painel-fornecedor

## Regra

Na lista `/pedidos`, a coluna Agenda (texto fixo de recebimento) passa a ser Comprador.
Nome vem do cadastro do SKU (`produtos.compradorCodigo` / `compradorNome`), o mesmo mapa do mix e da sugestão de compra. Vários compradores no mesmo pedido aparecem separados por `;`.

## Arquivos

- `src/lib/comprador.ts` — `compradorPedido`
- `src/routes/_portal.pedidos.tsx`

## Fora

- Capa RMS `COMPR_CAR` ainda não está no cache de pedidos.
