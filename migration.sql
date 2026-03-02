-- ============================================================
--  SUPABASE SCHEMA MIGRATION
--  Run in Supabase SQL Editor (safe to run multiple times)
--  Adds ML prediction columns to experiment.computed_scores
-- ============================================================

-- 1. Add ML prediction columns to computed_scores
ALTER TABLE experiment.computed_scores
  ADD COLUMN IF NOT EXISTS pred_health_t  float8,
  ADD COLUMN IF NOT EXISTS pred_stress_t  float8,
  ADD COLUMN IF NOT EXISTS pred_risk_t    float8;

-- 2. Add experiment_id column if missing (needed for pipeline joins)
ALTER TABLE public.processed_readings
  ADD COLUMN IF NOT EXISTS experiment_id  int8;

-- 3. Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_cs_exp_tub_ts
  ON experiment.computed_scores (experiment_id, tub_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pr_exp_tub_ts
  ON public.processed_readings (experiment_id, tub_id, timestamp DESC);

-- 4. Ensure sensor_data_id unique constraint for upsert
ALTER TABLE public.processed_readings
  DROP CONSTRAINT IF EXISTS processed_readings_sensor_data_id_key;

ALTER TABLE public.processed_readings
  ADD CONSTRAINT processed_readings_sensor_data_id_key UNIQUE (sensor_data_id);
