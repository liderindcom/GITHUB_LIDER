# CODE — Fase 2: carga inicial progressiva por fornecedor

Espelho do registro canônico em `RM/docs/controle-codigo/2026-09-20_fase-2_carga-inicial-progressiva_codex.md`.

- A sessão libera cadastro, catálogo e estoque assim que as três leituras canônicas terminam.
- Vendas detalhadas e informações dos menus secundários continuam a ser carregadas em segundo plano, sem nova consulta duplicada.
- Ao mudar de fornecedor, o cache anterior é limpo antes da primeira atualização; nenhum indicador do fornecedor anterior fica visível.
- Build do Portal aprovado.
