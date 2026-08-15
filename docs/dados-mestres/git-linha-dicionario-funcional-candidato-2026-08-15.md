# Tabela candidata - dicionario funcional de GIT_LINHA

- Data: 2026-08-15
- Autor: Codex
- Status: candidato para preenchimento funcional
- Arquivo: `/home/administrador/rms/dados/portal-fornecedor-dados-mestres/git_linha_dicionario_funcional_candidato.tsv`

## Objetivo

Disponibilizar uma tabela controlada com os 138 codigos de `GIT_LINHA` encontrados na leitura RMS, para que cadastro/comercial/DBA classifiquem cada codigo antes de qualquer implementacao no Portal Fornecedor.

Esta tabela nao altera RMS, SQLite nem Portal Fornecedor. Ela e um artefato de decisao.

## Origem

Derivada de:

`/home/administrador/rms/dados/portal-fornecedor-dados-mestres/portal_fornecedor_dados_mestres_02_perfil_linha_estoque.tsv`

Resumo:

- 138 codigos de `GIT_LINHA`.
- 3.681.704 produtos analisados.
- 13.288 produtos com estoque positivo consolidado.
- 3.668.416 produtos sem estoque positivo consolidado.

## Colunas

- `line_code`: codigo `GIT_LINHA`.
- `product_count`: quantidade de produtos com o codigo.
- `fiscal_supplier_count`: fornecedores fiscais distintos com o codigo.
- `products_with_stock`: produtos do codigo com estoque positivo consolidado.
- `products_without_stock`: produtos do codigo sem estoque positivo consolidado.
- `stock_presence_pct`: percentual de produtos do codigo com estoque positivo.
- `lifecycle_status`: decisao funcional esperada.
- `item_role`: papel do item esperado.
- `portal_import_rule`: regra de importacao no Portal Fornecedor.
- `functional_meaning`: descricao funcional aprovada.
- `approved_by`: responsavel pelo aceite.
- `approval_event_id`: evento Harness/MAOADC de aprovacao.
- `notes`: observacoes.
- `evidence_source`: arquivo fonte da evidencia.
- `approval_status`: status da aprovacao.

## Valores permitidos sugeridos

### `lifecycle_status`

- `active`
- `out_of_line`
- `unknown`
- `pending_functional_review`

### `item_role`

- `resale`
- `usage_consumption`
- `production_input`
- `finished_good`
- `internal_unknown`

### `portal_import_rule`

- `include_active`
- `include_out_of_line_with_stock`
- `exclude_out_of_line_without_stock`
- `restrict_usage_consumption`
- `restrict_production_input`
- `include_finished_good`
- `pending_source`

### `approval_status`

- `pending`
- `approved`
- `rejected`
- `needs_more_evidence`

## Regra de decisao

A regra de Oscar continua:

```text
produto ativo/em linha entra mesmo sem estoque
produto fora de linha entra somente se tiver estoque maior que zero
produto fora de linha sem estoque nao entra na base operacional
bloqueio por loja nao exclui produto automaticamente
```

Mas esta regra so pode ser aplicada depois de preencher e aprovar `lifecycle_status` e `item_role` para os 138 codigos.

## Situacao atual

Todas as 138 linhas foram criadas como:

- `lifecycle_status = pending_functional_review`
- `item_role = internal_unknown`
- `portal_import_rule = pending_source`
- `approval_status = pending`

Nenhuma classificacao foi inferida automaticamente.

