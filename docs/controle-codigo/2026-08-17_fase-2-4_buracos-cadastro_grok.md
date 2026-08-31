# CODE - Buracos do cadastro

- Data: 2026-08-17
- Script: `rms/scripts/apply_portal_buracos.py`
- Backup: `portal.db.bak-20260817T024534Z-buracos`

| Buraco | Resultado |
|---|---|
| CMV vazio | 24499 preenchidos (435 ULT_ENT + 24064 CUS_FOR com emb<=1). 928 o RMS nao tem custo unitario. Nao dividiu embalagem. |
| Departamento NNN | 37248 nomeados pelas secoes oficiais. 0 placeholder. |
| Comprador sem nome | 5 codigos (54,52,47,24,125) nao existem em AA3/AA2CLPRC nem CAD_COMPRADOR_CP. 806 SKUs seguem sem nome. |
| Capas sem item | +2694 itens (join sem DIGPED). 11609 capas o RMS nao tem linha. |
| Venda 2026 | 0 neste AGG_VDA_PROD (max 2025-12-29). |
| Perda 520 sem data | 110380 atomos loja×SKU com data=`sem-data`. Nao inventa dia. |
| Modelo entrega | VW03 2023+ nao acrescentou alem de NF/pedido abertos. 8530 seguem sem evidencia. |
| Marca | +27771 por dicionario unico na descricao. 73409 ainda vazia. Sem primeira palavra. |
| Oferta vigente | 1 SKU hoje. 509 janelas velhas. |
| PV3 | 20 SKUs. E o RMS. |
| Loja residual | 29,30,39,200,205,210 nomeados no AA2CTIPO. |
