# Controle de código — filtro diário do Arquivo B

- Data: 2026-10-20
- Autor: codex
- Fase: programação de faturamento/entrega do Arquivo B
- Decisão: exibir somente seções programadas para a data de entrega selecionada.

## Alterações

- A tela deixa de exibir todos os SKUs quando não há vínculo específico de programação.
- O contexto do Worker combina os grupos globais ativos quando a loja ainda não possui grupo próprio.
- A relação de seções do Reforço de Faturamento foi materializada no D1.
- A data inicial passou a ser amanhã; o filtro usa `delivery_weekday` e ordena as seções.

## Evidência

- `node --check worker.js` passou.
- Worker publicado: `c2f47470-b767-43d2-8065-eca867076083`.
- Asset remoto confirmou `eligibleGroups` e `delivery_weekday`.
- D1 recebeu 88 associações de seção idempotentes.

## Segurança e qualidade

- A autorização continua limitada ao usuário/loja/permissão do Atlas.
- Nenhuma credencial foi gravada.
- Sem consulta direta ao RMS pelo navegador.

## Pendências

- Confirmar com TI se alguma loja possui agenda específica diferente da agenda global.
- Validar funcionalmente os itens exibidos amanhã com o analista de estoque.

## Qualidade

Entrega técnica `validado_local/candidato`; aguarda aceite funcional.
