CREATE TABLE IF NOT EXISTS vendas_mensal (
  sku TEXT NOT NULL,
  anoMes TEXT NOT NULL,
  quantidade REAL NOT NULL,
  valor REAL NOT NULL,
  fornecedorCodigo TEXT,
  PRIMARY KEY (sku, anoMes)
);

CREATE INDEX IF NOT EXISTS idx_vendas_mensal_anomes ON vendas_mensal(anoMes);
CREATE INDEX IF NOT EXISTS idx_vendas_mensal_forn ON vendas_mensal(fornecedorCodigo);
