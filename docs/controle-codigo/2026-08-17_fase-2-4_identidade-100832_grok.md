# CODE - Identidade 100832 Plast Leo

- Data: 2026-08-17
- Autor: grok
- Projeto: painel-fornecedor
- Diretiva Oscar: corrigir o fornecedor 100832

## Fonte

`RMS.AA2CTIPO` F `TIP_CODIGO=100832`

- razao: PLAST LEO LTDA
- fantasia: PLAST LEO
- CGC: 53785291000137

`AA1DTIPO.DTIP_RAZAO_SOCIAL` deste codigo e vazio. O sync antigo joineava `GIT_COD_FOR=DTIP_FORPRI` e gravava nome/CNPJ inventados. O nome P&G no portal era o da razao de `101990`.

## Aplicado

| Campo | Antes | Depois |
|---|---|---|
| nome | PROCTER & GAMBLE DO BRASIL S/A | PLAST LEO LTDA |
| cnpj | 00.000.100832/0001-99 | 53.785.291/0001-37 |
| comercial | P&G | PLAST LEO |
| SKUs | 42 Plast Leo | 42 Plast Leo |
| visibilidade | 42 | 42 |

Backup: `db/portal.db.bak-20260817T112852Z-identidade-100832`

Sync: `scripts/sync_oracle_to_sqlite.py` passa a ler nome/CNPJ de `AA2CTIPO`. Nao rodei sync geral.

## Criterios

- CODE-01 Escopo: so identidade do 100832 + fonte do sync.
- CODE-03 RMS: SELECT.
- CODE-05 visibilidade e fiscal intactos.
- CODE-09 Fora: nao recarregar CNPJ dos 11144 sintetico; nao agrupar 101990; acessoLiberado permanece 0.
