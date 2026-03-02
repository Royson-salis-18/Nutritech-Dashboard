"""
pipeline/ml_predict.py
Trains XGBoost regressors for health, stress, and risk prediction.
Features are derived from processed_readings + computed_scores.
Models are saved to backend/models/ as .pkl files and reloaded on subsequent runs.
"""

import os
import logging
import math
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

TARGETS = ["health_t", "stress_t", "risk_t"]
FEATURE_COLS = [
    "q_moisture", "q_climate", "q_nutrient", "vpd_stress",
    "hour_sin", "hour_cos", "day_sin", "day_cos",
]


def _timestamp_features(ts_str: str) -> dict:
    """Extract cyclical time features from an ISO timestamp string."""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        hour = dt.hour
        day = dt.weekday()
    except Exception:
        hour, day = 0, 0
    return {
        "hour_sin": math.sin(2 * math.pi * hour / 24),
        "hour_cos": math.cos(2 * math.pi * hour / 24),
        "day_sin":  math.sin(2 * math.pi * day / 7),
        "day_cos":  math.cos(2 * math.pi * day / 7),
    }


def _load_training_data(experiment_id: int):
    """Pull computed_scores joined with processed_readings from Supabase."""
    try:
        import pandas as pd
        from services.supabase_service import supabase

        scores_res = (
            supabase
            .schema("experiment")
            .table("computed_scores")
            .select("*")
            .eq("experiment_id", experiment_id)
            .not_.is_("health_t", "null")
            .execute()
        )

        proc_res = (
            supabase
            .schema("public")
            .table("processed_readings")
            .select("*")
            .eq("experiment_id", experiment_id)
            .execute()
        )

        scores_df = pd.DataFrame(scores_res.data or [])
        proc_df   = pd.DataFrame(proc_res.data  or [])

        if scores_df.empty or proc_df.empty:
            return None, None

        # Merge on tub_id + closest timestamp (simple: merge on experiment_id + tub_id)
        proc_df = proc_df.rename(columns={
            "q_moisture": "q_moisture",
            "q_climate":  "q_climate",
            "q_nutrient": "q_nutrient",
            "vpd_stress": "vpd_stress",
        })

        proc_sub = proc_df[["tub_id", "experiment_id", "q_moisture", "q_climate", "q_nutrient", "vpd_stress", "timestamp"]].copy()
        scores_sub = scores_df[["tub_id", "experiment_id", "health_t", "stress_t", "risk_t", "timestamp"]].copy()

        # Add time features from scores timestamp
        tfeats = scores_sub["timestamp"].apply(
            lambda t: _timestamp_features(str(t)) if pd.notna(t) else _timestamp_features("")
        )
        scores_sub = pd.concat([scores_sub, tfeats.apply(pd.Series)], axis=1)

        # Merge proc features into scores (nearest by tub + timestamp)
        merged = pd.merge_asof(
            scores_sub.sort_values("timestamp"),
            proc_sub.sort_values("timestamp"),
            on="timestamp",
            by=["tub_id", "experiment_id"],
            direction="nearest",
            suffixes=("", "_proc")
        )

        merged = merged.dropna(subset=FEATURE_COLS + TARGETS)

        if merged.empty:
            return None, None

        X = merged[FEATURE_COLS].values.astype(float)
        y = {t: merged[t].values.astype(float) for t in TARGETS}
        return X, y

    except Exception as e:
        logger.error(f"Error loading training data: {e}")
        return None, None


def train_or_load_models(experiment_id: int) -> dict:
    """
    Returns dict of {target: model}.
    Loads from disk if pkl files exist, otherwise trains from Supabase data.
    """
    import joblib

    try:
        from xgboost import XGBRegressor
    except ImportError:
        logger.warning("xgboost not installed; falling back to sklearn GradientBoosting")
        from sklearn.ensemble import GradientBoostingRegressor as XGBRegressor

    models = {}
    all_cached = True

    for target in TARGETS:
        model_path = os.path.join(MODELS_DIR, f"{target}_exp{experiment_id}.pkl")
        if os.path.exists(model_path):
            models[target] = joblib.load(model_path)
            logger.info(f"Loaded cached model for {target} from {model_path}")
        else:
            all_cached = False

    if all_cached:
        return models

    # Train from scratch
    logger.info(f"Training ML models for experiment {experiment_id} ...")
    X, y = _load_training_data(experiment_id)

    if X is None or len(X) < 10:
        logger.warning("Not enough training data (need ≥10 rows). Returning untrained models.")
        for target in TARGETS:
            try:
                from xgboost import XGBRegressor
                models[target] = XGBRegressor(n_estimators=50, max_depth=4, learning_rate=0.1)
            except ImportError:
                from sklearn.ensemble import GradientBoostingRegressor
                models[target] = GradientBoostingRegressor(n_estimators=50, max_depth=4)
        return models

    import joblib
    for target in TARGETS:
        try:
            from xgboost import XGBRegressor
            model = XGBRegressor(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                verbosity=0,
            )
        except ImportError:
            from sklearn.ensemble import GradientBoostingRegressor
            model = GradientBoostingRegressor(n_estimators=200, max_depth=5, learning_rate=0.05, random_state=42)

        model.fit(X, y[target])
        model_path = os.path.join(MODELS_DIR, f"{target}_exp{experiment_id}.pkl")
        joblib.dump(model, model_path)
        logger.info(f"Trained + saved model for {target} → {model_path}")
        models[target] = model

    return models


def predict(models: dict, proc_batch: list[dict], scores_batch: list[dict]) -> list[dict]:
    """
    Run predictions on the freshly computed scores, enrich with pred_* columns.
    Returns enriched scores_batch (same list, modified in place).
    """
    import numpy as np

    if not models:
        logger.warning("No models available; skipping predictions.")
        return scores_batch

    # Build feature rows for the new data
    rows_with_features = []
    for proc, score in zip(proc_batch, scores_batch):
        ts_str = str(score.get("timestamp", ""))
        tfeats = _timestamp_features(ts_str)
        feature_row = [
            proc.get("q_moisture", 0.0) or 0.0,
            proc.get("q_climate",  0.0) or 0.0,
            proc.get("q_nutrient", 0.0) or 0.0,
            proc.get("vpd_stress", 0.0) or 0.0,
            tfeats["hour_sin"],
            tfeats["hour_cos"],
            tfeats["day_sin"],
            tfeats["day_cos"],
        ]
        rows_with_features.append(feature_row)

    if not rows_with_features:
        return scores_batch

    X = np.array(rows_with_features, dtype=float)

    for target in TARGETS:
        model = models.get(target)
        if model is None:
            continue
        try:
            preds = model.predict(X)
            pred_col = f"pred_{target}"
            for i, score in enumerate(scores_batch):
                score[pred_col] = round(float(preds[i]), 4)
        except Exception as e:
            logger.warning(f"Prediction failed for {target}: {e}")

    return scores_batch


def upsert_predictions(scores_batch: list[dict], experiment_id: int) -> int:
    """
    Write pred_health_t, pred_stress_t, pred_risk_t back to computed_scores.
    Returns number of rows updated.
    """
    from services.supabase_service import supabase

    if not scores_batch:
        return 0

    # Only update rows that have a processed_reading_id — need to match
    updates = []
    for s in scores_batch:
        row = {
            "tub_id":         s.get("tub_id"),
            "experiment_id":  s.get("experiment_id"),
            "timestamp":      s.get("timestamp"),
            "pred_health_t":  s.get("pred_health_t"),
            "pred_stress_t":  s.get("pred_stress_t"),
            "pred_risk_t":    s.get("pred_risk_t"),
        }
        if row["pred_health_t"] is not None:
            updates.append(row)

    if not updates:
        return 0

    res = (
        supabase
        .schema("experiment")
        .table("computed_scores")
    )

    try:
        out = res.upsert(updates, on_conflict="experiment_id,tub_id,timestamp").execute()
        count = len(out.data or [])
        logger.info(f"Upserted {count} prediction rows into computed_scores (on_conflict experiment_id,tub_id,timestamp)")
        return count
    except Exception as e:
        logger.warning(f"Prediction upsert with on_conflict failed; falling back. Error: {e}")
        out = res.upsert(updates).execute()
        count = len(out.data or [])
        logger.info(f"Wrote {count} prediction rows into computed_scores (fallback)")
        return count
