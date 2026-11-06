# Controle de código — Arquivo B com RMS via cache PostgreSQL

- Data: 2026-10-20
- Autor: codex
- Fase: integração RMS/cache do Arquivo B no Atlas
- Decisão: a tela do analista consulta o cache PostgreSQL alimentado pelo RMS; não há consulta Oracle direta no navegador nem no Worker.

## Entrega

- Criado `src/routes/api/atlas/arquivo-b.ts`, endpoint GET protegido por `ATLAS_ARQUIVO_B_TOKEN`.
- O endpoint lê produtos, estoque da loja, estoque do CDAM e histórico mensal de vendas do PostgreSQL.
- Atualizado `arquivo-b-programacao-stage.js` para carregar a loja selecionada da API real e remover o snapshot demonstrativo da tela publicada.
- Atualizado o asset publicado `arquivo-b.js` do Atlas.
- Atualizado o Worker para encaminhar `/api/atlas/arquivo-b` e inserir o segredo técnico somente no lado servidor.
- Segredo técnico configurado no Worker e no ambiente PostgreSQL, sem registrar seu valor.

## Regras preservadas

- cálculo por histórico mensal e demanda agregada;
- edição do analista continua no Atlas, com justificativa e histórico;
- ordenação e filtro por departamento, seção, grupo e subgrupo permanecem na tela;
- regras de palete, capacidade, CDAM, produto novo e retorno após ruptura continuam no calculador da tela.

## Limitações conhecidas

O cache atual não possui, para esta consulta, os campos RMS de estoque padrão, percentual de reposição, capacidade de depósito e composição de palete por SKU/loja. O endpoint devolve esses campos como nulos até que o ETL os materialize. A ausência de venda não é inferida como “produto novo” sem data de entrada em linha; isso evita falsos positivos.

## Segurança e governança

- RMS não é consultado em tempo real pela API.
- Nenhuma senha ou token foi incluído em código, log, CSV, registro ou commit.
- O token técnico só é injetado pelo Worker no encaminhamento para o Portal.
- O endpoint sem o token deve responder 401; o acesso público passa somente pelo Worker.

## Validações

- `node --check arquivo-b-programacao-stage.js`
- `node --check /home/administrador/atlas-lider/atlas/worker/worker.js`
- `npm run build` — concluído com sucesso.
- asset remoto `/arquivo-b.js` — HTTP 200.
- endpoint remoto `/api/atlas/arquivo-b?storeId=1` — respondeu com `source=rms_cache_postgresql` e dados reais.
- Worker publicado: `2e328416-0e1c-42ed-8865-fe84016083fa`.

## Qualidade

Entrega técnica concluída para homologação. Ainda não é homologação funcional: é necessário um analista validar uma loja real e o TI confirmar a rotina de atualização dos campos de capacidade, palete, estoque padrão e reposição no cache.
