# Controle de Código — Finalização das perdas físicas Agenda 520

- Data: 2026-10-06
- Escopo: Portal do Fornecedor, menu Perdas Físicas.

## Regra fechada

- A origem operacional do Portal é o RMS: `RMS.AG1CDFAT` (movimento da Agenda
  520) relacionado a `RMS.AA3CITEM` (fornecedor e descrição do item).
- A valorização usa `AG1CDFAT.DIG_QTD_FAT × AA3CITEM.GIT_CUS_MED` (custo médio
  na unidade de venda), nunca `DIG_PRECO` (preço de venda).
- O recorte segue a regra observada no CometNet: fornecedor, filial, NF, série
  e item. O CometNet foi usado somente como referência funcional; o Portal não
  consulta Intelider nem as tabelas `TB_AG520_*`.
- A leitura prioriza o lote canônico `perdas_rms_520_canonicas` ativo e mantém
  compatibilidade com a tabela legada `perdas` quando ainda não há lote ativo.
- A janela exibida e carregada é de 13 meses-calendário: mês atual e os 12
  meses anteriores.
- A ausência de dados do mês continua sendo mostrada como ausência, sem valores
  demonstrativos.

## Validação

- Build de produção concluído com sucesso.
- O script canônico foi validado sintaticamente.
- A consulta de carga não foi executada até o Oracle porque o ambiente atual
  não encontrou `libnnz19.so`; isso não impede o fallback da tabela legada nem
  o build do portal.
