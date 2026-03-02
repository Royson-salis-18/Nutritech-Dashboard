## NutriTech Platform Build — Implementation Plan (Phase 1)

This plan matches your current repo structure and Supabase schema screenshots:

- **Landing page** served by Flask at `/` (static HTML in `landing/`)
- **Dashboard** is a React/Vite app built to `frontend/nutritech-dashboard/dist` and served by Flask at `/dashboard`
- **Control panel** is external (ngrok)
- **Experiment entry** will live at `/entry` later (placeholder page for now)
- **Supabase** is the system of record for raw sensor + weather data, plus processed + computed + predicted scores

---

### Current state (what already exists)

- **Backend**
  - `backend/app.py` serves:
    - `/` → `landing/index.html`
    - `/dashboard/*` → React build output in `frontend/nutritech-dashboard/dist`
    - `/api/*` blueprints for tubs/experiments/pipeline/dashboard
  - Pipeline modules already exist:
    - `backend/pipeline/fetch.py` (Supabase pull)
    - `backend/pipeline/clean.py` (validation + fill + outlier flags)
    - `backend/pipeline/process.py` (physics scores via `calculations.py`)
    - `backend/pipeline/ml_predict.py` (XGBoost/Sklearn predictions)
- **Frontend**
  - Dashboard UI already exists and calls:
    - `GET /api/experiments/`
    - `GET /api/dashboard/summary?experiment_id=...`
    - `GET /api/dashboard/tub/<id>/timeseries?experiment_id=...`
    - `POST /api/pipeline/run`
- **Supabase**
  - Your screenshots show the key tables:
    - `public.sensor_data`
    - `experiment.weather_data`
    - `experiment.tub_config`
    - `experiment.mapping` (experiment ↔ tubs)
    - `experiment.computed_scores`
    - `public.processed_readings`

---

### What we will implement (in order)

#### Phase 2 — Landing Page

- Keep `landing/index.html` as the premium dark/glass landing.
- Ensure the 3 navigation buttons behave:
  - **Dashboard** → `/dashboard`
  - **Control Panel** → external ngrok link
  - **Experiment Entry** → `/entry` (placeholder page until real UI is added)
- Wire `/entry` to a placeholder HTML page (until you provide the experiment entry UI).

#### Phase 3 — Backend Data Pipeline

Endpoint:
- `POST /api/pipeline/run` with body `{ "experiment_id": <int>, "retrain": <bool> }`

Pipeline steps:
- **Fetch**: get tubs for experiment, pull unprocessed rows from `public.sensor_data`, enrich with latest `experiment.weather_data` + `experiment.tub_config`.
- **Clean**: clip to plausible ranges, fill nulls by median, flag outliers.
- **Process (physical/physics)**:
  - Map enriched rows into `calculations.py`’s `process_raw_data()`
  - Write:
    - `public.processed_readings` (quality indices/features)
    - `experiment.computed_scores` (health/stress/risk + predicted columns updated later)
- **ML predict**:
  - Train/load per-experiment models for `health_t`, `stress_t`, `risk_t`
  - Predict `pred_health_t`, `pred_stress_t`, `pred_risk_t`
  - Write predictions back into `experiment.computed_scores`

Important DB note (so upserts don’t duplicate):
- Ideally `experiment.computed_scores` should have a **unique constraint** on `(experiment_id, tub_id, timestamp)`.
  - If you don’t have that yet, we can add it in Supabase once you confirm there are no duplicates.

#### Phase 4 — Dashboard Enhancement

Backend routes already exist:
- `GET /api/dashboard/summary`
- `GET /api/dashboard/tub/<id>/timeseries`

Frontend already displays:
- Physical computed scores
- Predicted scores
- Side-by-side comparison charts
- Pipeline trigger panel

If you later add **growth** prediction or additional computed fields, we’ll extend:
- `computed_scores` columns
- dashboard API payload
- charts/tables in the dashboard UI

#### Phase 5 — Verification (local)

- Backend:
  - `python backend/app.py`
  - confirm:
    - `/` loads landing
    - `/entry` loads placeholder
    - `/api/pipeline/status` responds
- Frontend:
  - `npm run build` in `frontend/nutritech-dashboard`
  - confirm `/dashboard` loads built assets via Flask
- Pipeline:
  - Trigger from Dashboard “Pipeline” tab
  - Validate Supabase writes to `processed_readings` + `computed_scores`

---

### Environment variables you need

Backend expects:
- `SUPABASE_URL`
- `SUPABASE_KEY` (service role preferred for writes)

