"""
pipeline/clean.py
Validates and cleans a batch of enriched sensor rows before calculation.

Rules applied per column:
  - Drop rows missing tub_id or created_at (primary identifiers)
  - Clip values to physically plausible ranges
  - Fill remaining nulls with batch medians
  - Flag rows whose values are >3σ from mean (logged, kept)

Returns: (cleaned_rows, report_dict)
"""

import statistics
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Plausible value ranges ────────────────────────────────────────────────────
RANGES: dict[str, tuple[float, float]] = {
    "moisture_t":  (0.0,  1.0),
    "ph":          (3.0, 10.0),
    "n_sensor":    (0.0, 500.0),
    "p_sensor":    (0.0, 500.0),
    "k_sensor":    (0.0, 500.0),
    "ec_t":        (0.0,  10.0),
    "temp_air":    (-10.0, 60.0),
    "vpd":         (0.0,   7.0),
    "light":       (0.0, 2000.0),
    "dry_mass_g":  (0.0, 5000.0),
    "volume_cm3":  (0.0, 50000.0),
    "irrigation_t":(0.0, 999.0),
    "heat_t":      (0.0,   1.0),
}

NUMERIC_COLS = list(RANGES.keys())


def _median(values: list[float]) -> float | None:
    cleaned = [v for v in values if v is not None]
    return statistics.median(cleaned) if cleaned else None


def _compute_batch_medians(rows: list[dict]) -> dict[str, float | None]:
    medians: dict[str, float | None] = {}
    for col in NUMERIC_COLS:
        vals = []
        for r in rows:
            v = r.get(col)
            if v is not None:
                try:
                    vals.append(float(v))
                except (TypeError, ValueError):
                    pass
        medians[col] = _median(vals)
    return medians


def _compute_stdev_bounds(rows: list[dict]) -> dict[str, tuple[float, float] | None]:
    bounds: dict[str, tuple[float, float] | None] = {}
    for col in NUMERIC_COLS:
        vals = [float(r[col]) for r in rows if r.get(col) is not None]
        if len(vals) < 3:
            bounds[col] = None
            continue
        mu = statistics.mean(vals)
        sd = statistics.stdev(vals)
        bounds[col] = (mu - 3 * sd, mu + 3 * sd)
    return bounds


def clean_batch(rows: list[dict[str, Any]], use_math_cleaning: bool = True) -> tuple[list[dict], dict]:
    """
    Clean a batch of enriched sensor rows.
    Returns (cleaned_rows, report).
    """
    report = {
        "input_rows": len(rows),
        "dropped_missing_id": 0,
        "nulls_filled": 0,
        "clipped": 0,
        "outliers_flagged": 0,
        "output_rows": 0,
    }

    # 1. Drop rows missing primary keys
    valid = []
    for r in rows:
        if not r.get("tub_id") or not r.get("created_at"):
            report["dropped_missing_id"] += 1
            logger.warning(f"Dropped row id={r.get('id')} — missing tub_id or created_at")
        else:
            valid.append(dict(r))  # shallow copy

    # 2. Coerce numerics, clip to plausible ranges
    for r in valid:
        for col, (lo, hi) in RANGES.items():
            v = r.get(col)
            if v is None:
                continue
            try:
                fv = float(v)
            except (TypeError, ValueError):
                r[col] = None
                continue
            clipped = max(lo, min(hi, fv))
            if clipped != fv:
                report["clipped"] += 1
                logger.debug(f"Clipped {col}={fv} → {clipped} (row id={r.get('id')})")
            r[col] = clipped

    # 3. Compute batch medians for null-filling
    medians = _compute_batch_medians(valid)

    for r in valid:
        for col in NUMERIC_COLS:
            if r.get(col) is None:
                fill = medians.get(col)
                if fill is not None:
                    r[col] = fill
                    report["nulls_filled"] += 1

    # 4. Flag outliers (>3σ) — keep row but add flag
    if use_math_cleaning:
        bounds = _compute_stdev_bounds(valid)
        for r in valid:
            flagged_cols = []
            for col, bound in bounds.items():
                if bound is None:
                    continue
                v = r.get(col)
                if v is None:
                    continue
                lo, hi = bound
                if v < lo or v > hi:
                    flagged_cols.append(col)
                    report["outliers_flagged"] += 1
            r["_outlier_cols"] = flagged_cols
    else:
        for r in valid:
            r["_outlier_cols"] = []

    report["output_rows"] = len(valid)
    logger.info(
        f"Cleaning complete: {report['input_rows']} in → {report['output_rows']} out, "
        f"{report['dropped_missing_id']} dropped, {report['nulls_filled']} nulls filled, "
        f"{report['clipped']} clipped, {report['outliers_flagged']} outliers flagged"
    )
    return valid, report
