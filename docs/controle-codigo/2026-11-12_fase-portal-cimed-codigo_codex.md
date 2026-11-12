# Controle de Código — código canônico da Cimed no Portal do Fornecedor

- Data: 2026-11-12
- Autor: Codex
- Alteração: preservação do código canônico `104949` na normalização de fornecedor.
- Causa: o código era interpretado como base `10494` + dígito verificador, fazendo pedidos e NF-es serem consultados com o identificador errado.
- Validação: teste direto da normalização, Prettier, `node --check` do painel e `git diff --check` passaram; `tsc --noEmit` mantém falhas preexistentes não relacionadas.
- Pendência: recarregar dados operacionais e conferir a sessão da Cimed no runtime.
