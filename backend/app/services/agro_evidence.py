"""Evidence gates for BIOTEX agricultural decisions.

Official portals are references, *not* proof that a farm has an observed flow,
a verified soil sample, an accepted forecast or a guaranteed market price.
No unreviewed source is ever converted to a live measurement.
"""
from __future__ import annotations
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
import json
import math

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "official_evidence"
OFFICIAL = {
    "ana": {"name": "ANA - Sistema Nacional de Información de Recursos Hídricos",
            "url": "https://www.gob.pe/86460-acceder-al-sistema-nacional-de-informacion-de-recursos-hidricos",
            "use": "river_flow_context_not_irrigation_allocation"},
    "senamhi": {"name": "SENAMHI - avisos meteorológicos",
                "url": "https://www.senamhi.gob.pe/?p=aviso-meteorologico",
                "use": "forecast_alerts_not_observed_field_weather"},
    "midagri": {"name": "MIDAGRI - precios mayoristas",
                "url": "https://www.gob.pe/institucion/midagri/colecciones/94874-reporte-de-ingreso-y-precios-en-el-gran-mercado-mayorista-de-lima-2026",
                "use": "wholesale_prices_not_farmgate_profit"},
}
FAO_ECOCROP = "https://www.fao.org/land-water/resources/tools/databases/ecocrop/en"


def _official_document_url(kind: str, url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (
        (kind == "ana" and (host == "ana.gob.pe" or host.endswith(".ana.gob.pe") or host == "gob.pe" or host.endswith(".gob.pe")))
        or (kind == "senamhi" and (host == "senamhi.gob.pe" or host.endswith(".senamhi.gob.pe") or host == "gob.pe" or host.endswith(".gob.pe")))
        or (kind == "midagri" and (host == "gob.pe" or host.endswith(".gob.pe") or host == "midagri.gob.pe" or host.endswith(".midagri.gob.pe") or host == "siea.midagri.gob.pe"))
    )


def official_records(kind: str, *, today: date | None = None) -> dict:
    """Read a manually reviewed *dated* published record. No made-up live data.

    The operator must have traced the station/market and the document.
    Records remain labelled 'curated', never as a real-time API.
    """
    if kind not in OFFICIAL:
        raise ValueError("Unknown official evidence type")
    info = OFFICIAL[kind]
    result = {"status": "source_only", "source": info, "records": [], "data_quality": "unverified"}
    path = DATA_DIR / f"{kind}.json"
    if not path.is_file():
        return result
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
        url = doc["document_url"]
        checked = date.fromisoformat(doc["reviewed_on"])
        today = today or date.today()
        if checked > today or (today-checked).days > 365 or not _official_document_url(kind,url):
            return result
        if not doc.get("reviewed_by") or not doc.get("location") or doc.get("status") != "reviewed":
            return result
        if doc.get("zone") != "barranca":
            return result
        values = []
        for entry in doc["records"]:
            day = date.fromisoformat(entry["date"])
            value = float(entry["value"])
            if day > today or not math.isfinite(value) or value < 0:
                continue
            if kind == "ana" and entry.get("unit") != "m3/s":
                continue
            if kind == "midagri" and entry.get("unit") != "PEN/kg":
                continue
            if kind == "senamhi":
                # SENAMHI notices must be specifically verified and current.
                if entry.get("unit") != "alert_level" or not (0 <= value <= 3):
                    continue
                until = date.fromisoformat(entry["valid_until"])
                if day > today or until < today or (today - day).days > 7:
                    continue
            values.append({"date": day.isoformat(), "value": value, "unit": entry["unit"],
                           "location": doc["location"], "label": str(entry.get("label", ""))[:100]})
        if not values:
            return result
        return {"status": "curated_record", "source": info, "document_url": url,
                "reviewed_on": checked.isoformat(), "data_quality": "manually_reviewed_not_live",
                "records": sorted(values, key=lambda row: row["date"], reverse=True)[:12],
                "location": doc["location"]}
    except (OSError, TypeError, ValueError, KeyError, json.JSONDecodeError):
        return result


def soil_checks(soil: dict | None, crop_ids: list[str]) -> dict:
    """Never invent thresholds; use only an expert-reviewed range set if supplied."""
    if not soil:
        return {"status": "not_measured", "needs_review": crop_ids}
    if soil.get("source") != "lab_report":
        return {"status": "farmer_reported", "needs_review": crop_ids}
    path = DATA_DIR / "soil_requirements.json"
    if not path.is_file():
        return {"status": "lab_results_without_validated_crop_thresholds",
                "needs_review": crop_ids, "reference_url": FAO_ECOCROP}
    try:
        rules = json.loads(path.read_text(encoding="utf-8"))
        if rules.get("status") != "agronomist_reviewed" or not rules.get("reviewer") or not rules.get("source_url"):
            raise ValueError("unreviewed")
        value = soil.get("ph")
        alerts = []
        checked = []
        for crop_id in crop_ids:
            rule = rules.get("crops", {}).get(crop_id)
            if value is None or not rule or "ph_min" not in rule or "ph_max" not in rule:
                continue
            lo, hi = float(rule["ph_min"]), float(rule["ph_max"])
            if not (0 <= lo < hi <= 14):
                continue
            checked.append(crop_id)
            if not (lo <= float(value) <= hi):
                alerts.append({"crop_id": crop_id, "parameter": "pH",
                               "observed": float(value), "reference_min": lo,
                               "reference_max": hi, "message_es": "El pH medido queda fuera del rango de referencia; se necesita evaluación local."})
        return {"status": "screened_with_expert_reviewed_reference" if checked else "lab_results_without_validated_crop_thresholds",
                "checked_crops": checked, "alerts": alerts, "needs_review": [c for c in crop_ids if c not in checked],
                "reference_url": rules["source_url"]}
    except (OSError, TypeError, ValueError, KeyError, json.JSONDecodeError):
        return {"status": "lab_results_without_validated_crop_thresholds",
                "needs_review": crop_ids, "reference_url": FAO_ECOCROP}


def crop_economic_comparison(strategies: list[dict], budgets: list[dict] | None) -> dict:
    """User-supplied costs, price at farm gate and yield; not an AI price forecast.

    Totals compare the two-year crop calendar per hectare. No extrapolated margin
    if even one planned crop is missing costs/yield/price.
    """
    if not budgets:
        return {"status": "missing_farm_costs", "strategies": []}
    lookup = {x["crop_id"]: x for x in budgets}
    outputs = []
    for option in strategies:
        crops = option["plantings"]
        missing = sorted({c["crop_id"] for c in crops if c["crop_id"] not in lookup})
        if missing:
            outputs.append({"strategy_id": option["id"], "status": "incomplete", "missing_crop_ids": missing})
            continue
        amount = sum(lookup[c["crop_id"]]["yield_kg_ha"] *
                     lookup[c["crop_id"]]["price_soles_kg"] for c in crops)
        costs = sum(lookup[c["crop_id"]]["cost_soles_ha"] for c in crops)
        outputs.append({"strategy_id": option["id"], "status": "estimated_from_farmer_inputs",
                        "revenue_soles_ha_24months": round(amount, 2),
                        "cost_soles_ha_24months": round(costs, 2),
                        "margin_soles_ha_24months": round(amount-costs, 2)})
    return {"status": "estimated_from_farmer_inputs", "unit": "PEN/ha per illustrative 24 months",
            "method": "sum(yield_kg_ha * price_soles_kg - cost_soles_ha) per scheduled planting",
            "source": "farmer_estimate_not_official_market_price_or_profit_prediction",
            "strategies": outputs}


def historic_ana_context() -> dict:
    """Published multi-year river context from an ANA document, NEVER live flow."""
    path = DATA_DIR / "ana_historical_context.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if (data["source_kind"] != "published_historical_reference"
                or not _official_document_url("ana", data["reference_url"])
                or data["agency"] != "Autoridad Nacional del Agua (ANA)"):
            raise ValueError("not official")
        rivers = data["statistics"]
        if {r["river"] for r in rivers} != {"Pativilca", "Supe"}:
            raise ValueError("incorrect rivers")
        if not all(0 <= float(r["average_flow_m3_s"]) <= 10000 for r in rivers):
            raise ValueError("bad historic flow")
        return {"status": "published_historical_reference", **data,
                "use_for_irrigation_allocation": False}
    except (OSError, KeyError, ValueError, TypeError, json.JSONDecodeError):
        return {"status": "unavailable", "use_for_irrigation_allocation": False}


def public_evidence_summary() -> dict:
    return {"basin": official_records("ana"),
            "ana_historical_context": historic_ana_context(),
            "weather_alerts": official_records("senamhi"),
            "market_prices": official_records("midagri"),
            "science": {"soil_reference": FAO_ECOCROP,
                        "water_method": "https://www.fao.org/4/x0490e/x0490e0b.htm",
                        "rain_source": "https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07"}}
