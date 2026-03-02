# Crop Monitoring Pipeline — Setup Guide

## What this does
When a new row is inserted into your Supabase `raw_data` table, it automatically:
1. Triggers a webhook to your Railway app
2. Runs all your formulas (bulk density, moisture, nutrients, health, stress, risk, growth)
3. Writes the processed results into your `processed_data` table

---

## Step 1 — Set up Supabase tables

1. Go to **Supabase → SQL Editor**
2. Paste and run the contents of `schema.sql`
3. You'll have two tables: `raw_data` and `processed_data`

---

## Step 2 — Deploy to Railway

1. Create a GitHub repo and push all these files into it
2. Go to [railway.app](https://railway.app) and click **New Project → Deploy from GitHub**
3. Select your repo
4. Railway will auto-detect the `Procfile` and deploy

### Set environment variables in Railway:
Go to your service → **Variables** tab and add:
```
SUPABASE_URL         = https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY = your-service-role-key   (Settings → API → service_role)
WEBHOOK_SECRET       = any-random-string-you-choose
```

5. After deploy, copy your Railway app URL, e.g. `https://crop-pipeline.up.railway.app`

---

## Step 3 — Set up Supabase Database Webhook

1. Go to **Supabase → Database → Webhooks**
2. Click **Create a new hook**
3. Fill in:
   - **Name**: `raw_data_trigger`
   - **Table**: `raw_data`
   - **Events**: ✅ `INSERT`
   - **Type**: HTTP Request
   - **URL**: `https://your-railway-url.up.railway.app/webhook/raw-data`
   - **HTTP Headers**: Add `x-webhook-secret` = your WEBHOOK_SECRET value
4. Click **Confirm**

---

## Step 4 — Test it

Insert a test row in Supabase SQL Editor:
```sql
INSERT INTO raw_data (
    dry_mass_g, volume_cm3, moisture_t, fc, wp,
    ph, n_sensor, p_sensor, k_sensor,
    temp_air, temp_opt, vpd, light, time_t
) VALUES (
    150, 100, 0.35, 0.48, 0.20,
    6.5, 50, 30, 40,
    28, 25, 1.5, 800, 10
);
```

Then check:
```sql
SELECT * FROM processed_data ORDER BY created_at DESC LIMIT 1;
```

You should see a fully calculated row appear within seconds. ✅

---

## Formula Reference (from your notes)

| Formula | Description |
|---------|-------------|
| BD = Dry Mass / Volume | Bulk Density |
| θ_t = (M_t - WP) / (FC - WP) | Water Storage Window |
| η(pH) = exp(-(pH-6.5)² / 2σ²) | pH Nutrient Efficiency |
| N_eff = [N,P,K] · η(pH) · θ_t | Effective Nutrients |
| CV_t = σ/μ of (N_eff, P_eff, K_eff) | Nutrient Imbalance |
| Q_moist = exp(-α(θ-θ_opt)²) | Moisture Quality |
| Q_climate = exp(-γ(T-T_opt)²) | Climate Quality |
| H_t = w1·Q_moist + w2·Q_nutr + w3·Q_clim + w4·H_min | Health Index |
| VPD stress piecewise function | VPD Stress |
| δ_t = λ1\|Δθ\| + λ2·Heat + λ3·EC + λ4·CV + λ5(1-η) + λ6·S_VPD | Stress Index |
| R_t = σ(a1·δ + a2(1-H) + a3·dH/dt) | Risk Index |
| ET = α1·light + α2·VPD | Evapotranspiration |
| M_{t+1} = M_t + I_t - ET_t - Drain_t | Moisture Update |
| G_t = 1/(1+e^(-n(t-t0))) · H_t | Growth |

---

## Tuning weights
All weights (W1-W4, λ1-λ6, α1-α3) are at the top of `calculations.py`.
Change them and redeploy — Railway redeploys automatically on git push.

---

## Files in this project
```
main.py           — FastAPI webhook receiver
calculations.py   — All formula implementations
requirements.txt  — Python dependencies
Procfile          — Railway start command
schema.sql        — Supabase table definitions
.env.example      — Environment variable template
```
