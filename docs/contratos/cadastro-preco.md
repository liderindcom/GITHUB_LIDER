# Contrato candidato — cadastro e preço

**Estado:** candidato; não autoriza carga, integração ou decisão automática.

## Grão e chave

Uma versão por `empresa`, `filial`, `sku`, `tipo_preco`, `canal`, `moeda` e
`data_inicio_vigencia`. EAN é atributo; não é chave. A fonte deve declarar a
unidade de compra e de venda, tributos/ST, cascata de desconto e bonificação
financeira ou em mercadoria.

## Campos e vigência

Além da chave: `preco_unitario`, `unidade_medida`, `data_fim_vigencia`,
`situacao`, `origem`, `versao_registro` e `hash_conteudo`. Situação é
`ativo`, `inativo`, `pendente_aprovacao` ou `substituido`; origem é
`arquivo_fonte`, `api_fonte` ou `ajuste_auditado`. Fim nulo significa vigente.
Sobreposição de vigência só pode ser publicada após regra explícita do dono.

## Integridade e operação

O hash determinístico da chave e conteúdo torna reenvio idêntico um no-op;
conteúdo divergente cria versão, nunca sobrescreve histórico. Cada registro
guarda fonte, identificador e hash do arquivo, horário de extração e execução
da carga. A publicação é atômica por `data_referencia`, empresa e filial; o
rollback repõe a partição anterior, sem apagar versões.

## Retenção e dono

Snapshots diários: 90 dias candidatos, com consolidação mensal; versões:
camada fria permanente até aprovação de política de retenção. Dono candidato:
Cadastro e Precificação, a nomear pela gestão.
