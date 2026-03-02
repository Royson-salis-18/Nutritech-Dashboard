"""
routes/dashboard.py
Dashboard aggregation API — merges physical + predicted scores per tub.

GET /api/dashboard/summary?experiment_id=X
GET /api/dashboard/tub/<tub_id>/timeseries?experiment_id=X&limit=100
GET /api/dashboard/cleaning-report
"""

from flask import Blueprint, jsonify, request
from services.supabase_service import supabase
import logging

dashboard_bp = Blueprint("dashboard", __name__)
logger = logging.getLogger(__name__)


@dashboard_bp.route("/summary", methods=["GET"])
def dashboard_summary():
    """
    Returns per-tub latest computed scores (physical + predicted) for an experiment.
    """
    experiment_id = request.args.get("experiment_id", type=int)
    if not experiment_id:
        return jsonify({"status": "error", "message": "experiment_id query param required"}), 400

    try:
        # Get tubs for this experiment
        mapping_res = (
            supabase
            .schema("experiment")
            .table("mapping")
            .select("tub_id")
            .eq("experiment_id", experiment_id)
            .execute()
        )
        tub_ids = [r["tub_id"] for r in (mapping_res.data or [])]

        if not tub_ids:
            return jsonify({"status": "ok", "data": [], "experiment_id": experiment_id})

        # Get tub details
        tubs_res = (
            supabase
            .schema("experiment")
            .table("tubs")
            .select("id, label, plant_name, soil_type, growth_rate")
            .in_("id", tub_ids)
            .execute()
        )
        tubs_by_id = {t["id"]: t for t in (tubs_res.data or [])}

        # Get latest computed score per tub
        scores_res = (
            supabase
            .schema("experiment")
            .table("computed_scores")
            .select("*")
            .eq("experiment_id", experiment_id)
            .in_("tub_id", tub_ids)
            .order("timestamp", desc=True)
            .execute()
        )

        # Deduplicate — keep only latest per tub_id
        seen = set()
        latest_scores = []
        for row in (scores_res.data or []):
            tid = row["tub_id"]
            if tid not in seen:
                seen.add(tid)
                latest_scores.append(row)

        # Get latest processed_reading features per tub
        proc_res = (
            supabase
            .schema("public")
            .table("processed_readings")
            .select("tub_id, q_moisture, q_climate, q_nutrient, vpd_stress, timestamp")
            .eq("experiment_id", experiment_id)
            .in_("tub_id", tub_ids)
            .order("timestamp", desc=True)
            .execute()
        )
        seen_proc = set()
        latest_proc = {}
        for row in (proc_res.data or []):
            tid = row["tub_id"]
            if tid not in seen_proc:
                seen_proc.add(tid)
                latest_proc[tid] = row

        # Assemble response
        summary = []
        for score in latest_scores:
            tid = score["tub_id"]
            tub = tubs_by_id.get(tid, {})
            proc = latest_proc.get(tid, {})
            summary.append({
                "tub_id":        tid,
                "tub_label":     tub.get("label"),
                "plant_name":    tub.get("plant_name"),
                "soil_type":     tub.get("soil_type"),
                "growth_rate":   tub.get("growth_rate"),
                "timestamp":     score.get("timestamp"),
                # Physical scores
                "health_t":      score.get("health_t"),
                "stress_t":      score.get("stress_t"),
                "risk_t":        score.get("risk_t"),
                # ML predictions
                "pred_health_t": score.get("pred_health_t"),
                "pred_stress_t": score.get("pred_stress_t"),
                "pred_risk_t":   score.get("pred_risk_t"),
                # Quality indices
                "q_moisture":    proc.get("q_moisture"),
                "q_climate":     proc.get("q_climate"),
                "q_nutrient":    proc.get("q_nutrient"),
                "vpd_stress":    proc.get("vpd_stress"),
            })

        return jsonify({"status": "success", "experiment_id": experiment_id, "data": summary})

    except Exception as e:
        logger.exception("dashboard summary error")
        return jsonify({"status": "error", "message": str(e)}), 500


@dashboard_bp.route("/tub/<int:tub_id>/timeseries", methods=["GET"])
def tub_timeseries(tub_id: int):
    """
    Returns time-ordered health/stress/risk/growth scores for a single tub.
    """
    experiment_id = request.args.get("experiment_id", type=int)
    limit = request.args.get("limit", default=200, type=int)

    try:
        query = (
            supabase
            .schema("experiment")
            .table("computed_scores")
            .select("timestamp, health_t, stress_t, risk_t, pred_health_t, pred_stress_t, pred_risk_t")
            .eq("tub_id", tub_id)
            .order("timestamp", desc=False)
            .limit(limit)
        )
        if experiment_id:
            query = query.eq("experiment_id", experiment_id)

        scores_res = query.execute()

        # Also fetch quality indices
        proc_query = (
            supabase
            .schema("public")
            .table("processed_readings")
            .select("timestamp, q_moisture, q_climate, q_nutrient, vpd_stress")
            .eq("tub_id", tub_id)
            .order("timestamp", desc=False)
            .limit(limit)
        )
        if experiment_id:
            proc_query = proc_query.eq("experiment_id", experiment_id)

        proc_res = proc_query.execute()

        return jsonify({
            "status":      "success",
            "tub_id":      tub_id,
            "scores":      scores_res.data or [],
            "quality":     proc_res.data or [],
        })

    except Exception as e:
        logger.exception("timeseries error")
        return jsonify({"status": "error", "message": str(e)}), 500


@dashboard_bp.route("/cleaning-report", methods=["GET"])
def cleaning_report():
    """Returns the last cleaning run report stored in pipeline route memory."""
    try:
        from routes.pipeline import _last_run
        report = _last_run.get("cleaning_report", {})
        ran_at = _last_run.get("ran_at")
        return jsonify({"status": "success", "ran_at": ran_at, "report": report})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
