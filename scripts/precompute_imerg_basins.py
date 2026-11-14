# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Compute «agua que viene»: GPM IMERG monthly rain over each upper basin.

Requires a NASA Earthdata token in backend/.env (EARTHDATA_TOKEN=...). Never
commit that file. Reads only the basin window of each monthly IMERG granule
(GPM_3IMERGM v07) through earthaccess and writes the summary to
backend/app/data/imerg_basin_seed.json, which the API serves without a token.

Usage (from the repo root):
    backend/.venv/Scripts/python.exe scripts/precompute_imerg_basins.py [--start 2001]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.imerg_basin import PRODUCT, SEED_PATH, VERSION, iter_granule_values, summarise  # noqa: E402
from app.services.rotation_zones import ZONES  # noqa: E402


def main(start_year: int) -> None:
    import earthaccess
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend" / ".env")
    if not os.getenv("EARTHDATA_TOKEN"):
        sys.exit("EARTHDATA_TOKEN missing in backend/.env (create it at https://urs.earthdata.nasa.gov).")
    earthaccess.login(strategy="environment")
    end = datetime.now(timezone.utc)
    out = {"product": PRODUCT, "version": VERSION, "computed_at": end.isoformat(timespec="seconds"), "zones": {}}
    for zid, z in ZONES.items():
        bbox = z["upper_basin"]["bbox"]
        results = earthaccess.search_data(short_name=PRODUCT, version=VERSION,
                                          temporal=(f"{start_year}-01-01", end.strftime("%Y-%m-%d")),
                                          bounding_box=tuple(bbox))
        print(f"{zid}: {len(results)} monthly granules")
        files = earthaccess.open(results)
        series = {}
        for n, (ym, value) in enumerate(iter_granule_values(files, bbox), 1):
            series[ym] = value
            if n % 24 == 0:
                print(f"  {ym}: {value} mm")
        summary = summarise(series)
        out["zones"][zid] = {"basin_es": z["upper_basin"]["name"], "basin_en": z["upper_basin"]["name_en"],
                             "bbox": bbox, "monthly_mm": dict(sorted(series.items())), **summary}
        print(f"  climatology: {summary['climatology_mm_month']}")
        print(f"  seasons: {summary['seasons']}")
    SEED_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"written {SEED_PATH}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--start", type=int, default=2001)
    main(p.parse_args().start)
