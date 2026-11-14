"""Evidence-gated crop exploration for a farmer in Huaral.

NASA POWER annual regional descriptions + FAO ECOCROP expert reference
ranges. NOT crop suitability, profitability, irrigation or sowing advice.
The service abstains with incomplete climate records or implausible references.
"""
from __future__ import annotations

from functools import lru_cache
from math import isfinite
from statistics import mean
import unicodedata

from app.services.arie import CROPS

# Familiar exploratory directory, NOT an official list of suitable crops.
# Never infer a specific variety from a species-level FAO profile.
HUARAL_EXPLORATORY_IDS = (
    "sweet_potato", "tomato", "common_bean", "carrot", "onion",
    "maize", "potato", "pea", "avocado", "pumpkin", "cucumber", "pepper",
)
FAO_REFERENCE = "https://cgiar-climate-data-hub.github.io/catalog/ecocrop/"
NASA_REFERENCE = "https://power.larc.nasa.gov/"


def _species_name(value: str) -> str:
    words = "".join(
        char for char in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(char)
    ).replace(".", "").split()
    return " ".join(words[:2])


@lru_cache(maxsize=1)
def fao_by_species() -> dict:
    result: dict[str, dict] = {}
    for crop in CROPS.values():
        if crop.get("evidence_level") != "ecocrop_expert_estimates_not_locally_validated":
            continue
        key = _species_name(crop["scientific_name"])
        if key and key not in result:
            result[key] = crop.get("ecocrop_thresholds") or {}
    return result


def reliable_reference_range(reference: dict, first: str, last: str, lo: float, hi: float):
    a, b = reference.get(first), reference.get(last)
    if type(a) not in (int, float) or type(b) not in (int, float):
        return None
    if not (isfinite(a) and isfinite(b) and lo <= a < b <= hi):
        return None
    return [float(a), float(b)]


def climate_summary(annual_records: list[dict]) -> dict:
    complete = [
        r for r in annual_records
        if r.get("status") == "complete"
        and type(r.get("precipitation_total_mm")) in (int, float)
        and type(r.get("temperature_mean_c")) in (int, float)
        and isfinite(r["precipitation_total_mm"])
        and isfinite(r["temperature_mean_c"])
        and 0 <= r["precipitation_total_mm"] <= 20000
        and -40 <= r["temperature_mean_c"] <= 60
    ]
    if len(complete) < 3:
        return {"status": "insufficient_data", "complete_years": len(complete),
                "temperature_mean_c": None, "annual_rain_mm": None,
                "years": [r.get("year") for r in complete]}
    return {
        "status": "available", "complete_years": len(complete),
        "temperature_mean_c": round(mean(r["temperature_mean_c"] for r in complete), 2),
        "annual_rain_mm": round(mean(r["precipitation_total_mm"] for r in complete), 2),
        "years": [r.get("year") for r in complete],
    }


def screen_crop(crop_id: str, climate: dict) -> dict:
    crop = CROPS[crop_id]
    # A species-level reference is never evidence about the locally-grown variety.
    ranges = fao_by_species().get(_species_name(crop["scientific_name"]), {})
    temp = reliable_reference_range(ranges, "topmn", "topmx", -40, 65)
    rain = reliable_reference_range(ranges, "ropmn", "ropmx", 0, 20000)
    result = {
        "id": crop_id, "name": "Maíz (revisar variedad)" if crop_id == "maize" else crop["name"],
        "scientific_name": crop["scientific_name"],
        "status": "insufficient_evidence", "temperature_reference_c": temp,
        "rain_reference_mm_year": rain, "temperature_review": "unknown",
        "rain_review": "unknown",
        "local_suitability_confirmed": False, "can_recommend_sowing": False,
        "reference": FAO_REFERENCE if temp or rain else None,
    }
    if climate["status"] != "available" or temp is None:
        result["reason"] = "Aún faltan datos climáticos completos o una referencia FAO comprobable."
        return result
    temperature = climate["temperature_mean_c"]
    in_range = temp[0] <= temperature <= temp[1]
    result["temperature_review"] = "within_expert_reference" if in_range else "outside_expert_reference"
    if rain is not None:
        amount = climate["annual_rain_mm"]
        result["rain_review"] = ("below_expert_reference" if amount < rain[0]
                                 else "above_expert_reference" if amount > rain[1]
                                 else "within_expert_reference")
    result["status"] = "climate_reference_to_review" if in_range else "requires_climate_review"
    result["reason"] = (
        "La temperatura regional coincide con un rango general publicado para esta especie."
        if in_range else
        "La temperatura regional no coincide con el rango general publicado para esta especie."
    )
    if result["rain_review"] == "below_expert_reference":
        result["reason"] += " La lluvia anual de la zona es menor que la referencia: falta comprobar acceso al riego."
    elif result["rain_review"] == "above_expert_reference":
        result["reason"] += " La lluvia anual regional es mayor que la referencia general."
    else:
        result["reason"] += " Falta comprobar suelo, agua, variedad y estación de siembra."
    return result


def build_crop_guidance(annual_records: list[dict], selected_crop_id: str | None = None) -> dict:
    climate = climate_summary(annual_records)
    candidates = [screen_crop(crop_id, climate) for crop_id in HUARAL_EXPLORATORY_IDS]
    # Do not rank by agronomic merit; keep a stable familiar-crops display order.
    selected = screen_crop(selected_crop_id, climate) if selected_crop_id else None
    return {
        "status": climate["status"],
        "climate": climate,
        "candidates": candidates,
        "selected_crop": selected,
        "basis": "NASA POWER daily observations from complete calendar years; FAO ECOCROP species-level expert estimates.",
        "source_urls": [NASA_REFERENCE, FAO_REFERENCE],
        "regional_climate_only": True,
        "locally_validated": False,
        "can_recommend_sowing": False,
        "needs_local_review": [
            "Disponibilidad de riego en la chacra", "Tipo y calidad del suelo",
            "Variedad, plagas y fechas de siembra", "Mercado y costos locales",
        ],
        "limitation": (
            "Estas son opciones para conversar con un técnico, NO recomendaciones "
            "de siembra. La coincidencia de temperatura regional con FAO ECOCROP "
            "no verifica aptitud ni rendimiento. NASA POWER no mide una chacra."
        ),
    }


def annual_summaries_from_daily(rows: list[dict], start_year: int, end_year: int) -> list[dict]:
    """Reconstruct complete calendar years from NASA POWER normalized daily rows.

    Missing days/values cause partial status; incomplete precipitation is not
    extrapolated to a fictitious annual total.
    """
    import calendar
    from datetime import date
    grouped: dict[int, dict[str, dict]] = {year: {} for year in range(start_year, end_year + 1)}
    for row in rows:
        try:
            observed = date.fromisoformat(str(row["date"]))
        except (KeyError, TypeError, ValueError):
            continue
        if observed.year in grouped:
            grouped[observed.year][observed.isoformat()] = row
    result = []
    for year, days in grouped.items():
        expected = 366 if calendar.isleap(year) else 365
        rainy = [r["PRECTOTCORR"] for r in days.values()
                 if type(r.get("PRECTOTCORR")) in (int, float)
                 and isfinite(r["PRECTOTCORR"]) and 0 <= r["PRECTOTCORR"] <= 1000]
        temps = [r["T2M"] for r in days.values()
                 if type(r.get("T2M")) in (int, float)
                 and isfinite(r["T2M"]) and -60 <= r["T2M"] <= 65]
        complete = len(days) == expected and len(rainy) == expected and len(temps) == expected
        result.append({
            "year": year,
            "status": "complete" if complete else "partial",
            "precipitation_total_mm": round(sum(rainy), 2) if complete else None,
            "temperature_mean_c": round(mean(temps), 2) if complete else None,
        })
    return result
