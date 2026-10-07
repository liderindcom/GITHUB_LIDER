# Transferência do Portal do Fornecedor

**Data de referência:** 2026-10-07  
**Projeto atual:** Portal do Fornecedor — Grupo Líder  
**Repositório:** `/lider/portal-fornecedor`  
**Branch de produção:** `main`  
**Remote oficial:** `origin` (`github.com:liderindcom/GITHUB_LIDER.git`)

Este documento é o ponto de partida para qualquer nova versão do agente ou da equipe. Ele descreve o que existe, por que foi construído, as regras que não podem ser alteradas sem validação e o caminho planejado para transformar o Portal em um produto comercial para outras empresas que usam RMS.

> Não colocar senhas, tokens, DSNs ou dados de fornecedores neste documento. Segredos ficam somente no ambiente operacional e nos arquivos protegidos do servidor.

## 1. Visão do produto

O Portal transforma dados operacionais do varejista em informações úteis para seus fornecedores. O fornecedor acompanha vendas, estoque, pedidos, perdas, logística, preços e indicadores por loja sem receber acesso direto ao banco do varejista.

O problema comercial principal é a falta de transparência entre varejista e fornecedor. O Portal responde quanto foi vendido, onde existe estoque parado ou ruptura, quais lojas geram mais avarias, quais pedidos estão pendentes e qual é a participação do fornecedor dentro de cada categoria.

A Líder é o primeiro ambiente de referência. A evolução planejada é um produto multiempresa, com um conector instalado no servidor de cada cliente.

## 2. Estado atual

O Portal está em produção. O runtime Node escuta localmente em `127.0.0.1:18090`; o Nginx publica HTTPS.

Validações mais recentes:

- build de produção concluído com `npm run build`;
- Portal público respondendo HTTP 200;
- repositório limpo e sincronizado com `origin/main`;
- lote ativo de perdas Agenda 520: 321.702 registros;
- atualização diária das perdas agendada para 05:00 UTC.

Commits principais:

| Commit | Conteúdo |
|---|---|
| `ef239f6` | Fonte consolidada do CometNet para Agenda 520 |
| `aeacc70` | Registro do cron diário da Agenda 520 |
| `4e3ee9b` | Separação visual entre avaria operacional e cobrança fiscal |
| `10e64aa` | Valoração anterior pelo custo médio RMS |
| `c19a8e4` | Documentação da fonte RMS da Agenda 520 |

## 3. Arquitetura atual

```text
Navegador
   ↓
Nginx / HTTPS
   ↓
TanStack Start + Node em 127.0.0.1:18090
   ↓
Server functions / PostgreSQL
   ↓
Workers e cargas assíncronas
   ├── RMS Oracle (somente leitura)
   ├── CometNet / Intelider (somente leitura)
   └── RM SQL Server em fluxos específicos
```

Tecnologias:

- Frontend: React, TypeScript, TanStack Start, Vite, TailwindCSS e Lucide.
- Backend web: server functions TanStack Start em Node.
- Banco operacional: PostgreSQL.
- ETL e cargas: Python.
- Scripts auxiliares: Node/MJS e shell.
- Produção: Node + Nginx + supervisor.

A API deve ler caches e tabelas operacionais do PostgreSQL. Não fazer consultas pesadas diretamente no Oracle ou SQL Server durante uma requisição de usuário.

## 4. Menus existentes

As rotas estão em `src/routes`; o menu está em `src/components/app-sidebar.tsx`.

- Dashboard — `/dashboard`
- Pedidos — `/pedidos`
- Acordo Fill Rate — `/acordo-fillrate`
- Vendas Sell-out — `/vendas`
- Vendas Anual — `/vendas-anual`
- Catálogo Comercial — `/catalogo-comercial`
- Estoque — `/estoque`
- Ruptura e Perda Venda — `/ruptura-venda`
- Perdas Físicas — `/perdas`
- Relatório MIX — `/relatorio-mix`
- Preço Concorrência — `/precos`
- Tabela de Preço (Sistema) — `/preco-sistema`
- Share de Vendas — `/representatividade`
- Sugestão Compra — `/sugestao-compra`
- Ofertas e Rebaixas — `/ofertas-rebaixas`
- Classificação — `/classificacao`
- Logística — `/logistica`
- Conciliação NF-e — `/conciliacao`
- Contas a Receber — `/contas-receber`
- Financeiro — `/financeiro`
- Corrigir senha — `/corrigir-senha`
- Usuários e menus administrativos.

## 5. Regras de negócio

### Fornecedor

O Portal usa o código-base fiscal. Alguns sistemas exibem o dígito verificador, por exemplo `11640-8`; internamente as consultas usam `11640`. A normalização está em `src/lib/fornecedor-codigo.ts`.

Nunca usar somente o nome como chave.

### Estoque

Os cards exibem estoque real, estoque ideal e venda. A venda pode aparecer em unidade ou valor. A venda de 30 dias em unidades deve usar a quantidade vendida pelo CMV.

No card “Dimensionamento de estoque por loja”, sem loja selecionada deve aparecer o total do produto na rede. Não confundir rede, loja e CDAM.

### Share de vendas

O share deve ser calculado dentro da mesma categoria/subgrupo, considerando o fornecedor em cada subgrupo. Todas as marcas/produtos do fornecedor devem ser somadas antes do percentual.

Nunca misturar competências quando o usuário selecionou um mês.

### Perdas físicas / Agenda 520

Uma NF de perdas pode conter itens de vários fornecedores. A chave operacional correta é:

```text
data + fornecedor + loja/origem + NF + série + SKU
```

O valor usado atualmente é `I_AG520_SUBTOTAL`, reproduzindo o CometNet. O custo unitário vem de `I_AG520_CUSTO`.

A tela é **Avarias operacionais por loja**. Ela serve para identificar lojas que precisam de treinamento; não é cobrança fiscal.

Fonte oficial:

- `CONSULTA.TB_AG520_ITENS`
- `CONSULTA.TB_AG520_NF`

Campos relevantes:

- fornecedor/origem: `I_AG520_CODFORN`, `I_AG520_FORNECEDOR`, `I_AG520_CODORIG`;
- documento: `I_AG520_NFISCAL`, `I_AG520_SERIE`, `I_AG520_DTAGEN`;
- produto: `I_AG520_CODIGO`, `I_AG520_DIGITO`, `I_AG520_DESCRICAO`;
- quantidade/valor: `I_AG520_QTDE`, `I_AG520_CUSTO`, `I_AG520_SUBTOTAL`;
- origem legível: `N_AG520_ORIGEM`.

Validação da BRF:

- código-base `11640`, exibido `11640-8`;
- setembro/2026: R$ 167.066,77;
- CDAM: R$ 144.007,57;
- demais lojas: R$ 23.059,20;
- origens: 22.

O carregamento antigo baseado somente em `RMS.AG1CDFAT` mostrava apenas CDAM e R$ 4.056. Essa tabela não deve voltar a ser a fonte principal da visão por loja.

## 6. Carga da Agenda 520

Arquivo: `scripts/importar_perdas_rms_520_canonicas.py`.

Comportamento:

- consulta últimos 13 meses;
- lê a base consolidada do CometNet;
- preserva fornecedor, origem, NF, série, produto e data;
- cria lote novo;
- grava no PostgreSQL;
- ativa o lote apenas depois da inserção completa.

Tabelas:

- `perdas_rms_520_canonicas`;
- `perdas_rms_520_controle`.

Cron atual:

```text
0 5 * * * LD_LIBRARY_PATH=/home/administrador/instantclient_19_25 /home/administrador/deepseek-env/bin/python3 /lider/portal-fornecedor/scripts/importar_perdas_rms_520_canonicas.py --apply >> /lider/portal-fornecedor/logs/perdas-rms-520.log 2>&1
```

O horário é 05:00 UTC. Confirmar fuso antes de alterar.

## 7. Fontes e integrações

O código legado do CometNet está em `/home/administrador/worktrees/cometnet-rebaixa-portal`. A implementação de Agenda 520 está em `src/com/br/metavenda/service/produtovalidade/ProdutoFonecedorService.java`.

O CometNet usa conexão Oracle diferente da conexão antiga do Portal. Não presumir que `ISAURA` tenha acesso às tabelas `CONSULTA.TB_AG520_*`.

O RMS Oracle fornece produtos, custos, estoque e vendas em cargas autorizadas. O RM SQL Server participa de fluxos específicos financeiros. RMS, RM e CometNet são domínios diferentes.

A API não deve fazer varredura direta nos bancos transacionais.

## 8. Operação e deploy

Diretório: `/lider/portal-fornecedor`.

Build:

```bash
npm run build
```

Runtime:

- servidor: `.output/server/index.mjs`;
- porta local: `127.0.0.1:18090`;
- supervisor: `scripts/portal-supervisor-node-http.sh`;
- Nginx publica HTTPS.

Smoke test:

```bash
curl -ksS -o /dev/null -w '%{http_code}\n' https://portaldofornecedor.intelider.com.br/
```

Esperado: `200`. Após build, aguardar o supervisor reiniciar o Node antes do teste final.

Logs atuais:

- `logs/portal-node.log`;
- `logs/portal-supervisor.log`;
- `logs/portal-refresh-diario.log`;
- `logs/perdas-rms-520.log`.

`DATABASE_URL` e demais segredos ficam fora do Git. Nunca versionar `.env.postgres`.

## 9. VPS do produto comercial

Para o primeiro ambiente comercial:

- Ubuntu 24.04 LTS;
- 4 vCPU;
- 16 GB RAM;
- 200 GB NVMe;
- IP público fixo;
- firewall com SSH restrito e somente 80/443 públicos;
- backups externos além do backup da VPS;
- Docker e Docker Compose.

A VPS hospedará Portal, API, PostgreSQL e workers. O banco RMS de cada cliente não deve ser exposto à internet.

## 10. Produto comercial planejado

A Líder será o primeiro cliente de referência, mas a versão comercial precisa remover dependências específicas da Líder.

### Conector RMS local

Cada cliente instalará um conector em seu servidor. Ele:

1. conecta localmente ao Oracle, SQL Server ou PostgreSQL;
2. usa somente leitura;
3. aplica o mapeamento daquele cliente;
4. normaliza dados para o modelo do Portal;
5. envia lotes por HTTPS;
6. mantém fila local para retry.

```text
RMS do cliente
   ↓ leitura local
Conector RMS
   ↓ HTTPS outbound
API multiempresa
   ↓
PostgreSQL isolado por empresa
   ↓
Portal do fornecedor
```

Linguagens planejadas:

- conector definitivo: Go, como binário Windows/Linux;
- primeiro protótipo: Python, reaproveitando scripts validados;
- Portal/API: TypeScript/Node.js;
- banco: PostgreSQL;
- configuração: YAML ou JSON;
- transporte: HTTPS com lotes idempotentes.

### Multiempresa

Implementar:

- `tenant_id` ou banco separado por cliente;
- tokens exclusivos por empresa e conector;
- isolamento obrigatório no backend;
- usuários internos, fornecedores e administradores separados;
- auditoria de cargas e acessos;
- regras por cliente;
- retenção e exclusão documentadas.

Não levar para o produto comercial credenciais, logs ou dados reais da Líder.

### MVP vendável

1. autenticação e multiempresa;
2. fornecedores e lojas;
3. vendas sell-out;
4. estoque real/ideal;
5. pedidos e fill rate;
6. perdas por loja e fornecedor;
7. conector Oracle;
8. painel de status do conector;
9. exportação CSV/PDF;
10. auditoria e suporte.

Depois: conectores SQL Server/PostgreSQL, logística avançada, acordos financeiros e customizações.

## 11. Não fazer sem validação

- trocar a fonte da Agenda 520 por `AG1CDFAT` sem comparar com CometNet;
- misturar cobrança fiscal com avaria operacional;
- usar venda no lugar de custo/subtotal sem aprovação;
- misturar competências;
- liberar dados de uma loja para outro fornecedor;
- consultar Oracle/RM em cada abertura de tela;
- colocar senha em código, documentação ou frontend;
- apagar lote ativo ou tabela produtiva sem backup;
- declarar homologação fiscal sem comparação oficial.

## 12. Roteiro de evolução

### Fase 1 — estabilizar Líder

- monitorar cron da Agenda 520;
- comparar mensalmente CometNet e Portal;
- registrar divergências por fornecedor, loja e NF;
- revisar logs e backups;
- corrigir os menus atuais.

### Fase 2 — extrair produto

- criar repositório privado limpo;
- remover dados e credenciais da Líder;
- definir contratos canônicos;
- transformar regras específicas em configuração;
- criar primeiro conector local.

### Fase 3 — piloto externo

- escolher empresa com Oracle RMS;
- instalar conector controlado;
- validar somente leitura e segurança;
- comparar relatórios com o RMS;
- medir tempo de implantação e qualidade da carga.

### Fase 4 — comercialização

- contrato, SLA e suporte;
- planos por empresa, fornecedor ou volume;
- documentação de instalação;
- monitoramento multiempresa;
- atualização e rollback.

## 13. Procedimento para a próxima versão do agente

1. ler este documento e o `README.md`;
2. verificar `git status` e `git log`;
3. ler os dois registros mais recentes em `docs/controle-codigo`;
4. confirmar o lote ativo da Agenda 520;
5. não fazer hot-query ampla em Oracle/RM;
6. validar alterações com build e smoke test;
7. registrar entregas em novo documento de controle;
8. fazer commit e push depois da validação;
9. nunca afirmar correção sem comparar com a fonte oficial.

## 14. Estado de aceitação

O Portal da Líder está operacional. A transformação em produto comercial ainda é um plano de evolução.

Riscos principais:

- versões e customizações diferentes do RMS;
- qualidade das tabelas de origem;
- isolamento multiempresa;
- segurança dos conectores em redes de terceiros;
- suporte, backup e responsabilidade pelos dados.

Próximo marco: criar a cópia limpa do produto, sem dados da Líder, e iniciar o conector Oracle em uma VPS independente.

