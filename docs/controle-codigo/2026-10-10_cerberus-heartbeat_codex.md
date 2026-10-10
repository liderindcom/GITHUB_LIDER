# Controle de código — Cerberus heartbeat

- Data: 2026-10-10 UTC
- Autor: codex
- Projeto: portal-fornecedor / Cerberus
- Fase: heartbeat do sensor
- Decisão: `agent-memory-20261007-72ce123b367beb26`
- Escopo: marcador efêmero de saúde em `/run/maoadc/cerberus-portal/heartbeat.json` e unit systemd versionado.
- Segurança: o heartbeat não lê uploads, banco, mailbox ou segredos; não ativa uploads e não substitui o sensor de detecção/quarentena.
- Validação: `npm run build` passou; instalação do unit ainda depende de execução autenticada com sudo.
- Pendência: instalar/habilitar o unit e validar frescor do arquivo no host; manter `CERBERUS_PORTAL_UPLOADS_ENABLED` desligado até existir worker real.
