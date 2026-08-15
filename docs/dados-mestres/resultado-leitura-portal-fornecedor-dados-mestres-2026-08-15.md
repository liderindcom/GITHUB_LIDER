# Resultado da leitura RMS - dados mestres do Portal Fornecedor

- Data: 2026-08-15
- Autor: Codex
- Status: leitura SELECT concluida; fonte de linha ainda bloqueante

## Escopo

Foram rodadas somente consultas `SELECT` no Oracle RMS, usando o pacote `portal_fornecedor_dados_mestres_01..08`. Nenhuma escrita, carga, rotina, alteracao de schema ou alteracao de dados foi executada.

## Arquivos gerados

Diretorio: `/home/administrador/rms/dados/portal-fornecedor-dados-mestres/`

- `portal_fornecedor_dados_mestres_01_descobrir_fontes.tsv`: 218 linhas de metadados.
- `portal_fornecedor_dados_mestres_02_perfil_linha_estoque.tsv`: 138 codigos de linha.
- `portal_fornecedor_dados_mestres_03_amostras_comerciais.tsv`: 500 produtos de amostra comercial.
- `portal_fornecedor_dados_mestres_04_fornecedor_fiscal.tsv`: 200 fornecedores fiscais por volume de produtos.
- `portal_fornecedor_dados_mestres_05_bloqueio_nao_linha.tsv`: 92 combinacoes linha/bloqueio.
- `portal_fornecedor_dados_mestres_06_dicionario_linha.tsv`: 0 linhas de dados em `AA1LINHA`.
- `portal_fornecedor_dados_mestres_07_dicionario_marca.tsv`: 500 marcas.
- `portal_fornecedor_dados_mestres_08_perfil_linha_valida.tsv`: 7321 combinacoes de `GIT_LINHA` e `GIT_LINHA_VALIDA`.

## Achados

### 1. Estoque

`RMS.AA2CESTQ.GET_ESTOQUE` foi lida com sucesso como fonte de saldo por produto/local.

Resumo do perfil por linha:

- Total de produtos analisados em `AA3CITEM`: 3.681.704.
- Produtos com estoque positivo consolidado: 13.288.
- Produtos sem estoque positivo consolidado: 3.668.416.
- Codigos de linha encontrados: 138.

Este resultado confirma que existe fonte de estoque para aplicar a regra de Oscar:

```text
incluir = produto_em_linha OR (produto_fora_de_linha AND estoque > 0)
```

Mas ainda falta definir quais linhas representam produto em linha e fora de linha.

### 2. Linha

`RMS.AA1LINHA` existe, mas retornou 0 linhas. Portanto, ela nao resolve o dicionario funcional de `GIT_LINHA`.

`GIT_LINHA_VALIDA` foi lido, mas retornou muitos valores distintos e nao se comportou como dicionario simples. O maior valor agregado e `0`, seguido de muitos valores numericos que parecem codigos de validade/controle, nao descricao funcional.

Conclusao: o Gate 1 continua bloqueado. Nao podemos inferir automaticamente ativo/fora de linha apenas pelos codigos `M0`, `S0`, `RR`, `SA` etc. sem aceite funcional.

### 3. Bloqueio

`GET_BLOQUEIO` apareceu em combinacoes com diversas linhas, reforcando que bloqueio por loja e linha do produto sao dimensoes separadas.

Exemplos de maior volume:

- `M0` com bloqueio `1`: 2.222 produtos distintos / 60.953 linhas produto-local.
- `M0` com bloqueio `4`: 5.309 produtos distintos / 29.633 linhas produto-local.
- `S0` com bloqueio `1`: 412 produtos distintos / 11.332 linhas produto-local.

Isto confirma a regra: bloqueio nao deve excluir automaticamente produto em linha.

### 4. Marcas

`RMS.AA1MARCA` retornou dados e e fonte candidata para dicionario de marcas.

Tambem existem campos candidatos:

- `AA1DITEM.DET_MARCA`
- `AA3CITEM.GIT_MARCA_PROP`
- `AA1MARCA.MAR_MARCA`

Sera necessario validar qual campo e oficial para o Portal Fornecedor.

### 5. Amostras comerciais

A amostra de marcas confirmou que o problema nao e exclusivo da Unilever:

- `DOVE` apareceu em mais de um fornecedor fiscal, com concentracao em `14586`.
- `REXONA` apareceu em mais de um fornecedor fiscal, com concentracao em `14586`.
- `HELLMANN` apareceu em mais de um fornecedor fiscal, com concentracao em `14640`.
- `KNORR` apareceu em mais de um fornecedor fiscal.
- `KIBON`, `NISSIN`, `KINDER` e `FERRERO` apareceram em amostras associadas ao fornecedor `100702`, reforcando o caso de distribuidor multi-marca.

Como a consulta 03 e uma amostra limitada a 500 linhas, ela serve para validar o desenho, nao para homologar classificacao completa.

### 6. Fornecedor fiscal

`AA1DTIPO` possui `DTIP_RAZAO_SOCIAL` e `DTIP_FORPRI`, mas nao possui `DTIP_CGC_CPF` nesta base. A fonte do documento fiscal/CNPJ principal permanece pendente.

## Decisao tecnica

Nao liberar implementacao operacional ainda.

O pacote destravou parte da fonte:

- estoque completo por leitura em `AA2CESTQ`;
- marca como fonte candidata;
- fornecedor fiscal por `GIT_COD_FOR`/`DTIP_FORPRI`;
- bloqueio separado de linha.

Mas manteve bloqueado:

- dicionario oficial de `GIT_LINHA`;
- regra de produto em linha/fora de linha;
- fonte oficial do documento fiscal/CNPJ;
- aceite funcional de grupo comercial, marca, distribuidor e fornecedor alternativo.

## Proximo passo

Abrir validacao funcional com comprador/cadastro/DBA RMS para classificar os 138 codigos de `GIT_LINHA` ou apontar a tabela oficial que traduz esses codigos.

Tabela candidata criada para essa classificacao:

`/home/administrador/rms/dados/portal-fornecedor-dados-mestres/git_linha_dicionario_funcional_candidato.tsv`

Documentacao:

`/home/administrador/rms/docs/git-linha-dicionario-funcional-candidato-2026-08-15.md`
