# Contrato candidato — vendas e recebíveis previstos

**Estado:** derivado, candidato e regenerável; não é fonte primária nem saldo
bancário.

## Grão e chave

Uma parcela por `empresa`, chave de pedido ou nota, número de parcela e data
prevista, dentro de um snapshot identificado por data de referência e versão
de geração. Depende de pedido/nota validado.

## Campos e corte

Inclui valor previsto, moeda, situação e versões das entradas consumidas.
Situação: `prevista`, `reprogramada`, `cancelada_pela_origem` ou
`substituida`. O corte é diário e cada snapshot é imutável.

## Integridade e operação

Regenerar produz nova versão, nunca sobrescreve a anterior; deduplicação usa
a chave e a versão. Linhagem registra execução de geração, versões de
pedido/nota e versão da regra. A unidade de publicação é o snapshot completo;
consumidores nunca leem versão parcial. Rollback apenas troca o ponteiro para
a versão anterior ou regenera.

## Retenção e dono

Snapshots diários: 90 dias candidatos, consolidação mensal posterior. Dono
candidato: Financeiro/Controladoria Comercial.
