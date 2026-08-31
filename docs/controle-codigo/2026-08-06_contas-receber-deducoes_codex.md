# Registro de Código — Portal do Fornecedor (Contas a Receber / Deduções)

**Data:** 2026-08-06  
**Autor/agente:** Codex  
**Fase:** 4 — UI candidata  
**Pedido/decisão:** criar menu de `Contas a Receber` para mostrar tudo o que o fornecedor deve ao Grupo Líder e que será descontado no próximo pagamento.  
**Status:** validado_local / candidato

## 1. Objetivo

Adicionar uma área separada do menu `Financeiro` para demonstrar débitos do fornecedor com o Grupo Líder.

A nova tela cobre:

- acordos comerciais, bonificações, devoluções, avarias e verbas comerciais;
- valor total em aberto;
- valores programados para abatimento no próximo pagamento;
- cálculo do líquido previsto após descontos;
- exportação CSV dos lançamentos.

## 2. Arquivos criados

- `portal-fornecedor/src/routes/_portal.contas-receber.tsx`
- `portal-fornecedor/docs/controle-codigo/2026-08-06_contas-receber-deducoes_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/src/components/app-sidebar.tsx`
- `portal-fornecedor/src/lib/mock-data.ts`
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
npx prettier --write src/components/app-sidebar.tsx src/lib/mock-data.ts src/routes/_portal.contas-receber.tsx LOVABLE_SPECIFICATION.md docs/controle-codigo/2026-08-06_contas-receber-deducoes_codex.md
npm run lint
npm run build
```

Resultados esperados:

- lint sem erros; podem permanecer warnings antigos de Fast Refresh;
- build OK e rota `/contas-receber` disponível.

## 7. Riscos e pendências

- Os lançamentos são exemplos controlados, ainda sem integração live com RM/RMS.
- Para produção, a origem deve vir de contratos/cache autorizados e reconciliados com contas a pagar do fornecedor.
- Regras de carregamento de excedente para pagamentos seguintes precisam ser confirmadas pelo financeiro.

## 8. Decisão

`apto_para_revisao`. Não homologado.
