# Registro de Código — Portal do Fornecedor Fase 4 (classificação mercadológica)

**Data:** 2026-08-05  
**Autor/agente:** Codex  
**Fase:** 4 — worker + contrato + UI candidata  
**Pedido/decisão:** iniciar análise da classificação mercadológica por produto.  
**Status:** validado_local / candidato

## 1. Objetivo

Criar a estrutura candidata para analisar cada SKU por:

- hierarquia mercadológica: departamento, seção, grupo, subgrupo e família;
- papel mercadológico e curva comercial;
- sell-out, participação, margem, estoque, rupturas e fill rate.

## 2. Arquivos criados

- `portal-fornecedor/src/routes/_portal.classificacao.tsx`
- `portal-fornecedor/packages/contracts/product-classification.schema.json`
- `portal-fornecedor/db/migrations/005_product_classifications.sql`
- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-4_classificacao-mercadologica-produtos_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/src/lib/mock-data.ts`
- `portal-fornecedor/src/components/app-sidebar.tsx`
- `portal-fornecedor/packages/contracts/validate_contracts.py`
- `portal-fornecedor/db/seeds/controlled_examples.json`
- `portal-fornecedor/packages/sync_worker.py`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`
- `portal-fornecedor/src/routeTree.gen.ts` (gerado pelo build)

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério            | Resultado | Evidência                                                     |
| ------------------- | --------- | ------------------------------------------------------------- |
| Sem segredo novo    | aprovado  | Nenhuma credencial adicionada                                 |
| Sem hot path RMS/RM | aprovado  | UI e contrato usam cache/mock; worker só transforma payload   |
| LGPD                | aprovado  | Sem dado pessoal                                              |
| RLS/cache           | aprovado  | Migration `product_classifications` com RLS por `supplier_id` |
| Anti-overclaim      | aprovado  | Status candidato/validado_local                               |

## 6. Validações

```text
/home/administrador/deepseek-env/bin/python3 -m py_compile packages/sync_worker.py
/home/administrador/deepseek-env/bin/python3 -c "from packages.sync_worker import build_product_classifications_payload, enrich_orders; orders=enrich_orders([{'codFilial': 1, 'numPedido': 1, 'itens': [{'sku': '10010', 'quantidadePedida': 100, 'quantidadeFaturada': 80}]}]); payload=build_product_classifications_payload([{'sku': 10010, 'quantidade': 10, 'valorVenda': 129, 'valorCmv': 91}], [{'sku': 10010, 'saldoFisico': 20}], orders, '2026-08-05T13:30:00Z'); print(payload['rows'][0]['sku'], payload['rows'][0]['commercialRole'], payload['rows'][0]['fillRatePct'])"
/home/administrador/deepseek-env/bin/python3 packages/contracts/validate_contracts.py
npm run lint
npm run build
```

Resultados:

- smoke worker: `10010 destino 80.0`
- contratos: `11 schemas`, `8 examples`, `5 migrations`
- lint sem erros; warnings antigos de Fast Refresh
- build OK

## 7. Riscos e pendências

- A árvore mercadológica RMS oficial ainda não foi mapeada/aprovada.
- O worker usa de-para candidato para SKUs conhecidos e `nao_classificado` para os demais.
- Não foi executada consulta live contra RMS/RM.

## 8. Decisão

`apto_para_revisao`. Não homologado.
