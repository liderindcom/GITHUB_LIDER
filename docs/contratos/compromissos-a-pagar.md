# Contrato candidato — compromissos a pagar

**Estado:** candidato; não autoriza consulta a fontes financeiras nem execução
de migração.

## Grão e chave

Uma parcela por `empresa`, `fonte_compromisso`, identificador na fonte e
parcela. Liquidação é evento aditivo identificado por chave, data do evento e
identificador da baixa.

## Campos e corte

Inclui emissão, vencimento, fornecedor, moeda, valor, situação e eventos de
liquidação. Situação: `em_aberto`, `liquidado`, `liquidado_parcial`,
`cancelado` ou `renegociado`. O corte usa vencimento, watermark incremental e
snapshot periódico da carteira em aberto.

## Integridade e operação

Reenvio idêntico é no-op pela chave natural; baixa não substitui histórico.
Linhagem registra fonte, arquivo e execução. Lote incremental e snapshot da
carteira são publicados separadamente, cada qual com manifesto. Rollback
reprocessa o lote; baixas continuam intocáveis.

## Retenção e dono

Prazo candidato: cinco anos, sujeito à validação fiscal e jurídica. Dono
candidato: Contas a Pagar/Financeiro.
