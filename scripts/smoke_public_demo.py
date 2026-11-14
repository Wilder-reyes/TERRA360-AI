#!/usr/bin/env python3
"""Smoke test for the published TERRA360 demo: no credentials, no fake readings.

Run manually when Netlify and Render have finished deploying the SAME commit.
This script is not a substitute for agronomic review, UI accessibility testing,
raster inspection, or field validation with farmers.
"""
from datetime import date, timedelta
import json
import sys
import time
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urlencode

SITE = "https://terra360-ai.netlify.app"
BACKEND = "https://terra360-api.onrender.com"
TIMEOUT = 65


def fetch(path: str, body: dict | None = None, host: str = SITE) -> tuple[int, bytes, str]:
    url = f"{host}{path}"
    raw = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(url, data=raw, headers={"Accept": "application/json",
                                         "User-Agent": "TERRA360-public-smoke/1.0 (+https://terra360-ai.netlify.app/)"},
                  method="GET" if body is None else "POST")
    if raw is not None:
        req.add_header("Content-Type", "application/json")
    failure = None
    for attempt in range(3):
        try:
            with urlopen(req, timeout=TIMEOUT) as response:
                return response.status, response.read(3_000_000), response.headers.get("content-type", "")
        except HTTPError as exc:
            failure = exc
            if exc.code in (401, 403):
                raise RuntimeError(f"HTTP {exc.code} at {path}: anonymous access denied. Check Netlify > Visitor access > Production visibility = Public.") from exc
            if exc.code == 404:
                raise RuntimeError(f"HTTP 404 at {path}: verify production site URL and deployment.") from exc
            if attempt < 2:
                time.sleep(7 * (attempt + 1))
        except (URLError, TimeoutError) as exc:
            failure = exc
            if attempt < 2:
                time.sleep(7 * (attempt + 1))
    code = getattr(failure, "code", "network error")
    raise RuntimeError(f"Public demo unavailable: {path} (HTTP/status {code})") from failure


def json_from(path: str, body: dict | None = None, host: str = SITE) -> dict:
    status, raw, content_type = fetch(path, body, host)
    if status != 200 or "json" not in content_type:
        raise AssertionError(f"Expected JSON status 200 from {path}; received status={status} type={content_type}")
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise AssertionError("The API must return an object")
    return result


def check(name: str, fn):
    fn()
    print(f"PASS — {name}")


def main() -> None:
    tasks = [
        ("Render backend health", lambda: verify_health(BACKEND)),
        ("Render full FAO catalog search", lambda: verify_search(BACKEND)),
        ("Render SRTM terrain route contract", lambda: verify_terrain_contract(BACKEND)),
        ("Production Sentinel-2 real parcel NDVI", lambda: verify_ndvi(BACKEND)),
        ("Production Sentinel-2 multi-date observations", lambda: verify_ndvi_series(BACKEND)),
        ("Render ARIE decision", lambda: verify_decision(BACKEND)),
        ("Render real NASA POWER", lambda: verify_nasa(BACKEND)),
        ("anonymous Netlify home page", verify_html),
        ("anonymous Netlify to Render proxy", lambda: verify_health(SITE)),
    ]
    failed = []
    for name, runner in tasks:
        try:
            check(name, runner)
        except Exception as exc:
            print(f"FAIL — {name}: {exc}", file=sys.stderr)
            failed.append(name)
    if failed:
        raise RuntimeError("Public smoke incomplete; failed checks: " + ", ".join(failed))
    print("PASS — public integration smoke complete; agronomic validation remains separate.")


def verify_html():
    status, raw, content_type = fetch("/")
    if status != 200 or "html" not in content_type or b"TERRA360" not in raw.upper():
        raise AssertionError("Public website did not return TERRA360 HTML")


def verify_health(host: str = SITE):
    obj = json_from("/api/health", host=host)
    assert obj.get("status") == "ok", obj
    assert obj.get("application") == "TERRA360", obj
    assert obj.get("version") == "0.10.0", obj


def verify_search(host: str = SITE):
    obj = json_from("/api/arie/crops?query=quinua&limit=10", host=host)
    assert any(item["id"] == "quinoa" for item in obj.get("items", [])), obj
    assert obj.get("region_suitability_evaluated") is False, obj
    all_crops=json_from("/api/arie/crops?limit=1",host=host)
    assert all_crops["total"]>=2600, all_crops


def verify_terrain_contract(host: str = BACKEND):
    spec=json_from("/openapi.json",host=host)
    assert "/api/environment/terrain" in spec.get("paths", {}), "Missing SRTM endpoint; public provider should not be called automatically"



def verify_ndvi(host: str = BACKEND):
    """Read real COG pixels from the production Render API, not a mocked dataset."""
    spec = json_from("/openapi.json", host=host)
    route = "/api/environment/sentinel-2/parcel-ndvi"
    assert route in spec.get("paths", {}), "Backend has not deployed Sentinel-2 route"
    parcel = {"type":"Polygon","coordinates":[[
        [-71.95720,-13.32270],[-71.95490,-13.32270],
        [-71.95490,-13.32050],[-71.95720,-13.32050],
        [-71.95720,-13.32270]
    ]]}
    obj = json_from(route, {"polygon":parcel,"days":240,"cloud_limit":50}, host=host)
    if obj.get("status") != "available":
        raise AssertionError(f"Sentinel-2 raster in production inconclusive: status={obj.get('status')}")
    scene = obj.get("scene") or {}
    metrics = obj.get("metrics") or {}
    ndvi = metrics.get("ndvi") or {}
    assert scene.get("id") and scene.get("date") and scene.get("processing_baseline"), scene
    assert metrics.get("valid_pixels", 0) >= 20
    assert metrics.get("valid_fraction_percent", 0) >= 60
    assert -1 <= ndvi.get("mean", 99) <= 1
    assert obj.get("used_in_crop_decision") is False
    print("Sentinel-2 production: date=",scene["date"],
          "pixels=",metrics["valid_pixels"],
          "mean_ndvi=",ndvi["mean"],
          "valid_percent=",metrics["valid_fraction_percent"])



def verify_ndvi_series(host: str = BACKEND):
    """Read actual multi-date COG windows from Render without relying on mock data."""
    route = "/api/environment/sentinel-2/parcel-ndvi-series"
    spec = json_from("/openapi.json", host=host)
    assert route in spec.get("paths", {}), "Backend has not deployed Sentinel-2 multi-date route"
    parcel = {"type":"Polygon","coordinates":[[
        [-71.95720,-13.32270],[-71.95490,-13.32270],
        [-71.95490,-13.32050],[-71.95720,-13.32050],
        [-71.95720,-13.32270]
    ]]}
    result = json_from(route, {
        "polygon": parcel, "days": 240,
        "cloud_limit": 70, "max_observations": 3,
    }, host=host)
    if result.get("status") != "available":
        raise AssertionError(f"Multi-date satellite observation inconclusive: status={result.get('status')}")
    valid = [row for row in result.get("observations", [])
             if row.get("status") == "available" and
             (row.get("metrics") or {}).get("ndvi") is not None]
    assert result.get("valid_observation_count") == len(valid)
    assert len(valid) >= 2
    assert len(set(row["date"] for row in valid)) == len(valid)
    assert result.get("attempted_scenes", 1000) <= 8
    assert all((row["metrics"]["valid_fraction_percent"] >= 60 and
                row["metrics"]["valid_pixels"] >= 20 and
                -1 <= row["metrics"]["ndvi"]["mean"] <= 1)
               for row in valid)
    assert result.get("can_infer_vegetation_trend") is False
    assert result.get("used_in_crop_decision") is False
    print("Sentinel-2 multi-date production:", [
        {"date":v["date"],"ndvi":v["metrics"]["ndvi"]["mean"]} for v in valid
    ])


def verify_decision(host: str = SITE):
    obj = json_from("/api/arie/evaluate", {"crops": ["quinoa", "tomato"],
                                           "priority": "balanced", "water_access": "unknown"}, host=host)
    decision = obj["ai_decision"]
    assert decision["chosen_for_review"] is None, decision
    assert decision["status"] == "exploratory_catalog_only", decision
    assert not obj["is_yield_prediction"] and not obj["is_irrigation_prescription"]
    assert obj["plan_preview"]["is_planting_instruction"] is False


def verify_nasa(host: str = SITE):
    end = date.today() - timedelta(days=6)
    start = end - timedelta(days=5)
    query = urlencode({"start": start.isoformat(), "end": end.isoformat(),
                      "latitude": -13.32175, "longitude": -71.95605})
    obj = json_from("/api/environment/nasa-power/daily?" + query, host=host)
    records = obj.get("records", [])
    if not isinstance(records, list) or not records:
        raise AssertionError("NASA POWER did not return observations")
    if not any(row.get("PRECTOTCORR") is not None for row in records):
        raise AssertionError("NASA POWER returned no usable rain values")
    if "NASA" not in obj.get("source", "").upper():
        raise AssertionError("Missing NASA provenance")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, RuntimeError, ValueError, KeyError, TypeError) as exc:
        print(f"FAILED — {exc}", file=sys.stderr)
        raise SystemExit(1)
