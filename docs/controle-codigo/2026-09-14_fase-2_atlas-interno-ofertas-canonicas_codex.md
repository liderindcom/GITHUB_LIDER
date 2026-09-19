# Registro CODE — Atlas interno com ofertas canônicas

- Data: 2026-09-14
- Autor: Codex
- Fase: 2 / integração Atlas
- Status: candidato integrado internamente; validação autenticada pendente

## Entrega

O Atlas passou a ser servido internamente pelo runtime ativo do Atlas Fornecedor.

Arquivos criados/alterados:
- src/routes/_portal.atlas.tsx
- src/routes/api/atlas/ofertas.ts
- src/components/app-sidebar.tsx
- public/atlas/index.html
- public/atlas/app.js
- public/atlas/styles.css
- public/atlas/atlas-live.js

## Segurança e fonte

GET /api/atlas/ofertas exige sessão server-side. Sem cookie retorna 401. Usuário fornecedor tem o código efetivo restringido pela sessão; usuário interno usa o fornecedor selecionado no Portal. A leitura vem exclusivamente de ofertas_intelider no banco operacional. Não há acesso direto do navegador ao banco, RMS, token externo ou segredo.

## Evidências

- Runtime real: /lider/portal-fornecedor.
- Build do runtime aprovado com npm run build.
- /atlas/index.html: HTTP 200 via HTTPS interno.
- /atlas: HTTP 200 via HTTPS interno.
- /api/atlas/ofertas sem sessão: HTTP 401 e mensagem Sessão Atlas exigida.
- Sintaxe de app.js e atlas-live.js aprovada por node --check.

## Limites

Somente ofertas e rebaixas foram conectadas à base nesta entrega. As demais áreas do Atlas continuam piloto até receberem fonte canônica e validação própria. A prova autenticada no navegador ainda é necessária antes de considerar a visualização aceita funcionalmente.

## CODE

- CODE-01: aprovado localmente.
- CODE-02: ativo; leitura autenticada e sem segredos no cliente.
- CODE-03: parcial; build e fail-closed aprovados, teste autenticado pendente.
- CODE-04: pendente de revisão independente.
- CODE-05: ativo; sem alegar conexão das demais fontes.
