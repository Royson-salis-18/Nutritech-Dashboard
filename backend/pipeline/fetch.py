"""
pipeline/fetch.py
Pulls raw sensor data from Supabase that hasn't been processed yet.

Supabase schema context:
  public.sensor_data          — raw readings (id, tub_id, moisture, ph, n, p, k, ec, etc.)
  experiment.weather_data     — weather per tub+time (air_temp, air_humidity, vpd, light, rainfall, etc.)
  experiment.tub_config       — per-tub soil constants (field_capacity, wilting_point, t_opt, theta_opt, ...)
  public.processed_readings   — already-processed rows (sensor_data_id used to detect duplicates)
"""

from services.supabase_service import supabase
import logging

logger = logging.getLogger(__name__)


def _first(*vals):
    """Return first non-None/non-empty value."""
    for v in vals:
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def fetch_unprocessed_sensor_data(experiment_id: int) -> list[dict]:
    """
    Returns sensor rows for an experiment that have NOT yet been processed.
    Joins weather + tub config so the cleaner/processor has everything it needs.
    """

    # 1. Get tub_ids for this experiment via mapping table
    mapping_res = (
        supabase
        .schema("experiment")
        .table("mapping")
        .select("tub_id")
        .eq("experiment_id", experiment_id)
        .execute()
    )
    tub_ids = [row["tub_id"] for row in (mapping_res.data or [])]

    if not tub_ids:
        logger.warning(f"No tubs found for experiment {experiment_id}")
        return []

    # 2. IDs already processed
    processed_res = (
        supabase
        .schema("public")
        .table("processed_readings")
        .select("sensor_data_id")
        .in_("tub_id", tub_ids)
        .eq("experiment_id", experiment_id)
        .execute()
    )
    already_done = {
        row["sensor_data_id"]
        for row in (processed_res.data or [])
        if row.get("sensor_data_id")
    }

    # 3. Raw sensor rows
    sensor_res = (
        supabase
        .schema("public")
        .table("sensor_data")
        .select("*")
        .in_("tub_id", tub_ids)
        .order("created_at", desc=False)
        .execute()
    )
    raw_rows = [r for r in (sensor_res.data or []) if r["id"] not in already_done]

    if not raw_rows:
        logger.info(f"No new sensor rows to process for experiment {experiment_id}")
        return []

    # 4. Fetch tub configs (one per tub)
    config_res = (
        supabase
        .schema("experiment")
        .table("tub_config")
        .select("*")
        .in_("tub_id", tub_ids)
        .execute()
    )
    config_by_tub = {r["tub_id"]: r for r in (config_res.data or [])}

    # 5. Enrich each sensor row with config + weather
    enriched = []
    for row in raw_rows:
        tub_id = row.get("tub_id")
        cfg = config_by_tub.get(tub_id, {})

        # Match weather reading closest to sensor timestamp (simple: by tub_id)
        weather_res = (
            supabase
            .schema("experiment")
            .table("weather_data")
            .select("*")
            .eq("tub_id", tub_id)
            .order("recorded_at", desc=True)
            .limit(1)
            .execute()
        )
        wx = weather_res.data[0] if weather_res.data else {}

        # Derive soil/volume constants for calculations engine if missing
        volume_liters = _first(cfg.get("volume_liters"), cfg.get("volume_l"))  # support both
        try:
            volume_cm3 = float(row.get("volume_cm3") or (float(volume_liters) * 1000.0 if volume_liters is not None else 0.0))
        except Exception:
            volume_cm3 = 0.0

        bulk_density_gcm3 = _first(cfg.get("bulk_density_gcm3"), cfg.get("bulk_density"))
        try:
            bd = float(bulk_density_gcm3) if bulk_density_gcm3 is not None else 1.3
        except Exception:
            bd = 1.3

        # If dry mass not provided by sensors, approximate from BD * volume (g/cm3 * cm3 => g)
        try:
            dry_mass_g = float(row.get("dry_mass_g")) if row.get("dry_mass_g") is not None else (bd * volume_cm3 if volume_cm3 else None)
        except Exception:
            dry_mass_g = None

        enriched.append({
            # Identifiers
            "id":            row.get("id"),
            "tub_id":        tub_id,
            "experiment_id": experiment_id,
            "created_at":    row.get("created_at"),
            "weather_data_id": wx.get("id"),

            # Sensor readings — map to calculations.py expected keys
            # Prefer your screenshot column names (soil_*) but support older names too.
            "moisture_t":    _first(row.get("soil_moisture"), row.get("moisture_t"), row.get("moisture")),
            "ph":            _first(row.get("soil_ph"), row.get("ph")),
            "n_sensor":      _first(row.get("nitrogen"), row.get("n"), row.get("n_sensor")),
            "p_sensor":      _first(row.get("phosphorus"), row.get("p"), row.get("p_sensor")),
            "k_sensor":      _first(row.get("potassium"), row.get("k"), row.get("k_sensor")),
            "ec_t":          _first(row.get("soil_ec"), row.get("ec_t"), row.get("ec")),
            "dry_mass_g":    dry_mass_g,
            "volume_cm3":    volume_cm3,
            "irrigation_t":  _first(row.get("irrigation"), row.get("irrigation_t"), 0.0) or 0.0,
            "heat_t":        _first(row.get("heat_stress"), row.get("heat_t"), 0.0) or 0.0,

            # Weather
            "temp_air":      _first(wx.get("air_temp"), row.get("air_temp")),
            "vpd":           _first(wx.get("vpd"), row.get("vpd")),
            "light":         _first(wx.get("light"), row.get("light")),

            # Config / soil constants
            "fc":            cfg.get("field_capacity"),
            "wp":            cfg.get("wilting_point"),
            "temp_opt":      cfg.get("t_opt"),
            "theta_opt":     cfg.get("theta_opt"),
            "vpd_max_kpa":   cfg.get("vpd_max_kpa"),
            "bulk_density_gcm3": bd,
        })

    logger.info(f"Fetched {len(enriched)} unprocessed rows for experiment {experiment_id}")
    return enriched
