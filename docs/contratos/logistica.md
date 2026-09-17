# Contrato candidato — logística

**Estado:** candidato. Pedido/nota precede logística: registro sem chave de
pedido ou nota correspondente fica em quarentena, nunca no conjunto principal.

## Grão e chave

Uma linha por `empresa`, tipo, número e série do documento de transporte e
item sequencial, vinculada à nota. Rastreio é evento aditivo por chave,
timestamp e código de evento.

## Campos e corte

Inclui emissão, entrega, origem, destino, transportadora, frete, prazo,
validade e eventos de rastreio. Situação: `emitido`, `em_transito`,
`entregue`, `com_ocorrencia`, `cancelado`, `devolvido`. Corte por emissão e
watermark incremental; a definição de fill rate e da modalidade de frete é
pré-requisito de publicação.

## Integridade e operação

Reenvio idêntico é no-op pela chave natural; evento de rastreio é idempotente.
Cada lote carrega fonte, arquivo e execução. Publicação é atômica por janela;
quarentena é lote separado. Rollback reprocessa a janela e reavalia a
quarentena depois da republicação de pedido/nota.

## Retenção e dono

Prazo mínimo candidato: cinco anos fiscais para documentos; eventos agregados
seguem política aprovada. Dono candidato: Logística/Expedição.
