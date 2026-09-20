# Controle de Código — Atualização obrigatória do HTML do Portal

- Data: 2026-09-20
- Autor: Codex
- Fase: Portal do Fornecedor / disponibilidade da interface.
- Solicitação: corrigir portal que abre sem valores.

## Diagnóstico

- O PostgreSQL preserva os dados canônicos: o fornecedor 100148 (Santa Marta) possui cadastro ativo, 324 produtos visíveis, 4.092 posições de estoque, 116.114 vendas diárias e pedidos carregados.
- O log do runtime mostrou requisições a bundles com hash antigo que já não existem em .output/public/assets após o build. Sem o JavaScript da versão atual, a tela não consegue carregar os valores, embora a API e o banco estejam íntegros.

## Alteração

- src/server.ts passou a devolver respostas HTML com Cache-Control: no-store, max-age=0.
- Arquivos estáticos versionados por hash continuam cacheáveis; somente o documento HTML/manifest é renovado a cada abertura, eliminando a referência a bundles removidos.

## Arquivos

- src/server.ts
- docs/controle-codigo/2026-09-20_fase-portal_cache-html-atualizado_codex.md

## Validação

- npx prettier --check src/server.ts: concluído.
- npm run build: concluído.
- Pendente deste registro: reinício controlado do runtime e confirmação pública do cabeçalho e das rotas.

## Riscos e pendências

- Nenhum dado foi removido ou alterado. A mudança atua somente no cache do HTML.
