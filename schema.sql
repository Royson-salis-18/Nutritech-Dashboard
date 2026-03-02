-- ============================================================
--  SUPABASE SQL SCHEMA
--  Run these in Supabase SQL Editor
-- ============================================================

-- ── RAW DATA TABLE (your sensors write here) ─────────────────
CREATE TABLE IF NOT EXISTS raw_data (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Soil physical
    dry_mass_g      FLOAT,
    volume_cm3      FLOAT,
    moisture_t      FLOAT,
    prev_moisture_t FLOAT,
    fc              FLOAT DEFAULT 0.48,
    wp              FLOAT DEFAULT 0.20,
    bd_opt          FLOAT DEFAULT 1.3,

    -- Chemistry
    ph              FLOAT,
    ec_t            FLOAT,

    -- Nutrients (sensor readings)
    n_sensor        FLOAT,
    p_sensor        FLOAT,
    k_sensor        FLOAT,

    -- Climate
    temp_air        FLOAT,
    temp_opt        FLOAT DEFAULT 25.0,
    vpd             FLOAT,
    light           FLOAT,

    -- Irrigation & drainage
    irrigation_t    FLOAT DEFAULT 0,

    -- Moisture targets
    theta_opt       FLOAT DEFAULT 0.35,

    -- Stress inputs
    heat_t          FLOAT DEFAULT 0,

    -- Growth time steps
    time_t          FLOAT DEFAULT 0,
    time_0          FLOAT DEFAULT 0,

    -- Previous state (for delta calculations)
    prev_health     FLOAT DEFAULT 0.8,
    h_mineral       FLOAT DEFAULT 1.0
);

-- ── PROCESSED DATA TABLE (pipeline writes here) ──────────────
CREATE TABLE IF NOT EXISTS processed_data (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    raw_data_id     BIGINT REFERENCES raw_data(id),
    timestamp       TIMESTAMPTZ,

    -- Soil
    bulk_density    FLOAT,
    theta_t         FLOAT,
    moisture_next   FLOAT,
    drainage_t      FLOAT,
    et_t            FLOAT,

    -- Nutrients
    n_eff           FLOAT,
    p_eff           FLOAT,
    k_eff           FLOAT,
    cv_t            FLOAT,
    r_npk           FLOAT,
    eta_ph          FLOAT,

    -- Quality
    q_moisture      FLOAT,
    q_climate       FLOAT,
    q_nutrient      FLOAT,

    -- Health & Risk
    health_index    FLOAT,
    stress_index    FLOAT,
    vpd_stress      FLOAT,
    risk_index      FLOAT,

    -- Growth
    growth_t        FLOAT
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processed_raw_id ON processed_data(raw_data_id);
CREATE INDEX IF NOT EXISTS idx_processed_created ON processed_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_created ON raw_data(created_at DESC);
