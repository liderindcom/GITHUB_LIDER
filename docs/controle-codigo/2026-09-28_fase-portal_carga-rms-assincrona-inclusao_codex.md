# Controle de Código — inclusão assíncrona de fornecedor

- Data: 2026-09-28
- Autor: Codex
- Projeto: Portal do Fornecedor
- Solicitação: eliminar o erro 504 ao incluir fornecedor no Controle de Acesso.

## Alteração

- A inclusão agora inicia a carga RMS em subprocesso e devolve a resposta HTTP imediatamente.
- A carga é marcada como `PROCESSANDO`; o administrador acompanha a linha e o painel consulta seu estado periodicamente.
- Somente o callback de término que recebe `COMPLETUDE_JSON` válido ativa a degustação de 30 dias.
- Falha de processo ou de confirmação permanece visível como `FALHA`, sem liberar o fornecedor.

## Validação

- `npm run build` passou.
- `npx prettier --check` passou nos dois arquivos alterados.
- `git diff --check` passou.
- `npx tsc --noEmit` e lint global possuem falhas preexistentes fora do escopo; não houve erro apontando às linhas desta entrega.
- Não foi disparada carga RMS real, nem houve alteração direta de banco, segredo ou produção.

## Entrega

- Commit e push serão registrados após a revisão final do diff.
