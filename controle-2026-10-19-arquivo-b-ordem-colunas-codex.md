# Controle de Código — Atlas Arquivo B: ordem das colunas

- Data: 2026-10-19
- Autor: Codex
- Fase: 0 — ajuste de usabilidade
- Backlog/decisão: mostrar a sugestão de pedido antes da situação na planilha
  de cálculo, mantendo a sugestão como última coluna do CSV exportado.

## Entrega

- `atlas/site/public/arquivo-b.js`: coluna visual `Sugestão de pedido` movida
  para antes de `Situação`.
- Worker publicado na versão `db8fcc21-e01f-4c3a-9c66-a8c00e0380ea`.

## Validação

- `node --check` aprovado.
- Deploy Wrangler concluído; asset Arquivo B atualizado.
- A exportação CSV mantém `sugestao_pedido` na última coluna, conforme regra
  anterior.
