# Especificação de Interface (UI): Portal do Fornecedor Líder

Esta especificação técnica é otimizada para o **Lovable.dev** criar uma aplicação Next.js, React e TailwindCSS completa, com dashboards interativos, componentes baseados em shadcn/ui e dados mockados funcionais.

---

## 🎨 1. Identidade Visual & Design System

- **Branding:** Grupo Líder (Varejo Alimentício / Supermercados).
- **Logotipo:** marca oficial em todas as páginas via componente `LiderLogo` (`src/components/lider-logo.tsx`) e assets em `public/brand/` (wordmark GRUPOLÍDER + monograma L). Sidebar, header, login e telas de erro/404 devem exibir a marca.
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
      - Card Vermelho: _"Ruptura crítica de estoque em 3 lojas"_ (com link).
      - Card Amarelo: _"Você possui 2 Notas Fiscais pendentes de agendamento"_.
      - Card Verde: _"Previsão de pagamento de R$ 124.500,00 para amanhã"_.
    - **Gráficos Resumo:**
      - Gráfico de linha/barra de Vendas nos últimos 6 meses.
      - Gráfico de rosca/pizza de representação de estoque por categoria de produto.
3.  **`/pedidos` (Controle de Pedidos):**
    - Tabela de pedidos de compra emitidos pelo Grupo Líder.
    - Exibir no menu apenas pedidos diretos do fornecedor, ligados ao fluxo de compra/recebimento.
    - Não listar pedidos de lojas para o CDAM nem transferências internas no menu de pedidos de compra do fornecedor.
    - Filtros rápidos por status: `Aberto`, `Faturado`, `Pendente/Atrasado`, `Entregue` e `Cancelado`.
    - Calcular e exibir `Fill Rate` por pedido: `quantidade faturada / quantidade pedida`.
    - Calcular `Fill Rate Geral` do fornecedor usando apenas pedidos ativos exibidos no menu.
    - Calcular o tempo médio de entrega ao CDAM pela média dos últimos 5 pedidos entregues, usando `data de entrada no CDAM - data de emissão do pedido`.
    - A tabela deve mostrar `Entrada CDAM` quando existir, e o resumo deve exibir o card `Tempo médio`.
    - Ao clicar em uma linha, abre um drawer/slide-over lateral mostrando destino operacional, contexto de agenda, entrada no CDAM, itens do pedido, preço unitário, quantidade pedida e faturada.
4.  **`/vendas` (Painel de Sell-out):**
    - Relatório de vendas item a item por período (filtro de data obrigatório).
    - Tabela de itens com: `Código do Produto` com dígito verificador, `Descrição`, `Quantidade Vendida`, `Valor Unitário Médio`, `Valor Bruto Total`, `CMV` e `Margem Bruta %`.
    - O `SKU` pode seguir como chave técnica interna, mas a coluna visível para o fornecedor deve exibir `AA1DITEM.DET_COD_ITEM-AA3CITEM.GIT_DIGITO`.
    - Filtro por filial/loja do Grupo Líder.
    - Exportação para Excel (botão interativo).
5.  **`/estoque` (Estoque por Loja):**
    - Tabela mostrando o estoque atual dos produtos do fornecedor por loja.
    - Colunas: `SKU`, `Produto`, `Loja`, `Estoque Mínimo`, `Estoque Atual`, `Venda média mensal` (unidades, projetada da média diária dos últimos 90 dias × 30), `Cobertura (dias)` (= estoque atual ÷ venda média diária) e `Status` (Gatilho visual de Ruptura: vermelho se atual = 0; amarelo se atual ≤ mínimo; verde se confortável).
6.  **`/relatorio-mix` (Relatório MIX / REtqCob):**
    - Relatório baseado no PDF `relatorio lider.pdf`, com cabeçalho institucional Líder, comprador, fornecedor, departamento, período, data/hora e código `[REtqCob]`.
    - Matriz horizontal por filiais com colunas fixas de produto, `LIN`, `VD` e `ETQ`.
    - Agrupamento hierárquico: seção, grupo, subgrupo, produtos e linha `Totais:` por subgrupo.
    - Cada produto deve mostrar duas linhas: linha principal com produto/status/vendas/estoque e linha secundária com `Ref.` e cobertura em dias (`**`).
    - Exibir legenda: `VD`, `ETQ`, `X` fora do MIX e `** Cobertura em dias`.
    - A tabela deve ter scroll horizontal e colunas fixas à esquerda.
7.  **`/classificacao` (Classificação Mercadológica):**
    - Tabela por produto com hierarquia filtrável: `Código Departamento - Descrição`, `Código Seção - Descrição`, `Código Grupo - Descrição` e `Código Subgrupo - Descrição`.
    - Deve ser fácil filtrar/classificar por qualquer nível mercadológico: departamento, seção, grupo e subgrupo.
    - Mostrar papel mercadológico (`Destino`, `Rotina`, `Conveniência`, `Sazonal`) e classe recalculada (`A`, `B`, `C`, `D`).
    - Recalcular a classe `ABCD` por subgrupo usando venda média dos últimos 90 dias: classe A até 50% da venda acumulada, B de 50,1% a 80%, C de 80,1% a 98%, D de 98,1% a 100%.
    - Analisar por produto: sell-out, participação no subgrupo, margem, estoque atual, lojas em ruptura e fill rate.
8.  **`/logistica` (Agendamento de Recebimento):**
    - Calendário interativo de agendamentos para recebimento de notas fiscais nas centrais de distribuição do Grupo Líder.
    - Formulário para anexar chave da NF-e e agendar data/hora de entrega de mercadorias.
9.  **`/contas-receber` (Contas a Receber do Grupo Líder):**
    - Exibir valores que o fornecedor deve ao Grupo Líder, separados da previsão de pagamento ao fornecedor.
    - Listar lançamentos de acordo comercial, bonificação, devolução, avaria e verba comercial.
    - Mostrar quais débitos estão programados para abatimento no próximo pagamento do fornecedor.
    - Calcular o valor líquido previsto do próximo pagamento após os abatimentos.
    - Exibir débitos em análise sem descontá-los até que sejam programados.
    - Permitir exportação dos lançamentos para Excel/CSV.
10. **`/financeiro` (Previsão de Pagamento e Antecipação):**
    - **Escopo:** somente notas fiscais do **fornecedor autenticado para o Grupo Líder** (não exibir notas de outros fornecedores nem direção indevida).
    - **Cadastro financeiro** (condição comercial do fornecedor): prazo de pagamento em dias e desconto financeiro percentual, se existir.
    - **Data de pagamento prevista** = data de emissão da NF + prazo de pagamento do cadastro.
    - **Desconto financeiro** = valor da nota × % do cadastro (0 se não houver no cadastro); exibir valor líquido = valor − desconto financeiro.
    - Lista de títulos a vencer e pagos com colunas: Nota, Loja, Emissão, Pagamento previsto, Valor, Desc. financeiro, Líquido, Status.
    - **Módulo de Antecipação de Recebíveis:**
    - Simulador em tempo real com taxa de antecipação candidata (ex.: 1,8% a.m.) pró-rata die até a **data de pagamento do cadastro**.
    - Base da antecipação = valor **líquido** (já com desconto financeiro do cadastro, se houver).
    - Mostrar separadamente desconto financeiro (cadastro) e desconto de antecipação.

---

## 📦 3. Base de Dados Mockada (Para Rodar Localmente no Lovable)

Fornecer dados fictícios robustos carregados no estado do React para que o protótipo seja totalmente funcional e navegável imediatamente:

- **Dados do Fornecedor Atual:** Código `4050` | Nome: `Nestlé Brasil S/A` | CNPJ: `60.409.075/0001-52`.
- **Lojas Disponíveis:**
  - `Loja 01 - Líder Batista Campos`
  - `Loja 05 - Líder Doca`
  - `Loja 12 - Líder Humaitá`
- **Produtos Mockados:**
  - SKU `10010`: Nescau Chocolate Pó 400g
  - SKU `10020`: Leite Condensado Moça Lata 395g
  - SKU `10030`: Biscoito Passatempo Recheado Chocolate 130g
