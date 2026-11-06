# Controle de Código — Atlas Arquivo B: novos produtos e retorno após ruptura

- Data: 2026-10-19
- Autor: Codex
- Fase: 0 — candidato técnico do Arquivo B
- Backlog/decisão: calcular abastecimento sem penalizar produtos novos nem
  períodos em que o fornecedor/CDAM ficou mais de 60 dias sem abastecer.

## Entrega

- `atlas/site/public/arquivo-b.js`: contrato e cálculo para produto novo,
  produto referência do subgrupo e histórico ajustado antes da ruptura.
- `atlas/prototype/arquivo-b.js`: protótipo mantido com a mesma regra.
- Worker publicado na versão `1ab1ff31-cb81-4f8e-8f1c-8a7144f1d327`.

## Regras implementadas

- Produto novo pode ser identificado por `produto_novo` ou
  `historico_vendas_dias=0`.
- Produto novo usa estoque padrão/exposição; quando disponível, usa a média
  dos produtos com demanda positiva do mesmo subgrupo.
- Ausência de parâmetro não gera quantidade inventada e aparece como
  `Produto novo sem parâmetro`.
- Ruptura é detectada com `dias_sem_abastecimento` (incluindo aliases de dias
  sem faturamento/fornecimento) igual ou superior a 60 dias.
- No retorno, a demanda anterior à ruptura (`demanda_anterior_ruptura`) tem
  prioridade; se não existir, usa produto referência do subgrupo.
- O período sem abastecimento não é interpretado como venda zero.
- A origem da demanda, os dias de ruptura e a situação são exibidos no detalhe
  e exportados na planilha.

## Validação

- `node --check` aprovado nos arquivos publicados e no protótipo.
- Asset público `/arquivo-b.js` respondeu HTTP 200.
- Asset publicado contém as regras `Produto novo sem parâmetro`, `Retorno após
  ruptura`, `dias_sem_abastecimento` e `Produto referência do subgrupo`.

## Pendências operacionais

- O extrator RMS/cache precisa fornecer os campos de produto novo, dias sem
  abastecimento e demanda anterior à ruptura; sem eles o sistema preserva o
  cálculo normal e não cria classificação artificial.
- A regra é candidata e deve ser comparada com casos reais antes de
  homologação produtiva.
