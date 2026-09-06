# CODE — Catálogo Comercial do Fornecedor

**Data:** 2026-09-06  
**Fase:** 2 — piloto funcional  
**Status:** `candidato` / validação de produto e operação pendente

## Entrega

Criada a rota protegida `/catalogo-comercial`, acessível pelo menu do Portal do Fornecedor, com formulário para apresentação de produtos e coleções, imagens por URL, condições comerciais e status de rascunho ou publicação.

Arquivos principais:

- `src/routes/_portal.catalogo-comercial.tsx`;
- `src/catalogo-api.ts`;
- `src/components/app-sidebar.tsx`;
- `docs/catalogo-comercial-fornecedor-2026-09-06.md`.

## Regras de segurança e domínio

- o fornecedor só consulta e grava itens vinculados à própria sessão;
- o catálogo não altera `produtos`;
- o catálogo não gera pedidos, preços ou ofertas automaticamente;
- imagem é armazenada inicialmente como URL;
- produto enviado permanece sujeito à avaliação humana do Grupo Líder;
- a tabela é criada de forma idempotente no primeiro uso para compatibilidade com o cache atual.

## Próximas validações

- testar com fornecedor piloto;
- confirmar campos por segmento;
- validar URLs e política de imagens;
- adicionar revisão interna do catálogo;
- depois avaliar upload gerenciado e integração com o Atlas.
