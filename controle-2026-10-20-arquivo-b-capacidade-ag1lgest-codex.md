# Controle de código — capacidade do depósito no Arquivo B

- Data: 2026-10-20
- Autor: codex
- Fase: materialização RMS → PostgreSQL para o Arquivo B
- Decisão: carregar capacidade da constelação `RMS.AG1LGEST` no ETL, sem consulta Oracle pelo Atlas.

## Alterações

- `apply_portal_refresh_fornecedor.py` consulta `AG1LGEST` por entidade e produto.
- Capacidade específica do produto tem prioridade sobre a capacidade genérica (`LGE_PRODUTO_DE=0`).
- A capacidade genérica é aplicada somente aos registros existentes da loja, sem inventar linhas de estoque.
- Atualizações nulas não sobrescrevem parâmetros já materializados.

## Evidência

- `py_compile` passou.
- Carga-canário do fornecedor `108760` concluída com `completa=true`.
- Resultado: `capacidade_especifica=11`, `capacidade_generica=4`, `capacidade_updated=67`.
- Endpoint remoto do Atlas retornou `source=rms_cache_postgresql` e `capacity=200` para a loja 43.

## Segurança e qualidade

- RMS somente SELECT; escrita somente no PostgreSQL do Portal.
- Nenhuma credencial, senha ou token gravado.
- Sem consulta Oracle pelo navegador/Atlas.

## Pendências

- Validar amostra funcional com analista de estoque.
- Confirmar se a capacidade genérica da entidade representa limite global do depósito ou deve ser refinada por seção.

## Qualidade

Entrega técnica `validado_local/candidato`; aguarda aceite funcional.
