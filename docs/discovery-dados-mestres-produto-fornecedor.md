# Discovery - Dados mestres produto-fornecedor

- Data: 2026-08-15
- Autor: Codex
- Projeto Harness: `painel-fornecedor`
- Fase: `discovery-dados-mestres`
- Status: candidato / discovery, sem mutacao no banco operacional

## Objetivo

Registrar a analise inicial do problema de relacionamento entre produto, fornecedor e visibilidade no Portal Fornecedor. O problema nao deve ser tratado como correcao pontual da Unilever, porque a base atual mistura conceitos diferentes em um unico campo de fornecedor.

## Regra funcional candidata

Diretiva funcional informada por Oscar:

- Produto ativo/em linha deve ser importado mesmo sem estoque.
- Produto fora de linha so deve ser importado se houver estoque maior que zero.
- Produto fora de linha com estoque zero nao deve entrar na base operacional do portal.
- Bloqueio por loja nao exclui automaticamente o produto, porque um produto bloqueado pode continuar em linha.

Esta regra ainda depende de confirmar no RMS qual campo representa oficialmente produto ativo/em linha/fora de linha.

## Evidencias locais

Analise feita somente em arquivos locais e no SQLite do Portal Fornecedor.

- Banco analisado: `/lider/portal-fornecedor/db/portal.db`.
- Tabelas atuais: `fornecedores`, `produtos`, `vendas`, `perdas`, `produtos_lojas_bloqueios`, `usuarios_internos`.
- Nao existe tabela operacional de estoque no SQLite atual.
- `produtos.fornecedorCodigo` guarda o fornecedor fiscal/cadastral RMS do item, mas o portal precisa tambem de agrupamento comercial.
- `produtos.linha` existe e foi carregado de `RMS.AA3CITEM.GIT_LINHA`, mas os significados dos codigos ainda nao estao documentados localmente.
- `produtos_lojas_bloqueios` e carregada de `RMS.AA2CESTQ.GET_BLOQUEIO`, com codigos 1, 2, 3 e 4, separada do conceito de linha.
- O worker atual de estoque em `/lider/portal-fornecedor/packages/sync_worker.py` consulta `RMS.AA2CESTQ.GET_ESTOQUE`, mas com `ROWNUM <= 50`; portanto e amostra, nao sincronizacao completa.
- Busca local em `/home/administrador/rms`, `/home/administrador/RM`, `/home/administrador/rm-rms-integrador` e `/lider/portal-fornecedor/docs` nao encontrou dicionario oficial dos codigos de `GIT_LINHA`.

## Sintoma confirmado

O fornecedor `FORN-101257` esta cadastrado localmente como `FORNECEDOR COD 101257`, com CNPJ sintetico e 116 produtos `NOVO TEMPO`, sem venda associada. Isto explica a tela de sell-out vazia/incorreta para a Unilever, mas nao prova que a solucao seja editar esse fornecedor isoladamente.

Marcas comerciais associadas a Unilever aparecem localmente em outros fornecedores fiscais:

- `REXONA`, `DOVE`, `COMFORT`, `TRESEMME` aparecem principalmente em `FORN-14586`.
- `HELLMANN` aparece em `FORN-14640`.
- `KNORR` aparece em `FORN-14640` e tambem em `FORN-16689`.

Tambem foi observado o caso inverso:

- `EMPRESA BRASILEIRA DE DIST LTD` (`FORN-100702`) possui marcas de terceiros como `KIBON`, `NISSIN`, `KINDER`, `FERRERO` e `NUTELLA`.

## Modelo necessario

A correcao estrutural deve preservar o dado fiscal bruto do RMS e criar uma camada comercial acima dele:

- Fornecedor fiscal RMS: origem do produto no cadastro/NF, preservado sem sobrescrita.
- Grupo comercial virtual: consolida varias filiais/fabricas/CNPJs quando Oscar decidir que representam uma mesma empresa comercial.
- Marca: permite filtrar produtos dentro de distribuidores multi-marca.
- Distribuidor: permite representar fornecedores como EBD, que entregam produtos de varias marcas.
- Fornecedor alternativo: representa compra ocasional de item de uma marca por outro fornecedor, sem trocar o dono comercial principal.
- Tipo de item: venda, uso/consumo, insumo de producao e produto acabado.
- Receita/processo: relacao entre insumos e produtos acabados para padaria/fabricacao interna.

## Regra de importacao proposta

A importacao operacional do portal deve ser uma view/camada derivada, nao uma alteracao direta de `produtos.fornecedorCodigo`.

Pseudo-regra:

```text
incluir_no_portal =
  produto_em_linha
  OR (produto_fora_de_linha AND estoque_total_considerado > 0)

nao usar GET_BLOQUEIO como criterio de exclusao global
preservar fornecedor fiscal RMS em campo bruto
aplicar agrupamento comercial apenas na camada de visibilidade
```

## Pendencias de fonte

Antes de implementar saneamento automatico, precisam ser confirmados:

- Dicionario oficial de `RMS.AA3CITEM.GIT_LINHA`: quais codigos significam em linha, fora de linha, suspenso, uso/consumo, interno ou similar.
- Fonte completa de estoque por loja/CD: confirmar se `RMS.AA2CESTQ.GET_ESTOQUE` e a origem canonica e quais locais entram no calculo.
- Origem do fornecedor fiscal principal por NF/CNPJ e como conciliar com `GIT_COD_FOR`.
- Fonte de marca comercial oficial, se existir; caso contrario, criar classificacao assistida e auditavel.
- Fonte de fornecedor alternativo/historico de compras por item.
- Fonte de receitas/insumos para produtos processados.

## Decisao tecnica

Nao corrigir Unilever por interceptacao, mock, edicao manual de cache ou troca direta de fornecedor. A proxima fase deve criar contrato e staging de dados mestres, depois validar com amostra controlada.
