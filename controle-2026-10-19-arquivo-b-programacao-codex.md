# Controle de Código — Atlas Arquivo B: programação por loja

- Data: 2026-10-19
- Autor: Codex
- Fase: 0 — candidato técnico do Arquivo B
- Backlog/decisão: associar cada loja ao grupo de “Reforço de faturamento” do
  CometNet e exibir no Arquivo B somente as seções programadas para o dia,
  ordenadas pelo código da seção.

## Entrega

- `atlas/worker/worker.js`: tabelas D1 para grupos, associação loja → grupo,
  seções por grupo e histórico de alterações; APIs administrativas e contexto
  do Arquivo B.
- `atlas/site/public/atlas-acesso.js`: cadastro de associação loja → grupo e
  seção → grupo em “Usuários e acessos”.
- `atlas/site/public/arquivo-b.js`: leitura da programação autorizada,
  mensagem operacional e filtro diário com ordenação crescente de seção.
- Worker publicado na versão `0b519aad-64df-4ac3-a9f5-e06ff4ca8a5a`.

## Regras implementadas

- Grupos 1–8 recebem os dias padrão do quadro de programação do CometNet.
- O usuário só recebe a programação das lojas que já estão vinculadas ao seu
  acesso ao módulo Arquivo B.
- Quando a loja tem grupo e catálogo de seções cadastrados, o Arquivo B mostra
  as seções do dia de pedido e as ordena por código, depois por descrição e
  SKU.
- Sem cadastro de grupo ou de seções, nenhum item é ocultado; o sistema avisa
  que a programação ainda não foi cadastrada.
- A associação e a atualização de seções geram histórico no D1.

## Validação

- `node --check` aprovado para Worker, Arquivo B e painel de acessos.
- Deploy Wrangler concluído com dois assets atualizados.
- Health público respondeu `{"service":"atlas-site","status":"ok"}`.
- Os assets `/arquivo-b.js` e `/atlas-acesso.js` responderam HTTP 200 e
  continham a lógica de programação publicada.

## Pendências operacionais

- O administrador ainda precisa cadastrar as lojas nos grupos corretos e
  carregar as seções reais de cada grupo a partir do quadro validado do
  CometNet. Até isso ocorrer, o Arquivo B preserva todos os itens.
- A relação de dias foi inicializada com o quadro estático identificado no
  CometNet e deve ser homologada pelo responsável operacional antes de uso
  produtivo.
