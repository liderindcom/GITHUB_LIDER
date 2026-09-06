# CODE — Importação da ficha técnica de produto do Líder

**Data:** 2026-09-06
**Autor:** Codex
**Fase:** 2 — piloto funcional
**Status:** `validado_local` / candidato; aceite operacional pendente

## Entrega

Criado o importador de ficha técnica do Catálogo Comercial, com suporte a CSV/XLSX/XLS, download de modelo, validação, prévia e gravação em lote como rascunho.

## Escopo

A importação cobre código interno, descrição, embalagem, custo, IPI, prazo, frete, EAN-13, DUN-14, validade, NCM, CEST, dimensões, pesos e formação de pallet.

Ficam fora da importação: lojas de ativação, departamento, seção, grupo, subgrupo e sistemática de abastecimento. Esses campos permanecem decisão do Grupo Líder.

## Arquivos

- `portal-fornecedor/src/routes/_portal.catalogo-comercial.tsx`
- `portal-fornecedor/src/catalogo-api.ts`

Os dados específicos da ficha são preservados em `dadosFichaLiderJson`, sem alterar cadastro oficial, RMS/RM ou criar pedidos.

## Critérios CODE

- CODE-01/02: importação limitada a 500 linhas e validação de descrição/números.
- CODE-03/04: sessão do fornecedor e isolamento por fornecedor mantidos no endpoint.
- CODE-05/06: importações entram como `RASCUNHO`; publicação continua manual.
- CODE-07/08: nenhuma consulta ou escrita em RM/RMS.
- CODE-09: nenhum segredo ou dado real incluído.
- CODE-10: build local executado; aceite operacional pendente.

## Validação

- `npm run build`: passou.
- `npx tsc --noEmit`: erros preexistentes no Portal; nenhum erro restante nos arquivos do importador.
