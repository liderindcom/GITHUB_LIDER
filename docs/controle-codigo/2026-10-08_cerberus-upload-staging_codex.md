# Controle de código — Cerberus upload staging

- Event ID: `agent-memory-20261007-72ce123b367beb26`
- Commit: `c74cfa0`
- Escopo: `src/server/cerberus-upload-staging.ts`.
- Feature flag: desligada por padrão; sem alteração dos fluxos atuais.
- Validação: `npm run build` passou.
- Pendência: integração de rota e ativação permanecem separadas e bloqueadas
  até os testes de staging e sensor.
