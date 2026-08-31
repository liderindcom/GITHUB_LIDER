# Registro de Código — Portal do Fornecedor Fase 4 (classificação mercadológica ABCD)

**Data:** 2026-08-05  
**Executor:** Codex  
**Status:** validado_local — candidato funcional

## Pedido

Reorganizar a classificação mercadológica para usar `código - descrição` em departamento, seção, grupo e subgrupo. Recalcular a classe ABCD pela venda média dos últimos 90 dias dentro de cada subgrupo.

## Decisão

Cada produto passa a carregar:

```text
departmentCode / department
sectionCode / section
groupCode / group
subgroupCode / subgroup
abcClass recalculada
```

Regra ABCD:

```text
avgDailySales90Amount = sellOutAmount90d / 90
ordenar SKUs do subgrupo por avgDailySales90Amount desc
A: até 50%
B: 50,1% até 80%
C: 80,1% até 98%
D: 98,1% até 100%
```

## Arquivos alterados

- `portal-fornecedor/src/lib/mock-data.ts`
- `portal-fornecedor/src/routes/_portal.classificacao.tsx`
- `portal-fornecedor/packages/contracts/product-classification.schema.json`
- `portal-fornecedor/db/migrations/005_product_classifications.sql`
- `portal-fornecedor/db/seeds/controlled_examples.json`
- `portal-fornecedor/packages/sync_worker.py`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`
- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-4_classificacao-mercadologica-abcd_codex.md`

## Critérios

| Critério            | Resultado | Evidência                                        |
| ------------------- | --------- | ------------------------------------------------ |
| Sem segredo novo    | aprovado  | Nenhuma credencial adicionada                    |
| Sem hot path RMS/RM | aprovado  | UI/API seguem cache; consulta RMS apenas leitura |
| LGPD                | aprovado  | Sem dado pessoal                                 |
| Anti-overclaim      | aprovado  | Status `validado_local`, sem aceite funcional    |

## Pendências

- Homologar descrições oficiais das hierarquias mercadológicas no RMS.
- Confirmar se a janela dos 90 dias deve excluir dias sem venda/ruptura ou sempre dividir por 90 corridos.
