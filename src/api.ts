import { createServerFn } from "@tanstack/react-start";
import { db } from "./server/db";

export type FornecedorDB = {
  codigo: string;
  nome: string;
  cnpj: string;
  cnpjSenhaInicial: string;
  destinatario: string;
  modeloEntrega: string;
  agendaRecebimentoCdam: number;
  filialEntregaPadrao: string;
  prazoPagamentoDias: number;
  descontoFinanceiroPct: number;
  condicaoPagamentoLabel: string;
  acessoLiberado?: number;
};

export type ProdutoDB = {
  sku: string;
  codigoProdutoRms: string;
  digitoProdutoRms: string;
  descricao: string;
  categoria: string;
  departamentoCodigo: string;
  departamento: string;
  secaoCodigo: string;
  secao: string;
  grupoCodigo: string;
  grupo: string;
  subgrupoCodigo: string;
  subgrupo: string;
  familia: string;
  papelMercadologico: string;
  precoTabela: number;
  cmvUnit: number;
  fornecedorCodigo: string;
  compradorCodigo?: string;
  compradorNome?: string;
  embalagemCompra?: number;
  tipoEmbalagemCompra?: string;
};

export type PerdaDB = {
  id: number;
  fornecedorCodigo: string;
  lojaId: string;
  lojaNome: string;
  sku: string;
  produtoDescricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  data: string;
  ocorrencias: number;
};

export type VendaDB = {
  id: number;
  data: string;
  lojaId: string;
  sku: string;
  quantidade: number;
  valorUnitario: number;
};

// Endpoints RPC no lado do servidor (Server Functions)
export const fetchFornecedoresList = createServerFn({ method: "GET" }).handler(async () => {
  const stmt = db.prepare(
    "SELECT codigo, nome, cnpj, cnpjSenhaInicial, acessoLiberado FROM fornecedores LIMIT 100",
  );
  return stmt.all() as FornecedorDB[];
});

export const fetchFornecedor = createServerFn({ method: "GET" })
  .validator((codigo: string) => codigo)
  .handler(async ({ data: codigo }) => {
    const stmt = db.prepare("SELECT * FROM fornecedores WHERE codigo = ?");
    return stmt.get(codigo) as FornecedorDB | undefined;
  });

export const fetchProdutos = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => fornecedorCodigo)
  .handler(async ({ data: fornecedorCodigo }) => {
    const stmt = db.prepare("SELECT * FROM produtos WHERE fornecedorCodigo = ?");
    return stmt.all(fornecedorCodigo) as ProdutoDB[];
  });

export const fetchPerdas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => fornecedorCodigo)
  .handler(async ({ data: fornecedorCodigo }) => {
    const stmt = db.prepare("SELECT * FROM perdas WHERE fornecedorCodigo = ?");
    return stmt.all(fornecedorCodigo) as PerdaDB[];
  });

export const fetchVendas = createServerFn({ method: "GET" })
  .validator((fornecedorCodigo: string) => fornecedorCodigo)
  .handler(async ({ data: fornecedorCodigo }) => {
    // Como a tabela de vendas contém milhões de linhas, unimos com produtos para buscar de forma extremamente rápida indexada
    const stmt = db.prepare(`
      SELECT v.* 
      FROM vendas v
      JOIN produtos p ON v.sku = p.sku
      WHERE p.fornecedorCodigo = ?
    `);
    return stmt.all(fornecedorCodigo) as VendaDB[];
  });

// Novos Endpoints para o Painel Administrativo de Controle de Acesso
export const searchFornecedores = createServerFn({ method: "GET" })
  .validator((data: { search: string; limit: number; offset: number; onlyActive?: boolean }) => data)
  .handler(async ({ data }) => {
    const { search, limit, offset, onlyActive } = data;
    const cleanSearch = `%${search.trim()}%`;
    
    let query = "SELECT codigo, nome, cnpj, acessoLiberado FROM fornecedores WHERE (codigo LIKE ? OR nome LIKE ? OR cnpj LIKE ?)";
    const params: any[] = [cleanSearch, cleanSearch, cleanSearch];
    
    if (onlyActive) {
      query += " AND acessoLiberado = 1";
    }
    
    query += " ORDER BY codigo LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    // Obter contagem total
    let countQuery = "SELECT COUNT(*) FROM fornecedores WHERE (codigo LIKE ? OR nome LIKE ? OR cnpj LIKE ?)";
    const countParams: any[] = [cleanSearch, cleanSearch, cleanSearch];
    if (onlyActive) {
      countQuery += " AND acessoLiberado = 1";
    }
    const countStmt = db.prepare(countQuery);
    const total = countStmt.get(...countParams) as any;
    
    return {
      rows: rows as FornecedorDB[],
      total: total ? (total["COUNT(*)"] as number) : 0,
    };
  });

export const updateSupplierAccess = createServerFn({ method: "POST" })
  .validator((data: { codigo: string; acessoLiberado: number }) => data)
  .handler(async ({ data }) => {
    const { codigo, acessoLiberado } = data;
    const stmt = db.prepare("UPDATE fornecedores SET acessoLiberado = ? WHERE codigo = ?");
    stmt.run(acessoLiberado, codigo);
    return { success: true };
  });


export type UsuarioInternoDB = {
  username: string;
  nome: string;
  role: string;
};

export const loginUsuarioInterno = createServerFn({ method: "POST" })
  .validator((data: { username: string; senha: string }) => data)
  .handler(async ({ data }) => {
    const { username, senha } = data;
    const stmt = db.prepare("SELECT username, nome, role FROM usuarios_internos WHERE username = ? AND senha = ?");
    const user = stmt.get(username, senha) as UsuarioInternoDB | undefined;
    return user;
  });

export const fetchUsuariosInternos = createServerFn({ method: "GET" }).handler(async () => {
  const stmt = db.prepare("SELECT username, nome, role FROM usuarios_internos ORDER BY username");
  return stmt.all() as UsuarioInternoDB[];
});

export const createUsuarioInterno = createServerFn({ method: "POST" })
  .validator((data: { username: string; nome: string; senha: string; role: string }) => data)
  .handler(async ({ data }) => {
    const { username, nome, senha, role } = data;
    const stmt = db.prepare("INSERT INTO usuarios_internos (username, nome, senha, role) VALUES (?, ?, ?, ?)");
    stmt.run(username, nome, senha, role);
    return { success: true };
  });

export const deleteUsuarioInterno = createServerFn({ method: "POST" })
  .validator((username: string) => username)
  .handler(async ({ data: username }) => {
    const stmt = db.prepare("DELETE FROM usuarios_internos WHERE username = ?");
    stmt.run(username);
    return { success: true };
  });
