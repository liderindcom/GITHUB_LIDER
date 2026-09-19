# Controle de Código — Refresh diário de estoque e vendas

- Data: 2026-09-11
- Fase: 2.4
- Responsável: Codex
- Escopo: agendamento operacional do refresh completo do Portal do Fornecedor

## Entrega

Criado `scripts/run_portal_refresh_diario.py`, que percorre fornecedores ativos e executa o refresh completo por fornecedor: cadastro, produtos, visibilidade, estoque, vendas diárias, vendas mensais e pedidos.

Agendamento instalado às 04:00 UTC, antes da carga mensal das 05:00 UTC:

```text
0 4 * * * /home/administrador/deepseek-env/bin/python3 /lider/portal-fornecedor/scripts/run_portal_refresh_diario.py >> /lider/portal-fornecedor/logs/portal-refresh-diario.log 2>&1
```

O job registra início, sucesso e falha individual por fornecedor e retorna status diferente de zero quando houver falhas.

## Validação

- `python3 -m py_compile scripts/run_portal_refresh_diario.py`: aprovado.
- Crontab confirmado com a entrada diária.
- Execução contra Oracle: pendente para a primeira janela agendada; não foi executada manualmente nesta entrega.

## Riscos e pendências

- A qualidade da classificação ABC depende da existência de vendas retornadas pelo RMS.
- A primeira execução deve ser acompanhada pelo log `logs/portal-refresh-diario.log`.
- A entrega está `aguarda_aceite` até confirmar uma execução completa e os totais de estoque/vendas por fornecedor.
