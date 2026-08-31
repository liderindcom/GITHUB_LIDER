# CODE - Debito financeiro + logistica

- Data: 2026-08-17
- Autor: grok
- Diretiva Oscar: resolver debito financeiro e depois logistica

## Debito

- Fonte: `AA1RTITU` cliente = fornecedor F (codigo + CNPJ). Aberto = sem pag/baixa.
- Programado: `AG1AUABT` em `AG1PAGCP` ainda aberto.
- Fora: `AG2APRCC` (perda, nao debito), cartao/Cielo, titulo pago, Jeronimo.
- 4381 titulos / 1072 fornecedores / R$ 15,4 mi. Unilever: 2 / R$ 1.447.

## Logistica

- `NFE_CAB` e `AGENDAMENTO_DISTRIBUICAO` vazios — nao ha reserva de janela.
- Pendente: `VW03` situacao 1/2 (72258). Doca: `AG3CDOCA` (393). Pedido sem entrada ja no cache.
- Tela deixa de usar as 2 NF-e mock.

## Arquivos

- `rms/scripts/apply_portal_debitos_financeiros.py`
- `rms/scripts/apply_portal_logistica.py`
- backups `portal.db.bak-20260817T022507Z-debitos` e `...022758Z-logistica`
