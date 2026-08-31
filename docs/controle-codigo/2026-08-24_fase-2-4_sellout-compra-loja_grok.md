# CODE - Sell-out: quantidade comprada da loja

- Data: 2026-08-24
- Autor: grok
- Projeto: painel-fornecedor
- Espelho: `RM/docs/controle-codigo/2026-08-24_fase-2-4_portal-sellout-compra-loja_grok.md`

## Regra

Coluna **Qtd comprada** em `/vendas` (sell-out), no período filtrado:

- **Estocado:** transferência CDAM→loja (`AG1LPEDI`/`AG1FLPED` com `CODFOR` tipo D, qty `QTDENT`). Cache `transferencias_cdam`.
- **Direto loja / diretíssimo:** entrega do fornecedor na loja (`quantidadeFaturada` = `QTDENT` do pedido ao fornecedor; destino não é CDAM).
- **Unidade:** a mesma da venda. `QTDENT` RMS entra na embalagem de compra (`EMB_DET` / `GIT_EMB_FOR`); a tela multiplica por `produtos.embalagemCompra`. Item KG (`emb=1`) já está em kg.

Agrupamento por dia mostra o total do período na loja (não o dia exato da transferência). KPI soma os SKUs visíveis na tabela filtrada.

Não é quantidade pedida e não é entrada do fornecedor no CDAM.

## Arquivos

- `src/routes/_portal.vendas.tsx`
- `src/api.ts` (`fetchTransferenciasCdam`)
- `src/context/portal-context.tsx`
- `src/lib/mock-data.ts`
- `rms/scripts/apply_portal_transferencias_cdam.py`

## Validação

Playwright BRF 11640, 24/07–22/08: Comprado **28.507 un** (caixas convertidas). Filé peito L50: 45 cx × 12 = **540 un**. Bisteca L07: **1.800 kg** (granel, emb=1). Sem homologação.
