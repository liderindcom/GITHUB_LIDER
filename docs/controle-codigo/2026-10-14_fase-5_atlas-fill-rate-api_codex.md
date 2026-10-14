# Controle de Código — Fase 5 Atlas Fill Rate CDAM

- Data: 2026-10-14
- Autor: Codex
- Escopo: integrar a tela Fill Rate CDAM do Atlas com a API PostgreSQL validada.

## Alterações

- `atlas/site/public/atlas-fillrate-cdam.js` deixou o estado estático e passou a
  consultar `/api/atlas/fill-rate/summary` e `/api/atlas/fill-rate`.
- Filtros de corte e grain (`store`, `department`, `section`, `group`,
  `subgroup`, `sku`) foram adicionados.
- Falha da API é mostrada explicitamente; a interface não cria valores locais.
- `atlas-fillrate-cdam.css` recebeu layout de filtros, KPIs e tabela.

## Validação

- `node --check` do JavaScript passou.
- A API de origem foi validada anteriormente contra PostgreSQL real.
- O PostgreSQL operacional do Portal foi confirmado em `/lider/portal-fornecedor/.env.postgres`,
  com runtime Node documentado em `127.0.0.1:18090`.
- O Portal recebeu rotas GET read-only para `/api/atlas/fill-rate` e
  `/api/atlas/fill-rate/summary`, usando apenas as tabelas PostgreSQL do cache;
  ausência da migration retorna `503` explícito, sem fallback ou mock.
- Build de produção passou. Deploy/reload externo continua pendente porque esta
  sessão não possui acesso ao Docker/supervisor do runtime.

## Limites

- Não há escrita no RMS/RM.
- O Atlas mostra ressalva de que o histórico não possui snapshot causal de
  estoque.
