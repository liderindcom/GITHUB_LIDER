# Portal do Fornecedor — Grupo Líder

Este repositório contém a aplicação unificada para o **Portal do Fornecedor do Grupo Líder**:
1.  **Frontend / UI:** Aplicação interativa desenvolvida usando React, Vite, TailwindCSS, Lucide Icons e TanStack Start, gerada pelo Lovable.
2.  **Backend / ETL:** Sincronizador assíncrono híbrido em Python que realiza a extração real de dados fiscais e financeiros dos ERPs (Oracle RMS e Totvs RM SQL Server) e gera os caches locais em JSON.

---

## 🎨 1. Como rodar a Interface (Frontend)

O frontend utiliza o moderno **TanStack Start** com Vite e TailwindCSS.

### Pré-requisitos:
- Node.js (versão 18 ou superior)
- npm ou pnpm

### Passos:
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Acesse a aplicação localmente no navegador em `http://localhost:3000` ou na porta indicada pelo console.

---

## ⚙️ 2. Como rodar o Sincronizador de Dados (Sync Worker)

O sincronizador assíncrono em Python conecta-se de forma segura aos bancos transacionais corporativos (Oracle RMS e Totvs RM SQL Server), consolida faturamentos, pedidos e lançamentos financeiros de fornecedores, e gera sementes enriquecidas.

### Pré-requisitos:
- Python 3.8+
- Cliente Oracle Thick (Instant Client) configurado em `LD_LIBRARY_PATH`.

### Passos:
1. Execute o script de sincronização na VPS usando o ambiente Python habilitado:
   ```bash
   LD_LIBRARY_PATH=/home/administrador/instantclient_19_25 /home/administrador/deepseek-env/bin/python3 packages/sync_worker.py
   ```
2. O script atualizará as sementes locais em:
   👉 `db/seeds/real_supplier_portal_data.json`

---

## 🛠️ 3. Roteiro de Governança (CODE-01 a CODE-10)
Toda a modelagem do banco de dados, migrações de segurança PostgreSQL com **Row-Level Security (RLS)**, schemas de validação e pareceres de auditoria encontram-se estruturados nas pastas `/db/migrations/`, `/packages/contracts/` e `/docs/` para conformidade operacional estrita.
