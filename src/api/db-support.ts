import { db } from "../server/db";

export const tabelaExiste = (nome: string) => {
  try {
    return Boolean(
      db
        .prepare(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
        )
        .get(nome),
    );
  } catch {
    try {
      return Boolean(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nome),
      );
    } catch {
      return false;
    }
  }
};

export const colunaExiste = (tabela: string, coluna: string) => {
  try {
    if (
      db
        .prepare(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND lower(column_name) = lower(?)",
        )
        .get(tabela, coluna)
    ) {
      return true;
    }
  } catch {
    /* SQLite não possui information_schema. */
  }
  try {
    return Boolean(
      db
        .prepare(`SELECT 1 FROM pragma_table_info(?) WHERE lower(name) = lower(?)`)
        .get(tabela, coluna),
    );
  } catch {
    return false;
  }
};

/** Sortimento: fiscal ∪ grupo ∪ gabarito. Pedido/NF/financeiro continuam fiscais. */
export const sqlSkuVisivel = (alias = "p") =>
  tabelaExiste("produto_visibilidade")
    ? `EXISTS (SELECT 1 FROM produto_visibilidade WHERE fornecedorcodigo = ? AND sku = ${alias}.sku)`
    : `${alias}.fornecedorcodigo = ?`;

export const joinVendasMensalProduto = `LEFT JOIN produtos p
      ON p.sku = vm.sku
      OR (
        length(vm.sku) > 1
        AND p.codigoProdutoRms = substr(vm.sku, 1, length(vm.sku) - 1)
        AND p.digitoProdutoRms = substr(vm.sku, -1)
      )`;
