# Controle de Código — Perdas físicas com dados canônicos

- Data: 2026-09-19
- Autor: Codex
- Escopo: Portal do Fornecedor, menu Perdas Físicas.
- Solicitação: tornar a tela operacional com dados reais.

## Alteração

- A tela continua usando a carga de sessão que chama `fetchPerdas` na API do Portal.
- O cache de perdas agora aceita exclusivamente a resposta canônica da tabela PostgreSQL `perdas`; o fallback demonstrativo foi removido do código.
- Quando não há carga para o fornecedor/mês, a interface informa ausência de registro canônico em vez de mostrar valores fictícios.

## Evidência de origem

- A tabela PostgreSQL `perdas` contém dados de Agenda 520 por fornecedor, loja e SKU.
- A API filtra os registros pela visibilidade de produtos do fornecedor autenticado e exclui lojas fora do Portal.

## Arquivos

- `src/lib/mock-data.ts`
- `src/routes/_portal.perdas.tsx`

## Validação

- Prettier concluído; typecheck geral manteve erros preexistentes em mock-data.ts, sem erro da rota de Perdas; build de produção concluído.
- Runtime Node reiniciado; endpoints interno e público retornaram HTTP 200. Sem consulta direta ao Oracle/RMS e sem mutação de dados.

## Riscos e pendências

- A rotina histórica de Agenda 520 ainda é SQLite; a atualização Oracle para PostgreSQL requer desenho e gate próprio, pois envolve recarga da tabela produtiva.
