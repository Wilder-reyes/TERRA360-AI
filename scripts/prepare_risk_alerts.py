#!/usr/bin/env python3
"""Refresh the nine-point pilot risk inputs from real public models.

The public API never performs these downloads. Baselines are cached; forecast
data are always fetched afresh. No API keys, model training or synthetic inputs.
"""
from __future__ import annotations
import argparse
import calendar
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
from statistics import mean
import sys
import time
from zoneinfo import ZoneInfo

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.connectors.risk_weather import POINTS, FORECAST_URL, ARCHIVE_URL, normalize_points, parameters
from app.schemas.risk_alerts import RiskSnapshot
from app.services.rain_forecast import atomic_json
from app.services.risk_alerts import rules, complete, build_report
from app.services.risk_terrain import summarize_terrain

CACHE = ROOT / "backend/data/risk_alerts"
OUTPUT = ROOT / "backend/app/data/risk_alerts"
DEM_HASHES = {
    72: "533998d4acf8f2c9db3464a967f4cd9733db983a684aae982c758c46b3859635",
    73: "00d5e17afc567f96bcce0b9f3098556ff85a5a495555cdfdb2da78561cf9a512",
}


def download_json(client, url, params, cache=True):
    request_url = str(httpx.URL(url, params=params))
    path = CACHE / (sha256(request_url.encode()).hexdigest() + ".json")
    if cache and path.exists():
        data = json.loads(path.read_text())
        return data["payload"], {**data["provenance"], "cache_hit": "true"}
    with client.stream("GET", url, params=params) as response:
        response.raise_for_status()
        content = bytearray()
        for chunk in response.iter_bytes():
            content.extend(chunk)
            if len(content) > 8 * 1024 * 1024:
                raise ValueError("Weather response exceeds size limit")
    payload = json.loads(content)
    provenance = {"url": request_url, "sha256": sha256(content).hexdigest(),
                  "retrieved_at": datetime.now(timezone.utc).isoformat(), "cache_hit": "false"}
    atomic_json(path, {"payload": payload, "provenance": provenance})
    return payload, provenance


def terrain_paths(client):
    results = []
    for west in (73, 72):
        stem = f"Copernicus_DSM_COG_30_S14_00_W{west:03d}_00_DEM"
        url = f"https://copernicus-dem-90m.s3.amazonaws.com/{stem}/{stem}.tif"
        path = CACHE / (stem + ".tif")
        if not path.exists():
            with client.stream("GET", url) as response:
                response.raise_for_status()
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 16*1024*1024:
                        raise ValueError("DEM exceeds size limit")
            path.write_bytes(content)
        digest = sha256(path.read_bytes()).hexdigest()
        if digest != DEM_HASHES[west]:
            raise ValueError("Copernicus terrain digest mismatch")
        results.append((path, {"url": url, "sha256": digest}))
    return results


def prepare(output=OUTPUT):
    CACHE.mkdir(parents=True, exist_ok=True)
    issued = datetime.now(timezone.utc)
    today = issued.astimezone(ZoneInfo("America/Lima")).date()
    first_forecast, last_forecast = today+timedelta(days=1), today+timedelta(days=7)
    history_end = today - timedelta(days=7)
    history_start = history_end - timedelta(days=29)
    provenance = []
    baselines = [[] for _ in POINTS]
    with httpx.Client(timeout=httpx.Timeout(60, connect=15), follow_redirects=False) as client:
        # Cache-stable seasonal windows rather than downloading 30 full years.
        for year in range(1991, 2021):
            end = date(year, history_end.month, min(history_end.day, calendar.monthrange(year, history_end.month)[1]))
            start = end - timedelta(days=29)
            before = time.monotonic()
            payload, source = download_json(client, ARCHIVE_URL, parameters(start, end))
            normalized = normalize_points(payload, start, end)
            provenance.append({**source, "purpose": "baseline", "end_year": str(year)})
            for target, data in zip(baselines, normalized):
                target.append({"end_year": year, "precipitation_30d_mm": complete([r["precipitation_mm"] for r in data["rows"]]),
                               "soil_7d_m3_m3": complete([r["soil_m3_m3"] for r in data["rows"][-7:]], mean)})
            print(f"ERA5 reference {year}: nine points normalized", flush=True)
            # Multi-location requests consume multiple free-API quota units.
            if source["cache_hit"] == "false":
                time.sleep(max(0, 4 - (time.monotonic()-before)))
        payload, source = download_json(client, ARCHIVE_URL, parameters(history_start, history_end))
        history = normalize_points(payload, history_start, history_end)
        provenance.append({**source, "purpose": "recent_history"})
        try:
            assets = terrain_paths(client)
        except (httpx.HTTPError, OSError, ValueError) as exc:
            print(f"Terrain unavailable; erosion will remain unassessed: {type(exc).__name__}", flush=True)
            assets = []
        # Fetch the live forecast last so preparation does not age it unnecessarily.
        payload, source = download_json(client, FORECAST_URL, parameters(first_forecast, last_forecast, forecast=True), cache=False)
        forecast = normalize_points(payload, first_forecast, last_forecast, forecast=True)
        provenance.append({**source, "purpose": "forecast"})
    points = []
    for index, point in enumerate(POINTS):
        terrain = {"slope_p75_degrees": None, "valid_fraction": 0, "neighborhood_km": 3, "source_assets": []}
        if assets:
            try:
                terrain = {**summarize_terrain(point["latitude"], point["longitude"], [p for p, _ in assets]),
                           "source_assets": [source for _, source in assets]}
            except (OSError, ValueError, RuntimeError) as exc:
                print(f"{point['id']}: no verified terrain: {type(exc).__name__}", flush=True)
        points.append({**point, "history_grid": history[index]["grid"], "forecast_grid": forecast[index]["grid"],
                       "history": history[index]["rows"], "forecast": forecast[index]["rows"],
                       "baseline": baselines[index], "terrain": terrain})
    midnight = datetime.combine(first_forecast, datetime.min.time(), tzinfo=ZoneInfo("America/Lima"))
    snapshot = RiskSnapshot(method_version=rules()["version"], issued_at=issued, expires_at=min(issued+timedelta(hours=12), midnight),
                            forecast_start=first_forecast, forecast_end=last_forecast,
                            history_start=history_start, history_end=history_end, points=points, provenance=provenance)
    output = Path(output)
    atomic_json(output / "pilot-snapshot.json", snapshot.model_dump(mode="json"))
    digest = sha256((output / "pilot-snapshot.json").read_bytes()).hexdigest()
    atomic_json(output / "pilot-manifest.json", {"sha256": digest, "method_version": rules()["version"]})
    print(json.dumps({"prepared": str(output), "summary": build_report(snapshot)["summary"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    prepare(args.output)
