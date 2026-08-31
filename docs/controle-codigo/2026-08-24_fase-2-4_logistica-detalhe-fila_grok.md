# CODE - Logística: detalhe da fila de entrada

- Data: 2026-08-24
- Autor: grok
- Projeto: painel-fornecedor

## Regra

Na card Entrada física pendente:
- NF-e: abre o detalhe no portal com os itens do XML (`nfe_xml_itens` / conciliação). SEFA é atalho no painel, não a ação principal.
- Pedido: painel local com itens de `pedido_itens`.

Sem consulta RMS no request.

## Arquivo

- `src/routes/_portal.logistica.tsx`
