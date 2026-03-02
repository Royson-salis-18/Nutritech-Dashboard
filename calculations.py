"""
Crop Monitoring Calculation Engine
All formulas transcribed from handwritten notes (Images 1-4)

Inputs expected in raw_data row:
  - dry_mass_g        : Dry mass in grams (after drying)
  - volume_cm3        : Initial volume in cm³
  - moisture_t        : Current soil moisture (M_t)
  - fc                : Field Capacity
  - wp                : Wilting Point
  - ph                : Soil pH
  - n_sensor          : Nitrogen (sensor reading)
  - p_sensor          : Phosphorus (sensor reading)
  - k_sensor          : Potassium (sensor reading)
  - temp_air          : Air temperature (T_air,t)
  - temp_opt          : Optimal temperature for crop (T_opt)
  - theta_opt         : Optimal soil moisture (θ_opt)
  - vpd               : Vapour Pressure Deficit
  - light             : Light intensity
  - irrigation_t      : Irrigation amount (I_t)
  - drain_rate        : Drainage rate parameter (κ)
  - heat_t            : Heat stress index input
  - ec_t              : Electrical conductivity
  - time_t            : Current time step
  - time_0            : Reference time step (t0 for growth)
  - p_t, s_t, c_t     : Markov state variables (Pest, Stress, Condition)
  - npk_ratio_opt     : Optimal NPK ratio (R_opt)

All weights (w1..w4, λ1..λ6, α1..α3, a1..a3) are configurable below.
"""

import math
from typing import Any

# ── CONFIGURABLE WEIGHTS & HYPERPARAMETERS ────────────────────────────────────

# Health weights
W1, W2, W3, W4 = 0.25, 0.25, 0.25, 0.25

# Stress weights
LAMBDA1 = 0.2   # moisture imbalance
LAMBDA2 = 0.2   # heat
LAMBDA3 = 0.2   # EC
LAMBDA4 = 0.2   # nutrient CV
LAMBDA5 = 0.1   # pH effect  (1 - η(pH))
LAMBDA6 = 0.1   # VPD stress

# Risk weights
A1, A2, A3 = 0.4, 0.4, 0.2

# Moisture quality shape parameter
ALPHA_MOIST = 1.0

# Climate quality shape parameter
GAMMA_CLIMATE = 0.005  # Fixed: γ=1.0 collapses Q to ~0 just 5°C from T_opt

# Growth logistic rate
N_GROWTH = 0.1

# VPD stress linear weight
W_VPD = 0.5

# pH gaussian width
SIGMA_PH = 1.0

# Drainage parameters
KAPPA_DRAIN = 0.1

# Evapotranspiration coefficients
# Fixed: α1=0.6 with light in W/m2 gave ET=480mm (impossible).
# α1=0.0035 converts W/m2 to mm/day (standard simplified Priestley-Taylor range)
# Realistic ET output: 2-10 mm/day for crops
ALPHA1_ET = 0.0035
ALPHA2_ET = 0.3

# Soil root zone depth (mm) — used to convert mm of water ↔ m3/m3 volumetric moisture
# M(m3/m3) = water_mm / SOIL_DEPTH_MM
# Typical: 200-400mm for shallow/deep root crops
SOIL_DEPTH_MM = 300.0

# NPK Michaelis-Menten half-saturation
K_T = 10.0

# Sigmoid β for risk
BETA_SIGMOID = 1.0


# ── HELPER: SIGMOID ───────────────────────────────────────────────────────────

def sigmoid(x: float, beta: float = 1.0) -> float:
    """σ(x) = 1 / (1 + e^(-βx))"""
    return 1.0 / (1.0 + math.exp(-beta * x))


# ── 1. BULK DENSITY ───────────────────────────────────────────────────────────

def bulk_density(dry_mass_g: float, volume_cm3: float) -> float:
    """BD = Dry Mass (g) / Volume (cm³)"""
    if volume_cm3 == 0:
        return 0.0
    return dry_mass_g / volume_cm3


# ── 2. WATER STORAGE WINDOW (θ_t) ────────────────────────────────────────────

def water_storage_window(moisture_t: float, fc: float, wp: float) -> float:
    """θ_t = (M_t - WP) / (FC - WP)   — normalised 0..1"""
    denom = fc - wp
    if denom == 0:
        return 0.0
    return (moisture_t - wp) / denom


# ── 3. pH NUTRIENT LOCK EFFICIENCY ───────────────────────────────────────────

def ph_efficiency(ph: float, sigma_ph: float = SIGMA_PH) -> float:
    """η(pH) = exp( -(pH - 6.5)² / (2·σ_pH²) )   Gaussian centred at 6.5"""
    return math.exp(-((ph - 6.5) ** 2) / (2 * sigma_ph ** 2))


# ── 4. EFFECTIVE NUTRIENTS ────────────────────────────────────────────────────

def effective_nutrients(n: float, p: float, k: float,
                        ph: float, theta_t: float) -> dict:
    """N_eff,t = [N,P,K]_sensor · η(pH) · θ_t"""
    eta = ph_efficiency(ph)
    factor = eta * theta_t
    return {
        "n_eff": n * factor,
        "p_eff": p * factor,
        "k_eff": k * factor,
    }


# ── 5. NUTRIENT IMBALANCE (CV_t) ─────────────────────────────────────────────

def nutrient_imbalance(n_eff: float, p_eff: float, k_eff: float) -> float:
    """CV_t = σ(N_eff, P_eff, K_eff) / μ(N_eff, P_eff, K_eff)"""
    vals = [n_eff, p_eff, k_eff]
    mu = sum(vals) / 3
    if mu == 0:
        return 0.0
    variance = sum((v - mu) ** 2 for v in vals) / 3
    return math.sqrt(variance) / mu


# ── 6. NPK RATIO (Michaelis-Menten) ──────────────────────────────────────────

def npk_ratio(n_t: float, p_t_val: float, k_t_val: float,
              k_half: float = K_T) -> float:
    """R_NPK,t = N_t / (P_t + K_t)   where K_t is half-saturation"""
    denom = p_t_val + k_half
    if denom == 0:
        return 0.0
    return n_t / denom


# ── 7. NUTRIENT QUALITY (Q_nutrient) ─────────────────────────────────────────

def nutrient_quality(ph: float, cv_t: float,
                     beta: float = BETA_SIGMOID) -> float:
    """Q_nutrient = η(pH) · (1 - β·CV_t)   — from image 3 & 4"""
    eta = ph_efficiency(ph)
    return eta * (1.0 - beta * cv_t)


# ── 8. MOISTURE QUALITY ───────────────────────────────────────────────────────

def moisture_quality(theta_t: float, theta_opt: float,
                     alpha: float = ALPHA_MOIST) -> float:
    """Q_moist,t = exp( -α·(θ_t - θ_opt)² )"""
    return math.exp(-alpha * (theta_t - theta_opt) ** 2)


# ── 9. CLIMATE QUALITY ───────────────────────────────────────────────────────

def climate_quality(temp_air: float, temp_opt: float,
                    gamma: float = GAMMA_CLIMATE) -> float:
    """Q_climate,t = exp( -γ·(T_air,t - T_opt)² )"""
    return math.exp(-gamma * (temp_air - temp_opt) ** 2)


# ── 10. HEALTH INDEX ─────────────────────────────────────────────────────────

def health_index(q_moist: float, q_nutrient: float,
                 q_climate: float, h_mineral: float = 1.0) -> float:
    """H_t = w1·Q_moist + w2·Q_nutrient + w3·Q_climate + w4·H_mineral"""
    return W1 * q_moist + W2 * q_nutrient + W3 * q_climate + W4 * h_mineral


# ── 11. VPD STRESS ───────────────────────────────────────────────────────────

def vpd_stress(vpd: float, w_vpd: float = W_VPD) -> float:
    """
    S_VPD,t = 0              if VPD < 1.0
              w·(VPD - 1.0)  if 1.0 ≤ VPD ≤ 2.5
              1.0             if VPD > 2.5
    """
    if vpd < 1.0:
        return 0.0
    elif vpd <= 2.5:
        return w_vpd * (vpd - 1.0)
    else:
        return 1.0


# ── 12. COMPOSITE STRESS INDEX ───────────────────────────────────────────────

def stress_index(delta_theta: float, heat_t: float, ec_t: float,
                 cv_t: float, ph: float, vpd: float) -> float:
    """
    δ_t = λ1·|Δθ_t| + λ2·Heat_t + λ3·EC_t + λ4·CV_t
          + λ5·(1 - η(pH)) + λ6·S_VPD,t
    """
    eta = ph_efficiency(ph)
    s_vpd = vpd_stress(vpd)
    return (LAMBDA1 * abs(delta_theta) +
            LAMBDA2 * heat_t +
            LAMBDA3 * ec_t +
            LAMBDA4 * cv_t +
            LAMBDA5 * (1.0 - eta) +
            LAMBDA6 * s_vpd)


# ── 13. RISK INDEX ────────────────────────────────────────────────────────────

def risk_index(stress_t: float, health_t: float,
               delta_health: float, beta: float = BETA_SIGMOID) -> float:
    """R_t = σ( a1·δ_t + a2·(1 - H_t) + a3·(dH/dt) )"""
    raw = A1 * stress_t + A2 * (1.0 - health_t) + A3 * delta_health
    return sigmoid(raw, beta)


# ── 14. EVAPOTRANSPIRATION ────────────────────────────────────────────────────

def evapotranspiration(light: float, vpd: float) -> float:
    """ET_t = α1·light_t + α2·VPD_t"""
    return ALPHA1_ET * light + ALPHA2_ET * vpd


# ── 15. MOISTURE UPDATE ───────────────────────────────────────────────────────

def moisture_update(moisture_t: float, irrigation_t: float,
                    et_t: float, drainage_t: float,
                    soil_depth_mm: float = SOIL_DEPTH_MM) -> float:
    """
    M_{t+1} = M_t + I_t - ET_t - Drain_t
    irrigation_t and et_t are in mm; convert to m3/m3 by dividing by soil depth (mm).
    """
    irr_vol   = irrigation_t / soil_depth_mm
    et_vol    = et_t         / soil_depth_mm
    return moisture_t + irr_vol - et_vol - drainage_t


# ── 16. DRAINAGE ─────────────────────────────────────────────────────────────

def drainage(bulk_dens: float, bulk_dens_opt: float,
             moisture_t: float, fc: float,
             kappa: float = KAPPA_DRAIN) -> float:
    """Drain = κ·(BD - BD_opt) · (1/BD) · (M_t - FC)"""
    if bulk_dens == 0:
        return 0.0
    return kappa * (bulk_dens - bulk_dens_opt) * (1.0 / bulk_dens) * (moisture_t - fc)


# ── 17. GROWTH ───────────────────────────────────────────────────────────────

def growth(time_t: float, time_0: float,
           health_t: float, n: float = N_GROWTH) -> float:
    """G_t = 1 / (1 + e^(-n·(t - t0))) · H_t   — logistic × health"""
    logistic = 1.0 / (1.0 + math.exp(-n * (time_t - time_0)))
    return logistic * health_t


# ── MASTER PROCESSOR ─────────────────────────────────────────────────────────

def process_raw_data(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Takes a raw_data row dict, runs all calculations, returns processed dict
    ready to INSERT into Supabase processed_data table.
    """

    def g(key, default=0.0):
        return float(raw.get(key, default) or default)

    # Raw inputs
    dry_mass      = g("dry_mass_g")
    volume        = g("volume_cm3")
    moisture_t    = g("moisture_t")
    fc            = g("fc", 0.48)   # default loam
    wp            = g("wp", 0.20)
    ph            = g("ph", 6.5)
    n_sensor      = g("n_sensor")
    p_sensor      = g("p_sensor")
    k_sensor      = g("k_sensor")
    temp_air      = g("temp_air")
    temp_opt      = g("temp_opt", 25.0)
    theta_opt     = g("theta_opt", 0.35)
    vpd           = g("vpd")
    light         = g("light")
    irrigation_t  = g("irrigation_t")
    heat_t        = g("heat_t")
    ec_t          = g("ec_t")
    time_t        = g("time_t", 0)
    time_0        = g("time_0", 0)
    prev_moisture = g("prev_moisture_t", moisture_t)
    bd_opt        = g("bd_opt", 1.3)
    prev_health   = g("prev_health", 0.8)
    h_mineral     = g("h_mineral", 1.0)

    # Step-by-step calculations
    bd            = bulk_density(dry_mass, volume)
    theta_t       = water_storage_window(moisture_t, fc, wp)
    effs          = effective_nutrients(n_sensor, p_sensor, k_sensor, ph, theta_t)
    n_eff         = effs["n_eff"]
    p_eff         = effs["p_eff"]
    k_eff         = effs["k_eff"]
    cv_t          = nutrient_imbalance(n_eff, p_eff, k_eff)
    q_nutrient    = nutrient_quality(ph, cv_t)
    q_moist       = moisture_quality(theta_t, theta_opt)
    q_climate     = climate_quality(temp_air, temp_opt)
    h_t           = health_index(q_moist, q_nutrient, q_climate, h_mineral)
    delta_health  = h_t - prev_health
    delta_theta   = theta_t - water_storage_window(prev_moisture, fc, wp)
    s_vpd         = vpd_stress(vpd)
    stress_t      = stress_index(delta_theta, heat_t, ec_t, cv_t, ph, vpd)
    risk_t        = risk_index(stress_t, h_t, delta_health)
    et_t          = evapotranspiration(light, vpd)
    drain_t       = drainage(bd, bd_opt, moisture_t, fc)
    m_next        = moisture_update(moisture_t, irrigation_t, et_t, drain_t)
    growth_t      = growth(time_t, time_0, h_t)
    r_npk         = npk_ratio(n_eff, p_eff, k_eff)
    eta_ph        = ph_efficiency(ph)

    return {
        "raw_data_id":     raw.get("id"),
        "timestamp":       raw.get("created_at"),
        # Soil
        "bulk_density":    round(bd, 4),
        "theta_t":         round(theta_t, 4),
        "moisture_next":   round(m_next, 4),
        "drainage_t":      round(drain_t, 4),
        "et_t":            round(et_t, 4),
        # Nutrients
        "n_eff":           round(n_eff, 4),
        "p_eff":           round(p_eff, 4),
        "k_eff":           round(k_eff, 4),
        "cv_t":            round(cv_t, 4),
        "r_npk":           round(r_npk, 4),
        "eta_ph":          round(eta_ph, 4),
        # Quality indices
        "q_moisture":      round(q_moist, 4),
        "q_climate":       round(q_climate, 4),
        "q_nutrient":      round(q_nutrient, 4),
        # Health & risk
        "health_index":    round(h_t, 4),
        "stress_index":    round(stress_t, 4),
        "vpd_stress":      round(s_vpd, 4),
        "risk_index":      round(risk_t, 4),
        # Growth
        "growth_t":        round(growth_t, 4),
    }
