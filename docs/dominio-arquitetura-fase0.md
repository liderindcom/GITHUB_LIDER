# Arquitetura de Domínio — Portal do Fornecedor (Fase 0)

**Data:** 2026-08-03  
**Autor:** grok  
**Bico:** `msg_20260803_151437_314` (BICO_DEV_SCHEMA_PORTAL)  
**Status:** candidato técnico — não homologado

## 1. Bounded contexts

| Contexto               | Responsabilidade                                   | Fonte canônica (futura)                       | Cache portal                                   |
| ---------------------- | -------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Identity & Access      | Login CNPJ + código fornecedor, MFA, sessão JWT    | Cadastro fornecedores (RM/RMS) via worker     | `suppliers`, `users`, `mfa_devices`            |
| Stock Visibility       | Saldo e movimentos por produto/filial              | Oracle RMS (ETL)                              | `stock_balances`, `stock_movements`            |
| Product Classification | Hierarquia mercadológica e papel comercial por SKU | Oracle RMS (ETL) + de-para controlado         | `product_classifications`                      |
| Purchase Orders        | Pedidos diretos ao fornecedor e pedidos para CDAM  | Oracle RMS (ETL) + mapa de agendas            | `purchase_orders`, `purchase_order_lines`      |
| Receivables            | Títulos a receber, vencimentos, status             | RM/financeiro via worker                      | `receivable_titles`                            |
| Anticipation           | Cotação e pedido de antecipação de títulos         | Motor de regras do portal + aceite financeiro | `anticipation_quotes`, `anticipation_requests` |
| Alerts                 | Action-driven home                                 | Derivado de cache local                       | `alerts` (materializado ou query)              |
| Trade Marketing        | Verbas sell-out (fase posterior)                   | Comercial                                     | `trade_budgets` (stub)                         |
| Audit                  | Append-only de aceites e ações sensíveis           | Portal                                        | `audit_events`                                 |

## 2. Princípios

1. **Edge security:** API pública só fala com PostgreSQL do portal.
2. **Tenant key:** `supplier_id` (UUID interno) — nunca confiar só em CNPJ no WHERE da app.
3. **Idade da informação:** todo payload de leitura carrega `dataFreshness` (`sourceUpdatedAt`, `syncedAt`, `ageSeconds`, `slaLabel`).
4. **Writes limitados:** fornecedor só grava antecipação, MFA, preferências e aceites; nunca altera saldo/título de origem.
5. **Anti-overclaim:** campos `homologationStatus` ∈ `candidato | aguarda_aceite | restrito | bloqueado`.

## 2.0. Agendas RMS: fornecedor → Líder (não é “venda” 101/102)

No RMS do Grupo Líder, **agenda de vendas** (`101` atacado / `102` varejo) é saída do Líder para o consumidor/cliente — **não** é o documento do fornecedor.

| Fluxo                                | Agendas                                  | O que é                                                      |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| Venda Líder (PDV/atacado)            | `101`, `102`                             | Saída de estoque + receita do Grupo                          |
| **Compra/recebimento do fornecedor** | entrada de NF-e (contexto Compras)       | NF-e emitida pelo fornecedor para o Líder                    |
| Transferência CD → loja              | `65`, `66`, `148`                        | Movimento interno; **não** gera título a pagar ao fornecedor |
| Devolução a fornecedor               | `8` (paridade com `2` em vários códigos) | Logística reversa                                            |

### Evidência empírica Nestlé (`VW03_NFEENTRADA` + `AA2CTIPO`, homolog RMS)

- Fornecedor Nestlé (CNPJ raiz `60409075*`):
  - **Agenda `28`**: ~98% dos destinos são tipo **D (depósito)** — quase todos no **filial 201 – DEPOSITO AUG.MONTENEGRO** (`TIP_LOJ_CLI=D`). Candidata operacional de **recebimento fornecedor no CDAM**.
  - **Agenda `2`**: volume alto, misto depósito + **lojas** (`TIP_LOJ_CLI=L`). No mapa AA1CTCON a agenda `2` também participa de paridades de devolução — **não** usar sozinha como “nota de loja do fornecedor” sem regra de negócio/aceite.
- Nestlé no portal: `modeloEntrega = somente_cdam` → financeiro lista só recebimento no depósito/CD, **exclui** transferência `65/66/148` e CNPJ de loja.
- Filiais CD/depósito reais no cadastro: `201` Depósito Aug. Montenegro, `213` CD Parque Verde, `214` CD Benevides, `203` CD Farmalíder, etc. O código mock legado `13` **não** é o depósito canônico no `AA2CTIPO` (lá o 13 é outro estabelecimento).

## 2.1. Regra de domínio: pedidos Fornecedor x CDAM

O portal não deve tratar todos os pedidos de compra como uma fila única. O mapa de agendas RMS separa dois fluxos operacionais:

| Tipo                           | `orderKind`          | Interpretação no portal                                                                                                               | Contexto de agenda    |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Pedido feito para o fornecedor | `supplier_direct`    | Compra/recebimento direto do parceiro, base para faturamento, entrega e NF-e do fornecedor.                                           | `compras_recebimento` |
| Pedido feito para o CDAM       | `cdam_central_depot` | Abastecimento do depósito central; transferências posteriores para lojas não devem contaminar a visão de pedido direto ao fornecedor. | `transferencia_cdam`  |

Para CDAM, o contrato carrega `agendaCode`, `agendaParity` e `ruleSummary` para preservar a regra de trânsito/transferência mapeada no RMS, especialmente pares como agenda `66` com paridade `65/148`. A API do portal continua lendo apenas o cache PostgreSQL; a classificação vem do worker assíncrono.

Decisão de UI em 2026-08-06: o menu **Pedidos de Compra** do fornecedor não lista pedidos de lojas para o CDAM nem transferências internas. A tela exibe apenas pedidos diretos do fornecedor (`supplier_direct`). A classificação `cdam_central_depot` permanece no domínio/worker para rastreabilidade e para evitar mistura operacional, mas não entra na navegação do fornecedor.

No worker, a lista de filiais/depósitos classificados como CDAM é configurável por ambiente:

```text
PORTAL_CDAM_BRANCH_IDS=13,35,124
```

Sem configuração explícita, o fallback candidato usa apenas `13`, porque há evidência local de `LOJA 13 = LIDER CENTRO DE DISTRIBUICAO`. A lista definitiva depende de aceite funcional/DBA.

## 2.2. Fill rate de pedidos

O fill rate candidato do portal é calculado por quantidade, não por valor financeiro:

```text
fillRatePct = sum(qtyInvoiced) / sum(qtyOrdered) * 100
```

Aplicação:

- Por pedido: usa todas as linhas do pedido.
- Por item: usa a linha individual.
- Geral do fornecedor: soma pedidos ativos e exclui `cancelado` para não penalizar cancelamentos administrativos.
- CDAM: quando `orderKind = cdam_central_depot`, o CDAM é tratado como fornecedor interno da loja. A fórmula é a mesma do fornecedor direto.

Enquanto a extração RMS trouxer apenas cabeçalho do pedido, o worker emite `qtyOrderedTotal = 0`, `qtyInvoicedTotal = 0` e `fillRatePct = 0` com linha placeholder candidata. O valor real depende do mapeamento aprovado das linhas do pedido.

## 2.3. Tempo médio de entrega ao CDAM

O tempo médio de entrega candidato mede o prazo físico entre emissão do pedido e entrada no CDAM:

```text
deliveryLeadTimeDays = cdamEntryDate - issueDate
averageDeliveryLeadTimeDays = avg(deliveryLeadTimeDays) nos 5 pedidos mais recentes por cdamEntryDate
```

Aplicação:

- Considera apenas pedidos com `cdamEntryDate` preenchido.
- Ordena por `cdamEntryDate DESC` e calcula a média dos últimos 5 pedidos entregues.
- O status `entregue` representa pedido recebido no CDAM para essa métrica.
- Se houver menos de 5 pedidos entregues, a média usa os pedidos disponíveis; se não houver nenhum, a API/UI exibe ausência de dado.

O cache grava `cdam_entry_date` e `delivery_lead_time_days` para evitar recalcular a métrica em tempo de tela.

## 2.4. Classificação mercadológica de produtos

A análise mercadológica candidata do portal usa uma hierarquia por SKU:

```text
departmentCode - department
sectionCode - section
groupCode - group
subgroupCode - subgroup
```

Campos analíticos derivados:

- `commercialRole`: papel do SKU (`destino`, `rotina`, `conveniencia`, `sazonal`, `nao_classificado`).
- `abcClass`: classe recalculada pelo portal, não pela curva legada do RMS.
- sell-out, margem bruta percentual, estoque atual, lojas em ruptura e fill rate.

A classe ABCD é calculada dentro de cada subgrupo mercadológico, usando a venda média diária dos últimos 90 dias:

```text
avgDailySales90Amount = sellOutAmount90d / 90
subgroupSalesSharePct = avgDailySales90Amount do SKU / soma avgDailySales90Amount do subgrupo
```

Regra por participação acumulada do subgrupo, ordenando SKUs por maior venda média:

- Classe A: itens que compõem até 50% das vendas do subgrupo.
- Classe B: de 50,1% até 80%.
- Classe C: de 80,1% até 98%.
- Classe D: de 98,1% até 100%.

Na implementação candidata, a classe usa a participação acumulada anterior ao item para garantir que o primeiro SKU de um subgrupo sempre entre em uma classe útil mesmo quando sozinho ultrapassa uma faixa. Enquanto a árvore mercadológica RMS oficial não estiver totalmente mapeada/aprovada, o worker usa de-para candidato controlado para os SKUs conhecidos e marca os demais como `nao_classificado`. A API continua lendo somente o cache PostgreSQL.

## 2.5. Código de produto visível no sell-out

Na aba de vendas sell-out, o portal mantém `sku` como chave técnica para relacionamento entre vendas, estoque, pedidos e classificação mercadológica. Para o fornecedor, a coluna visível deve exibir o código RMS do produto com dígito verificador:

```text
codigoProdutoDv = AA1DITEM.DET_COD_ITEM + "-" + AA3CITEM.GIT_DIGITO
```

Mapeamento RMS identificado em leitura no `RMSTESTE`:

- `AGG_VDA_PROD_VEND_MES.CD_PROD`: código técnico usado no agregado de sell-out.
- `AA3CITEM.GIT_COD_ITEM`: cadastro principal que cruza com `CD_PROD`.
- `AA3CITEM.GIT_DIGITO`: dígito verificador.
- `AA1DITEM.DET_COD_ITEM`: código base exibível para o fornecedor.

Exemplo validado: `CD_PROD = 114150`, `GIT_DIGITO = 3` e `DET_COD_ITEM = 1141500`, exibido como `1141500-3`.

## 3. Modelo de identidade (API)

```text
POST /auth/login          { supplierCode, cnpj, password } → challenge MFA ou token
POST /auth/mfa/verify     { challengeId, otp } → accessToken + refreshToken
POST /auth/password/change (obrigatório 1º acesso)
GET  /me                  perfil + flags (mustChangePassword, mfaEnabled)
```

Claims JWT mínimos: `sub` (user_id), `sid` (supplier_id), `roles[]`, `cnpj`, `exp`.  
A sessão PostgreSQL da API seta `SET LOCAL app.supplier_id = '<uuid>'` antes de qualquer query.

## 4. Superfície REST candidata

| Método | Path                              | RLS | Paginação  | Observação                             |
| ------ | --------------------------------- | --- | ---------- | -------------------------------------- |
| GET    | `/health`                         | n/a | —          | sem dados de tenant                    |
| GET    | `/v1/dashboard/alerts`            | sim | cursor     | action-driven home                     |
| GET    | `/v1/purchase-orders`             | sim | page/limit | filtros: `orderKind`, status, branchId |
| GET    | `/v1/stock/balances`              | sim | page/limit | filtros: sku, branchId                 |
| GET    | `/v1/stock/movements`             | sim | cursor     | janela max 90d default                 |
| GET    | `/v1/receivables/titles`          | sim | page/limit | status, dueFrom/dueTo                  |
| POST   | `/v1/anticipations/quotes`        | sim | —          | simulação sem commit                   |
| POST   | `/v1/anticipations/requests`      | sim | —          | cria pedido (async possível)           |
| GET    | `/v1/anticipations/requests`      | sim | page       | histórico                              |
| GET    | `/v1/anticipations/requests/{id}` | sim | —          | detalhe                                |
| GET    | `/v1/payments/schedule`           | sim | page       | agenda de pagamentos                   |
| GET    | `/v1/exports/{jobId}`             | sim | —          | jobs assíncronos (DeepSeek/BullMQ)     |

Todos os endpoints autenticados exigem rate limit por `supplier_id` + IP.

## 5. Contratos

Schemas em `packages/contracts/*.schema.json`.  
Validador: `packages/contracts/validate_contracts.py`.

## 6. RLS e performance

Ver `docs/rls-performance-estoques.md` e `db/migrations/001_rls_core.sql`.

Resumo:

- Todas as tabelas de negócio com `supplier_id NOT NULL`.
- Índice composto alinhado aos filtros da API.
- Policy `USING (supplier_id = current_setting('app.supplier_id')::uuid)`.
- Role app sem BYPASSRLS; worker ETL usa role de escrita com bypass controlado e auditoria.

## 7. Fora de escopo nesta entrega

- UI Next.js (Gemini)
- Worker ETL real (DeepSeek)
- Conexão RMS/RM
- Homologação financeira da taxa de antecipação
- Trade marketing completo
