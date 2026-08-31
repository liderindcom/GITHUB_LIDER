# Registro de Código — Portal do Fornecedor (Relatório MIX REtqCob)

**Data:** 2026-08-06  
**Autor/agente:** Codex  
**Fase:** 4 — UI candidata  
**Pedido/decisão:** usar o PDF `relatorio lider.pdf` como referência para criar um relatório no Portal do Fornecedor.  
**Status:** validado_local / candidato

## 1. Objetivo

Criar uma tela web baseada no modelo visual e informacional do relatório Líder `[REtqCob] - Relatório de Produtos nas Filiais - MIX`.

A tela reproduz a estrutura principal do PDF:

- cabeçalho institucional com empresa, comprador, fornecedor, departamento, período, data/hora e tag `[REtqCob]`;
- matriz larga por filiais;
- colunas fixas de produto, `LIN`, `VD` e `ETQ`;
- hierarquia seção > grupo > subgrupo > produto;
- duas linhas por produto: linha principal e linha `Ref.` com cobertura em dias;
- linha `Totais:` por subgrupo;
- legenda de `VD`, `ETQ`, `X` e `**`.

## 2. Arquivos criados

- `portal-fornecedor/src/routes/_portal.relatorio-mix.tsx`
- `portal-fornecedor/docs/controle-codigo/2026-08-06_relatorio-mix-retqcob_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/src/components/app-sidebar.tsx`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`
- `portal-fornecedor/src/routeTree.gen.ts` (gerado pelo build)

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério             | Resultado | Evidência                                                   |
| -------------------- | --------- | ----------------------------------------------------------- |
| Sem segredo novo     | aprovado  | Nenhuma credencial adicionada                               |
| Sem hot path API/RMS | aprovado  | UI usa dataset controlado local; sem consulta direta RM/RMS |
| LGPD                 | aprovado  | Sem dado pessoal                                            |
| RLS/cache            | aprovado  | Sem alteração de políticas/tabelas                          |
| Anti-overclaim       | aprovado  | Status candidato/validado_local; sem homologação declarada  |

## 6. Validações

```text
npx prettier --write src/components/app-sidebar.tsx src/routes/_portal.relatorio-mix.tsx LOVABLE_SPECIFICATION.md
npm run lint
npm run build
```

Resultados esperados:

- lint sem erros; podem permanecer warnings antigos de Fast Refresh;
- build OK e rota `/relatorio-mix` disponível.

## 7. Riscos e pendências

- O relatório usa dataset controlado derivado da estrutura do PDF, não extração live do RMS.
- Significados de `RT`, `FN`, `SA`, `R1`, `+++`, `DT.SAI.LIN` e `LIN` permanecem conforme rótulos observados no PDF; não foram inferidos semanticamente.
- Para produção, a matriz deve vir de cache PostgreSQL populado por worker assíncrono autorizado.

## 8. Decisão

`apto_para_revisao`. Não homologado.
