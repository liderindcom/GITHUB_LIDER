# Registro de Código — Portão Financeiro Atlas: contratos de fonte

**Data:** 2026-09-17  
**Autor:** Codex  
**Fase:** 2 — contratos candidatos
**Status:** candidato; sem fonte real, ETL, migração executada ou publicação.

## Objetivo

Materializar os cinco contratos que condicionam as próximas fases do Portão
Financeiro: cadastro/preço, pedido/nota, logística, vendas/recebíveis previstos
e compromissos a pagar.

## Entrega

Cada contrato define grão e chave natural, campos e enumerações, corte ou
vigência, idempotência, linhagem, retenção, publicação atômica, rollback e dono
candidato. Pedido/nota precede logística; registros órfãos ficam em quarentena.

## Arquivos

- `docs/contratos/cadastro-preco.md`
- `docs/contratos/pedido-nota.md`
- `docs/contratos/logistica.md`
- `docs/contratos/vendas-recebiveis-previstos.md`
- `docs/contratos/compromissos-a-pagar.md`

## Validação

- `python3 packages/contracts/validate_contracts.py` — 17 schemas, 8 exemplos e 11 migrações verificados.
- `git diff --check` — sem erro.

## Limites e próximo gate

Os prazos de retenção, donos nominais e enumerações ainda precisam de aceite
Financeiro, Fiscal, Logística e Cadastro. Fase 3 continua vedada até validação
dos contratos contra fontes reais; nenhum valor das planilhas foi importado.
