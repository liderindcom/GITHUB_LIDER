# Controle de Código — Acordo com instruções de primeiro acesso

- Data: 2026-09-23
- Autor: Codex
- Fase: Portal do Fornecedor / Controle de Acesso
- Solicitação: incluir no acordo impresso a URL do portal e uma orientação curta para o primeiro acesso.

## Alteração

O acordo impresso agora inclui um bloco destacado de primeiro acesso com a URL canônica do portal e os passos: entrar com código RMS, informar e-mail corporativo, usar o CNPJ como senha inicial e alterá-la no menu **Corrigir senha**.

O documento não grava nem expõe uma senha nova; apenas orienta a credencial inicial já prevista no fluxo do portal.

## Arquivos

- `src/routes/_portal.admin-fornecedores.tsx`
- Espelho: `/home/administrador/RM/docs/controle-codigo/2026-09-23_fase-portal_acordo-primeiro-acesso_codex.md`

## Validação

- `npm run build`
- Smoke test HTTP local e HTTPS público após reinício do runtime
