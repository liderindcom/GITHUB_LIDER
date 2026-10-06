# Controle de Código — Finalização das perdas físicas Agenda 520

- Data: 2026-10-06
- Escopo: Portal do Fornecedor, menu Perdas Físicas.

## Regra fechada

- A origem segue o mesmo recorte do CometNet: Agenda 520, fornecedor, filial,
  NF, série e item.
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
