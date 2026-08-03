-- Portal do Fornecedor — core + RLS (candidato)
-- NÃO aplicar em produção sem auditoria e aceites.
-- Sem BYPASSRLS na role da API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_app') THEN
    CREATE ROLE portal_app NOINHERIT LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_etl') THEN
    CREATE ROLE portal_etl NOINHERIT LOGIN;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  cnpj char(14) NOT NULL UNIQUE,
  legal_name text NOT NULL,
  anticipation_enabled boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  email text NOT NULL,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  mfa_enabled boolean NOT NULL DEFAULT false,
  roles text[] NOT NULL DEFAULT ARRAY['supplier_user'],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, email)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  supplier_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  ip inet,
  user_agent text,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- audit_events: append-only para portal_app (sem UPDATE/DELETE)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_tenant ON suppliers;
CREATE POLICY suppliers_tenant ON suppliers
  FOR SELECT TO portal_app
  USING (id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS portal_users_tenant ON portal_users;
CREATE POLICY portal_users_tenant ON portal_users
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS audit_events_tenant_select ON audit_events;
CREATE POLICY audit_events_tenant_select ON audit_events
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS audit_events_tenant_insert ON audit_events;
CREATE POLICY audit_events_tenant_insert ON audit_events
  FOR INSERT TO portal_app
  WITH CHECK (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

GRANT SELECT ON suppliers, portal_users TO portal_app;
GRANT SELECT, INSERT ON audit_events TO portal_app;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO portal_app;

-- ETL: full write no core (ainda sem internet)
GRANT ALL ON suppliers, portal_users, audit_events TO portal_etl;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO portal_etl;
