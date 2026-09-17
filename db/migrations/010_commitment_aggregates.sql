-- Fase 3 candidata — agregado de compromissos a pagar por fornecedor/horizonte.
-- Migração SOMENTE aditiva e reversível: apenas DDL, sem INSERT de dados.
-- Origem exclusiva: cache documentado contas_receber (populada assincronamente
-- de RMS.AA1RTITU) com fornecedorCodigo, vencimento, valor e status
-- Programado/Aberto.
--
-- O agregado NÃO expõe reserva, saldo ou custo de capital (SEM BASE FINANCEIRA
-- para esses conceitos). Nenhuma exposição é criada para fornecedor/AppCom:
-- a role portal_app NÃO recebe GRANT nesta tabela.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_comprador') THEN
    CREATE ROLE portal_comprador NOINHERIT LOGIN;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS commitment_aggregates (
  aggregate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL REFERENCES suppliers(code),
  horizon_id text NOT NULL,
  horizon_date date NOT NULL,
  bucket_id text NOT NULL,
  due_from date NOT NULL,
  due_to date NOT NULL,
  status_programado_amount numeric(18,2) NOT NULL DEFAULT 0,
  status_aberto_amount numeric(18,2) NOT NULL DEFAULT 0,
  total_amount numeric(18,2) NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  source_name text,
  source_cut_id text,
  rule_version text,
  permission text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_code, horizon_id, bucket_id),
  CHECK (status_programado_amount >= 0),
  CHECK (status_aberto_amount >= 0),
  CHECK (total_amount = status_programado_amount + status_aberto_amount),
  CHECK (row_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_commitment_aggregates_supplier_horizon
  ON commitment_aggregates (supplier_code, horizon_date, bucket_id);

ALTER TABLE commitment_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_aggregates FORCE ROW LEVEL SECURITY;

-- Comprador interno autorizado enxerga apenas o agregado do fornecedor cujo
-- código ele definiu via GUC app.supplier_code. Sem exposição a fornecedor.
DROP POLICY IF EXISTS commitment_aggregates_comprador_select ON commitment_aggregates;
CREATE POLICY commitment_aggregates_comprador_select ON commitment_aggregates
  FOR SELECT TO portal_comprador
  USING (supplier_code = NULLIF(current_setting('app.supplier_code', true), ''));

-- ETL candidato grava o agregado derivado do cache. Nenhuma escrita ao ERP.
DROP POLICY IF EXISTS commitment_aggregates_etl_insert ON commitment_aggregates;
CREATE POLICY commitment_aggregates_etl_insert ON commitment_aggregates
  FOR INSERT TO portal_etl
  WITH CHECK (total_amount = status_programado_amount + status_aberto_amount);

GRANT SELECT ON commitment_aggregates TO portal_comprador;
GRANT INSERT ON commitment_aggregates TO portal_etl;
-- Deliberadamente SEM GRANT para portal_app: fornecedor/AppCom não acessam.

-- Reversão manual (não executar automaticamente):
-- DROP POLICY IF EXISTS commitment_aggregates_comprador_select ON commitment_aggregates;
-- DROP POLICY IF EXISTS commitment_aggregates_etl_insert ON commitment_aggregates;
-- DROP TABLE IF EXISTS commitment_aggregates;
-- DROP ROLE portal_comprador;  -- somente se nenhum outro objeto usar a role
