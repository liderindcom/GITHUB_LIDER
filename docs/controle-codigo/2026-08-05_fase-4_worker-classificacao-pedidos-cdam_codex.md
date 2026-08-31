# Registro de Código — Portal do Fornecedor Fase 4 (worker classifica pedidos Fornecedor x CDAM)

**Data:** 2026-08-05  
**Autor/agente:** Codex  
**Fase:** 4 — sync worker candidato  
**Pedido/decisão:** aplicar no worker a separação entre pedido direto ao fornecedor e pedido feito para o CDAM.  
**Status:** validado_local / candidato

## 1. Objetivo

Fazer o `sync_worker.py` emitir pedidos enriquecidos com `orderKind`:

- `supplier_direct`
- `cdam_central_depot`

A classificação usa `PORTAL_CDAM_BRANCH_IDS` quando configurado e, sem configuração, fallback candidato para filial `13`.

## 2. Arquivos criados

- `portal-fornecedor/docs/controle-codigo/2026-08-05_fase-4_worker-classificacao-pedidos-cdam_codex.md`

## 3. Arquivos editados

- `portal-fornecedor/packages/sync_worker.py`
- `portal-fornecedor/docs/dominio-arquitetura-fase0.md`

## 4. Arquivos removidos

- nenhum

## 5. Critérios

| Critério                   | Resultado | Evidência                                                     |
| -------------------------- | --------- | ------------------------------------------------------------- |
| Sem segredo novo em código | aprovado  | Nenhuma credencial adicionada                                 |
| Sem escrita RM/RMS         | aprovado  | Mudança só transforma payload do worker                       |
| LGPD                       | aprovado  | Consulta de pedidos deixou de selecionar/persistir nome e CPF |
| API sem hot path           | aprovado  | API continua prevista sobre cache PostgreSQL                  |
| Anti-overclaim             | aprovado  | Entrega candidata/local                                       |

## 6. Validações

```text
/home/administrador/deepseek-env/bin/python3 -m py_compile packages/sync_worker.py
/home/administrador/deepseek-env/bin/python3 -c "from packages.sync_worker import enrich_orders, build_purchase_orders_payload; orders=enrich_orders([{'codFilial': 1, 'numPedido': 1, 'status': 'Aberto', 'dataEmissao': '2026-08-01'}, {'codFilial': 13, 'numPedido': 2, 'status': 'Pendente', 'dataEmissao': '2026-08-01'}]); print(build_purchase_orders_payload(orders, '2026-08-05T12:30:00Z')['rows'][1]['orderKind'])"
```

Resultado esperado do smoke: `cdam_central_depot`.

## 7. Riscos e pendências

- A lista definitiva de filiais CDAM depende de aceite funcional/DBA.
- Os itens de pedido ainda aparecem no payload contratual como placeholder candidato (`PENDENTE_DETALHE_RMS`) até mapear a tabela/colunas de itens.
- Há credenciais pré-existentes no worker legado; esta entrega não adicionou credenciais, mas a remoção/parametrização deve ser tratada em hardening separado.

## 8. Decisão

`apto_para_revisao`. Não homologado. Não executar contra RMS/RM sem janela aprovada.
