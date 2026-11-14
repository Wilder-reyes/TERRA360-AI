# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Multi-year monthly NDVI history of a field: «historial estimado por satélite».

Primary source: NASA HLS v2.0 (Harmonized Landsat Sentinel-2, 30 m) on
Microsoft Planetary Computer, collections ``hls2-s30`` and ``hls2-l30``,
cloud-masked with the HLS ``Fmask`` layer (cloud, adjacent cloud, cloud
shadow, snow/ice and water rejected).
Fallback: ESA Sentinel-2 L2A (10 m) with the SCL mask, reusing
``sentinel_ndvi.process_scene``.

For each month the value is the MAXIMUM of the per-scene polygon NDVI (median
of clear pixels) among a few low-cloud scenes. Months without a usable scene
are returned as ``null`` and are NEVER interpolated. Campaign / bare-soil
detection uses declared heuristic thresholds (<0.2 bare, >0.4 active crop).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from pathlib import Path
from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx
import numpy as np
import planetary_computer
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from rasterio.windows import Window, transform as window_transform
from shapely.geometry import Polygon, mapping, shape

from app.connectors.planetary_computer import CATALOG_URL, COLLECTION as S2_COLLECTION, STAC_URL
from app.services.sentinel_ndvi import NDVIError, process_scene, validate_parcel

HLS_COLLECTIONS = ("hls2-s30", "hls2-l30")
HLS_NIR = {"hls2-s30": "B8A", "hls2-l30": "B05"}
# Fmask bits: 1 cloud, 2 adjacent to cloud/shadow, 3 cloud shadow, 4 snow/ice, 5 water.
FMASK_REJECT = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)
BARE_MAX = 0.2
ACTIVE_MIN = 0.4
MAX_CLOUD = 70
SCENES_PER_MONTH = 2
VALID_PER_MONTH = 2
MIN_CLEAR_PIXELS_30M = 4
MIN_CLEAR_FRACTION = 0.5
MAX_WINDOW_PIXELS = 40_000
CONCURRENCY = 20
CACHE_TTL = 6 * 3600
_CACHE: dict[str, tuple[float, dict]] = {}
_LOCK = asyncio.Lock()
# Persistent cache: a computed field history is reused across restarts (same
# polygon, same start year, same last month). Never shared as "fresh" data:
# the response keeps its own computed_at timestamp.
# On Vercel only /tmp is writable.
CACHE_DIR = Path(os.getenv("TERRA360_CACHE_DIR") or ("/tmp/terra360" if os.getenv("VERCEL") else Path(__file__).resolve().parents[2] / ".cache")) / "hls_history"


def _disk_path(key: str) -> Path:
    return CACHE_DIR / (hashlib.sha256(key.encode()).hexdigest()[:32] + ".json")


def _disk_get(key: str) -> dict | None:
    try:
        return json.loads(_disk_path(key).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


# Precomputed histories for the demo/example fields, committed to the repo so the
# public demo answers instantly. Keyed by polygon + start year (not by month);
# each file keeps its own computed_at and is labelled as precomputed.
SEED_DIR = Path(__file__).resolve().parents[1] / "data" / "history_seed"


def seed_key(raw_polygon: dict, start_year: int, prefer: str) -> str:
    return json.dumps({"c": raw_polygon["coordinates"], "s": start_year, "p": prefer},
                      sort_keys=True, separators=(",", ":"))


def seed_path(raw_polygon: dict, start_year: int, prefer: str) -> Path:
    return SEED_DIR / (hashlib.sha256(seed_key(raw_polygon, start_year, prefer).encode()).hexdigest()[:32] + ".json")


def _seed_get(raw_polygon: dict, start_year: int, prefer: str) -> dict | None:
    try:
        value = json.loads(seed_path(raw_polygon, start_year, prefer).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    value["cache"] = "precomputed"
    return value


def cached_history(raw_polygon: dict, start_year: int = 2021, prefer: str = "hls",
                   today: date | None = None) -> dict | None:
    """Return an already computed history (memory, disk or committed seed) without network."""
    end = today or datetime.now(timezone.utc).date()
    key = json.dumps({"c": raw_polygon["coordinates"], "s": start_year, "e": _month_key(end), "p": prefer},
                     sort_keys=True, separators=(",", ":"))
    hit = _CACHE.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL:
        return deepcopy(hit[1])
    stored = _disk_get(key)
    if stored is not None:
        stored["cache"] = "disk"
        return stored
    return _seed_get(raw_polygon, start_year, prefer)


def _disk_put(key: str, value: dict) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _disk_path(key).write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _months_between(start: date, end: date) -> list[str]:
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _scene_date(item: dict) -> date | None:
    text = (item.get("properties") or {}).get("datetime")
    if not isinstance(text, str):
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _signed(item: dict, key: str) -> str:
    href = ((item.get("assets") or {}).get(key) or {}).get("href")
    if not isinstance(href, str):
        raise NDVIError(f"La escena no contiene la banda {key}.")
    host = urlparse(href).hostname or ""
    if urlparse(href).scheme != "https" or not (host.startswith("hls2") and host.endswith(".blob.core.windows.net")):
        raise NDVIError("La ubicación del raster HLS no es una fuente aprobada.")
    signed = planetary_computer.sign(href)
    if urlparse(signed).hostname != host:
        raise NDVIError("El raster firmado cambió de proveedor.")
    return signed


def hls_ndvi_from_arrays(red: np.ndarray, nir: np.ndarray, fmask: np.ndarray,
                         inside: np.ndarray, area_m2: float, pixel_area_m2: float) -> dict:
    """Pure core: HLS surface reflectance ×0.0001, fill -9999, Fmask quality bits."""
    total = int(np.count_nonzero(inside))
    if total == 0:
        return {"status": "no_spatial_coverage", "valid_pixels": 0, "ndvi_median": None}
    r = red.astype(np.float32) * 1e-4
    n = nir.astype(np.float32) * 1e-4
    denom = r + n
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (n - r) / denom
    good = (inside & (red > -9999) & (nir > -9999) & (red > 0) & (nir > 0) &
            ((fmask.astype(np.int32) & FMASK_REJECT) == 0) & (fmask != 255) &
            (denom > 0) & np.isfinite(ndvi) & (ndvi >= -1) & (ndvi <= 1))
    valid = int(np.count_nonzero(good))
    fraction = min(1.0, valid * pixel_area_m2 / area_m2)
    ok = valid >= MIN_CLEAR_PIXELS_30M and fraction >= MIN_CLEAR_FRACTION
    return {
        "status": "available" if ok else "insufficient_clear_pixels",
        "valid_pixels": valid,
        "valid_fraction_percent": round(fraction * 100, 1),
        "ndvi_median": round(float(np.median(ndvi[good])), 4) if ok else None,
    }


def process_hls_scene(item: dict, collection: str, parcel: Polygon, area_m2: float) -> dict:
    red_url, nir_url, mask_url = (_signed(item, k) for k in ("B04", HLS_NIR[collection], "Fmask"))
    try:
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT="15",
                          GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", GDAL_INGESTED_BYTES_AT_OPEN="32768",
                          GDAL_HTTP_MAX_RETRY="2", GDAL_HTTP_RETRY_DELAY="1"):
            with rasterio.open(red_url) as red_ds, rasterio.open(nir_url) as nir_ds, rasterio.open(mask_url) as m_ds:
                if red_ds.crs is None or red_ds.transform != nir_ds.transform or red_ds.transform != m_ds.transform:
                    raise NDVIError("Las bandas HLS no comparten la misma cuadrícula.")
                projected = transform_geom("EPSG:4326", red_ds.crs, mapping(parcel))
                xmin, ymin, xmax, ymax = shape(projected).bounds
                wf = red_ds.window(xmin, ymin, xmax, ymax)
                col0, row0 = max(0, int(wf.col_off) - 1), max(0, int(wf.row_off) - 1)
                col1 = min(red_ds.width, int(wf.col_off + wf.width) + 2)
                row1 = min(red_ds.height, int(wf.row_off + wf.height) + 2)
                if col1 <= col0 or row1 <= row0:
                    return {"status": "no_spatial_coverage", "valid_pixels": 0, "ndvi_median": None}
                window = Window(col0, row0, col1 - col0, row1 - row0)
                if window.width * window.height > MAX_WINDOW_PIXELS:
                    raise NDVIError("La parcela excede el límite de procesamiento.")
                inside = geometry_mask([projected], out_shape=(int(window.height), int(window.width)),
                                       transform=window_transform(window, red_ds.transform), invert=True)
                pixel_area = abs(red_ds.transform.a * red_ds.transform.e)
                return hls_ndvi_from_arrays(red_ds.read(1, window=window), nir_ds.read(1, window=window),
                                            m_ds.read(1, window=window), inside, area_m2, pixel_area)
    except (rasterio.errors.RasterioError, OSError) as exc:
        raise NDVIError("No fue posible leer los rasters HLS.") from exc


async def _search(client: httpx.AsyncClient, collections: list[str], bbox: list[float],
                  start: date, end: date) -> list[dict]:
    body: dict[str, Any] | None = {
        "collections": collections, "bbox": bbox,
        "datetime": f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
        "query": {"eo:cloud_cover": {"lte": MAX_CLOUD}}, "limit": 500,
    }
    features: list[dict] = []
    for _ in range(12):  # bounded pagination
        response = await client.post(STAC_URL, json=body, headers={"Accept": "application/geo+json"})
        response.raise_for_status()
        data = response.json()
        page = data.get("features")
        if not isinstance(page, list):
            raise NDVIError("El catálogo satelital devolvió una respuesta incorrecta.")
        features.extend(page)
        nxt = next((l for l in data.get("links", []) if l.get("rel") == "next" and isinstance(l.get("body"), dict)), None)
        if not nxt or not page:
            break
        body = nxt["body"]
    return features


MIN_PROMINENCE = 0.12


def _peaks(values: list[float | None]) -> list[int]:
    """Local maxima above ACTIVE_MIN among available months, merged when the dip
    between two peaks is smaller than MIN_PROMINENCE (same campaign)."""
    avail = [k for k, v in enumerate(values) if v is not None]
    peaks = []
    for n, k in enumerate(avail):
        v = values[k]
        prev = values[avail[n - 1]] if n > 0 else -1
        nxt = values[avail[n + 1]] if n + 1 < len(avail) else -1
        if v > ACTIVE_MIN and v >= prev and v >= nxt:
            peaks.append(k)
    merged: list[int] = []
    for k in peaks:
        if merged:
            a = merged[-1]
            between = [values[x] for x in range(a + 1, k) if values[x] is not None]
            dip = min(between) if between else min(values[a], values[k])
            longest_gap, run = 0, 0
            for x in range(a + 1, k):
                run = run + 1 if values[x] is None else 0
                longest_gap = max(longest_gap, run)
            # A long cloudy gap hides the valley: keep both peaks (unknown, not merged).
            if longest_gap < 2 and min(values[a], values[k]) - dip < MIN_PROMINENCE:
                if values[k] > values[a]:
                    merged[-1] = k
                continue
        merged.append(k)
    return merged


def detect_campaigns(months: list[dict]) -> dict:
    """Heuristic, declared detection on the monthly max-NDVI series (no gap filling).

    1. Campaign peaks: local maxima with NDVI > 0.4, separated by a dip of at
       least 0.12 (otherwise they are the same campaign).
    2. Each campaign spans the months around its peak whose NDVI is at least
       half-way between the adjacent valley and the peak (50 % amplitude rule).
       One cloudy (null) month inside a campaign is tolerated, never filled.
    3. Month states: active (>0.4), bare (<0.2), transition, unknown (null).
       Sustained bare = ≥2 consecutive bare months. Months outside every
       campaign are reported as "without crop" (sin cultivo).
    """
    values = [m["ndvi"] for m in months]
    n = len(months)
    states = ["unknown" if v is None else "active" if v > ACTIVE_MIN else
              "bare" if v < BARE_MAX else "transition" for v in values]
    peaks = _peaks(values)
    campaigns = []
    for p_idx, p in enumerate(peaks):
        lo_bound = peaks[p_idx - 1] + 1 if p_idx > 0 else 0
        hi_bound = peaks[p_idx + 1] - 1 if p_idx + 1 < len(peaks) else n - 1
        left_vals = [values[x] for x in range(lo_bound, p) if values[x] is not None]
        right_vals = [values[x] for x in range(p + 1, hi_bound + 1) if values[x] is not None]
        v_left = min(left_vals) if left_vals else values[p]
        v_right = min(right_vals) if right_vals else values[p]
        th_left = max(BARE_MAX, v_left + 0.5 * (values[p] - v_left))
        th_right = max(BARE_MAX, v_right + 0.5 * (values[p] - v_right))

        def extend(step: int, th: float, bound: int) -> int:
            k, edge = p, p
            while True:
                k += step
                if (step < 0 and k < bound) or (step > 0 and k > bound):
                    return edge
                if values[k] is None:
                    after = k + step
                    if ((step < 0 and after >= bound) or (step > 0 and after <= bound)) and \
                            values[after] is not None and values[after] >= th:
                        continue  # tolerate a single cloudy month
                    return edge
                if values[k] < th:
                    return edge
                edge = k
        start, end = extend(-1, th_left, lo_bound), extend(1, th_right, hi_bound)
        campaigns.append({
            "start": months[start]["month"], "end": months[end]["month"],
            "months": end - start + 1, "peak_month": months[p]["month"],
            "peak_ndvi": values[p], "start_index": start, "end_index": end,
            "unknown_months_inside": sum(values[k] is None for k in range(start, end + 1)),
        })
    in_campaign = set()
    for c in campaigns:
        in_campaign.update(range(c["start_index"], c["end_index"] + 1))
    without_crop = [k for k in range(n) if k not in in_campaign and values[k] is not None]
    bare_runs, i = [], 0
    while i < n:
        if states[i] == "bare":
            j = i
            while j + 1 < n and states[j + 1] == "bare":
                j += 1
            if j - i + 1 >= 2:
                bare_runs.append({"start": months[i]["month"], "end": months[j]["month"], "months": j - i + 1})
            i = j + 1
        else:
            i += 1
    per_year: dict[str, dict] = {}
    for k, (m, s) in enumerate(zip(months, states)):
        y = per_year.setdefault(m["month"][:4], {"bare": 0, "active": 0, "transition": 0, "unknown": 0,
                                                 "without_crop": 0, "campaign_months": 0})
        y[s] += 1
        y["without_crop"] += k in without_crop
        y["campaign_months"] += k in in_campaign
    return {"states": states, "campaigns": campaigns, "sustained_bare_periods": bare_runs,
            "without_crop_months": [months[k]["month"] for k in without_crop],
            "per_year": per_year,
            "thresholds": {"bare_below": BARE_MAX, "active_above": ACTIVE_MIN,
                           "min_peak_prominence": MIN_PROMINENCE, "campaign_edge": "50% amplitude between valley and peak",
                           "heuristic": True, "note": "Umbrales de partida, no calibrados localmente."}}


def suggest_crops(campaign: dict, catalog_crops: list[dict]) -> list[dict]:
    """Candidate crops for a detected campaign: sowing month ≈ 1 month before the
    first green month, cycle length close to the campaign duration (catalogue)."""
    first_green = int(campaign["start"][5:7])
    sow = 12 if first_green == 1 else first_green - 1
    # The green period seen by the satellite is shorter than the crop cycle
    # (emergence and senescence are not green): add one month.
    seen = campaign["months"] + 1
    out = []
    for c in catalog_crops:
        months = c["cycle_days"] / 30.4
        if c["cycle_days"] > 365:
            if campaign["months"] < 10:
                continue
            fit = 0.0
        else:
            fit = abs(months - seen)
        in_cal = sow in c["sowing_months_lima"] or first_green in c["sowing_months_lima"]
        if not in_cal or fit > 2.5:
            continue
        out.append({"crop_id": c["id"], "name_es": c["name_es"], "fit_months": round(fit, 1),
                    "peak_sowing": sow in c.get("sowing_peak_months", [])})
    out.sort(key=lambda x: (x["fit_months"], not x["peak_sowing"]))
    return out[:4]


async def monthly_history(raw_polygon: dict, *, start_year: int = 2021, today: date | None = None,
                          client: httpx.AsyncClient | None = None, prefer: str = "hls") -> dict:
    parcel, area_m2 = validate_parcel(raw_polygon)
    end = today or datetime.now(timezone.utc).date()
    if not 2020 <= start_year <= end.year:
        raise ValueError("Año inicial fuera de rango (HLS v2 en Planetary Computer comienza en 2020).")
    start = date(start_year, 1, 1)
    key = json.dumps({"c": raw_polygon["coordinates"], "s": start_year, "e": _month_key(end), "p": prefer},
                     sort_keys=True, separators=(",", ":"))
    async with _LOCK:
        hit = _CACHE.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL:
            return deepcopy(hit[1])
    stored = _disk_get(key) or _seed_get(raw_polygon, start_year, prefer)
    if stored is not None:
        stored.setdefault("cache", "disk")
        return stored
    owned = client is None
    client = client or httpx.AsyncClient(timeout=httpx.Timeout(45.0), follow_redirects=False)
    sensor = "hls"
    try:
        features: list[dict] = []
        if prefer == "hls":
            try:
                features = await _search(client, list(HLS_COLLECTIONS), list(parcel.bounds), start, end)
            except (httpx.HTTPError, NDVIError, ValueError):
                features = []
        if not features:
            sensor = "sentinel2"
            features = await _search(client, [S2_COLLECTION], list(parcel.bounds), start, end)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise NDVIError("El catálogo satelital no está disponible.") from exc
    finally:
        if owned:
            await client.aclose()

    by_month: dict[str, list[dict]] = {}
    for item in features:
        d = _scene_date(item)
        cloud = (item.get("properties") or {}).get("eo:cloud_cover")
        if d is None or not isinstance(cloud, (int, float)) or not (start <= d <= end):
            continue
        by_month.setdefault(_month_key(d), []).append(item)
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(item: dict) -> dict:
        props = item["properties"]
        rec = {"date": _scene_date(item).isoformat(), "scene_id": item.get("id"),
               "collection": item.get("collection"), "platform": props.get("platform"),
               "scene_cloud_percent": props.get("eo:cloud_cover"), "ndvi": None, "status": "processing_unavailable"}
        async with sem:
            try:
                if sensor == "hls":
                    m = await asyncio.to_thread(process_hls_scene, item, item.get("collection"), parcel, area_m2)
                    rec.update(status=m["status"], ndvi=m["ndvi_median"], valid_pixels=m["valid_pixels"])
                else:
                    m = await asyncio.to_thread(process_scene, item, parcel, area_m2)
                    rec.update(status=m["status"], ndvi=(m.get("ndvi") or {}).get("median"),
                               valid_pixels=m.get("valid_pixels"))
            except (NDVIError, ValueError, KeyError):
                pass
        return rec

    async def month_value(month: str) -> dict:
        items = sorted(by_month.get(month, []), key=lambda it: (it["properties"]["eo:cloud_cover"], it.get("id", "")))
        tried, valid = [], []
        for batch_start in range(0, min(len(items), SCENES_PER_MONTH * 2), SCENES_PER_MONTH):
            batch = items[batch_start:batch_start + SCENES_PER_MONTH]
            recs = await asyncio.gather(*(one(it) for it in batch))
            tried += recs
            valid += [r for r in recs if r["ndvi"] is not None]
            if len(valid) >= VALID_PER_MONTH:
                break
        best = max(valid, key=lambda r: r["ndvi"]) if valid else None
        return {"month": month, "ndvi": best["ndvi"] if best else None,
                "best_scene": best, "scenes_available": len(items),
                "scenes_tried": len(tried), "scenes_valid": len(valid)}

    months = await asyncio.gather(*(month_value(m) for m in _months_between(start, end)))
    months = list(months)
    detection = detect_campaigns(months)
    from app.services.rotation_engine import load_catalog
    crops = list(load_catalog()["crops"].values())
    for campaign in detection["campaigns"]:
        campaign["candidates"] = suggest_crops(campaign, crops)
    with_data = sum(m["ndvi"] is not None for m in months)
    result = {
        "status": "available" if with_data >= 12 else "insufficient_data" if with_data else "no_usable_observations",
        "label_es": "Historial estimado por satélite. Puede equivocarse: confírmalo o corrígelo.",
        "label_en": "Satellite-estimated history. It can be wrong: confirm or correct it.",
        "sensor": "NASA HLS v2.0 (Landsat 8/9 + Sentinel-2, 30 m)" if sensor == "hls" else "ESA Sentinel-2 L2A (10 m)",
        "sensor_id": sensor,
        "collections": list(HLS_COLLECTIONS) if sensor == "hls" else [S2_COLLECTION],
        "cloud_mask": "HLS Fmask (cloud, adjacent, shadow, snow, water rejected)" if sensor == "hls" else "Sentinel-2 SCL classes 4-5 only",
        "source_url": CATALOG_URL,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "parcel_area_ha_approx": round(area_m2 / 10000, 2),
        "aggregation": "Monthly MAXIMUM of per-scene polygon median NDVI (clear pixels only); months without data are null, never interpolated.",
        "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "months_total": len(months), "months_with_data": with_data,
        "months": months,
        "detection": detection,
        "limitations": [
            "NDVI indica verdor, no qué cultivo hay ni si está sano.",
            "Con nubes persistentes (invierno costero) faltan meses; no se rellenan.",
            "Píxeles de 30 m (HLS) mezclan bordes, caminos y acequias en terrenos pequeños.",
            "Los umbrales 0,2 / 0,4 son heurísticos y no están calibrados en el valle.",
        ],
    }
    if with_data:
        async with _LOCK:
            if len(_CACHE) >= 32:
                _CACHE.pop(next(iter(_CACHE)))
            _CACHE[key] = (time.monotonic(), deepcopy(result))
        _disk_put(key, result)
    return result
