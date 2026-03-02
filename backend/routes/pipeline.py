"""
routes/pipeline.py
Flask blueprint exposing the data pipeline endpoints.

POST /api/pipeline/run   — fetch → clean → process → predict → upsert
GET  /api/pipeline/status — last run info stored in memory
"""

from flask import Blueprint, jsonify, request
import logging
from datetime import datetime, timezone

pipeline_bp = Blueprint("pipeline", __name__)
logger = logging.getLogger(__name__)

# In-memory store of last run results (no DB table needed for now)
_last_run: dict = {}


@pipeline_bp.route("/run", methods=["POST"])
def run_pipeline():
    """
    Trigger the full data pipeline for a given experiment_id.
    Body: { "experiment_id": <int>, "retrain": <bool optional> }
    """
    body = request.get_json(silent=True) or {}
    experiment_id = body.get("experiment_id")
    retrain = body.get("retrain", False)

    if not experiment_id:
        return jsonify({"status": "error", "message": "experiment_id is required"}), 400

    try:
        from pipeline.fetch import fetch_unprocessed_sensor_data
        from pipeline.clean import clean_batch
        from pipeline.process import run_physical_calculations, upsert_to_supabase
        from pipeline.ml_predict import train_or_load_models, predict, upsert_predictions
        import os, joblib

        # ── Step 1: Fetch ──────────────────────────────────────────────────────
        raw_rows = fetch_unprocessed_sensor_data(experiment_id)

        if not raw_rows:
            result = {
                "status": "ok",
                "message": "No new data to process",
                "experiment_id": experiment_id,
                "rows_fetched": 0,
            }
            _last_run.update({**result, "ran_at": datetime.now(timezone.utc).isoformat()})
            return jsonify(result)

        # ── Step 2: Clean ──────────────────────────────────────────────────────
        cleaned, cleaning_report = clean_batch(raw_rows)

        if not cleaned:
            return jsonify({
                "status": "ok",
                "message": "All rows were dropped during cleaning",
                "cleaning_report": cleaning_report,
            })

        # ── Step 3: Physical calculations ──────────────────────────────────────
        proc_batch, scores_batch = run_physical_calculations(cleaned)
        upsert_summary = upsert_to_supabase(proc_batch, scores_batch)

        # ── Step 4: ML predictions ─────────────────────────────────────────────
        # Delete cached models if retrain requested
        if retrain:
            from pipeline.ml_predict import MODELS_DIR, TARGETS
            for t in TARGETS:
                p = os.path.join(MODELS_DIR, f"{t}_exp{experiment_id}.pkl")
                if os.path.exists(p):
                    os.remove(p)

        models = train_or_load_models(experiment_id)
        scores_batch = predict(models, proc_batch, scores_batch)
        pred_count = upsert_predictions(scores_batch, experiment_id)

        result = {
            "status": "success",
            "experiment_id": experiment_id,
            "rows_fetched": len(raw_rows),
            "rows_after_cleaning": len(cleaned),
            "processed_readings_inserted": upsert_summary["processed_readings_inserted"],
            "computed_scores_inserted": upsert_summary["computed_scores_inserted"],
            "predictions_written": pred_count,
            "cleaning_report": cleaning_report,
            "ran_at": datetime.now(timezone.utc).isoformat(),
        }
        _last_run.update(result)
        return jsonify(result)

    except Exception as e:
        logger.exception("Pipeline run failed")
        return jsonify({"status": "error", "message": str(e)}), 500


@pipeline_bp.route("/status", methods=["GET"])
def pipeline_status():
    """Returns info from the last pipeline run."""
    if not _last_run:
        return jsonify({"status": "never_run", "message": "Pipeline has not been run yet"})
    return jsonify(_last_run)
