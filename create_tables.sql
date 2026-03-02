-- Professional Database Schema for NutriTech
-- Run this in Supabase SQL Editor

-- 1. Create the 'experiment' schema
CREATE SCHEMA IF NOT EXISTS experiment;

-- 2. Create experiments table
CREATE TABLE IF NOT EXISTS experiment.experiments (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create tubs table
CREATE TABLE IF NOT EXISTS experiment.tubs (
    id SERIAL PRIMARY KEY,
    label TEXT,
    experiment_id INTEGER REFERENCES experiment.experiments(id) ON DELETE CASCADE,
    soil_type TEXT DEFAULT 'Standard',
    plant_name TEXT,
    growth_rate TEXT DEFAULT 'Stable',
    status TEXT DEFAULT 'Ready',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create computed_scores table
CREATE TABLE IF NOT EXISTS experiment.computed_scores (
    id SERIAL PRIMARY KEY,
    tub_id INTEGER REFERENCES experiment.tubs(id) ON DELETE CASCADE,
    experiment_id INTEGER REFERENCES experiment.experiments(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    health_t FLOAT8 DEFAULT 0.8,
    stress_t FLOAT8 DEFAULT 0.1,
    risk_t FLOAT8 DEFAULT 0.05,
    pred_health_t FLOAT8,
    pred_stress_t FLOAT8,
    pred_risk_t FLOAT8,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE experiment.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment.tubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment.computed_scores ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development
CREATE POLICY "Allow all on experiments" ON experiment.experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tubs" ON experiment.tubs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on computed_scores" ON experiment.computed_scores FOR ALL USING (true) WITH CHECK (true);
