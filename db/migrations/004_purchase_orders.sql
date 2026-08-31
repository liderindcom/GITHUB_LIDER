-- Pedidos de compra com separacao Fornecedor x CDAM (candidato)
-- Cache ETL: origem RMS -> PostgreSQL portal -> API.

CREATE TABLE IF NOT EXISTS purchase_orders (
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  order_kind text NOT NULL CHECK (order_kind IN ('supplier_direct', 'cdam_central_depot')),
  origin_name text NOT NULL,
  destination_name text NOT NULL,
  reference_branch_id text NOT NULL,
  issue_date date NOT NULL,
  expected_delivery_date date,
  cdam_entry_date date,
  delivery_lead_time_days integer CHECK (delivery_lead_time_days IS NULL OR delivery_lead_time_days >= 0),
  status text NOT NULL CHECK (status IN ('aberto', 'faturado', 'pendente', 'entregue', 'cancelado')),
  agenda_context text NOT NULL CHECK (agenda_context IN ('compras_recebimento', 'transferencia_cdam')),
  agenda_code text NOT NULL,
  agenda_parity text NOT NULL,
  qty_ordered_total numeric NOT NULL DEFAULT 0,
  qty_invoiced_total numeric NOT NULL DEFAULT 0,
  fill_rate_pct numeric(7, 4) NOT NULL DEFAULT 0,
  rule_summary text,
  source_updated_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, order_id),
  UNIQUE (supplier_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_kind_status
  ON purchase_orders (supplier_id, order_kind, status, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_branch
  ON purchase_orders (supplier_id, reference_branch_id, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_cdam_entry
  ON purchase_orders (supplier_id, cdam_entry_date DESC)
  WHERE cdam_entry_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  supplier_id uuid NOT NULL,
  order_id uuid NOT NULL,
  line_number integer NOT NULL,
  sku text NOT NULL,
  sku_description text NOT NULL DEFAULT '',
  qty_ordered numeric NOT NULL DEFAULT 0,
  qty_invoiced numeric NOT NULL DEFAULT 0,
  fill_rate_pct numeric(7, 4) NOT NULL DEFAULT 0,
  unit_price numeric(14, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (supplier_id, order_id, line_number),
  FOREIGN KEY (supplier_id, order_id)
    REFERENCES purchase_orders (supplier_id, order_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_supplier_sku
  ON purchase_order_lines (supplier_id, sku);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_orders_tenant ON purchase_orders;
CREATE POLICY purchase_orders_tenant ON purchase_orders
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS purchase_order_lines_tenant ON purchase_order_lines;
CREATE POLICY purchase_order_lines_tenant ON purchase_order_lines
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

GRANT SELECT ON purchase_orders, purchase_order_lines TO portal_app;
GRANT ALL ON purchase_orders, purchase_order_lines TO portal_etl;
