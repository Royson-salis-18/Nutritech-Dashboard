-- Create experiments and tubs tables in public schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS experiments (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    num_buckets INTEGER DEFAULT 1,
    crop_type TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tubs (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES experiments(id) ON DELETE CASCADE,
    bucket_number INTEGER,
    soil_type TEXT DEFAULT 'Standard',
    plant_type TEXT,
    status TEXT DEFAULT 'Ready',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (optional, but good practice for Supabase)
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tubs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (since we use service key or anon key)
CREATE POLICY "Allow all on experiments" ON experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tubs" ON tubs FOR ALL USING (true) WITH CHECK (true);
