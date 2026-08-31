# CODE - Visibilidade comercial produto-fornecedor

- Data: 2026-08-17
- Autor: grok
- Projeto: painel-fornecedor
- Fase: visibilidade-comercial-sku
- Diretiva Oscar: pode fazer; Kibon=EBD; sorvete Nestle=Santa Marta

## Arquivos

- `rms/scripts/apply_portal_visibilidade_comercial.py`
- `src/api.ts`
- `rms/docs/visibilidade-comercial-portal-2026-08-17.md`
- `db/portal.db.bak-20260817T105847Z-visibilidade-comercial`

## Criterios

- CODE-01 Escopo: tabela de visibilidade + queries de sortimento. Sem deploy.
- CODE-02 Segredos: nenhum.
- CODE-03 RM/RMS: nenhuma leitura nesta entrega (gabarito local).
- CODE-04 LGPD: sem PII extra.
- CODE-05 Hot path: pedido, NF, financeiro permanecem `fornecedorCodigo` fiscal.
- CODE-06 Rastreabilidade: origem fiscal|grupo|gabarito + travas nominais.
- CODE-07 Validacao: aceite_kibon_ebd, aceite_nestle_santa_marta, aceite_unilever_grupo = true. Fiscal 354338 inalterado.
- CODE-08 Status: aplicado no cache local. Sem republicar.
- CODE-09 Fora: dono da marca como visibilidade; grupo Nestle de fabricas; Comfort por marca; schema Oracle.
- CODE-10 Decisao: Kibon nao e Unilever; sorvete Nestle nao e Nestle fabrica.

## Rebuild 2026-08-17T112138Z

- Gabarito so por `portal_sku`. Sem SKU+DV. Sem borda crua.
- Grupo P&G `20931`+`20932` (261 SKUs).
- 100832: 42 fiscais, 0 extra.
- Colisao: 699 fornecedores / 5496 extras -> 0.
- CODE-09 extra: nao renomear `100832` para Plast Leo; nao agrupar `101990`.
