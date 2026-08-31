# CODE - Remover fornecedores inativos do portal

- Data: 2026-08-18
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva: tirar do portal todos os fornecedores inativos

## Regra

Inativo no portal = `acessoLiberado != 1` (sem acesso liberado). Não é flag RMS.

## Aplicado

| Antes | Depois |
|---|---|
| 11.146 em `fornecedores` (4 ativos, 11.142 inativos) | 4 ativos |
| sync inseria todo `GIT_COD_FOR` | sync só atualiza quem já está no portal |
| seletor do header: 100 primeiros, inclusive inativos | só `acessoLiberado = 1` |
| admin listava o cadastro inteiro | só ativos; inclusão por código RMS |

Produtos, vendas e demais fatos dos inativos ficam. Backup: `db/portal.db.bak-20260818T000432Z-fornecedores-inativos`

Restantes: `100561` Nestlé, `13003` Tirolez, `704894` BTD, `4050` Nestlé demo.

## Arquivos

- `scripts/sync_oracle_to_sqlite.py`
- `src/api.ts` — `fetchFornecedoresList`, `searchFornecedores`, `includeSupplier`
- `src/routes/_portal.admin-fornecedores.tsx`

## Criterios

- CODE-01 Escopo: cadastro de fornecedores do portal e listas de acesso.
- CODE-03 RMS: SELECT só para inspecionar `FOR_LINHA` (não usado na regra).
- CODE-05 Fatos (produto, venda, pedido) não apagados.
- Fora: apagar SKU/venda de inativo; usar `FOR_LINHA` como critério.
