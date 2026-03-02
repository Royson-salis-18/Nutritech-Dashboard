"""
pipeline/process.py
Runs physics-based calculations on cleaned sensor rows and writes
results to Supabase: processed_readings + computed_scores tables.
"""

import sys
import os
import logging
from datetime import datetime, timezone

# Allow importing root-level calculations.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from calculations import process_raw_data

from services.supabase_service import supabase

logger = logging.getLogger(__name__)


def _build_calc_input(row: dict) -> dict:
    """Map cleaned enriched row → calculations.py expected keys."""

    def _f(key, default=0.0):
        v = row.get(key)
        try:
            return float(v) if v is not None else default
        except (TypeError, ValueError):
            return default

    return {
        # Soil
        "moisture_t":     _f("moisture_t"),
        "fc":             _f("fc", 0.48),
        "wp":             _f("wp", 0.20),
        "theta_opt":      _f("theta_opt", 0.35),
        "dry_mass_g":     _f("dry_mass_g"),
        "volume_cm3":     _f("volume_cm3", 1.0),
        "bd_opt":         _f("bulk_density_gcm3", 1.3),
        "irrigation_t":   _f("irrigation_t"),
        # Nutrients
        "ph":             _f("ph", 6.5),
        "n_sensor":       _f("n_sensor"),
        "p_sensor":       _f("p_sensor"),
        "k_sensor":       _f("k_sensor"),
        # Climate
        "temp_air":       _f("temp_air"),
        "temp_opt":       _f("temp_opt", 25.0),
        "vpd":            _f("vpd"),
        "light":          _f("light"),
        # Stress
        "ec_t":           _f("ec_t"),
        "heat_t":         _f("heat_t"),
        # Growth
        "time_t":         0.0,
        "time_0":         0.0,
        # State carry-over defaults
        "prev_moisture_t": _f("moisture_t"),
        "prev_health":     0.8,
        "h_mineral":       1.0,
    }


def run_physical_calculations(cleaned_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Compute physics scores for all cleaned rows.
    Returns (processed_readings_batch, computed_scores_batch).
    """
    proc_batch = []
    scores_batch = []

    for row in cleaned_rows:
        calc_input = _build_calc_input(row)
        try:
            result = process_raw_data(calc_input)
        except Exception as e:
            logger.warning(f"Calc failed for row id={row.get('id')}: {e}")
            continue

        now_ts = datetime.now(timezone.utc).isoformat()

        proc_batch.append({
            "tub_id":          row["tub_id"],
            "experiment_id":   row.get("experiment_id"),
            "sensor_data_id":  row.get("id"),
            "weather_data_id": row.get("weather_data_id"),
            "timestamp":       row.get("created_at", now_ts),
            "q_moisture":      result["q_moisture"],
            "q_climate":       result["q_climate"],
            "q_nutrient":      result["q_nutrient"],
            "vpd_stress":      result["vpd_stress"],
            "created_at":      now_ts,
        })

        scores_batch.append({
            "tub_id":          row["tub_id"],
            "experiment_id":   row.get("experiment_id"),
            "timestamp":       row.get("created_at", now_ts),
            # Physical scores
            "health_t":        result["health_index"],
            "stress_t":        result["stress_index"],
            "risk_t":          result["risk_index"],
            # Extra computed fields stored for ML feature use
            "_growth_t":       result["growth_t"],
            "_eta_ph":         result["eta_ph"],
            "_cv_t":           result["cv_t"],
            "_r_npk":          result["r_npk"],
            # ML columns filled later by ml_predict.py (null for now)
            "pred_health_t":   None,
            "pred_stress_t":   None,
            "pred_risk_t":     None,
            "created_at":      now_ts,
        })

    return proc_batch, scores_batch


def upsert_to_supabase(proc_batch: list[dict], scores_batch: list[dict]) -> dict:
    """
    Bulk-upsert processed_readings and computed_scores to Supabase.
    Returns summary dict.
    """
    inserted_proc = 0
    inserted_scores = 0

    if proc_batch:
        # Strip internal _ fields before upserting
        clean_proc = [{k: v for k, v in r.items() if not k.startswith("_")} for r in proc_batch]
        res = (
            supabase
            .schema("public")
            .table("processed_readings")
            .upsert(clean_proc, on_conflict="sensor_data_id")
            .execute()
        )
        inserted_proc = len(res.data or [])
        logger.info(f"Upserted {inserted_proc} rows into processed_readings")

    if scores_batch:
        # Remove internal _ fields
        clean_scores = [{k: v for k, v in r.items() if not k.startswith("_")} for r in scores_batch]
        try:
            # Prefer a deterministic conflict target if the DB has a unique constraint on these columns.
            res = (
                supabase
                .schema("experiment")
                .table("computed_scores")
                .upsert(clean_scores, on_conflict="experiment_id,tub_id,timestamp")
                .execute()
            )
            inserted_scores = len(res.data or [])
            logger.info(f"Upserted {inserted_scores} rows into computed_scores (on_conflict experiment_id,tub_id,timestamp)")
        except Exception as e:
            # Fallback: insert/upsert without explicit conflict target (works if PK/unique is present, otherwise inserts duplicates)
            logger.warning(f"computed_scores upsert with on_conflict failed; falling back. Error: {e}")
            res = (
                supabase
                .schema("experiment")
                .table("computed_scores")
                .upsert(clean_scores)
                .execute()
            )
            inserted_scores = len(res.data or [])
            logger.info(f"Wrote {inserted_scores} rows into computed_scores (fallback)")

    # Return the scores (with internal fields) for ML to use
    return {
        "processed_readings_inserted": inserted_proc,
        "computed_scores_inserted": inserted_scores,
    }
