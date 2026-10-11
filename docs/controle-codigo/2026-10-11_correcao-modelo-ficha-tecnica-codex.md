# CODE — Correção do modelo de cadastro técnico por planilha

**Data:** 2026-10-11
**Fase:** 2 — piloto funcional
**Status:** `validado_local` / aceite operacional pendente

## Achado

O modelo baixado pelo Portal apresentava campos de catálogo comercial — marca,
categoria, coleção, evento e preço sugerido — enquanto o cadastro técnico do
Líder exige os campos da ficha de produto.

## Correção

O modelo passou a usar a aba `Ficha Produto` e os campos:

- código interno e descrição do produto;
- embalagem, custo do fornecedor, IPI, prazo e frete;
- EAN-13, DUN-14, validade, NCM e CEST;
- dimensões, pesos e formação de pallet.

Os dados técnicos são preservados em `dadosFichaLiderJson`. O custo do
fornecedor não é convertido em preço sugerido e não altera o cadastro oficial.

Planilhas antigas do modelo comercial continuam sendo aceitas por aliases para
não quebrar arquivos já preparados, mas o modelo novo e as mensagens da tela
orientam o usuário para a ficha técnica.

## Validação

- Prettier: passou nos quatro arquivos alterados.
- ESLint: passou nos quatro arquivos alterados.
- `npm run build`: passou em client, SSR e Nitro.
- migração idempotente: adiciona `dadosFichaLiderJson` quando a tabela antiga
  ainda não possui a coluna.
