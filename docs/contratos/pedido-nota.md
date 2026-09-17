# Contrato candidato — pedido e nota

**Estado:** candidato; não autoriza carga, integração ou emissão de pedido.

## Grão e chave

Pedido: `empresa`, `numero_pedido`, fornecedor e filial. Nota: chave de acesso
fiscal; quando indisponível, `empresa`, emitente, modelo, série e número. Item
é identificado pela linha e SKU. O vínculo pedido–nota é associativo e suporta
recebimentos parciais e divergências de quantidade ou preço.

## Campos e corte

Registra emissão, cancelamento, natureza, parceiro, moeda, valores da fonte,
hash e versão. Pedido: `aberto`, `faturado_parcial`, `faturado_total`,
`cancelado` ou `bloqueado`; nota: `autorizada`, `cancelada`, `denegada`,
`inutilizada` ou `em_contingencia`. A competência (emissão, recebimento ou
escrituração) deve ser fixada pelo dono antes de cálculo financeiro.

## Integridade e operação

Deduplicação pela chave natural completa. Nota autorizada é imutável;
cancelamento é evento aditivo. Cada lote registra fonte, arquivo, hash,
execução e watermark. A publicação é atômica por janela de watermark com
manifesto de contagem e checksum; rollback recua o watermark e reprocessa a
janela, sem apagar fatos.

## Retenção e dono

Fatos imutáveis permanecem em camada fria; 24 meses em camada quente é
candidato sujeito à validação fiscal. Dono candidato: Fiscal/Faturamento.
