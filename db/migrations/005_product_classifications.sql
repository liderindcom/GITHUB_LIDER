-- Classificacao mercadologica de produtos (candidato)
-- Cache ETL: RMS/de-para produto -> PostgreSQL portal -> API.

CREATE TABLE IF NOT EXISTS product_classifications (
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  sku text NOT NULL,
  sku_description text NOT NULL,
  department_code text NOT NULL,
  department text NOT NULL,
  section_code text NOT NULL,
  section_name text NOT NULL,
  group_code text NOT NULL,
  product_group text NOT NULL,
  subgroup_code text NOT NULL,
  subgroup text NOT NULL,
  family text NOT NULL,
  commercial_role text NOT NULL CHECK (
    commercial_role IN ('destino', 'rotina', 'conveniencia', 'sazonal', 'nao_classificado')
  ),
  abc_class text NOT NULL CHECK (abc_class IN ('A', 'B', 'C', 'D', 'nao_classificado')),
  sell_out_amount numeric(14, 2) NOT NULL DEFAULT 0,
  avg_daily_sales_90_amount numeric(14, 2) NOT NULL DEFAULT 0,
  subgroup_sales_share_pct numeric(7, 4) NOT NULL DEFAULT 0,
  subgroup_cumulative_share_pct numeric(7, 4) NOT NULL DEFAULT 0,
  source_updated_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_product_classifications_supplier_hierarchy
  ON product_classifications (
    supplier_id,
    department_code,
    section_code,
    group_code,
    subgroup_code,
    abc_class
  );

ALTER TABLE product_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_classifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_classifications_tenant ON product_classifications;
CREATE POLICY product_classifications_tenant ON product_classifications
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

GRANT SELECT ON product_classifications TO portal_app;
GRANT ALL ON product_classifications TO portal_etl;
