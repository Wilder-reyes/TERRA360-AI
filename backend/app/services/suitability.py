"""Offline FAO/IIASA GAEZ v5 native-cell maps, with traceable three-group display.

No fitted ML model, spatial interpolation, parcel inference or live downloads.
The application grouping preserves every original class and its meaning.
"""
from functools import lru_cache
from hashlib import sha256
import json
import math
from pathlib import Path

from app.schemas.suitability import SuitabilityRequest

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "suitability"
STEP = 1 / 12  # Native 5 arc-minute grid, not downscaled.
MAX_CELLS = 1024
GROUPS = ("suitable", "moderate", "low", "no_data", "water")
CLASSES = {
    0: ("no_data", "Sin datos", "No data"),
    1: ("suitable", "Muy alta", "Very high"),
    2: ("suitable", "Alta", "High"),
    3: ("suitable", "Buena", "Good"),
    4: ("moderate", "Media", "Medium"),
    5: ("moderate", "Moderada", "Moderate"),
    6: ("low", "Marginal", "Marginal"),
    7: ("low", "Muy marginal", "Very marginal"),
    8: ("low", "No apta", "Not suitable"),
    9: ("water", "Agua", "Water"),
}


class SuitabilityDataError(RuntimeError):
    """A packaged source could not be verified. Do not publish any cell."""


class SuitabilityExtentError(ValueError):
    pass


@lru_cache(maxsize=1)
def manifest():
    try:
        result = json.loads((DATA_DIR / "manifest.json").read_text())
        if result["grid"] != {"crs": "EPSG:4326", "step_degrees": STEP,
                              "global_width": 4320, "global_height": 2160, "nodata": 0}:
            raise ValueError("Unexpected native grid")
        return result
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise SuitabilityDataError("Suitability manifest unavailable") from exc


def catalog():
    data = manifest()
    return {key: data[key] for key in ("source", "coverage", "pilot_bbox", "grid", "crops",
                                       "management", "grouping", "factors", "limitations")}


@lru_cache(maxsize=12)
def load_tile(crop_id, management):
    try:
        asset = manifest()["assets"][crop_id][management]
        # Never construct paths or remote URLs from request text.
        filename = asset["tile_file"]
        if Path(filename).name != filename:
            raise ValueError("Invalid packaged path")
        raw = (DATA_DIR / filename).read_bytes()
        if sha256(raw).hexdigest() != asset["tile_sha256"]:
            raise ValueError("Packaged data digest mismatch")
        tile = json.loads(raw)
        if tile["source_sha256"] != asset["source_sha256"] or tile["window"] != [1272, 1212, 48, 48]:
            raise ValueError("Unexpected source or window")
        values = tile["values"]
        if len(values) != 48 or any(len(row) != 48 for row in values):
            raise ValueError("Invalid grid dimensions")
        if any(type(value) is not int or value not in CLASSES for row in values for value in row):
            raise ValueError("Unrecognized FAO class")
        return tile, asset
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise SuitabilityDataError("Packaged suitability layer unavailable") from exc


def cell_window(bbox):
    west, south, east, north = bbox
    # Snap only numerical roundoff at exact native grid boundaries.
    c0 = math.floor((west + 180) / STEP + 1e-9)
    c1 = math.ceil((east + 180) / STEP - 1e-9)
    r0 = math.floor((90 - north) / STEP + 1e-9)
    r1 = math.ceil((90 - south) / STEP - 1e-9)
    if (c1 - c0) * (r1 - r0) > MAX_CELLS:
        raise SuitabilityExtentError(f"Request exceeds {MAX_CELLS} native cells; zoom in")
    return c0, r0, c1, r1


def approximate_area_km2(west, south, east, north):
    """Spherical area of a geographic rectangle; never reported as arable area."""
    return 6371.0088 ** 2 * math.radians(east - west) * (
        math.sin(math.radians(north)) - math.sin(math.radians(south)))


def suitability_map(request: SuitabilityRequest):
    data = manifest()
    crop = next(item for item in data["crops"] if item["id"] == request.crop_id)
    if not crop["available"]:
        return {"status": "unsupported_crop", "map": None}
    west, south, east, north = request.bbox
    cw, cs, ce, cn = data["coverage"]["bbox"]
    if west < cw or south < cs or east > ce or north > cn:
        return {"status": "outside_coverage", "map": None}
    c0, r0, c1, r1 = cell_window(request.bbox)  # Bound work before reading data.
    tile, asset = load_tile(request.crop_id, request.management)
    counts = {key: 0 for key in GROUPS}
    areas = {key: 0.0 for key in GROUPS}
    features = []
    for row in range(r0, r1):
        for col in range(c0, c1):
            code = tile["values"][row - 1212][col - 1272]
            group, label, label_en = CLASSES[code]
            left, top = -180 + col * STEP, 90 - row * STEP
            right, bottom = left + STEP, top - STEP
            counts[group] += 1
            areas[group] += approximate_area_km2(max(west, left), max(south, bottom),
                                                 min(east, right), min(north, top))
            features.append({"type": "Feature", "id": f"{row}:{col}",
                             "properties": {"row": row, "col": col, "class_code": code,
                                            "class_label": label, "class_label_en": label_en, "group": group},
                             "geometry": {"type": "Polygon", "coordinates": [[
                                 [left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]}})
    total_area = sum(areas.values())
    valid_cells = counts["suitable"] + counts["moderate"] + counts["low"]
    return {"status": "available" if valid_cells else "no_land_data", "map": {
        "crop": crop, "management": request.management, "bbox": list(request.bbox),
        "geojson": {"type": "FeatureCollection", "features": features},
        "summary": {"cells": counts, "area_km2": {k: round(v, 3) for k, v in areas.items()},
                    "total_cells": len(features),
                    "land_data_coverage_percent": round(100 * sum(areas[g] for g in ("suitable", "moderate", "low")) / total_area, 1),
                    "area_method": "spherical_rectangle_intersection_with_requested_bbox"},
        "source": {**data["source"], "raster_url": asset["source_url"],
                   "raster_sha256": asset["source_sha256"], "tile_sha256": asset["tile_sha256"]},
        "grouping": data["grouping"], "grid": data["grid"],
    }}
