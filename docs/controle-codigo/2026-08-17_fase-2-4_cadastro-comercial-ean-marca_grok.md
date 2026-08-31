# CODE - Cadastro comercial na linha

- Data: 2026-08-17
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva Oscar: EAN, referencia, marketing, GIT_DAT_SAI_LIN; PV2 interior / PV3 atacado / oferta vigente / qtd atacado; marca real; comercial separado do fiscal; modelo de entrega real

## Arquivos

- `rms/scripts/apply_portal_cadastro_comercial.py`
- `rms/docs/cadastro-comercial-portal-2026-08-17.md`
- `db/portal.db.bak-20260817T020221Z-cadastro-comercial`

## Criterios

- CODE-01 Escopo: so estes campos de cadastro.
- CODE-02 Segredos: nenhum.
- CODE-03 RM/RMS: SELECT only.
- CODE-04 LGPD: sem PII extra.
- CODE-05 Hot path: `precoTabela` continua PV1; CMV intacto.
- CODE-06 Rastreabilidade: este registro + Cérbero.
- CODE-07 Validacao: 354338 EAN; 318543 ref; 306464 marketing; 341035 PV2; 20 PV3; 5035 qtd atacado; 253158 marca; 15322 comercial<>fiscal; modelo 1709/624/283 + 8530 sem evidencia.
- CODE-08 Status: aplicado. Oferta vigente 0 em 2026-08-17 (486 janelas antigas no cadastro).
- CODE-09 Fora: faixas 4-5, teorico, GIT_ABC, GIT_MARCA_PROP, primeira palavra da descricao, default somente_cdam em massa.
- CODE-10 Decisao: comercial = gabarito, senao dono da marca, senao fiscal. DTIP_FORPRI nao e grupo Unilever.
