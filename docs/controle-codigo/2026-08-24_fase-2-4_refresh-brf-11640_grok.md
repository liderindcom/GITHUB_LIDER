# CODE - Atualizar dados BRF no portal

- Data: 2026-08-24
- Autor: grok
- Projeto: painel-fornecedor

## Regra

BRF fiscal `11640` (BRF S/A-PA, CNPJ 01.838.723/0263-55) entra no cadastro com acesso liberado e recarga RMS (produto, visibilidade, estoque, venda, pedido).

## Resultado

| objeto | n |
|---|---:|
| produtos | 338 upsert (359 no cache) |
| visibilidade fiscal | 338 |
| estoque | 127 |
| vendas diárias 90d | 269035 |
| vendas mensal | 1154 |
| pedidos | 284 capas / 6609 itens |

## Arquivo

- `rms/scripts/apply_portal_refresh_fornecedor.py --codigo 11640`
