# Registro de Código — Portal do Fornecedor Fase 4 (sell-out código produto com DV)

**Data:** 2026-08-05  
**Executor:** Codex  
**Status:** validado_local — mapeamento RMS identificado em leitura

## Pedido

Na aba de vendas sell-out, trocar a coluna visual de SKU para mostrar o código do produto com dígito verificador.

## Decisão

Manter `sku` como chave técnica interna do portal e usar no cadastro do produto o código RMS exibível:

```text
codigoProdutoRms = AA1DITEM.DET_COD_ITEM
digitoProdutoRms = AA3CITEM.GIT_DIGITO
codigoProdutoDv = codigoProdutoRms + "-" + digitoProdutoRms
```

A tela `/vendas` passa a usar `codigoProdutoDv` na tabela, busca, seletor de produto e exportação CSV.

Exemplo validado no RMS:

```text
AGG_VDA_PROD_VEND_MES.CD_PROD = 114150
AA3CITEM.GIT_COD_ITEM = 114150
AA3CITEM.GIT_DIGITO = 3
AA1DITEM.DET_COD_ITEM = 1141500
exibição = 1141500-3
```

## Arquivos alterados

- `portal-fornecedor/src/lib/mock-data.ts`
- `portal-fornecedor/src/routes/_portal.vendas.tsx`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`
- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-4_sell-out-codigo-produto-dv_codex.md`

## Critérios

| Critério            | Resultado | Evidência                                                  |
| ------------------- | --------- | ---------------------------------------------------------- |
| Sem segredo novo    | aprovado  | Nenhuma credencial adicionada                              |
| Sem hot path RMS/RM | aprovado  | Consultas read-only de metadados/cadastro; nenhuma escrita |
| LGPD                | aprovado  | Sem dado pessoal                                           |
| Anti-overclaim      | aprovado  | Status `validado_local`, sem homologação funcional         |

## Pendências

- Homologar funcionalmente o mapeamento `AA1DITEM.DET_COD_ITEM` + `AA3CITEM.GIT_DIGITO`.
- Propagar o campo no contrato/API de sell-out quando esse endpoint for formalizado.
