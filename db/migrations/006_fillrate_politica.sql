-- Política única de fill rate (taxa da multa). A meta continua pactuada por fornecedor na tela operacional.

CREATE TABLE IF NOT EXISTS fillrate_politica (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  taxaMultaPct REAL NOT NULL,
  atualizadoEm TEXT NOT NULL
);

INSERT OR IGNORE INTO fillrate_politica (id, taxaMultaPct, atualizadoEm)
VALUES (1, 3, datetime('now'));
