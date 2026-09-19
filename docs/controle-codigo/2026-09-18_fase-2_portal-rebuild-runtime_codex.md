# Recuperação do runtime do Portal do Fornecedor

- Data: 2026-09-18
- Autor: Codex
- Fase: 2 — operação do portal
- Build local executado e supervisor Node reiniciado após indisponibilidade HTTP 502.
- Validação: listener em `127.0.0.1:18090`, rota interna HTTP 200 e portal público HTTP 200.
- Não houve alteração de código-fonte, schema, dados ou credenciais.
- Pendente: validação funcional autenticada durante o uso normal.

## Correção definitiva

- A causa recorrente era o cron que ainda iniciava `scripts/portal-supervisor.sh`, baseado em Vite e obsoleto para a produção.
- Os dois agendamentos desse cron (`@reboot` e por minuto) foram direcionados para `scripts/portal-supervisor-node-http.sh`.
- Processos Vite concorrentes foram encerrados; após o ciclo seguinte do cron, uma nova instância Node subiu e as rotas interna e pública permaneceram HTTP 200.
