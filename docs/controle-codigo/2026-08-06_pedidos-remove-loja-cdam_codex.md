# Registro de Código — Portal do Fornecedor (Pedidos sem loja → CDAM)

**Data:** 2026-08-06  
**Autor/agente:** Codex  
**Fase:** 4 — UI candidata  
**Pedido/decisão:** no menu `Pedidos de Compra`, retirar pedidos de lojas para o CDAM e exibir apenas pedidos diretos do fornecedor.  
**Status:** validado_local / candidato

## 1. Objetivo

Remover da navegação do fornecedor os pedidos operacionais `CDAM` / transferência interna, mantendo a tela focada em pedidos diretos do fornecedor.

A regra de domínio e o worker continuam podendo classificar `cdam_central_depot` para rastreabilidade e para não misturar fluxos, mas esses pedidos não entram no menu do fornecedor.

## 2. Arquivos criados

- `portal-fornecedor/docs/controle-codigo/2026-08-06_pedidos-remove-loja-cdam_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/src/routes/_portal.pedidos.tsx`
- `portal-fornecedor/LOVABLE_SPECIFICATION.md`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério             | Resultado | Evidência                                                    |
| -------------------- | --------- | ------------------------------------------------------------ |
| Sem segredo novo     | aprovado  | Nenhuma credencial adicionada                                |
| Sem hot path API/RMS | aprovado  | Alteração só na UI/documentação; sem consulta direta RM/RMS   |
| LGPD                 | aprovado  | Sem dado pessoal novo                                        |
| RLS/cache            | aprovado  | Sem alteração de políticas/tabelas                           |
| Anti-overclaim       | aprovado  | Status candidato/validado_local; sem homologação declarada   |

## 6. Validações

```text
npx prettier --write src/routes/_portal.pedidos.tsx LOVABLE_SPECIFICATION.md docs/dominio-arquitetura-fase0.md
npm run lint
npm run build
```

Resultados:

- lint sem erros; permanecem 7 warnings antigos de Fast Refresh;
- build OK.

## 7. Riscos e pendências

- O contrato/worker ainda modela `cdam_central_depot`; a decisão desta entrega é somente de exibição no menu do fornecedor.
- Se o aceite funcional exigir remoção também do payload/cache, será necessária uma alteração de contrato/ETL separada.

## 8. Decisão

`apto_para_revisao`. Não homologado.
