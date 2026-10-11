# Gestão do catálogo do fornecedor

## Objetivo

Transformar a planilha importada em registros administráveis no catálogo do
fornecedor, sem publicar automaticamente produtos para o Grupo Líder.

## Comportamento implementado

- A importação grava cada linha como `RASCUNHO`.
- O fornecedor pode pesquisar e filtrar seu catálogo por texto e status.
- Cada produto possui visualização da ficha comercial e dos campos técnicos
  importados da ficha Líder.
- Produtos existentes podem ser editados; a edição retorna o item para revisão
  do fornecedor.
- Produtos podem ser arquivados sem serem apagados do banco.
- O envio usa o estado `ENVIADO_PARA_ANALISE`; `APROVADO` e `REJEITADO` ficam
  reservados ao fluxo interno do Grupo Líder.
- Código do fornecedor, SKU/referência, EAN13 e DUN14 são verificados contra
  registros ativos do mesmo fornecedor. A planilha inteira é validada antes da
  primeira gravação, evitando importação parcial por duplicidade.

## Limites desta etapa

Ainda falta a tela interna de análise do Grupo Líder e o histórico append-only
de versões. Esses itens devem ser construídos sobre os estados já definidos,
sem permitir que o fornecedor altere aprovação ou rejeição.

## Validação

- ESLint dos arquivos do catálogo: aprovado.
- Build client, SSR e Nitro: aprovado.
- Alterações não relacionadas no repositório não foram incluídas.
