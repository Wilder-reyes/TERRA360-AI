# AI-assisted: written with Claude Code (Anthropic) and reviewed by the CHAKRA X team.
"""Precompute the Barranca example result (study field barranca-1) for cold starts.

The Render API can take ~30 s to wake up. The frontend shows this precomputed
result ONLY for the exact Barranca example input below and ONLY if the live API
fails; it is labelled as precomputed with its date. Same backend code, no new data:
POST /api/rotation/spatial-plan and POST /api/rotation/compare via FastAPI TestClient
(NASA POWER climatology is fetched live once while running this script).

Usage (repo root): backend/.venv/Scripts/python.exe scripts/precompute_barranca_example.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DEMO_ZONES = [{"id": "rest", "crop_id": "maiz_amarillo_duro", "planted_month": "2026-02"}]
DEMO_CURRENT = [{"crop_id": "maiz_amarillo_duro", "start_index": 18}]  # Feb of year 2 (window starts in August), as the app derives it
DEMO_PRIORITIES = {"water": 2, "soil": 2, "income": 1, "pests": 1}


def main() -> None:
    fields = json.loads((ROOT / "frontend" / "src" / "exampleFields.json").read_text(encoding="utf-8"))
    polygon = next(f["polygon"] for f in fields["team_fields"] if f["id"] == "barranca-1")
    client = TestClient(app)
    plan = client.post("/api/rotation/spatial-plan", json={"polygon": polygon, "zones": DEMO_ZONES})
    plan.raise_for_status()
    centre_lng = sum(p[0] for p in polygon["coordinates"][0][:-1]) / (len(polygon["coordinates"][0]) - 1)
    centre_lat = sum(p[1] for p in polygon["coordinates"][0][:-1]) / (len(polygon["coordinates"][0]) - 1)
    compare = client.post("/api/rotation/compare", json={
        "zone": "barranca", "latitude": centre_lat, "longitude": centre_lng, "polygon": polygon,
        "current": DEMO_CURRENT, "priorities": DEMO_PRIORITIES, "water_turn": "no_se",
        "current_source": "farmer_declared", "use_team_templates_as_fallback": False})
    compare.raise_for_status()
    health = client.get("/api/health").json()
    out = {
        "_note": "Precomputed Barranca example (barranca-1, yellow maize sown Feb 2026, default priorities). "
                 "Shown only if the live API fails for this exact input; labelled as precomputed.",
        "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "api": health,
        "input": {"zones": DEMO_ZONES, "current": DEMO_CURRENT, "priorities": DEMO_PRIORITIES, "water_turn": "no_se"},
        "spatial_plan": plan.json(),
        "compare": compare.json(),
    }
    target = ROOT / "frontend" / "src" / "barrancaExampleResult.json"
    target.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    ids = [s["id"] for s in out["compare"]["strategies"]]
    print(f"written {target.name}: {len(target.read_text(encoding='utf-8')) // 1024} KB, strategies {ids}")


if __name__ == "__main__":
    main()
