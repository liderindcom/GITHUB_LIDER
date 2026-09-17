-- Fase 3 candidata — fluxo operacional projetado por fornecedor/horizonte.
-- Migração SOMENTE aditiva e reversível: apenas DDL, sem INSERT de dados.
--
-- Fórmula operacional por faixa de horizonte:
--   vendas_realizadas + entradas_financeiras_previstas - compromissos_a_pagar
--
-- Cada série exige fonte, corte, regra e permissão. Se faltar qualquer série,
-- a respectiva coluna fica NULL (SEM BASE FINANCEIRA) e a projeção da faixa
-- fica NULL; não há preenchimento de lacunas. O fluxo operacional projetado
-- NÃO é saldo bancário nem caixa disponível.
--
-- Nenhuma exposição é criada para fornecedor/AppCom: a role portal_app NÃO
-- recebe GRANT nesta tabela.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_comprador') THEN
    CREATE ROLE portal_comprador NOINHERIT LOGIN;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS operational_flow_projection_lines (
  projection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL REFERENCES suppliers(code),
  horizon_id text NOT NULL,
  horizon_date date NOT NULL,
  bucket_id text NOT NULL,
  bucket_from date NOT NULL,
  bucket_to date NOT NULL,
  vendas_realizadas_amount numeric(18,2),
  entradas_financeiras_previstas_amount numeric(18,2),
  compromissos_a_pagar_amount numeric(18,2),
  projected_operational_flow_amount numeric(18,2),
  vendas_realizadas_basis text NOT NULL DEFAULT 'sem_base_financeira'
    CHECK (vendas_realizadas_basis IN ('sem_base_financeira', 'base_candidata')),
  entradas_financeiras_previstas_basis text NOT NULL DEFAULT 'sem_base_financeira'
    CHECK (entradas_financeiras_previstas_basis IN ('sem_base_financeira', 'base_candidata')),
  compromissos_a_pagar_basis text NOT NULL DEFAULT 'sem_base_financeira'
    CHECK (compromissos_a_pagar_basis IN ('sem_base_financeira', 'base_candidata')),
  overall_basis text NOT NULL DEFAULT 'sem_base_financeira'
    CHECK (overall_basis IN ('sem_base_financeira', 'base_candidata')),
  source_name text,
  source_cut_id text,
  rule_version text,
  permission text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_code, horizon_id, bucket_id),
  CHECK (projected_operational_flow_amount IS NULL OR (
    vendas_realizadas_amount IS NOT NULL
    AND entradas_financeiras_previstas_amount IS NOT NULL
    AND compromissos_a_pagar_amount IS NOT NULL
    AND projected_operational_flow_amount =
        vendas_realizadas_amount + entradas_financeiras_previstas_amount - compromissos_a_pagar_amount
  )),
  CHECK (
    (vendas_realizadas_basis = 'base_candidata') = (vendas_realizadas_amount IS NOT NULL)
  ),
  CHECK (
    (entradas_financeiras_previstas_basis = 'base_candidata') =
      (entradas_financeiras_previstas_amount IS NOT NULL)
  ),
  CHECK (
    (compromissos_a_pagar_basis = 'base_candidata') = (compromissos_a_pagar_amount IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_flow_projection_supplier_horizon
  ON operational_flow_projection_lines (supplier_code, horizon_date, bucket_id);

ALTER TABLE operational_flow_projection_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_flow_projection_lines FORCE ROW LEVEL SECURITY;

-- Comprador interno autorizado enxerga apenas a projeção do fornecedor cujo
-- código ele definiu via GUC app.supplier_code. Sem exposição a fornecedor.
DROP POLICY IF EXISTS operational_flow_projection_comprador_select
  ON operational_flow_projection_lines;
CREATE POLICY operational_flow_projection_comprador_select
  ON operational_flow_projection_lines
  FOR SELECT TO portal_comprador
  USING (supplier_code = NULLIF(current_setting('app.supplier_code', true), ''));

-- ETL candidato grava a projeção derivada dos caches. Nenhuma escrita ao ERP.
DROP POLICY IF EXISTS operational_flow_projection_etl_insert
  ON operational_flow_projection_lines;
CREATE POLICY operational_flow_projection_etl_insert
  ON operational_flow_projection_lines
  FOR INSERT TO portal_etl
  WITH CHECK (
    projected_operational_flow_amount IS NULL OR (
      vendas_realizadas_amount IS NOT NULL
      AND entradas_financeiras_previstas_amount IS NOT NULL
      AND compromissos_a_pagar_amount IS NOT NULL
      AND projected_operational_flow_amount =
          vendas_realizadas_amount + entradas_financeiras_previstas_amount - compromissos_a_pagar_amount
    )
  );

GRANT SELECT ON operational_flow_projection_lines TO portal_comprador;
GRANT INSERT ON operational_flow_projection_lines TO portal_etl;
-- Deliberadamente SEM GRANT para portal_app: fornecedor/AppCom não acessam.

-- Reversão manual (não executar automaticamente):
-- DROP POLICY IF EXISTS operational_flow_projection_comprador_select
--   ON operational_flow_projection_lines;
-- DROP POLICY IF EXISTS operational_flow_projection_etl_insert
--   ON operational_flow_projection_lines;
-- DROP TABLE IF EXISTS operational_flow_projection_lines;
