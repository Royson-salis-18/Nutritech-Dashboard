# NutriTech Intelligence Platform

Precision plant health monitoring with real-time sensor fusion, physics-based scoring, and ML-powered predictive analytics.

## Structure

- `backend/`: Flask API serving the dashboard and handling data aggregation.
- `frontend/nutritech-dashboard/`: React + Vite dashboard application.
- `landing/`: Static HTML landing page.
- `main.py`: FastAPI webhook receiver for data ingestion and pipeline triggering.
- `calculations.py`: Physics-based formula engine for health/stress/risk scoring.

## Setup

### Backend (Flask)
1. `cd backend`
2. `python -m venv venv`
3. `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. `pip install -r requirements.txt`
5. Create a `.env` file with `SUPABASE_URL` and `SUPABASE_KEY`.
6. `python app.py`

### Frontend (React)
1. `cd frontend/nutritech-dashboard`
2. `npm install`
3. `npm run build` (Builds to `dist/`, served by the backend at `/dashboard`)

## Deployment
The project includes a `Procfile` for deployment to platforms like Railway or Heroku.
- Web: `python backend/app.py`
- Pipeline: `uvicorn main:app --host 0.0.0.0 --port $PORT`
