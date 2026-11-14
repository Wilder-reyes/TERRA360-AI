# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Precompute the monthly NDVI history of every example field and commit it.

Reads frontend/src/exampleFields.json (team_fields + test_fields), runs the
same backend service used by POST /api/rotation/history (HLS v2.0 on Microsoft
Planetary Computer, fallback Sentinel-2) and writes one JSON per field into
backend/app/data/history_seed/. The public demo then answers instantly; each
file keeps its computed_at date and is served with cache="precomputed".

Usage (from the repo root):
    backend/.venv/Scripts/python.exe scripts/precompute_rotation_history.py [--only huaral-1]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
warnings.filterwarnings("ignore")

from app.services.hls_history import SEED_DIR, monthly_history, seed_path  # noqa: E402


async def main(only: str | None, start_year: int) -> None:
    data = json.loads((ROOT / "frontend" / "src" / "exampleFields.json").read_text(encoding="utf-8"))
    fields = data.get("team_fields", []) + data.get("test_fields", [])
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    for field in fields:
        if only and field["id"] != only:
            continue
        polygon = field["polygon"]
        t = time.time()
        result = await monthly_history(polygon, start_year=start_year, prefer="hls")
        result.pop("cache", None)
        result["example_field_id"] = field["id"]
        seed_path(polygon, start_year, "hls").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        campaigns = result["detection"]["campaigns"]
        print(f"{field['id']}: {result['sensor_id']} {result['months_with_data']}/{result['months_total']} months, "
              f"{len(campaigns)} campaigns, {time.time() - t:.0f}s")
        if len(campaigns) < 3:
            print(f"  WARNING: fewer than 3 campaigns in 5 years; consider another polygon for {field['id']}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only")
    parser.add_argument("--start-year", type=int, default=2021)
    args = parser.parse_args()
    asyncio.run(main(args.only, args.start_year))
