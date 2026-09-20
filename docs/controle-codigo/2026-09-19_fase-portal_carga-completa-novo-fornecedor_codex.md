# Controle de Código — Carga completa na entrada de fornecedor

- Data: 2026-09-19
- Autor: Codex
- Fase: Portal do Fornecedor / integração RMS.
- Solicitação: garantir que fornecedor novo só entre no Portal após carga completa.

## Alteração

- A inclusão administrativa agora aciona a carga RMS completa antes da degustação; cadastro manual não libera acesso.
- O carregador preserva o acesso bloqueado, renova a visibilidade fiscal e confere no PostgreSQL: cadastro, mix, visibilidade, estoque, vendas diária, vendas mensal, pedidos e itens.
- Vendas mensais passam a limpar somente a janela do fornecedor antes da reposição, evitando sobras que mascarariam uma carga parcial.
- A referência canônica de Perdas RMS 520 também é conferida pelo lote ativo e pela quantidade registrada.
- O resultado fica em `fornecedor_carga_completude`; divergência registra `FALHA` e impede liberação, acordo ou ativação manual.
- Controle de Acesso mostra `COMPLETA`, `PENDENTE` ou `LEGADO`, e o botão RMS agora comunica a validação de carga.

## Arquivos

- `/home/administrador/rms/scripts/apply_portal_refresh_fornecedor.py`
- `/home/administrador/rms/scripts/apply_portal_vendas_mensal_mes.py`
- `src/api.ts`
- `src/server/db.ts`
- `src/routes/_portal.admin-fornecedores.tsx`

## Validação

- `python3 -m py_compile` nos dois carregadores: concluído.
- `apply_portal_refresh_fornecedor.py --preflight`: PostgreSQL disponível; 47 fornecedores, 387477 produtos e 2738648 linhas mensais.
- `npm run build`: concluído.
- `npx tsc --noEmit`: dívida preexistente em diversas rotas e em `src/api.ts`; nenhuma falha de sintaxe ou tipo atribuída a este portão.

## Riscos e pendências

- A confirmação operacional integral ocorrerá na primeira inclusão/revalidação real; até lá nenhum novo fornecedor pode ser liberado pelo fluxo sem o registro `COMPLETA`.
- A carga usa somente SELECT na origem RMS e grava no PostgreSQL do Portal; não há consulta direta da interface ao RMS.


## Validação operacional posterior

- Em 2026-09-20, a carga real do fornecedor RMS `11640` (BRF S.A.) concluiu com `COMPLETA` no PostgreSQL.
- Conferência registrada: 349 produtos/visibilidades, 6.964 chaves SKU+loja de estoque, 264.709 vendas diárias, 7.193 linhas mensais, 303 pedidos, 6.983 itens e lote canônico de perdas com 28.463 registros.
- O primeiro ciclo detectou 16 linhas de estoque que convergiam para as mesmas chaves SKU+loja; o carregador passou a consolidar valores por chave antes do upsert. A repetição conferiu integralmente.
