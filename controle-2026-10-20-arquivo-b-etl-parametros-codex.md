# Controle de código — ETL dos parâmetros do Arquivo B

- Data: 2026-10-20
- Autor: codex
- Fase: materialização RMS → PostgreSQL para o Arquivo B
- Decisão: carregar parâmetros no ETL, sem consulta Oracle pelo Atlas.

## Alterações

- `apply_portal_refresh_fornecedor.py` passou a criar, de forma idempotente, os campos do Arquivo B em `produtos` e `estoque`.
- `AA3CITEM` agora alimenta estoque padrão, estoque de depósito, tipo/base/altura de palete.
- `AA2CIEDI` agora alimenta por loja estoque máximo como estoque padrão e calcula o percentual mínimo/máximo quando houver linhas.
- O endpoint do Arquivo B passou a usar os campos materializados, mantendo nulo quando a fonte não possui parâmetro.

## Evidência de carga

- Carga canária do fornecedor 108760 concluída com `completa=true`: 51 produtos, 1.385 estoques, 1.467 meses e 1.474 pedidos.
- `AA2CIEDI` no canário: 0 linhas; nenhum parâmetro por loja foi inventado.
- Endpoint remoto retornou para o canário `standardStock`, `boxesPerLayer` e `layersPerPallet` preenchidos.
- Refresh integral dos fornecedores ativos iniciado em 2026-10-20; no momento do registro estava processando o fornecedor 100561.

## Segurança e qualidade

- RMS somente SELECT; escrita somente no PostgreSQL do Portal.
- Nenhuma credencial, senha ou token foi gravado no código ou no registro.
- Carga atômica por fornecedor; falha do fornecedor não publica carga incompleta.
- `PYTHONPYCACHEPREFIX=/tmp/arquivo-b-pycache python3 -m py_compile ...` passou.
- `npm run build` passou após a alteração do endpoint.

## Pendências

- A relação de capacidade do depósito por loja ainda não foi encontrada na origem consultada; `capacidadeDeposito` permanece nula até o TI indicar a tabela/arquivo correto.
- A `AA2CIEDI` precisa possuir registros para que o percentual de reposição por loja seja carregado.
- Após o refresh integral, executar validação amostral por loja e aceite funcional do analista.

## Qualidade

Entrega técnica `validado_local/candidato`; aguarda término do refresh integral e aceite funcional. Não declarar homologação ou produção.
