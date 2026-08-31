# CODE - Sell-out mensal 24 meses (Black & Decker 103448)

- Data: 2026-08-31
- Autor: grok
- Projeto: painel-fornecedor
- Espelho: `RM/docs/controle-codigo/2026-08-31_fase-2-4_portal-vendas-mensal-103448_grok.md`

## Causa

`apply_portal_refresh_fornecedor.py` upsertava `vendas_mensal` só com os últimos 90 dias. 1034480 = Black & Decker `103448` não estava na planilha Vendas Anual (COD_FORN+DV). RMS `AGG_VDA_PROD` tinha jan/2025–ago/2026.

## Correção

Janela mensal 24 meses (diária permanece 90d). Recarga `--somente-vendas --codigo 1034480`.

## Resultado Postgres

| | |
|---|---|
| fornecedor | 103448 BLACK & DECKER |
| SKUs | 193 |
| vendas_mensal | 2273 linhas, 20 meses (2025-01..2026-08) |
| total | R$ 5.409.760,58 |
