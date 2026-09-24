# Controle de Código — carga RMS assíncrona

- Data: 2026-09-24
- Autor: Codex
- Solicitação: eliminar 504 ao validar carga RMS pelo Portal.

## Alteração

- A API inicia o refresh RMS em subprocesso e responde imediatamente.
- Estado `PROCESSANDO` persiste antes do início, bloqueia novo clique e a tela consulta o resultado a cada cinco segundos.
- Encerramento anormal registra `FALHA`; o script RMS continua dono de `COMPLETA` e das métricas.

## Validação

- `git diff --check` e `npm run build` passaram.
- Sem disparar carga real, migration, alteração de origem RMS ou segredo.
