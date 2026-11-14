# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Rotation comparator engine (Field Shift): S0 current vs S1 «Water» vs S2 «Soil».

Reuses the ARIE vocabulary (S0/S1/S2, same-family transitions as a pest-cycle
proxy) but works on a 24-month calendar for irrigated coastal valleys.

Everything is COMPUTED from:
- the team's local crop catalogue (backend/app/data/rotation_crops.json):
  FAO-56 Kc and stage lengths, DRA Lima sowing months, legume, residue class;
- NASA POWER monthly climatology (ET0 FAO-56 Penman-Monteith and Tmax).
No score is hard-coded. All indicators are RELATIVE to the farmer's current
rotation (S0) and are not yield, profit or irrigation prescriptions.

Calendar convention: index 0 = August of year 1 (start of the Peruvian
agricultural campaign), 24 months, treated as a repeating cycle. A month counts
as "covered" when a crop occupies it for at least 15 days.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "rotation_crops.json"
WINDOW_MONTHS = 24
WINDOW_DAYS = 730
MONTH_LEN = WINDOW_DAYS / WINDOW_MONTHS
COVER_MIN_DAYS = 15
MAX_OVERLAP_DAYS = 20
START_CAL_MONTH = 8  # August
MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"]
MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
RESIDUE_SCORE = {"alto": 2, "medio": 1, "bajo": 0}


class RotationError(ValueError):
    """Invalid rotation request (shown to the user, never silently fixed)."""


@lru_cache(maxsize=1)
def load_catalog() -> dict:
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    crops = {c["id"]: c for c in data["crops"]}
    return {"raw": data, "crops": crops, "seasons": data["seasons_costa_lima"]}


def crop(cid: str) -> dict:
    crops = load_catalog()["crops"]
    if cid not in crops:
        raise RotationError(f"Cultivo desconocido: {cid}")
    return crops[cid]


def cal_month(index: int) -> int:
    """Calendar month (1-12) of a window index (0 = August)."""
    return (START_CAL_MONTH - 1 + index) % 12 + 1


def month_start_day(index: int) -> int:
    return round((index % WINDOW_MONTHS) * MONTH_LEN)


def is_perennial(c: dict) -> bool:
    return c["cycle_days"] > 365


def occupancy_months(c: dict, days: int | None = None) -> int:
    if is_perennial(c) and days is None:
        return WINDOW_MONTHS
    return max(1, round((days or c["cycle_days"]) / MONTH_LEN))


def residue_level(c: dict) -> str:
    text = str(c.get("residue_class", "")).lower()
    for key in RESIDUE_SCORE:
        if text.startswith(key):
            return key
    return "medio"


def is_approximate(c: dict) -> bool:
    conf = str(c.get("confidence", "")).lower()
    return "proxy" in conf or "verificar" in conf


def kc_curve(c: dict, days: int | None = None) -> list[float]:
    """Daily FAO-56 single-Kc curve (ini flat, linear dev, mid flat, linear late)."""
    kc_ini, kc_mid, kc_end = c["kc"]
    if is_perennial(c) and days is None:
        # Perennial forage (alfalfa): establishment ramp, then the averaged-cutting mid Kc.
        ini, dev = c["stages_days"][0], c["stages_days"][1]
        curve = [kc_ini] * ini + [kc_ini + (kc_mid - kc_ini) * (d + 1) / dev for d in range(dev)]
        return curve + [kc_mid] * (WINDOW_DAYS - len(curve))
    stages = list(c["stages_days"])
    total = days or c["cycle_days"]
    scale = total / sum(stages)
    ini, dev, mid, late = (max(1, round(s * scale)) for s in stages)
    curve = [kc_ini] * ini
    curve += [kc_ini + (kc_mid - kc_ini) * (d + 1) / dev for d in range(dev)]
    curve += [kc_mid] * mid
    curve += [kc_mid + (kc_end - kc_mid) * (d + 1) / late for d in range(late)]
    return curve[:total] + [kc_end] * max(0, total - len(curve))


def stage_bounds(c: dict, days: int | None = None) -> list[tuple[str, int, int]]:
    stages = list(c["stages_days"])
    total = days or c["cycle_days"]
    if is_perennial(c) and days is None:
        return [("ini", 0, stages[0]), ("dev", stages[0], stages[0] + stages[1]),
                ("mid", stages[0] + stages[1], WINDOW_DAYS)]
    scale = total / sum(stages)
    out, start = [], 0
    for name, s in zip(("ini", "dev", "mid", "late"), stages):
        length = max(1, round(s * scale))
        out.append((name, start, start + length))
        start += length
    return out


def sensitive_window(c: dict, days: int | None = None) -> tuple[int, int] | None:
    """Heat-sensitive window derived from the catalogue's text label.

    'tolerante' / 'baja sensibilidad' -> none; 'muy sensible' -> development
    plus mid-season; otherwise the first 45 days of mid-season (flowering,
    tuber initiation, bulbing, head formation, root bulking start).
    """
    label = str(c.get("heat_sensitive_stage", "")).lower()
    if not label or "tolerante" in label or "baja sensibilidad" in label or is_perennial(c):
        return None
    bounds = {name: (a, b) for name, a, b in stage_bounds(c, days)}
    if "muy sensible" in label:
        return bounds["dev"][0], bounds["mid"][1]
    a, b = bounds["mid"]
    return a, min(b, a + 45)


# --------------------------------------------------------------------------- #
# Simulation of one rotation
# --------------------------------------------------------------------------- #
def normalize_plantings(raw: list[dict]) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        raise RotationError("La rotación no tiene cultivos.")
    if len(raw) > 10:
        raise RotationError("Máximo 10 cultivos en 24 meses.")
    out = []
    for p in raw:
        c = crop(str(p.get("crop_id")))
        start = p.get("start_index")
        if isinstance(start, bool) or not isinstance(start, int) or not 0 <= start < WINDOW_MONTHS:
            raise RotationError("start_index debe ser un mes entre 0 (agosto, año 1) y 23.")
        days = p.get("days")
        if days is not None:
            if isinstance(days, bool) or not isinstance(days, int) or not 30 <= days <= WINDOW_DAYS:
                raise RotationError("days debe estar entre 30 y 730.")
        out.append({"crop_id": c["id"], "start_index": start, "days": days})
    return sorted(out, key=lambda p: p["start_index"])


def fit_to_cycle(plantings: list[dict]) -> list[dict]:
    """For the farmer's CURRENT rotation only: when a confirmed campaign starts
    before the previous crop's catalogue cycle ends, shorten the previous crop
    to the observed gap (the satellite saw the field change). Marked adjusted."""
    out = [dict(p) for p in plantings]
    for k, p in enumerate(out):
        nxt = out[(k + 1) % len(out)]
        gap_months = (nxt["start_index"] - p["start_index"]) % WINDOW_MONTHS or WINDOW_MONTHS
        c = crop(p["crop_id"])
        if len(out) > 1 and occupancy_months(c, p["days"]) > gap_months:
            p["days"] = max(30, int(gap_months * MONTH_LEN))
            p["adjusted_to_observed_gap"] = True
    return out


def simulate(plantings: list[dict], climate: dict) -> dict:
    """Day-level cyclic simulation over 730 days; returns monthly timeline + indicators."""
    seasons = load_catalog()["seasons"]
    low_river = set(seasons["river_low_months"])
    hot = set(climate["hot_months"])
    et0_day = {m["month"]: m["et0_mm_day"] for m in climate["months"]}
    day_crop: list[int | None] = [None] * WINDOW_DAYS
    day_kc = [0.0] * WINDOW_DAYS
    day_stage: list[str | None] = [None] * WINDOW_DAYS
    overlap = 0
    heat_hits = []
    for n, p in enumerate(plantings):
        c = crop(p["crop_id"])
        curve = kc_curve(c, p["days"])
        bounds = stage_bounds(c, p["days"])
        d0 = month_start_day(p["start_index"])
        for d, kc in enumerate(curve[:WINDOW_DAYS]):
            day = (d0 + d) % WINDOW_DAYS
            if day_crop[day] is not None and day_crop[day] != n:
                overlap += 1
                if kc <= day_kc[day]:
                    continue
            day_crop[day], day_kc[day] = n, kc
            day_stage[day] = next((s for s, a, b in bounds if a <= d < b), "late")
        window = sensitive_window(c, p["days"])
        if window:
            months = [cal_month(int(((d0 + d) % WINDOW_DAYS) // MONTH_LEN)) for d in range(*window)]
            in_hot = sum(m in hot for m in months)
            if in_hot * 2 >= len(months):
                heat_hits.append({"crop_id": c["id"], "name_es": c["name_es"], "stage": c["heat_sensitive_stage"],
                                  "months": sorted(set(m for m in months if m in hot))})
    if overlap > MAX_OVERLAP_DAYS * max(1, len(plantings)):
        raise RotationError("Los cultivos se superponen demasiado en el calendario.")
    timeline = []
    for i in range(WINDOW_MONTHS):
        a, b = month_start_day(i), month_start_day(i + 1) if i + 1 < WINDOW_MONTHS else WINDOW_DAYS
        cm = cal_month(i)
        counts: dict[int, int] = {}
        water = 0.0
        for day in range(a, b):
            if day_crop[day] is not None:
                counts[day_crop[day]] = counts.get(day_crop[day], 0) + 1
                water += day_kc[day] * et0_day[cm]
        main = max(counts, key=counts.get) if counts else None
        covered = bool(counts) and sum(counts.values()) >= COVER_MIN_DAYS
        stages = [day_stage[d] for d in range(a, b) if day_crop[d] == main] if main is not None else []
        timeline.append({
            "index": i, "calendar_month": cm, "year": 1 + i // 12,
            "crop_id": plantings[main]["crop_id"] if covered else None,
            "stage": max(set(stages), key=stages.count) if covered and stages else None,
            "kc_mean": round(sum(day_kc[a:b]) / (b - a), 2),
            "water_mm": round(water, 1), "covered": covered,
            "low_river": cm in low_river, "hot": cm in hot,
        })
    families = [crop(p["crop_id"])["family"] for p in plantings]
    same_family = (sum(families[k] == families[(k + 1) % len(families)] for k in range(len(families)))
                   if len(families) > 1 else 0)
    legumes = [p["crop_id"] for p in plantings if crop(p["crop_id"])["nitrogen_fixer"]]
    residues = [residue_level(crop(p["crop_id"])) for p in plantings]
    total = sum(m["water_mm"] for m in timeline)
    low = sum(m["water_mm"] for m in timeline if m["low_river"])
    return {
        "timeline": timeline,
        "indicators": {
            "water_total_mm": round(total, 0),
            "water_low_river_mm": round(low, 0),
            "water_low_river_share_percent": round(100 * low / total, 1) if total else 0.0,
            "bare_months": sum(not m["covered"] for m in timeline),
            "bare_months_low_river": sum((not m["covered"]) and m["low_river"] for m in timeline),
            "legume_plantings": len(legumes),
            "legumes_per_year": len(legumes) / 2,
            "distinct_families": len(set(families)),
            "same_family_consecutive": same_family,
            "heat_sensitive_hits": heat_hits,
            "residue_score": round(sum(RESIDUE_SCORE[r] for r in residues) / len(residues), 2),
            "approximate_crops": sorted({p["crop_id"] for p in plantings if is_approximate(crop(p["crop_id"]))}),
        },
    }


CAL_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def low_river_share(crop_id: str, sow_month: int, climate: dict, sow_day: int = 15) -> dict:
    """Share of ONE campaign's crop water (Kc x ET0) that falls in low-river months.

    Uses a real day calendar and a mid-month sowing date (default day 15), the
    convention of the team's verification note (09-verificacion-agua-y-calor.md, 2b),
    e.g. maize sown on 15 Feb vs 15 Mar. Relative estimate, not a prescription.
    """
    c = crop(crop_id)
    low = set(load_catalog()["seasons"]["river_low_months"])
    et0 = {m["month"]: m["et0_mm_day"] for m in climate["months"]}
    month, day = sow_month, sow_day
    total = in_low = 0.0
    for kc in kc_curve(c)[:365]:
        water = kc * et0[month]
        total += water
        in_low += water if month in low else 0.0
        day += 1
        if day > CAL_DAYS[month - 1]:
            day, month = 1, month % 12 + 1
    return {"crop_id": crop_id, "sow_month": sow_month, "sow_day": sow_day,
            "water_mm": round(total, 0),
            "low_river_share_percent": round(100 * in_low / total, 0) if total else 0.0}


def maize_water_phrases(plantings: list[dict], climate: dict) -> tuple[list[str], list[str]]:
    """«X % del agua de tu maíz cae cuando el río baja» for each maize campaign."""
    es, en = [], []
    seen = set()
    for p in plantings:
        if p["crop_id"] != "maiz_amarillo_duro":
            continue
        m = cal_month(p["start_index"])
        if m in seen:
            continue
        seen.add(m)
        share = low_river_share(p["crop_id"], m, climate)
        es.append(f"{share['low_river_share_percent']:.0f} % del agua de tu maíz sembrado en {MONTH_ES[m - 1]} cae cuando el río baja (may–nov).")
        en.append(f"{share['low_river_share_percent']:.0f}% of the water of your maize sown in {MONTH_EN[m - 1]} falls when the river is low (May–Nov).")
    return es, en

# --------------------------------------------------------------------------- #
# Constrained search for S1 / S2
# --------------------------------------------------------------------------- #
BASE_WEIGHTS = {
    "water": {"low": 8.0, "total": 0.5, "bare": 0.3, "legume": 0.3, "residue": 0.3, "pests": 0.6, "heat": 0.5},
    "soil": {"low": 0.6, "total": 0.3, "bare": 1.5, "legume": 1.5, "residue": 0.8, "pests": 1.0, "heat": 0.5},
}


def weights_for(profile: str, priorities: dict, water_turn: str) -> dict:
    w = dict(BASE_WEIGHTS[profile])
    f = lambda key: 0.5 + 0.5 * priorities.get(key, 1)
    w["low"] *= f("water"); w["total"] *= f("water")
    w["bare"] *= f("soil"); w["legume"] *= f("soil"); w["residue"] *= f("soil")
    w["pests"] *= f("pests")
    if water_turn == "escaso":
        w["low"] *= 1.5
    return w


def _single_cost_table(climate: dict) -> dict:
    """Water/heat of each crop sown at each window month, via the same simulator."""
    table = {}
    for cid, c in load_catalog()["crops"].items():
        if is_perennial(c):
            continue
        for s in range(WINDOW_MONTHS):
            sim = simulate([{"crop_id": cid, "start_index": s, "days": None}], climate)
            ind = sim["indicators"]
            table[(cid, s)] = (ind["water_low_river_mm"], ind["water_total_mm"],
                               bool(ind["heat_sensitive_hits"]))
    return table


def search(profile: str, climate: dict, ref: dict, income_crop: str, priorities: dict,
           water_turn: str, avoid: set | None = None, max_bare: int = WINDOW_MONTHS) -> list[dict] | None:
    """Exact DP over (month, last crop, income count, legume count, first family, bare months).

    Two anchors (August, January). ``max_bare`` is a hard cap on bare months.
    """
    w = weights_for(profile, priorities, water_turn)
    crops = {cid: c for cid, c in load_catalog()["crops"].items() if not is_perennial(c)}
    table = _cost_cache(climate, ref)
    need_income = 0 if priorities.get("income", 1) == 0 else (2 if priorities.get("income", 1) >= 2 else 1)
    avoid = avoid or set()
    track_bare = max_bare < WINDOW_MONTHS
    info = {cid: (occupancy_months(c), set(c["sowing_months_lima"]), c["family"], bool(c["nitrogen_fixer"]),
                  w["residue"] * (2 - RESIDUE_SCORE[residue_level(c)]) / 2) for cid, c in crops.items()}
    best: tuple[float, list] | None = None
    for anchor in (0, 5):
        memo: dict = {}

        def f(pos: int, last: str | None, inc: int, leg: int, first: str | None, bare: int):
            key = (pos, last, inc, leg, first, bare)
            if key in memo:
                return memo[key]
            options = []
            if inc >= need_income and last is not None and bare + WINDOW_MONTHS - pos <= max_bare:
                # Closing the 24-month cycle: last crop is followed by the first one again.
                wrap = w["pests"] if first and info[last][2] == first else 0
                options.append((w["bare"] * (WINDOW_MONTHS - pos) + w["legume"] * max(0, 2 - leg) + wrap, []))
            for gap in (0, 1, 2):
                s = pos + gap
                if s >= WINDOW_MONTHS or bare + gap > max_bare:
                    break
                cm = cal_month(anchor + s)
                for cid, (length, sowing, family, legume, residue_cost) in info.items():
                    if cid == last or cm not in sowing or s + length > WINDOW_MONTHS:
                        continue
                    abs_start = (anchor + s) % WINDOW_MONTHS
                    low, tot, heat = table[(cid, abs_start)]
                    low, tot = low / ref["low"], tot / ref["total"]
                    cost = (w["bare"] * gap + w["low"] * low + w["total"] * tot +
                            w["heat"] * heat + residue_cost +
                            (w["pests"] if last and info[last][2] == family else 0) +
                            (0.8 if (cid, abs_start) in avoid else 0))
                    nxt = f(s + length, cid, min(2, inc + (cid == income_crop)),
                            min(2, leg + legume), first or family, bare + gap if track_bare else 0)
                    if nxt is not None:
                        options.append((cost + nxt[0], [(cid, abs_start)] + nxt[1]))
            memo[key] = min(options, key=lambda o: o[0]) if options else None
            return memo[key]

        result = f(0, None, 0, 0, None, 0)
        if result and result[1] and (best is None or result[0] < best[0]):
            best = result
    if not best:
        return None
    return [{"crop_id": cid, "start_index": s, "days": None} for cid, s in best[1]]


_COST_CACHE: dict = {}


def _cost_cache(climate: dict, ref: dict) -> dict:
    key = (tuple(m["et0_mm_day"] for m in climate["months"]), tuple(climate["hot_months"]))
    if key not in _COST_CACHE:
        if len(_COST_CACHE) > 16:
            _COST_CACHE.clear()
        _COST_CACHE[key] = _single_cost_table(climate)
    return _COST_CACHE[key]


# --------------------------------------------------------------------------- #
# Explanations (5 sections, ES/EN)
# --------------------------------------------------------------------------- #
def _months(ms, lang):
    names = MONTH_ES if lang == "es" else MONTH_EN
    return ", ".join(names[m - 1] for m in sorted(set(ms))) or ("—")


def _pct(a: float, b: float) -> float | None:
    return round(100 * (a - b) / b, 0) if b else None


def describe_plantings(plantings: list[dict]) -> list[dict]:
    out = []
    for p in plantings:
        c = crop(p["crop_id"])
        months = occupancy_months(c, p["days"])
        out.append({
            "crop_id": c["id"], "name_es": c["name_es"], "family": c["family"],
            "legume": c["nitrogen_fixer"], "start_index": p["start_index"],
            "start_calendar_month": cal_month(p["start_index"]),
            "end_calendar_month": cal_month(p["start_index"] + months - 1),
            "months": months, "cycle_days": p["days"] or c["cycle_days"],
            "sowing_month_in_catalog": cal_month(p["start_index"]) in c["sowing_months_lima"],
            "approximate": is_approximate(c), "confidence": c.get("confidence"),
            "adjusted_to_observed_gap": bool(p.get("adjusted_to_observed_gap")),
            "market": c.get("market"), "heat_sensitive_stage": c.get("heat_sensitive_stage"),
        })
    return out


def sections(key: str, ind: dict, base: dict | None, plantings: list[dict], climate: dict,
             history: dict | None, water_turn: str) -> dict:
    seasons = load_catalog()["seasons"]
    low_es, low_en = _months(seasons["river_low_months"], "es"), _months(seasons["river_low_months"], "en")
    names = [crop(p["crop_id"])["name_es"] for p in plantings]
    peak = sorted(ind["_timeline"], key=lambda m: -m["water_mm"])[:3]
    peak_es, peak_en = _months([m["calendar_month"] for m in peak], "es"), _months([m["calendar_month"] for m in peak], "en")
    hist_es = (f"Historial estimado por satélite ({history.get('sensor', 'HLS/Sentinel-2')}) de {history.get('start', '?')} a {history.get('end', '?')}, "
               f"{history.get('months_with_data', '?')} meses con dato." if history else
               "Sin historial satelital adjunto: la rotación actual es la declarada por el agricultor.")
    hist_en = (f"Satellite-estimated history ({history.get('sensor', 'HLS/Sentinel-2')}) from {history.get('start', '?')} to {history.get('end', '?')}, "
               f"{history.get('months_with_data', '?')} months with data." if history else
               "No satellite history attached: the current rotation is the one declared by the farmer.")
    evidence_es = [hist_es,
                   f"Clima NASA POWER ({climate['period']}); ET0 FAO-56 Penman-Monteith: {climate['annual_et0_mm']:.0f} mm/año en la malla de la zona.",
                   "Coeficientes de cultivo (Kc) y etapas: FAO-56, Tablas 11 y 12.",
                   "Meses de siembra: DRA Lima / MIDAGRI, campaña 2024-2025 (departamento de Lima).",
                   f"Meses de río bajo (estiaje): {low_es} (DRA Lima; por confirmar con caudales ANA)."]
    evidence_en = [hist_en,
                   f"NASA POWER climate ({climate['period']}); FAO-56 Penman-Monteith ET0: {climate['annual_et0_mm']:.0f} mm/yr for the zone grid cell.",
                   "Crop coefficients (Kc) and stages: FAO-56, Tables 11 and 12.",
                   "Sowing months: DRA Lima / MIDAGRI, 2024-2025 season (Lima department).",
                   f"Low-river months: {low_en} (DRA Lima; to be confirmed with ANA river flows)."]
    gaps_es = ["No conocemos el análisis de suelo de tu terreno.",
               "No conocemos tu turno de riego real ni el caudal que te toca." if water_turn != "escaso" else
               "Nos dijiste que tu turno de agua suele ser escaso entre mayo y noviembre; no conocemos el caudal exacto.",
               "No sabemos la variedad que usas ni el precio de la próxima campaña.",
               "El clima es una estimación regional de NASA POWER (malla de ~50 km), no una estación en tu chacra."]
    gaps_en = ["We do not know your field's soil test.",
               "We do not know your real irrigation turn or flow." if water_turn != "escaso" else
               "You told us your water turn is usually scarce from May to November; we do not know the exact flow.",
               "We do not know your variety or next season's price.",
               "Climate is a regional NASA POWER estimate (~50 km grid), not a station on your field."]
    approx = [crop(c)["name_es"] for c in ind["approximate_crops"]]
    if approx:
        gaps_es.append("Datos aproximados (proxy o por verificar) para: " + ", ".join(approx) + ".")
        gaps_en.append("Approximate data (proxy or to verify) for: " + ", ".join(approx) + ".")
    risks_es, risks_en = [], []

    risks_es += ["Plagas y enfermedades propias de cada cultivo nuevo.", "Salinidad del suelo y calidad del agua.",
                 "Si hay comprador para cada cosecha (mercado).", "Maquinaria, semilla y mano de obra disponibles."]
    risks_en += ["Pests and diseases specific to each new crop.", "Soil salinity and water quality.",
                 "Whether there is a buyer for each harvest (market).", "Available machinery, seed and labour."]
    for hit in ind["heat_sensitive_hits"]:
        risks_es.append(f"{hit['name_es']}: su etapa sensible ({hit['stage']}) cae en los meses más cálidos de la zona ({_months(hit['months'], 'es')}).")
        risks_en.append(f"{hit['name_es']}: its sensitive stage ({hit['stage']}) falls in the zone's warmest months ({_months(hit['months'], 'en')}).")
    if ind["same_family_consecutive"]:
        risks_es.append(f"Repite la misma familia {ind['same_family_consecutive']} vez/veces seguidas: puede mantener plagas del suelo.")
        risks_en.append(f"Same botanical family repeated {ind['same_family_consecutive']} time(s) in a row: soil pests may persist.")

    if key == "current" or base is None:
        why_es = [f"Es lo que haces hoy: {', '.join(names)}.",
                  f"Tu terreno queda sin cultivo {ind['bare_months']} de 24 meses ({ind['bare_months_low_river']} en estiaje).",
                  f"El mayor consumo de agua del cultivo cae en {peak_es}; el estiaje es {low_es}.",
                  f"{ind['water_low_river_share_percent']:.0f} % del agua del cultivo se pide en meses de río bajo."]
        why_en = [f"This is what you do today: {', '.join(names)}.",
                  f"Your field is left without a crop {ind['bare_months']} of 24 months ({ind['bare_months_low_river']} in the low-river season).",
                  f"Peak crop water use falls in {peak_en}; the low-river season is {low_en}.",
                  f"{ind['water_low_river_share_percent']:.0f}% of crop water is needed in low-river months."]
        maize_es, maize_en = maize_water_phrases(plantings, climate)
        why_es += maize_es
        why_en += maize_en
        benefits_es = ["Es la referencia para comparar: no se calculan beneficios sobre sí misma."]
        benefits_en = ["This is the reference for comparison: no benefits are computed against itself."]
    else:
        dlow = _pct(ind["water_low_river_mm"], base["water_low_river_mm"])
        dtot = _pct(ind["water_total_mm"], base["water_total_mm"])
        dbare = base["bare_months"] - ind["bare_months"]
        if key == "water":
            why_es = [f"Atiende tu prioridad de gastar menos agua cuando el río baja ({low_es}).",
                      f"Hoy el mayor consumo de agua cae en {_months([m['calendar_month'] for m in sorted(base['_timeline'], key=lambda m: -m['water_mm'])[:3]], 'es')}; esta idea mueve las campañas de más sed hacia los meses de avenida o usa cultivos de menor demanda."]
            why_en = [f"Addresses your priority of using less water when the river is low ({low_en}).",
                      f"Today, peak water use falls in {_months([m['calendar_month'] for m in sorted(base['_timeline'], key=lambda m: -m['water_mm'])[:3]], 'en')}; this idea moves the thirstiest campaigns to high-river months or uses lower-demand crops."]
        else:
            why_es = [f"Atiende tu prioridad de cuidar el suelo: hoy queda sin cubierta {base['bare_months']} de 24 meses.",
                      "Incluye leguminosas que dejan nitrógeno y alterna familias para cortar plagas."]
            why_en = [f"Addresses your priority of caring for the soil: today it is bare {base['bare_months']} of 24 months.",
                      "Includes nitrogen-fixing legumes and alternates families to break pest cycles."]
        benefits_es, benefits_en = [], []
        if dlow is not None:
            word_es = "menos" if dlow < 0 else "más"
            word_en = "less" if dlow < 0 else "more"
            benefits_es.append(f"{abs(dlow):.0f} % {word_es} agua del cultivo entre mayo y noviembre que lo que haces hoy (cálculo relativo).")
            benefits_en.append(f"{abs(dlow):.0f}% {word_en} crop water from May to November than today (relative estimate).")
        if dtot is not None:
            benefits_es.append(f"Agua total en 24 meses: {dtot:+.0f} % frente a hoy.")
            benefits_en.append(f"Total water over 24 months: {dtot:+.0f}% vs today.")
        if dbare > 0:
            benefits_es.append(f"{dbare} meses más con el suelo cubierto en 24 meses.")
            benefits_en.append(f"{dbare} more months with covered soil over 24 months.")
        elif dbare < 0:
            benefits_es.append(f"Ojo: {-dbare} meses más sin cubierta que hoy (descanso en estiaje).")
            benefits_en.append(f"Note: {-dbare} more bare months than today (rest during the low-river season).")
        if ind["legume_plantings"]:
            benefits_es.append(f"{ind['legume_plantings']} siembra(s) de leguminosa en 24 meses: dejan nitrógeno al siguiente cultivo.")
            benefits_en.append(f"{ind['legume_plantings']} legume planting(s) in 24 months: they leave nitrogen for the next crop.")
        if ind["same_family_consecutive"] < base["same_family_consecutive"]:
            benefits_es.append("Menos repeticiones de la misma familia: ayuda a cortar plagas.")
            benefits_en.append("Fewer same-family repeats: helps break pest cycles.")
    if key in ("current", "water"):
        maize_es, maize_en = maize_water_phrases(plantings, climate)
        if maize_es:
            evidence_es += [x.replace("tu maíz", "el maíz") for x in maize_es] + [
                "Siembra a mitad de mes; el mismo maíz puede tomar ¼ o ¾ de su agua en estiaje según el mes de siembra (ET0 de NASA POWER, Kc FAO-56)."]
            evidence_en += [x.replace("your maize", "maize") for x in maize_en] + [
                "Mid-month sowing; the same maize can take ¼ or ¾ of its water in the low-river season depending on the sowing month (NASA POWER ET0, FAO-56 Kc)."]
    return {
        "why": {"es": why_es, "en": why_en},
        "evidence": {"es": evidence_es, "en": evidence_en},
        "benefits": {"es": benefits_es, "en": benefits_en},
        "gaps": {"es": gaps_es, "en": gaps_en},
        "risks": {"es": risks_es, "en": risks_en},
    }


def icons(ind: dict, base: dict | None) -> dict:
    def cmp(a, b, lower_better=True):
        if base is None:
            return "reference"
        if abs(a - b) < 1e-9:
            return "same"
        return "better" if (a < b) == lower_better else "worse"
    return {
        "water": cmp(ind["water_low_river_mm"], base["water_low_river_mm"]) if base else "reference",
        "soil_cover": cmp(ind["bare_months"], base["bare_months"]) if base else "reference",
        "nitrogen": "yes" if ind["legume_plantings"] else "no",
        "pests": "ok" if ind["same_family_consecutive"] == 0 else "repeat",
        "heat": "alert" if ind["heat_sensitive_hits"] else "ok",
    }


TITLES = {
    "current": ("S0", "Lo que haces hoy", "What you do today"),
    "water": ("S1", "Idea 1: gasta menos agua cuando el río baja", "Idea 1: use less water when the river is low"),
    "soil": ("S2", "Idea 2: tu suelo siempre cubierto", "Idea 2: keep your soil always covered"),
}


def _strategy(key: str, plantings: list[dict], climate: dict, base: dict | None,
              history: dict | None, water_turn: str, origin: str) -> dict:
    sim = simulate(plantings, climate)
    ind = sim["indicators"]
    ind_with_tl = {**ind, "_timeline": sim["timeline"]}
    sid, es, en = TITLES[key]
    relative = None
    if base is not None:
        relative = {
            "water_low_river_change_percent": _pct(ind["water_low_river_mm"], base["water_low_river_mm"]),
            "water_total_change_percent": _pct(ind["water_total_mm"], base["water_total_mm"]),
            "bare_months_change": ind["bare_months"] - base["bare_months"],
            "legume_plantings_change": ind["legume_plantings"] - base["legume_plantings"],
        }
    return {
        "id": sid, "key": key, "title_es": es, "title_en": en, "origin": origin,
        "plantings": describe_plantings(plantings),
        "timeline": sim["timeline"],
        "indicators": ind, "relative_to_current": relative,
        "icons": icons(ind, base),
        "sections": sections(key, ind_with_tl, base, plantings, climate, history, water_turn),
    }


def compare(current: list[dict], climate: dict, *, priorities: dict | None = None,
            water_turn: str = "normal", history: dict | None = None,
            current_origin: str = "farmer_declared",
            fallback: dict | None = None) -> dict:
    priorities = {k: int(v) for k, v in (priorities or {}).items() if k in ("water", "soil", "income", "pests")}
    for k, v in priorities.items():
        if not 0 <= v <= 2:
            raise RotationError("Las prioridades van de 0 a 2.")
    if water_turn not in ("normal", "escaso", "no_se"):
        raise RotationError("water_turn debe ser normal, escaso o no_se.")
    if current_origin not in ("farmer_declared", "satellite_confirmed", "team_demo"):
        raise RotationError("Origen de rotación actual desconocido.")
    s0 = fit_to_cycle(normalize_plantings(current))
    base_sim = simulate(s0, climate)
    base = {**base_sim["indicators"], "_timeline": base_sim["timeline"]}
    income_crop = max((p["crop_id"] for p in s0),
                      key=lambda cid: (cid == "maiz_amarillo_duro", sum(p["crop_id"] == cid for p in s0)))
    ref = {"low": max(base["water_low_river_mm"], 50.0), "total": max(base["water_total_mm"], 100.0)}
    strategies = [_strategy("current", s0, climate, None, history, water_turn, current_origin)]
    # S1 may not leave the field bare longer than today (at least 2 months allowed).
    s1 = search("water", climate, ref, income_crop, priorities, water_turn,
                max_bare=max(base["bare_months"], 2))
    s2 = search("soil", climate, ref, income_crop, priorities, water_turn,
                avoid={(p["crop_id"], p["start_index"]) for p in (s1 or [])})
    status = "available"
    for key, plan in (("water", s1), ("soil", s2)):
        origin = "constrained_search"
        if plan is None and fallback and fallback.get(key):
            plan, origin = normalize_plantings(fallback[key]), "team_template"
        if plan is None:
            status = "partial"
            continue
        strategies.append(_strategy(key, plan, climate, base, history, water_turn, origin))
    seasons = load_catalog()["seasons"]
    return {
        "status": status,
        "income_crop": income_crop,
        "priorities": {"water": 1, "soil": 1, "income": 1, "pests": 1, **priorities},
        "water_turn": water_turn,
        "window": {
            "start_calendar_month": START_CAL_MONTH, "months": WINDOW_MONTHS,
            "convention": "index 0 = August of year 1; the 24-month plan repeats as a cycle; a month is covered when a crop occupies ≥15 days",
            "context": [{"index": i, "calendar_month": cal_month(i), "year": 1 + i // 12,
                         "low_river": cal_month(i) in seasons["river_low_months"],
                         "hot": cal_month(i) in climate["hot_months"],
                         "et0_mm_month": next(m["et0_mm_month"] for m in climate["months"] if m["month"] == cal_month(i)),
                         "tmax_c": next(m["tmax_c"] for m in climate["months"] if m["month"] == cal_month(i))}
                        for i in range(WINDOW_MONTHS)],
        },
        "climate": {k: climate[k] for k in ("source", "source_url", "period", "hot_months", "annual_et0_mm",
                                            "tmax_seasonal_range_c", "limitations", "limitations_en", "method",
                                            "cell_adjustment", "power_grid_elevation_m")},
        "strategies": strategies,
        "method": {
            "water": "Σ Kc(day) × ET0(month) over 730 days (FAO-56 single Kc; Kc from the team catalogue; ET0 FAO-56 Penman-Monteith from NASA POWER climatology). Bare-soil evaporation is not counted.",
            "search": "Exact dynamic programming over months: sowing only in DRA Lima sowing months, crop cycles from the catalogue, no crop repeated back-to-back, keeps the farmer's income crop; weights from the farmer's priorities. Perennial alfalfa is not proposed automatically.",
            "heat": "A crop is flagged when most of its heat-sensitive window (from the catalogue label) falls in the zone's 3 warmest POWER months.",
            "relative_only": True,
        },
        "disclaimer_es": "Son ideas para conversar, no órdenes. Revísalas con un técnico de la Agencia Agraria o de tu Junta de Usuarios antes de decidir.",
        "disclaimer_en": "These are ideas to discuss, not instructions. Review them with a technician from the Agrarian Agency or your Water Users' Board before deciding.",
    }


TEMPLATES = {
    # From ../analisis-challenge/07-rotaciones-demo-y-terrenos.md (index 0 = August, year 1).
    "current": [{"crop_id": "maiz_amarillo_duro", "start_index": 0}, {"crop_id": "maiz_amarillo_duro", "start_index": 7},
                {"crop_id": "maiz_amarillo_duro", "start_index": 13}, {"crop_id": "maiz_amarillo_duro", "start_index": 19}],
    "water": [{"crop_id": "brocoli_col", "start_index": 2}, {"crop_id": "maiz_amarillo_duro", "start_index": 5},
              {"crop_id": "frijol_grano_seco", "start_index": 10}, {"crop_id": "brocoli_col", "start_index": 14},
              {"crop_id": "maiz_amarillo_duro", "start_index": 17}, {"crop_id": "frijol_grano_seco", "start_index": 22}],
    "soil": [{"crop_id": "maiz_amarillo_duro", "start_index": 0}, {"crop_id": "frijol_castilla", "start_index": 5},
             {"crop_id": "zanahoria", "start_index": 8}, {"crop_id": "vainita", "start_index": 12},
             {"crop_id": "maiz_amarillo_duro", "start_index": 15}, {"crop_id": "zanahoria", "start_index": 20}],
}
