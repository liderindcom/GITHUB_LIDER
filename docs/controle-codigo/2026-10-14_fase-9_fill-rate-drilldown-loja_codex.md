# Controle de Código — drill-down Fill Rate por loja

- Data: 2026-10-14
- Solicitação: escolher uma loja e ver o resultado do CDAM no período, com departamento, seção e demais níveis.

## Alterações

- Atlas ganhou filtro numérico de loja (`storeCode`) combinado com CDAM e período.
- A tabela passou a mostrar CDAM, loja, departamento, seção, grupo, subgrupo e SKU explicitamente.
- O nível escolhido controla a agregação; o nível SKU permite a leitura item a item.
- API elevou o limite máximo para 25.000 linhas para suportar lojas grandes sem truncar o drill-down.
- A tela informa que o indicador é quantitativo (pedidas/atendidas); não há faturamento monetário nesta base.

## Validação

- Loja 31 no corte atual possui 20 departamentos, 88 seções, 359 grupos, 1.443 subgrupos e 19.750 SKUs.
- Sem mock ou fallback.

## Correção posterior — cortes arbitrários no período materializado

- Causa observada: a API exigia que `cutStart`/`cutEnd` coincidissem exatamente
  com o snapshot de 30 dias; por isso o intervalo 05/10/2026–10/10/2026
  retornava vazio apesar de haver linhas reais no cache.
- Correção: quando o período solicitado estiver contido em um snapshot válido,
  a API consulta `fill_rate_cdam_lines`, filtra a data do pedido e agrega no
  nível escolhido. O caminho exato do snapshot permanece usando os agregados.
- Commits publicados no remoto canônico `origin/main`:
  `ffb8299` e `5a2f3d2`.
- Build de produção concluído; supervisor recarregou o runtime. Smoke público:
  resumo 05/10–10/10 respondeu HTTP 200 com 1.510.471 linhas, 1.288 pedidos,
  4.997.976,255 solicitadas e 4.919.033,565 atendidas. O drill-down por
  CDAM 2011 / loja 31 / departamento também respondeu HTTP 200 com dados.
- Sem mock, fallback ou alteração no RMS de origem; a fonte continua sendo o
  cache PostgreSQL abastecido pela leitura real do RMS.
