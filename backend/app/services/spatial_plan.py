"""Spatial crop rotation planning for any valid farmer-drawn parcel.

All fields can receive reference planning using farmer-reported crop history and
FAO/DRA catalogue rules. Local Lima sowing references are applied ONLY in the
Barranca corridor. NASA HLS model evidence is used ONLY for its exact training
parcel; its seasonal signal is not a crop-recognition or yield model.
"""
from __future__ import annotations

from datetime import date, timedelta
import calendar
import math
from typing import Any

from pyproj import Geod
from shapely.geometry import shape
from shapely.ops import unary_union

from app.services import rotation_engine as engine, field_shift_ai as field_ai

GEOD = Geod(ellps="WGS84")
MONTHS_ES = ("enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre")


def _month(value: str) -> date:
    try:
        year, month = (int(part) for part in value.split("-"))
        if not 2000 <= year <= 2100:
            raise ValueError("El año de la siembra debe estar entre 2000 y 2100.")
        return date(year, month, 1)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("Escribe el mes de siembra con el formato AAAA-MM.") from exc


def _area_ha(geometry: Any) -> float:
    return abs(GEOD.geometry_area_perimeter(geometry)[0]) / 10000


def _valid_polygon(polygon: dict):
    try:
        geo = shape(polygon)
    except (KeyError, ValueError, TypeError, IndexError) as exc:
        raise ValueError("Revisa los límites del terreno.") from exc
    if geo.geom_type != "Polygon" or geo.is_empty or not geo.is_valid:
        raise ValueError("Revisa los límites del terreno.")
    coords = list(geo.exterior.coords)
    if len(coords) > 101 or len(coords) < 4:
        raise ValueError("La delimitación requiere entre tres y cien esquinas.")
    if any(not math.isfinite(x) or not math.isfinite(y)
           or abs(x) > 180 or abs(y) > 90 for x, y in coords):
        raise ValueError("Revisa las coordenadas del terreno.")
    if geo.interiors:
        raise ValueError("Dibuja un contorno continuo para esta etapa.")
    return geo


def _is_barranca(point) -> bool:
    return -10.95 <= point.y <= -10.40 and -78.07 <= point.x <= -77.35


def _start_after_harvest(planted_month: str, cycle_days: int) -> date:
    planted = _month(planted_month)
    expected = planted + timedelta(days=max(30, cycle_days) + 15)
    today = date.today()
    earliest = date(today.year, today.month, 1)
    if expected < earliest:
        return earliest
    return date(expected.year, expected.month, 1)


def _add_months(start: date, amount: int) -> date:
    x = (start.year * 12 + start.month - 1) + amount
    return date(x // 12, x % 12 + 1, 1)


def _water_reference(crop: dict, sow_month: int, climate: dict | None) -> float | None:
    """FAO Kc x NASA POWER ET0 over a simple monthly stage reference, not irrigation."""
    months = climate.get("months") if isinstance(climate, dict) else None
    if not isinstance(months, list):
        return None
    et0 = {row.get("month"): row.get("et0_mm_day") for row in months if isinstance(row, dict)}
    if any(not isinstance(et0.get(m), (int, float))
           or not math.isfinite(et0[m]) or et0[m] < 0 for m in range(1, 13)):
        return None
    days = int(crop.get("cycle_days") or sum(crop.get("stages_days", [])) or 120)
    kc = crop.get("kc", [0.4, 1, 0.6])
    if len(kc) != 3:
        return None
    # Reference calculation: first/second/last third, deliberately approximate.
    total = 0.0
    for i in range(0, days, 30):
        month = (sow_month - 1 + i // 30) % 12 + 1
        coefficient = float(kc[0] if i < days / 3 else kc[2] if i > 2 * days / 3 else kc[1])
        total += et0[month] * coefficient * min(30, days - i)
    return round(total, 1)


def _candidate(current: dict, start: date, local_calendar: bool,
               climate: dict | None, seasonal_cover: list[float] | None) -> tuple[dict, date, float | None]:
    crops = list(engine.load_catalog()["crops"].values())
    options = []
    for crop in crops:
        if crop["id"] == current["id"] or crop["family"] == current["family"]:
            continue
        valid_months = crop.get("sowing_months_lima", []) if local_calendar else list(range(1, 13))
        if not valid_months:
            continue
        future = next((_add_months(start, n) for n in range(13)
                       if _add_months(start, n).month in valid_months), None)
        if future is None:
            continue
        water = _water_reference(crop, future.month, climate)
        score = 4.0
        if current.get("nitrogen_fixer"):
            score += 1.0 if not crop.get("nitrogen_fixer") else -0.5
        else:
            score += 2.0 if crop.get("nitrogen_fixer") else 0.0
        if local_calendar and future.month in crop.get("sowing_peak_months", []):
            score += 1.2
        # Avoid suggesting a month far away solely to favor a generic crop.
        score -= (future.year - start.year) * 1.8 + ((future.month - start.month) % 12) * 0.12
        if water is not None:
            score -= water / 1100
        else:
            score -= float(crop.get("kc", [1, 1, 1])[1]) * 0.3
        if seasonal_cover:
            # This signal is for the whole study parcel, never one sub-zone.
            score += seasonal_cover[future.month - 1] * 0.4
        options.append((score, crop["id"], crop, future, water))
    if not options:
        raise ValueError("Revisa el catálogo de cultivos antes de preparar el plan.")
    _, _, chosen, month, water = max(options, key=lambda r: (r[0], r[1]))
    return chosen, month, water


def build_spatial_plan(polygon: dict, zones: list[dict],
                       climate: dict | None = None, planning_months: int = 12) -> dict:
    """Validate geometry and build sequential reference campaigns within the requested horizon."""
    if isinstance(planning_months, bool) or not isinstance(planning_months, int) or not 3 <= planning_months <= 60:
        raise ValueError("El plazo del plan debe estar entre 3 y 60 meses.")
    period_start = date.today().replace(day=1)
    period_end = _add_months(period_start, planning_months)
    if not 1 <= len(zones) <= 25:
        raise ValueError("Asigna cultivos a un máximo de 25 zonas.")
    field = _valid_polygon(polygon)
    area = _area_ha(field)
    if not 0.1 <= area <= 10000:
        raise ValueError("Delimita un terreno de 0,1 a 10 000 hectáreas.")
    names: set[str] = set()
    explicit = []
    for record in zones:
        zid = record["id"]
        if zid in names:
            raise ValueError("Cada zona necesita un nombre único.")
        names.add(zid)
        engine.crop(record["crop_id"])
        _month(record["planted_month"])
        poly = record.get("polygon")
        if poly:
            sub = _valid_polygon(poly)
            if not field.buffer(1e-10).covers(sub):
                raise ValueError("Cada zona debe quedar dentro del terreno.")
            if any(sub.intersection(previous).area > 1e-13 for previous in explicit):
                raise ValueError("Ajusta las zonas para evitar que se superpongan.")
            explicit.append(sub)
        elif zid != "rest":
            raise ValueError("Dibuja los límites de cada zona.")
    if len(explicit) > 24:
        raise ValueError("El terreno admite hasta 24 subdivisiones.")
    occupied = unary_union(explicit) if explicit else None
    remainder = field.difference(occupied) if occupied else field
    area_rem = _area_ha(remainder) if not remainder.is_empty else 0.0
    for record in zones:
        if record["id"] == "rest" and record.get("polygon"):
            raise ValueError("La zona general se calcula a partir de las subdivisiones.")
    if "rest" not in names and area_rem > max(0.02, area * 0.005):
        raise ValueError("Asigna también el resto del terreno.")
    if "rest" in names and area_rem < 0.005:
        raise ValueError("La zona general ya está cubierta por las subdivisiones.")

    local = _is_barranca(field.centroid)
    verified_ai = False
    seasonal = None
    if field_ai.exact_parcel_match(polygon):
        try:
            model = field_ai.validated_barranca_model()
            seasonal = model["probabilities"]
            verified_ai = True
        except (OSError, ValueError, KeyError):
            pass

    results = []
    for record in zones:
        current = engine.crop(record["crop_id"])
        start = _start_after_harvest(record["planted_month"], int(current["cycle_days"]))
        candidate, sow, water = _candidate(current, start, local, climate, seasonal)
        subarea = area_rem if record["id"] == "rest" else _area_ha(_valid_polygon(record["polygon"]))
        es_date = f"{MONTHS_ES[sow.month - 1]} de {sow.year}"
        reason = (f"Después de {current['name_es']}, considera {candidate['name_es']} "
                  "para alternar familias de cultivos.")
        if local:
            reason += " El mes propuesto utiliza el calendario regional de Lima como referencia."
        else:
            reason += " La fecha es orientativa y debe confirmarse con el calendario agrícola local."
        en_date = f"{calendar.month_name[sow.month]} {sow.year}"
        reason_en = (f"After {engine.name_en(current['id'])}, consider {engine.name_en(candidate['id'])} "
                     "to alternate crop families.")
        if local:
            reason_en += " The planting month uses the regional Lima calendar as a reference."
        else:
            reason_en += " The planting date is a preliminary reference; verify the local season."
        how_en = [
            f"Before {en_date}, check available irrigation water, drainage, and soil conditions.",
            f"Choose a locally adapted {engine.name_en(candidate['id'])} variety with agricultural guidance.",
            "Prepare rows or beds for the soil and variety; confirm seed, depth and spacing in a crop guide.",
            "Schedule irrigation and pest monitoring for growth stages, checking your actual water allocation.",
        ]
        how = [
            f"Antes de {es_date}, comprueba agua disponible, drenaje y estado del suelo de esta zona.",
            f"Selecciona una variedad de {candidate['name_es']} adecuada a la zona con asesoría agraria local.",
            "Prepara las camas o surcos según suelo y variedad; ajusta semilla, profundidad y espaciamiento a la ficha técnica.",
            "Organiza el riego y el seguimiento de plagas por etapas de desarrollo, verificando el turno real de agua.",
        ]
        results.append({
            "zone_id": record["id"],
            "area_ha": round(subarea, 3),
            "current_crop_id": current["id"],
            "current_crop": current["name_es"],
            "current_crop_en": engine.name_en(current["id"]),
            "last_planting_month": record["planted_month"],
            "suggested_crop_id": candidate["id"],
            "suggested_crop": candidate["name_es"],
            "suggested_crop_en": engine.name_en(candidate["id"]),
            "sow_month": f"{sow.year:04d}-{sow.month:02d}",
            "sow_label_es": es_date,
            "sow_label_en": en_date,
            "estimated_cycle_days": int(candidate["cycle_days"]),
            "why_es": reason,
            "why_en": reason_en,
            "how_es": how,
            "how_en": how_en,
            "reference_water_mm": water,
            "sowing_window_scope": "lima_reference" if local else "farmer_check",
            "source_tags": ["FAO-56", "DRA Lima / MIDAGRI"] if local else ["FAO-56", "historial declarado"],
        })
        # Consecutive campaigns, not independent per-month guesses. The model is
        # historical evidence for the exact study polygon, never a future forecast.
        campaigns = []
        previous = current
        earliest = start
        for _ in range(36):
            if not campaigns:
                next_crop, next_sow, next_water = candidate, sow, water
            else:
                next_crop, next_sow, next_water = _candidate(previous, earliest, local, climate, seasonal)
            if next_sow >= period_end:
                break
            duration = int(next_crop["cycle_days"])
            # Month boundaries are indicative; end_month is exclusive.
            end_month = _add_months(next_sow, max(1, math.ceil(duration / 30.44)))
            campaigns.append({
                "crop_id": next_crop["id"],
                "crop_es": next_crop["name_es"],
                "crop_en": engine.name_en(next_crop["id"]),
                "sow_month": next_sow.strftime("%Y-%m"),
                "end_month": end_month.strftime("%Y-%m"),
                "estimated_cycle_days": duration,
                "reference_water_mm": next_water,
                "source": "agronomic_rule_with_regional_references",
            })
            earliest, previous = end_month, next_crop
        results[-1]["campaigns"] = campaigns
    return {
        "planning_months": planning_months,
        "plan_start_month": period_start.strftime("%Y-%m"),
        "plan_end_month": period_end.strftime("%Y-%m"),
        "plan_kind": "reference_rotation_not_future_weather_forecast",
        "status": "prepared",
        "parcel_area_ha": round(area, 3),
        "zone_plans": results,
        "scope": "barranca_reference" if local else "exploratory_reference",
        "climate_status": "nasa_power_reference" if isinstance(climate, dict) and
                         isinstance(climate.get("months"), list) else "reference_rules",
        "ai_status": "trained_hls_on_exact_study_parcel" if verified_ai else "agronomic_rule_engine",
        "disclaimer_es": ("Plan orientativo basado en tus cultivos y referencias FAO."
                          " Confirma agua, suelo, variedad y fechas antes de sembrar."
                          " El pequeño modelo estacional NASA HLS (prueba de concepto) se aplica solo a la parcela de estudio de Barranca."),
        "disclaimer_en": ("Reference plan based on your crop records and FAO sources."
                          " Verify water supply, soil, varieties and dates before planting."
                          " The small seasonal NASA HLS model (proof of concept) only applies to the Barranca study field."),
        "sources": ["FAO Irrigation and Drainage Paper 56",
                    "NASA POWER (solo cuando se carga su climatología)",
                    "DRA Lima / MIDAGRI (solo para Barranca)",
                    "NASA HLS (solo para el polígono original de estudio)"],
        "sources_en": ["FAO Irrigation and Drainage Paper 56",
                       "NASA POWER (only when its climatology is loaded)",
                       "DRA Lima / MIDAGRI (Barranca only)",
                       "NASA HLS (only for the original study polygon)"],
    }
