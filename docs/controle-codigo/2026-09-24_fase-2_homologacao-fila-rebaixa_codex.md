# CODE — Homologação isolada da fila de rebaixas do Portal

Espelho do registro canônico em
`/home/administrador/RM/docs/controle-codigo/2026-09-24_fase-2_homologacao-fila-rebaixa_codex.md`.

## Entrega

- Criada a rota isolada `src/routes/homologacao-rebaixa.tsx`.
- A fila e a caixa de seleção da planilha aparecem antes da listagem de ofertas
  do CometNet, reproduzindo o ponto correto para validação visual.
- Não há chamada para banco, RMS, CometNet ou compartilhamento SMB.

## Status

`validado_local` / `aguarda_aceite`.

Validação local: Prettier e `npm run build` aprovados.
