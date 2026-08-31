-- Meta de fill rate pactuada por fornecedor. A taxa da multa continua em fillrate_politica.

ALTER TABLE fornecedores ADD COLUMN metaFillRatePct REAL NOT NULL DEFAULT 85;
