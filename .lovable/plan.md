# Portal do Fornecedor Líder

Li a especificação diretamente do repositório `liderindcom/GITHUB_LIDER` (via conexão GitHub da workspace) e vou construir o portal aqui, neste projeto, seguindo a spec. Observação: o Lovable não importa repositórios — o código nasce aqui e pode ser sincronizado de volta para o GitHub depois.

## Identidade visual

Azul marinho `#0f172a` + azul Líder `#1e40af`, verde esmeralda para sucesso, âmbar para atenção, vermelho para ruptura. Ícones Lucide, tipografia sans-serif limpa, componentes shadcn/ui. Tudo via tokens semânticos no design system (sem cores fixas espalhadas nos componentes).

## Backend (Lovable Cloud)

Banco e login reais, com as tabelas semeadas com os dados da spec (Nestlé Brasil S/A, 3 lojas Líder, 3 SKUs), então tudo já aparece populado na primeira abertura:

- `fornecedores` (código, razão social, CNPJ), `lojas`, `produtos`
- `pedidos` + `pedido_itens` (status: aberto, faturado, pendente, cancelado)
- `vendas_itens` (sell-out por SKU/loja/data, com CMV e margem)
- `estoque` (estoque atual e mínimo por SKU/loja)
- `agendamentos_nfe` (chave NF-e, data/hora, central de distribuição)
- `faturas` (vencimento, valor, status pago/a vencer) + `antecipacoes`

Cada tabela com RLS: o fornecedor autenticado só vê os próprios dados. Leituras via server functions autenticadas.

## Telas

1. **/login** — Código do Fornecedor + CNPJ/senha. Se a senha ainda for o CNPJ, abre o modal de Primeiro Acesso: nova senha (mín. 8 caracteres, 1 especial) e onboarding de MFA com QR Code e campo de 6 dígitos.
2. **/dashboard** — cards de alerta acionáveis (ruptura crítica / NF-e pendentes de agendamento / previsão de pagamento), gráfico de vendas dos últimos 6 meses e rosca de estoque por categoria.
3. **/pedidos** — tabela com filtros rápidos por status; clique na linha abre drawer lateral com itens, preço unitário, quantidade pedida e faturada.
4. **/vendas** — relatório item a item com filtro de período obrigatório e filtro por loja; colunas SKU, descrição, qtd vendida, valor unitário médio, bruto total, CMV, margem %; botão de exportar Excel.
5. **/estoque** — estoque por loja com sinalizador de cor: vermelho se atual < mínimo, âmbar se próximo, verde se confortável.
6. **/logistica** — calendário interativo de agendamentos + formulário com chave da NF-e e data/hora de entrega.
7. **/financeiro** — faturas a vencer e pagas + modal do Simulador de Antecipação, calculando desconto de 1,8% a.m. proporcional aos dias até o vencimento e mostrando o líquido a receber hoje, em tempo real.

Layout com shell autenticado: sidebar de navegação, cabeçalho com fornecedor logado e sair.

## Detalhes técnicos

- Rotas de app sob `_authenticated/` (gate gerenciado); `/` redireciona para `/dashboard` quando logado e mostra o login caso contrário.
- Autenticação usa e-mail internamente; como a spec loga por Código do Fornecedor, derivo um e-mail determinístico a partir do código e ativo confirmação automática. Efeito colateral: reset de senha por e-mail não funciona nesse modelo — se preferir, podemos pedir e-mail corporativo no primeiro acesso.
- MFA (TOTP) via Cloud auth, obrigatório no onboarding do primeiro acesso.
- Exportação Excel gerada no cliente (arquivo .xlsx real).
- Simulador de antecipação: cálculo pró-rata dias/30 sobre a taxa mensal, exibido ao vivo conforme as faturas selecionadas.

## Entrega em etapas

1. Cloud + schema + seed dos dados da spec
2. Login, primeiro acesso e MFA + shell autenticado
3. Dashboard com alertas e gráficos
4. Pedidos, Vendas (com Excel), Estoque
5. Logística e Financeiro com o simulador
