# Controle de Código — Recuperação de sessão com build obsoleto

- Data: 2026-09-20
- Autor: Codex
- Fase: Portal do Fornecedor / disponibilidade.
- Diagnóstico: Browser Harness sem sessão autenticada passou sem erros, mas logs mostraram sessões antigas chamando IDs de funções removidos pelo build.
- Alteração: a raiz do cliente detecta a rejeição Server function info not found e recarrega uma única vez a página atual. A limitação por sessionStorage evita ciclo de recarga.
- Arquivo: src/routes/__root.tsx.
- Validação: Prettier e npm run build concluídos. Publicação e Browser Harness pós-restart pendentes.
- Risco: nenhum dado ou credencial é acessado; atua somente na recuperação do navegador.
