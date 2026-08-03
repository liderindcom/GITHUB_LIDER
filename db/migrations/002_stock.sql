-- Estoques com RLS e índices alinhados à API

CREATE TABLE IF NOT EXISTS stock_balances (
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  branch_id text NOT NULL,
  sku text NOT NULL,
  sku_description text NOT NULL DEFAULT '',
  qty_on_hand numeric NOT NULL DEFAULT 0,
  qty_reserved numeric NOT NULL DEFAULT 0,
  reorder_point numeric,
  uom text NOT NULL DEFAULT 'UN',
  source_updated_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, branch_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_supplier_sku
  ON stock_balances (supplier_id, sku);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  branch_id text NOT NULL,
  sku text NOT NULL,
  moved_at timestamptz NOT NULL,
  qty numeric NOT NULL,
  movement_type text NOT NULL,
  document_ref text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier_moved
  ON stock_movements (supplier_id, moved_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier_sku_moved
  ON stock_movements (supplier_id, sku, moved_at DESC);

ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_balances_tenant ON stock_balances;
CREATE POLICY stock_balances_tenant ON stock_balances
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS stock_movements_tenant ON stock_movements;
CREATE POLICY stock_movements_tenant ON stock_movements
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

GRANT SELECT ON stock_balances, stock_movements TO portal_app;
GRANT ALL ON stock_balances, stock_movements TO portal_etl;
