# CODE - Número do pedido com dígito verificador

- Data: 2026-08-24
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva: exibir o pedido RMS como NROPED-DIGPED em todo o portal

## Regra

- Chave técnica no cache: `pedidos.numero` = `AG1LPEDI.NROPED_CAR` / `AG1FLPED.NROPED_CARF` (sem DV).
- Exibição: `NROPED-DIGPED`, ex. `59937-9`.
- `DIGPED` = módulo 11, pesos 2..9 da direita para a esquerda (conferido 2065/2065 no RMS).
- Loader passa a gravar `digitoPedido`; a tela calcula o DV se a coluna vier vazia.

## Arquivos

- `src/lib/pedido-numero.ts`
- `src/routes/_portal.pedidos.tsx`
- `src/routes/_portal.acordo-fillrate.tsx`
- `src/routes/_portal.logistica.tsx`
- `src/routes/_portal.conciliacao.tsx`
- `src/routes/_portal.itens.tsx`
- `src/components/agenda-entrada.tsx`
- `rms/scripts/apply_portal_pedidos_fornecedor.py`
- `rms/docs/pedidos-fornecedor-lider-2026-08-17.md`

## Criterios

- CODE-01 Escopo: só número do pedido na UI; chave de join inalterada.
- CODE-03 RM/RMS: SELECT já trazia DIGPED; a carga descartava o campo.
- CODE-05 Hot path: sem consulta RMS no request; DV no TypeScript.
- CODE-07 Validação: 59937 → 9; 689273 → 6; 65 vivos + 2000 hist = 100%.
