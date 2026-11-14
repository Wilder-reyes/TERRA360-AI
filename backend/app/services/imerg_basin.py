# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""«Agua que viene»: GPM IMERG monthly rainfall over the UPPER basin of each valley.

On the desert coast it almost never rains; irrigation water comes from rain in
the Andean headwaters. This module summarises NASA GPM IMERG Final Run monthly
precipitation (GPM_3IMERGM v07, 0.1°) averaged over an approximate upper-basin
box (rotation_zones.ZONES[...]["upper_basin"]["bbox"], NOT an official ANA
watershed) into:
  - a monthly climatology (mm/month) over the available years;
  - recent seasons (Sep-Aug) compared with that climatology (% of normal).

IMERG requires a NASA Earthdata token, so the summary is computed offline by
``scripts/precompute_imerg_basins.py`` and committed as
``backend/app/data/imerg_basin_seed.json``. Without that file the API abstains.
Rainfall in the headwaters is CONTEXT for the low-river season; it is not the
river flow (ANA) and not water available to a given farmer.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

import numpy as np

SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "imerg_basin_seed.json"
PRODUCT = "GPM_3IMERGM"
VERSION = "07"
DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def box_mean_mm_month(precip_mm_hr: np.ndarray, lons: np.ndarray, lats: np.ndarray,
                      bbox: list[float], month: int) -> float | None:
    """Mean monthly rainfall (mm/month) of IMERG cells whose centre is in bbox.

    IMERG monthly ``precipitation`` is a mean rate in mm/hr with dims (lon, lat)
    after selecting the single time step; negative/fill values are rejected.
    Cells are weighted by cos(latitude) (equal-angle grid).
    """
    west, south, east, north = bbox
    xi = np.where((lons >= west) & (lons <= east))[0]
    yi = np.where((lats >= south) & (lats <= north))[0]
    if not len(xi) or not len(yi):
        return None
    block = np.asarray(precip_mm_hr, dtype=np.float64)[np.ix_(xi, yi)]
    weights = np.broadcast_to(np.cos(np.radians(lats[yi]))[None, :], block.shape)
    valid = np.isfinite(block) & (block >= 0)
    if valid.sum() < max(1, 0.5 * block.size):
        return None
    rate = float((block[valid] * weights[valid]).sum() / weights[valid].sum())
    return round(rate * 24 * DAYS[month - 1], 1)


def summarise(series: dict[str, float | None], min_years: int = 10) -> dict:
    """series: {"YYYY-MM": mm/month or None} → climatology + recent seasons."""
    by_month: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    for ym, v in series.items():
        if v is not None and math.isfinite(v):
            by_month[int(ym[5:7])].append(v)
    years = sorted({ym[:4] for ym, v in series.items() if v is not None})
    clim = {m: (round(sum(v) / len(v), 1) if len(v) >= min_years else None) for m, v in by_month.items()}
    seasons = []
    for start in sorted({int(y) for y in years}):
        months = [f"{start}-{m:02d}" for m in range(9, 13)] + [f"{start + 1}-{m:02d}" for m in range(1, 9)]
        vals = [series.get(ym) for ym in months]
        if any(v is None for v in vals) or any(clim[int(ym[5:7])] is None for ym in months):
            continue
        total = sum(vals)
        normal = sum(clim[int(ym[5:7])] for ym in months)
        seasons.append({"season": f"{start}-{start + 1}", "rain_mm": round(total, 0),
                        "percent_of_normal": round(100 * total / normal, 0) if normal else None})
    return {"climatology_mm_month": clim, "years": [years[0], years[-1]] if years else None,
            "years_count": len(years), "seasons": seasons[-5:]}


def load_seed() -> dict | None:
    try:
        return json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def basin_context(zone_id: str | None) -> dict:
    """What the API/UI shows; abstains clearly when no IMERG summary exists."""
    seed = load_seed()
    if not zone_id or not seed or zone_id not in seed.get("zones", {}):
        return {"status": "unavailable",
                "message_es": "Lluvia de la sierra (GPM IMERG) aún no calculada para esta zona: requiere una cuenta NASA Earthdata.",
                "message_en": "Headwater rainfall (GPM IMERG) not yet computed for this zone: it requires a NASA Earthdata account."}
    z = seed["zones"][zone_id]
    last = z["seasons"][-1] if z.get("seasons") else None
    return {"status": "available", "source": f"NASA GPM IMERG Final Run monthly ({PRODUCT} v{VERSION}, 0.1°)",
            "computed_at": seed.get("computed_at"), "basin_es": z["basin_es"], "basin_en": z["basin_en"],
            "bbox": z["bbox"], "years": z["years"], "years_count": z["years_count"],
            "climatology_mm_month": z["climatology_mm_month"], "seasons": z["seasons"], "last_season": last,
            "note_es": "Lluvia en la cabecera de cuenca (rectángulo aproximado). Es contexto: no es el caudal del río ni tu turno de agua.",
            "note_en": "Rainfall in the headwaters (approximate box). It is context: not the river flow nor your water turn."}


def iter_granule_values(paths_or_files: Iterable, bbox: list[float]) -> Iterable[tuple[str, float | None]]:
    """Read IMERG monthly HDF5 granules (paths or earthaccess file objects)."""
    import h5py  # local import: only needed by the precompute script
    for f in paths_or_files:
        with h5py.File(f, "r") as h5:
            grid = h5["Grid"]
            lons, lats = grid["lon"][:], grid["lat"][:]
            west, south, east, north = bbox
            xi = np.where((lons >= west) & (lons <= east))[0]
            yi = np.where((lats >= south) & (lats <= north))[0]
            data = grid["precipitation"][0, xi.min():xi.max() + 1, yi.min():yi.max() + 1]
            name = getattr(f, "path", None) or getattr(f, "full_name", None) or str(f)
            start = str(name).split("3IMERG.")[1][:8]  # YYYYMMDD
            ym = f"{start[:4]}-{start[4:6]}"
            yield ym, box_mean_mm_month(data, lons[xi.min():xi.max() + 1], lats[yi.min():yi.max() + 1], bbox, int(start[4:6]))
