# Especificação de Interface (UI): Portal do Fornecedor Líder

Esta especificação técnica é otimizada para o **Lovable.dev** criar uma aplicação Next.js, React e TailwindCSS completa, com dashboards interativos, componentes baseados em shadcn/ui e dados mockados funcionais.

---

## 🎨 1. Identidade Visual & Design System
- **Branding:** Grupo Líder (Varejo Alimentício / Supermercados).
- **Cores Dominantes:**
  - Principal (Brand): Azul Marinho Corporativo (`#0f172a` / `slate-900`) e Azul Líder (`#1e40af` / `blue-800`).
  - Destaques/Sucesso (Estoque/Vendas): Verde Esmeralda (`#059669` / `emerald-600`).
  - Alertas/Atenção: Amarelo Âmbar (`#d97706` / `amber-600`) e Vermelho Ruptura (`#dc2626` / `red-600`).
- **Biblioteca de Ícones:** Lucide React.
- **Tipografia:** Clean Sans-serif (Inter ou similar).

---

## 🗺️ 2. Estrutura de Rotas e Telas

### Rotas Principais a Gerar:
1.  **`/login` (Autenticação e Onboarding):**
    - Tela de login com campos: `Código do Fornecedor` e `CNPJ / Senha`.
    - Modal de "Primeiro Acesso": Se a senha for o CNPJ inicial, abre modal para cadastrar senha nova (mínimo 8 dígitos, caractere especial) e habilitar o **MFA (Autenticação de Dois Fatores)** (exibe QR Code fictício e campo para código de 6 dígitos).
2.  **`/dashboard` (Visão Geral - Home):**
    - **Seção de Alertas Acionáveis:**
      - Card Vermelho: *"Ruptura crítica de estoque em 3 lojas"* (com link).
      - Card Amarelo: *"Você possui 2 Notas Fiscais pendentes de agendamento"*.
      - Card Verde: *"Previsão de pagamento de R$ 124.500,00 para amanhã"*.
    - **Gráficos Resumo:**
      - Gráfico de linha/barra de Vendas nos últimos 6 meses.
      - Gráfico de rosca/pizza de representação de estoque por categoria de produto.
3.  **`/pedidos` (Controle de Pedidos):**
    - Tabela de pedidos de compra emitidos pelo Grupo Líder.
    - Filtros rápidos por status: `Aberto`, `Faturado`, `Pendente/Atrasado` e `Cancelado`.
    - Ao clicar em uma linha, abre um drawer/slide-over lateral mostrando os itens do pedido, preço unitário, quantidade pedida e faturada.
4.  **`/vendas` (Painel de Sell-out):**
    - Relatório de vendas item a item por período (filtro de data obrigatório).
    - Tabela de itens com: `SKU`, `Descrição`, `Quantidade Vendida`, `Valor Unitário Médio`, `Valor Bruto Total`, `CMV` e `Margem Bruta %`.
    - Filtro por filial/loja do Grupo Líder.
    - Exportação para Excel (botão interativo).
5.  **`/estoque` (Estoque por Loja):**
    - Tabela mostrando o estoque atual dos produtos do fornecedor por loja.
    - Colunas: `SKU`, `Produto`, `Loja`, `Estoque Mínimo`, `Estoque Atual` e `Status` (Gatilho visual de Ruptura: vermelho se atual < mínimo; amarelo se próximo; verde se confortável).
6.  **`/logistica` (Agendamento de Recebimento):**
    - Calendário interativo de agendamentos para recebimento de notas fiscais nas centrais de distribuição do Grupo Líder.
    - Formulário para anexar chave da NF-e e agendar data/hora de entrega de mercadorias.
7.  **`/financeiro` (Previsão de Pagamento e Antecipação):**
    - Lista de faturas a vencer e pagas.
    - **Módulo de Antecipação de Recebíveis:**
      - Botão *"Antecipar Recebimentos"* que abre modal interativo.
      - O modal calcula em tempo real o desconto financeiro (Taxa de 1.8% a.m.) dependendo de quantos dias faltam para o vencimento original e mostra o valor líquido final a receber na conta do fornecedor hoje.

---

## 📦 3. Base de Dados Mockada (Para Rodar Localmente no Lovable)

Fornecer dados fictícios robustos carregados no estado do React para que o protótipo seja totalmente funcional e navegável imediatamente:

- **Dados do Fornecedor Atual:** Código `FORN-4050` | Nome: `Nestlé Brasil S/A` | CNPJ: `60.409.075/0001-52`.
- **Lojas Disponíveis:**
  - `Loja 01 - Líder Batista Campos`
  - `Loja 05 - Líder Doca`
  - `Loja 12 - Líder Humaitá`
- **Produtos Mockados:**
  - SKU `10010`: Nescau Chocolate Pó 400g
  - SKU `10020`: Leite Condensado Moça Lata 395g
  - SKU `10030`: Biscoito Passatempo Recheado Chocolate 130g
