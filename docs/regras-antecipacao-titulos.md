# Regras de domínio — Antecipação de títulos (recebíveis)

**Data:** 2026-08-03  
**Autor:** grok  
**Status:** candidato — depende de aceite Controladoria/Financeiro  
**Não homologado**

## 1. Objetivo

Permitir que o fornecedor simule e solicite antecipação de títulos a receber do Grupo Líder, com transparência de taxas, prazos e elegibilidade, sem escrita nos ERPs.

## 2. Entidades

| Entidade | Descrição |
|---|---|
| `ReceivableTitle` | Título a receber já liquidável no portal (cache ETL) |
| `AnticipationQuote` | Simulação imutável por TTL (não gera obrigação) |
| `AnticipationRequest` | Pedido formal com trilha de auditoria |
| `AnticipationLine` | Vínculo título ↔ pedido (valor face e valor líquido) |

## 3. Elegibilidade (gates)

Um título só entra em cotação/pedido se **todas** forem verdadeiras:

| Código | Regra | Default candidato |
|---|---|---|
| ELG-01 | `supplier_id` do título = fornecedor autenticado | obrigatório (RLS) |
| ELG-02 | `status` ∈ `aberto`, `parcialmente_pago` | sim |
| ELG-03 | `amountOpen > 0` | sim |
| ELG-04 | `dueDate >= today` (não vencido) **ou** política de vencidos liberada | default: só a vencer |
| ELG-05 | Não está em pedido `pendente` / `em_analise` / `aprovado` ativo | sem double-spend |
| ELG-06 | `currency = BRL` | MVP |
| ELG-07 | Fornecedor com `anticipationEnabled = true` | cadastro |
| ELG-08 | Valor face ≥ `minTitleAmount` | config (ex.: 100.00) |
| ELG-09 | Somatório do pedido ≤ `maxRequestAmount` | config |
| ELG-10 | Quantidade de títulos no pedido ≤ `maxTitlesPerRequest` | config (ex.: 50) |

Qualquer falha → título excluído da cotação com `ineligibilityReason` explícito.

## 4. Precificação candidata (motor de regras)

Parâmetros (tabela `anticipation_policy`, versionada):

| Parâmetro | Significado | Exemplo candidato |
|---|---|---|
| `baseRateMonthly` | Taxa mensal linear | 0.019 (1,9% a.m.) |
| `minDays` | Carência mínima cobrada | 5 |
| `spreadFixed` | Custo fixo por título | 0 |
| `iofRate` | Placeholder IOF (se aplicável) | 0 até aceite fiscal |
| `quoteTtlSeconds` | Validade da cotação | 900 (15 min) |

Fórmula candidata do desconto por título:

```text
days = max(minDays, dueDate - quoteDate)   # dias corridos
gross = amountOpen
discount = round(gross * baseRateMonthly * (days / 30) + spreadFixed, 2)
net = gross - discount - iof
```

- Arredondamento: half-up 2 casas, moeda BRL.
- Cotação **não** grava no financeiro; só `anticipation_quotes` (append).
- Pedido referencia `quoteId` ainda dentro do TTL; fora do TTL → `quote_expired`.

## 5. Máquina de estados do pedido

```text
rascunho → cotado → solicitado → em_analise → aprovado | recusado | cancelado
                              ↘ expirado (se cotação venceu antes do submit)
aprovado → liquidado_parcial → liquidado
```

Transições sensíveis (`solicitado`, `aprovado`, `recusado`, `cancelado`) geram `audit_events` append-only (IP, userAgent, payload hash).

## 6. API (contrato)

1. `POST /v1/anticipations/quotes`  
   Body: `{ titleIds: uuid[] }`  
   Response: `AnticipationQuote` (schema)

2. `POST /v1/anticipations/requests`  
   Body: `{ quoteId, acceptTermsVersion, clientRequestId }`  
   Idempotência: `clientRequestId` único por supplier (24h).

3. `GET /v1/anticipations/requests[/{id}]`

Schemas: `receivable-title.schema.json`, `anticipation-quote.schema.json`, `anticipation-request.schema.json`.

## 7. Riscos e bloqueios externos

| Risco | Mitigação |
|---|---|
| Taxa real diferente da candidata | Status `aguarda_aceite` Financeiro |
| Double anticipation | Lock por `title_id` + status ativo |
| Fraude de sessão | MFA + RLS + audit |
| Overclaim de “aprovado automático” | MVP: sempre `em_analise` após submit |

## 8. Decisão

Motor e contratos **aptos para revisão**.  
**Não** publicar taxas como oficiais sem aceite Controladoria/Financeiro.
