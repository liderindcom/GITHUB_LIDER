-- Títulos e antecipação (candidato; taxas aguardam aceite Financeiro)

CREATE TABLE IF NOT EXISTS receivable_titles (
  title_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  document_number text NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BRL',
  amount_original numeric(18,2) NOT NULL,
  amount_open numeric(18,2) NOT NULL,
  status text NOT NULL,
  anticipation_lock_request_id uuid,
  source_updated_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CHECK (currency = 'BRL'),
  CHECK (amount_open >= 0)
);

CREATE INDEX IF NOT EXISTS idx_titles_supplier_due
  ON receivable_titles (supplier_id, due_date);

CREATE INDEX IF NOT EXISTS idx_titles_supplier_status
  ON receivable_titles (supplier_id, status);

CREATE TABLE IF NOT EXISTS anticipation_policy (
  version text PRIMARY KEY,
  base_rate_monthly numeric(10,6) NOT NULL,
  min_days integer NOT NULL DEFAULT 5,
  spread_fixed numeric(18,2) NOT NULL DEFAULT 0,
  iof_rate numeric(10,6) NOT NULL DEFAULT 0,
  quote_ttl_seconds integer NOT NULL DEFAULT 900,
  min_title_amount numeric(18,2) NOT NULL DEFAULT 100.00,
  max_request_amount numeric(18,2) NOT NULL DEFAULT 500000.00,
  max_titles_per_request integer NOT NULL DEFAULT 50,
  homologation_status text NOT NULL DEFAULT 'candidato',
  effective_from timestamptz NOT NULL DEFAULT now(),
  CHECK (homologation_status IN ('candidato', 'aguarda_aceite', 'restrito', 'bloqueado'))
);

CREATE TABLE IF NOT EXISTS anticipation_quotes (
  quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  policy_version text NOT NULL REFERENCES anticipation_policy(version),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BRL',
  gross numeric(18,2) NOT NULL,
  discount numeric(18,2) NOT NULL,
  net numeric(18,2) NOT NULL,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS anticipation_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES anticipation_quotes(quote_id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  client_request_id text NOT NULL,
  status text NOT NULL,
  accept_terms_version text NOT NULL,
  gross numeric(18,2) NOT NULL,
  discount numeric(18,2) NOT NULL,
  net numeric(18,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS anticipation_request_lines (
  request_id uuid NOT NULL REFERENCES anticipation_requests(request_id),
  title_id uuid NOT NULL REFERENCES receivable_titles(title_id),
  amount_open numeric(18,2) NOT NULL,
  discount numeric(18,2) NOT NULL,
  net numeric(18,2) NOT NULL,
  PRIMARY KEY (request_id, title_id)
);

-- Impede dois pedidos ativos no mesmo título (lock 1:1 no título)
CREATE UNIQUE INDEX IF NOT EXISTS uq_title_anticipation_lock
  ON receivable_titles (title_id)
  WHERE anticipation_lock_request_id IS NOT NULL;

ALTER TABLE receivable_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_titles FORCE ROW LEVEL SECURITY;
ALTER TABLE anticipation_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE anticipation_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE anticipation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE anticipation_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE anticipation_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE anticipation_request_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY titles_tenant ON receivable_titles
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

CREATE POLICY quotes_tenant_select ON anticipation_quotes
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

CREATE POLICY quotes_tenant_insert ON anticipation_quotes
  FOR INSERT TO portal_app
  WITH CHECK (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

CREATE POLICY requests_tenant_select ON anticipation_requests
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

CREATE POLICY requests_tenant_insert ON anticipation_requests
  FOR INSERT TO portal_app
  WITH CHECK (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

CREATE POLICY request_lines_tenant ON anticipation_request_lines
  FOR ALL TO portal_app
  USING (
    EXISTS (
      SELECT 1 FROM anticipation_requests r
      WHERE r.request_id = anticipation_request_lines.request_id
        AND r.supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM anticipation_requests r
      WHERE r.request_id = anticipation_request_lines.request_id
        AND r.supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid
    )
  );

GRANT SELECT ON receivable_titles, anticipation_policy TO portal_app;
GRANT SELECT, INSERT ON anticipation_quotes, anticipation_requests, anticipation_request_lines TO portal_app;
GRANT ALL ON receivable_titles, anticipation_policy, anticipation_quotes,
  anticipation_requests, anticipation_request_lines TO portal_etl;
