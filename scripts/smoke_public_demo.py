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
TIMEOUT = 65


def fetch(path: str, body: dict | None = None) -> tuple[int, bytes, str]:
    url = f"{SITE}{path}"
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


def json_from(path: str, body: dict | None = None) -> dict:
    status, raw, content_type = fetch(path, body)
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
    check("public frontend renders HTML", lambda: verify_html())
    check("Netlify reverse-proxy health", lambda: verify_health())
    check("paginated crop search", lambda: verify_search())
    check("decision evaluation keeps evidence warnings", lambda: verify_decision())
    check("NASA POWER returns real dated observations", lambda: verify_nasa())
    print("PASS — public integration smoke complete; agronomic validation remains separate.")


def verify_html():
    status, raw, content_type = fetch("/")
    if status != 200 or "html" not in content_type or b"TERRA360" not in raw.upper():
        raise AssertionError("Public website did not return TERRA360 HTML")


def verify_health():
    obj = json_from("/api/health")
    assert obj.get("status") == "ok", obj
    assert obj.get("application") == "TERRA360", obj


def verify_search():
    obj = json_from("/api/arie/crops?query=quinua&limit=10")
    assert any(item["id"] == "quinoa" for item in obj.get("items", [])), obj
    assert obj.get("region_suitability_evaluated") is False, obj


def verify_decision():
    obj = json_from("/api/arie/evaluate", {"crops": ["quinoa", "tomato"],
                                           "priority": "balanced", "water_access": "unknown"})
    decision = obj["ai_decision"]
    assert decision["chosen_for_review"] is None, decision
    assert decision["status"] == "exploratory_catalog_only", decision
    assert not obj["is_yield_prediction"] and not obj["is_irrigation_prescription"]
    assert obj["plan_preview"]["is_planting_instruction"] is False


def verify_nasa():
    end = date.today() - timedelta(days=6)
    start = end - timedelta(days=5)
    query = urlencode({"start": start.isoformat(), "end": end.isoformat(),
                      "latitude": -13.32175, "longitude": -71.95605})
    obj = json_from("/api/environment/nasa-power/daily?" + query)
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
