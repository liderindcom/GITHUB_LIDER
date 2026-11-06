# Controle de código — aba de programação do Arquivo B

- Data: 2026-10-20
- Autor: codex
- Fase: interface do cálculo e programação de entrega
- Decisão: retirar a agenda do cabeçalho e exibi-la em uma aba própria do card da planilha.

## Alterações

- Aba `Cálculo` mantém filtros, tabela e edição.
- Aba `Programação` exibe grupo, pedido, CDAM/faturamento, entrega e seções consideradas.
- A programação é recalculada quando loja ou data são alteradas.

## Evidência

- `node --check worker.js` passou.
- Worker publicado: `b1b4c49c-5eec-4c35-a078-52fd44c4fab4`.
- Asset remoto confirmou a aba e o painel de programação.

## Segurança e qualidade

- Mantida a autorização por usuário, loja e permissão.
- Nenhuma credencial gravada.

## Qualidade

Entrega técnica `validado_local/candidato`; aguarda aceite funcional.
