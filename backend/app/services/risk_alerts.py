"""Explainable screening of dated model outputs; no alarms from missing data."""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from hashlib import sha256
import json
import os
from pathlib import Path
from statistics import mean
from zoneinfo import ZoneInfo

from app.schemas.risk_alerts import RiskPointInput, RiskSnapshot

DATA = Path(__file__).resolve().parents[1] / "data"
LEVELS = ("insufficient_data", "no_signal", "monitor", "high")


@lru_cache(maxsize=1)
def rules():
    return json.loads((DATA / "risk_rules.json").read_text())


def catalog():
    return rules()


def percentile_rank(value, reference):
    """Empirical midrank; tied zeros in a normal dry season are not a drought."""
    if value is None or len(reference) < rules()["minimum_baseline_years"]:
        return None
    return 100 * (sum(x < value for x in reference) + .5 * sum(x == value for x in reference)) / len(reference)


def complete(values, operation=sum):
    return operation(values) if values and all(v is not None for v in values) else None


def metric(label, label_en, value, unit, day=None):
    return {"label": label, "label_en": label_en, "value": round(value, 3) if value is not None else None,
            "unit": unit, "date": day.isoformat() if day is not None else None}


def rolling_rain(point):
    rows = point.forecast
    windows = [complete([r.precipitation_mm for r in rows[i:i+3]]) for i in range(5)]
    return max((v for v in windows if v is not None), default=None)


def point_alerts(point: RiskPointInput):
    t = rules()["thresholds"]
    output = []
    forecast = point.forecast
    rain = [r.precipitation_mm for r in forecast]
    rain_valid = [v for v in rain if v is not None]
    max_rain = max(rain_valid, default=None)
    rain3 = rolling_rain(point)

    def emit(hazard, level, metrics, reason, reason_en, valid, expected, baseline=None, **extra):
        definition = next(h for h in rules()["hazards"] if h["id"] == hazard)
        output.append({**definition, "level": level, "metrics": metrics, "reason": reason, "reason_en": reason_en,
                       "coverage": {"valid": valid, "expected": expected, "baseline_years": baseline}, **extra})

    p30 = complete([r.precipitation_mm for r in point.history])
    baseline_rain = [b.precipitation_30d_mm for b in point.baseline if b.precipitation_30d_mm is not None]
    p_rank = percentile_rank(p30, baseline_rain)
    drought = "insufficient_data" if p_rank is None else ("high" if p_rank <= t["drought_percentile_high"] else
               "monitor" if p_rank <= t["drought_percentile_monitor"] else "no_signal")
    emit("drought", drought,
         [metric("Lluvia de 30 días", "30-day precipitation", p30, "mm"),
          metric("Percentil histórico de lluvia", "Historical precipitation percentile", p_rank, "/100")],
         f"Señal de déficit: percentil ≤{t['drought_percentile_monitor']} (prioridad alta ≤{t['drought_percentile_high']}) frente a las mismas ventanas de 1991–2020. No es SPI ni una declaración de sequía.",
         f"Deficit signal: percentile ≤{t['drought_percentile_monitor']} (high priority ≤{t['drought_percentile_high']}) against matching 1991–2020 windows. Not SPI or a drought declaration.",
         sum(r.precipitation_mm is not None for r in point.history), 30, len(baseline_rain),
         period={"from": point.history[0].date.isoformat(), "to": point.history[-1].date.isoformat()})

    lows = [(r.tmin_c, r.date) for r in forecast if r.tmin_c is not None]
    highs = [(r.tmax_c, r.date) for r in forecast if r.tmax_c is not None]
    low, low_day = min(lows, default=(None, None))
    high, high_day = max(highs, default=(None, None))
    valid_temp = len(lows) + len(highs)
    if (low is not None and low <= t["frost_high_c"]) or (high is not None and high >= t["heat_high_c"]):
        temp_level = "high"
    elif (low is not None and low <= t["frost_monitor_c"]) or (high is not None and high >= t["heat_monitor_c"]):
        temp_level = "monitor"
    else:
        temp_level = "no_signal" if valid_temp == 14 else "insufficient_data"
    emit("temperature", temp_level,
         [metric("Mínima prevista", "Forecast minimum", low, "°C", low_day), metric("Máxima prevista", "Forecast maximum", high, "°C", high_day)],
         f"Monitorear si Tmin ≤{t['frost_monitor_c']} °C o Tmax ≥{t['heat_monitor_c']} °C; prioridad alta si ≤{t['frost_high_c']} °C o ≥{t['heat_high_c']} °C. El daño depende del cultivo y su etapa.",
         f"Monitor if Tmin ≤{t['frost_monitor_c']} °C or Tmax ≥{t['heat_monitor_c']} °C; high priority if ≤{t['frost_high_c']} °C or ≥{t['heat_high_c']} °C. Damage depends on crop and growth stage.", valid_temp, 14)

    if (max_rain is not None and max_rain >= t["rain_day_high_mm"]) or (rain3 is not None and rain3 >= t["rain_3day_high_mm"]):
        rain_level = "high"
    elif (max_rain is not None and max_rain >= t["rain_day_monitor_mm"]) or (rain3 is not None and rain3 >= t["rain_3day_monitor_mm"]):
        rain_level = "monitor"
    else:
        rain_level = "no_signal" if len(rain_valid) == 7 else "insufficient_data"
    rain_metrics = [metric("Máximo diario previsto", "Forecast daily maximum", max_rain, "mm"),
                    metric("Máximo en 3 días consecutivos", "Maximum over 3 consecutive days", rain3, "mm")]
    emit("excess_rain", rain_level, rain_metrics,
         f"Monitorear desde {t['rain_day_monitor_mm']} mm/día o {t['rain_3day_monitor_mm']} mm/3 días; prioridad alta desde {t['rain_day_high_mm']} o {t['rain_3day_high_mm']} mm respectivamente. Umbrales exploratorios, no avisos oficiales.",
         f"Monitor from {t['rain_day_monitor_mm']} mm/day or {t['rain_3day_monitor_mm']} mm/3 days; high priority from {t['rain_day_high_mm']} or {t['rain_3day_high_mm']} mm respectively. Screening thresholds, not official advisories.", len(rain_valid), 7)

    slope = point.terrain.slope_p75_degrees if point.terrain.valid_fraction >= .95 else None
    if slope is None or max_rain is None:
        erosion = "insufficient_data"
    elif slope >= t["erosion_slope_p75_degrees"] and rain_level in ("monitor", "high"):
        erosion = "monitor"  # Soil erodibility and cover are unknown: never quantified high erosion.
    else:
        erosion = "no_signal" if len(rain_valid) == 7 else "insufficient_data"
    emit("erosion", erosion, [*rain_metrics[:1], metric("Pendiente P75 del entorno", "Neighborhood P75 slope", slope, "°")],
         f"Señal para inspección si pendiente P75 ≥{t['erosion_slope_p75_degrees']}° y se activa el umbral de lluvia. Solo lluvia y relieve; faltan erodibilidad, cobertura y prácticas de conservación.",
         f"Inspection signal if P75 slope ≥{t['erosion_slope_p75_degrees']}° and a rainfall threshold is triggered. Rainfall and terrain only; erodibility, cover and conservation practices are missing.",
         len(rain_valid) + (slope is not None), 8,
         missing_factors=["soil_erodibility", "land_cover", "slope_length", "conservation_practices"])

    soil7 = complete([r.soil_m3_m3 for r in point.history[-7:]], mean)
    baseline_soil = [b.soil_7d_m3_m3 for b in point.baseline if b.soil_7d_m3_m3 is not None]
    soil_rank = percentile_rank(soil7, baseline_soil)
    p7 = complete(rain)
    et7 = complete([r.et0_mm for r in forecast])
    deficit = max(0, et7 - p7) if et7 is not None and p7 is not None else None
    if soil_rank is None or deficit is None:
        stress = "insufficient_data"
    elif soil_rank <= t["soil_percentile_high"] and deficit >= t["water_deficit_high_mm"]:
        stress = "high"
    elif soil_rank <= t["soil_percentile_monitor"] and deficit >= t["water_deficit_monitor_mm"]:
        stress = "monitor"
    else:
        stress = "no_signal"
    emit("water_stress", stress,
         [metric("Agua modelada 0–100 cm (media 7 días)", "Modeled soil water 0–100 cm (7-day mean)", soil7, "m³/m³"),
          metric("Percentil histórico de agua del suelo", "Historical soil water percentile", soil_rank, "/100"),
          metric("Déficit climático previsto ET₀−P (7 días)", "Forecast climatic deficit ET₀−P (7 days)", deficit, "mm")],
         f"Monitorear si el percentil del suelo ≤{t['soil_percentile_monitor']} y ET₀−P ≥{t['water_deficit_monitor_mm']} mm; prioridad alta ≤{t['soil_percentile_high']} y ≥{t['water_deficit_high_mm']} mm. No estima estrés real ni agua de riego del cultivo.",
         f"Monitor if soil percentile ≤{t['soil_percentile_monitor']} and ET₀−P ≥{t['water_deficit_monitor_mm']} mm; high priority ≤{t['soil_percentile_high']} and ≥{t['water_deficit_high_mm']} mm. Not actual crop stress or crop irrigation demand.",
         sum(r.soil_m3_m3 is not None for r in point.history[-7:]) + len(rain_valid) + sum(r.et0_mm is not None for r in forecast), 21,
         len(baseline_soil), missing_factors=["crop_coefficient", "growth_stage", "measured_root_zone", "irrigation"])
    return output


def build_report(snapshot: RiskSnapshot):
    points = []
    for p in snapshot.points:
        alerts = point_alerts(p)
        overall = max((a["level"] for a in alerts), key=LEVELS.index)
        missing = sum(a["level"] == "insufficient_data" for a in alerts)
        if overall == "no_signal" and missing:
            overall = "insufficient_data"
        points.append({"id": p.id, "latitude": p.latitude, "longitude": p.longitude,
                       "overall": overall, "missing_hazards": missing, "alerts": alerts})
    terrain_assets = {asset["url"]: asset for point in snapshot.points for asset in point.terrain.source_assets}
    return {"method_version": snapshot.method_version,
            "rules_sha256": sha256((DATA / "risk_rules.json").read_bytes()).hexdigest(), "thresholds": rules()["thresholds"],
            "issued_at": snapshot.issued_at.isoformat(),
            "expires_at": snapshot.expires_at.isoformat(), "forecast_start": snapshot.forecast_start.isoformat(),
            "forecast_end": snapshot.forecast_end.isoformat(), "history_start": snapshot.history_start.isoformat(),
            "history_end": snapshot.history_end.isoformat(), "points": points,
            "summary": {h["id"]: {level: sum(next(a for a in p["alerts"] if a["id"] == h["id"])["level"] == level for p in points)
                                   for level in LEVELS} for h in rules()["hazards"]},
            "provenance": snapshot.provenance, "terrain_assets": list(terrain_assets.values()), "limitations": rules()["limitations"],
            "sources": rules()["sources"], "attribution": rules()["attribution"]}


def snapshot_directory():
    return Path(os.getenv("RISK_ALERTS_DATA_DIR", str(DATA / "risk_alerts")))


def load_snapshot(directory=None):
    root = Path(directory) if directory is not None else snapshot_directory()
    raw = (root / "pilot-snapshot.json").read_bytes()
    digest = json.loads((root / "pilot-manifest.json").read_text())["sha256"]
    if sha256(raw).hexdigest() != digest:
        raise ValueError("Risk input digest mismatch")
    snapshot = RiskSnapshot.model_validate_json(raw)
    if snapshot.method_version != rules()["version"]:
        raise ValueError("Risk method changed; rebuild the inputs")
    local_issue = snapshot.issued_at.astimezone(ZoneInfo("America/Lima")).date()
    if snapshot.forecast_start != local_issue + timedelta(days=1) or snapshot.history_end != local_issue - timedelta(days=7):
        raise ValueError("Risk input periods differ from the declared lag and horizon")
    return snapshot


def latest_report(now=None):
    now = now or datetime.now(timezone.utc)
    try:
        snapshot = load_snapshot()
    except FileNotFoundError:
        return {"status": "not_prepared", "report": None}
    except (OSError, ValueError, KeyError, TypeError):
        return {"status": "invalid_report", "report": None}
    if now < snapshot.issued_at or now >= snapshot.expires_at or now.astimezone(ZoneInfo("America/Lima")).date() >= snapshot.forecast_start:
        return {"status": "stale_report", "report": None, "issued_at": snapshot.issued_at.isoformat(), "expires_at": snapshot.expires_at.isoformat()}
    return {"status": "available", "report": build_report(snapshot)}
