# Portal do Fornecedor — Grupo Líder

Protótipo completo e navegável, com todos os dados mockados carregados em estado global (React Context), exatamente como no prompt detalhado. Dois ajustes de plataforma: o app roda em React + TanStack Router (o stack do Lovable, equivalente ao Next.js aqui) e o backend real (Lovable Cloud) fica para uma etapa seguinte — assim as 7 telas ficam prontas e interativas primeiro.

## Design

Cabeçalhos e sidebar em azul corporativo escuro (slate-900 / blue-800), área de dados em fundo claro muito organizado. Bordas suaves, sombras discretas, transições, tipografia sans-serif limpa. Ícones Lucide na navegação. Verde esmeralda = sucesso, âmbar = atenção, vermelho = ruptura. Tudo em tokens semânticos no design system, responsivo, com sidebar colapsável.

## Dados mockados (Context global)

- Fornecedor: `FORN-4050` — Nestlé Brasil S/A — CNPJ 60.409.075/0001-52
- Lojas: Loja 01 Batista Campos, Loja 05 Doca, Loja 12 Humaitá
- Produtos: 10010 Nescau 400g, 10020 Leite Moça 395g, 10030 Passatempo 130g
- 4 pedidos (Aberto, Faturado, Pendente, Cancelado) com itens
- Vendas por dia/item/loja com SKU, qtd, valor unitário, total, CMV e margem %
- Estoque por SKU/loja com mínimo e atual
- Faturas a vencer e pagas com previsão de pagamento
- Agenda logística de recebimento de NF-e com datas e horários

O Context também guarda mutações da sessão: agendamentos criados, antecipações confirmadas e o estado de primeiro acesso/MFA.

## Telas

1. **/login** — marca "Portal do Fornecedor - Grupo Líder", campos Código do Fornecedor e Senha. Senha igual a `60409075000152` dispara o modal obrigatório de Primeiro Acesso: criação de senha forte + onboarding de MFA com QR Code fictício e campo de código de 6 dígitos para validar o setup.
2. **/dashboard** — três cards de alerta acionáveis (ruptura → /estoque, 2 NF-e aguardando agendamento → /logistica, previsão de R$ 124.500,00 → /financeiro), cards de métricas, gráfico interativo de vendas mensais e rosca de vendas por loja.
3. **/pedidos** — filtros rápidos por status (Todos, Aberto, Faturado, Pendente, Cancelado), tabela dos pedidos; clique na linha abre drawer lateral com SKU, descrição, qtd pedida, qtd faturada, preço unitário e total do item.
4. **/vendas** — filtro obrigatório de período (data inicial/final) + seletor de loja ("Todas as Lojas"); tabela item a item com SKU, produto, qtd vendida, valor médio, faturamento bruto, CMV e margem %; botão "Exportar para Excel/CSV" gerando o arquivo em tempo real com toast de feedback.
5. **/estoque** — tabela SKU, produto, loja, estoque mínimo, atual e badge de status: vermelho se atual = 0, âmbar se 0 < atual ≤ mínimo, verde se atual > mínimo.
6. **/logistica** — calendário de entregas interativo + formulário de Novo Agendamento com chave da NF-e (validação de 44 dígitos), filial, data no calendário e horário disponível; ao enviar, o evento entra no calendário com notificação de sucesso.
7. **/financeiro** — faturas a vencer ordenadas por vencimento + botão em destaque "Solicitar Antecipação de Recebíveis" abrindo o simulador: checkboxes por fatura e cálculo em tempo real de valor bruto, taxa de 1,8% a.m. pro-rata dia até o vencimento de cada fatura, valor do desconto e líquido a receber hoje; "Confirmar Antecipação" grava o log de aceite e exibe recibo com código de auditoria.

## Notas técnicas

- Rotas em `src/routes/` (login, dashboard, pedidos, vendas, estoque, logistica, financeiro), com layout de app compartilhado (sidebar + header do fornecedor logado) e `/` redirecionando para o login/dashboard.
- Gate de sessão do protótipo via Context: sem login, as rotas internas voltam para `/login`.
- Gráficos com Recharts; toasts com sonner; datas e calendário com shadcn/ui.
- Exportação gera um `.csv`/`.xlsx` real no navegador a partir dos dados filtrados.
- Antecipação: `desconto = valor × 0,018 × (dias até vencimento / 30)`, somado por fatura selecionada.

## Etapas

1. Design system, Context de dados mockados, layout com sidebar
2. Login + Primeiro Acesso + MFA
3. Dashboard com alertas e gráficos
4. Pedidos, Vendas (com exportação), Estoque
5. Logística e Financeiro com o simulador de antecipação
