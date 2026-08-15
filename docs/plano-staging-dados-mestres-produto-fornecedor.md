# Plano - Staging de dados mestres produto-fornecedor

- Data: 2026-08-15
- Autor: Codex
- Projeto Harness: `painel-fornecedor`
- Fase: `contrato-staging-dados-mestres`
- Status: candidato tecnico, sem homologacao funcional

## Objetivo

Criar uma camada controlada para corrigir a visibilidade de produtos no Portal Fornecedor sem sobrescrever o fornecedor fiscal RMS. Esta camada deve permitir consolidar fornecedores virtuais, filtrar por marca, reconhecer distribuidores, registrar fornecedores alternativos e aplicar a regra de produto em linha/fora de linha/estoque.

## Principios

- O fornecedor fiscal RMS continua preservado como origem bruta.
- O portal passa a consultar um escopo comercial derivado.
- Nenhum mock, interceptacao ou correcao pontual de cache pode substituir o contrato.
- Bloqueio por loja e linha comercial sao conceitos separados.
- Produto ativo/em linha entra mesmo sem estoque.
- Produto fora de linha entra somente se houver estoque maior que zero.
- Produto fora de linha sem estoque nao entra na base operacional do portal.
- Produtos de uso/consumo, insumos e fabricacao interna precisam de regra propria antes de aparecer ao fornecedor externo.

## Staging proposto

### `raw_rms_product_snapshot`

Snapshot bruto dos produtos RMS usados pelo portal.

- `sku`
- `description`
- `fiscal_supplier_code`
- `line_code`
- `department_code`
- `section_code`
- `group_code`
- `subgroup_code`
- `source_updated_at`
- `synced_at`

### `raw_rms_stock_balance_snapshot`

Snapshot completo de saldo por local, sem limite de amostra.

- `branch_id`
- `sku`
- `qty_on_hand`
- `block_code`
- `source_updated_at`
- `synced_at`

### `product_line_dictionary`

Dicionario aprovado dos codigos de linha.

- `line_code`
- `line_meaning`
- `lifecycle_status`: `active`, `out_of_line` ou `unknown`
- `item_role`: `resale`, `usage_consumption`, `production_input`, `finished_good` ou `internal_unknown`
- `approved_by`
- `approval_event_id`

### `commercial_supplier_groups`

Grupo comercial virtual.

- `commercial_group_id`
- `name`
- `status`
- `approval_event_id`

### `commercial_supplier_group_members`

Relação entre fornecedor fiscal e grupo comercial.

- `commercial_group_id`
- `fiscal_supplier_code`
- `relationship_type`: `factory`, `branch`, `commercial_owner` ou `exception`
- `valid_from`
- `valid_to`

### `commercial_brands`

Cadastro comercial de marcas.

- `brand_id`
- `brand_name`
- `commercial_group_id`
- `status`

### `product_brand_assignments`

Relacionamento SKU/marca.

- `sku`
- `brand_id`
- `assignment_source`: `official`, `rule_assisted`, `manual_review`
- `confidence_pct`
- `approved_by`
- `approval_event_id`

### `product_supplier_relationships`

Relação comercial entre SKU e fornecedor.

- `sku`
- `fiscal_supplier_code`
- `commercial_group_id`
- `brand_id`
- `relationship_type`: `principal_fiscal`, `distributor_brand`, `alternative_supplier`, `manual_exception`
- `valid_from`
- `valid_to`
- `approval_event_id`

### `product_portal_visibility_snapshot`

Materialização da regra operacional do portal.

- `sku`
- `fiscal_supplier_code`
- `commercial_group_id`
- `brand_id`
- `lifecycle_status`
- `item_role`
- `stock_qty_considered`
- `blocked_branch_count`
- `inclusion_status`
- `inclusion_reason`
- `source_evidence_hash`
- `generated_at`

### `product_recipe_links`

Relação de insumo/produto acabado para fabricacao interna.

- `input_sku`
- `output_sku`
- `recipe_id`
- `conversion_qty`
- `uom`
- `status`
- `approval_event_id`

## View operacional proposta

```text
vw_supplier_product_commercial_scope
```

Regra minima:

```text
included =
  lifecycle_status = active
  OR (lifecycle_status = out_of_line AND stock_qty_considered > 0)
```

Restrições:

- `GET_BLOQUEIO` nao pode ser usado como exclusao global.
- `unknown` deve aparecer como `pending_source` ate o dicionario ser aprovado.
- uso/consumo e insumos devem ficar `restricted` ate haver regra de exibicao por perfil.

## Gates de implementacao

- Gate 1: dicionario oficial de `GIT_LINHA` aprovado.
- Gate 2: origem completa de estoque aprovada, sem `ROWNUM <= 50`.
- Gate 3: amostra Unilever validando tres fornecedores/fabricas em grupo comercial unico.
- Gate 4: amostra EBD validando distribuidor multi-marca.
- Gate 5: amostra de fornecedor alternativo com validade temporal.
- Gate 6: amostra de uso/consumo e producao interna sem exposicao indevida ao fornecedor externo.
- Gate 7: auditoria independente antes de alterar sell-out, estoque ou classificacao no portal.

## Fora de escopo nesta fase

- Alterar dados no SQLite operacional.
- Corrigir Unilever manualmente.
- Alterar tela de sell-out.
- Rodar consulta viva no Oracle RMS sem janela aprovada.
- Homologar codigos de `GIT_LINHA` por inferencia.

## Resultado da busca local

Uma busca local em documentos e projetos existentes encontrou usos de `AA3CITEM.GIT_LINHA`, `AA2CESTQ.GET_ESTOQUE` e `AA2CESTQ.GET_BLOQUEIO`, mas nao encontrou o dicionario oficial de significado dos codigos de linha. Portanto, o Gate 1 permanece bloqueante.
