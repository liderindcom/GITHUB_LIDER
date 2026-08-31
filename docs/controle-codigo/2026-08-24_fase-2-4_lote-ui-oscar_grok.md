# CODE - Lote UI Portal Fornecedor (diretivas Oscar 2026-08-24)

- Data: 2026-08-24
- Autor: grok
- Projeto: painel-fornecedor
- Espelho: `RM/docs/controle-codigo/2026-08-24_fase-2-4_portal-lote-ui-oscar_grok.md`

## Escopo (além de DV, comprador, logística, BRF e sell-out compra)

| Tela | Mudança |
|---|---|
| Relatório acordo de acesso | títulos sem "1%"; filtro "vendas no período" / "valor do período" |
| Estoque | título "Estoque Ideal"; cards Qualidade filtram a tabela (toggle); paginação; pares ativos |
| Perdas físicas | competência mensal; seletor de mês (default corrente) |
| Dashboard | Posições críticas com código+DV |
| Meus itens | coluna Comercial removida |
| Contas a receber | só títulos não recebidos / não baixados (`status<>Descontado`, vencimento≥hoje) |
| Estoque (perf) | cartesian SKU×loja reduzido; 120 linhas por página |

Cores da Qualidade revertidas a pedido. Sem homologação.
