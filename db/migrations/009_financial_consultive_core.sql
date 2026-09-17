-- Núcleo consultivo financeiro (candidato, Fases 1-4).
-- Migração aditiva e reversível: apenas DDL, sem INSERT de dados financeiros.
-- Não insere fonte, corte, regra ou permissão: o motor/API deve devolver
-- SEM BASE FINANCEIRA por padrão quando esses elementos estiverem ausentes.

CREATE TABLE IF NOT EXISTS financial_policy_versions (
  version text PRIMARY KEY,
  previous_version text REFERENCES financial_policy_versions(version),
  homologation_status text NOT NULL DEFAULT 'candidato'
    CHECK (homologation_status IN ('candidato', 'aguarda_aceite', 'restrito', 'bloqueado')),
  base_rate_monthly numeric(10,6),
  min_days integer,
  spread_fixed numeric(18,2),
  iof_rate numeric(10,6),
  quote_ttl_seconds integer,
  min_title_amount numeric(18,2),
  max_request_amount numeric(18,2),
  max_titles_per_request integer,
  rationale text NOT NULL DEFAULT 'Politica candidata; aguarda aceite Financeiro.',
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_version IS NULL OR previous_version <> version)
);

CREATE INDEX IF NOT EXISTS idx_financial_policy_versions_status
  ON financial_policy_versions (homologation_status, effective_from DESC);

CREATE TABLE IF NOT EXISTS negotiable_packages (
  package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  policy_version text REFERENCES financial_policy_versions(version),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN (
      'rascunho',
      'cotado',
      'solicitado',
      'em_analise',
      'aprovado',
      'recusado',
      'cancelado',
      'expirado',
      'liquidado_parcial',
      'liquidado'
    )),
  financial_basis text NOT NULL DEFAULT 'sem_base_financeira'
    CHECK (financial_basis IN ('sem_base_financeira', 'base_candidata')),
  source_name text,
  source_cut_id text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb,
  writes_to_erp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (writes_to_erp = false)
);

CREATE INDEX IF NOT EXISTS idx_negotiable_packages_supplier_status
  ON negotiable_packages (supplier_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS evidence_envelopes (
  envelope_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'financial_policy',
      'negotiable_package',
      'anticipation_quote',
      'anticipation_request'
    )),
  entity_id text NOT NULL,
  source_name text,
  source_cut_id text,
  rule_version text,
  permission text,
  evidence_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_envelopes_entity
  ON evidence_envelopes (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_evidence_envelopes_source_cut
  ON evidence_envelopes (source_name, source_cut_id)
  WHERE source_name IS NOT NULL AND source_cut_id IS NOT NULL;

ALTER TABLE negotiable_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiable_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_envelopes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS negotiable_packages_tenant_select ON negotiable_packages;
CREATE POLICY negotiable_packages_tenant_select ON negotiable_packages
  FOR SELECT TO portal_app
  USING (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS negotiable_packages_tenant_insert ON negotiable_packages;
CREATE POLICY negotiable_packages_tenant_insert ON negotiable_packages
  FOR INSERT TO portal_app
  WITH CHECK (supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid);

DROP POLICY IF EXISTS evidence_envelopes_tenant_select ON evidence_envelopes;
CREATE POLICY evidence_envelopes_tenant_select ON evidence_envelopes
  FOR SELECT TO portal_app
  USING (
    EXISTS (
      SELECT 1 FROM negotiable_packages p
      WHERE p.package_id::text = evidence_envelopes.entity_id
        AND p.supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS evidence_envelopes_tenant_insert ON evidence_envelopes;
CREATE POLICY evidence_envelopes_tenant_insert ON evidence_envelopes
  FOR INSERT TO portal_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM negotiable_packages p
      WHERE p.package_id::text = evidence_envelopes.entity_id
        AND p.supplier_id = NULLIF(current_setting('app.supplier_id', true), '')::uuid
    )
  );

GRANT SELECT ON financial_policy_versions TO portal_app;
GRANT SELECT, INSERT ON negotiable_packages, evidence_envelopes TO portal_app;
GRANT ALL ON financial_policy_versions, negotiable_packages, evidence_envelopes TO portal_etl;

-- Reversão manual (não executar automaticamente):
-- DROP POLICY IF EXISTS evidence_envelopes_tenant_select ON evidence_envelopes;
-- DROP POLICY IF EXISTS evidence_envelopes_tenant_insert ON evidence_envelopes;
-- DROP POLICY IF EXISTS negotiable_packages_tenant_select ON negotiable_packages;
-- DROP POLICY IF EXISTS negotiable_packages_tenant_insert ON negotiable_packages;
-- DROP TABLE IF EXISTS evidence_envelopes;
-- DROP TABLE IF EXISTS negotiable_packages;
-- DROP TABLE IF EXISTS financial_policy_versions;
