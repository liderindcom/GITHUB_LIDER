# Atualização diária da Agenda 520

- Data: 2026-10-07
- Fonte: tabelas consolidadas do CometNet (`CONSULTA.TB_AG520_ITENS` e `CONSULTA.TB_AG520_NF`)
- Janela: últimos 13 meses
- Horário: diariamente às 05:00 UTC
- Rotina: `scripts/importar_perdas_rms_520_canonicas.py --apply`
- Log operacional: `/lider/portal-fornecedor/logs/perdas-rms-520.log`

A carga cria um novo lote e só o ativa depois de concluir a inserção. O
agrupamento preserva fornecedor, loja de origem, NF, série, produto e data.
