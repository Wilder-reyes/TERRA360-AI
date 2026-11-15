# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Compute «agua que viene»: GPM IMERG monthly rain over each upper basin.

Requires a NASA Earthdata token in backend/.env (EARTHDATA_TOKEN=...). Never
commit that file. Reads only the basin window of each monthly IMERG granule
(GPM_3IMERGM v07) through earthaccess and writes the summary to
backend/app/data/imerg_basin_seed.json, which the API serves without a token.

Usage (from the repo root):
    backend/.venv/Scripts/python.exe scripts/precompute_imerg_basins.py --start 2015 --zone barranca --max-granules 160
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.imerg_basin import PRODUCT, SEED_PATH, VERSION, iter_granule_values, summarise  # noqa: E402
from app.services.rotation_zones import ZONES  # noqa: E402


def main(start_year: int, zone: str = 'barranca', max_granules: int = 160, dry_run: bool = False) -> None:
    import earthaccess
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend" / ".env")
    if zone not in ZONES:
        sys.exit(f"Unknown zone {zone!r}.")
    if not 2001 <= start_year <= datetime.now(timezone.utc).year:
        sys.exit("start year must be 2001 through current year.")
    if not 12 <= max_granules <= 240:
        sys.exit("max granules must be between 12 and 240; stay within the selected quota.")
    if not dry_run:
        if not os.getenv("EARTHDATA_TOKEN"):
            sys.exit("EARTHDATA_TOKEN missing. Set the token privately in the environment.")
        earthaccess.login(strategy="environment")
    end = datetime.now(timezone.utc)
    out = {"product": PRODUCT, "version": VERSION, "computed_at": end.isoformat(timespec="seconds"), "zones": {}}
    for zid, z in ZONES.items():
        if zid != zone:
            continue
        bbox = z["upper_basin"]["bbox"]
        results = earthaccess.search_data(short_name=PRODUCT, version=VERSION,
                                          temporal=(f"{start_year}-01-01", end.strftime("%Y-%m-%d")),
                                          bounding_box=tuple(bbox))
        print(f"{zid}: {len(results)} monthly granules", flush=True)
        if not results:
            sys.exit("No matching NASA IMERG Final Run monthly granules. Verify product, version, dates and basin bounding box.")
        if len(results) > max_granules:
            sys.exit(f"Safety limit: {len(results)} granules exceeds --max-granules={max_granules}. Choose a later start year or review quota.")
        if dry_run:
            print("DRY RUN: discovered granules only; no download or output written.")
            continue
        probe = earthaccess.get_requests_https_session().get(results[0].data_links()[0], headers={"Range": "bytes=0-15"}, timeout=60)
        if probe.status_code == 403 and "EULA" in probe.text:
            sys.exit("NASA GES DISC: this Earthdata account has not accepted the GES DISC EULA. Approve it at "
                     "https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ and run again.")
        # Resumable: each month is checkpointed locally (backend/.cache, git-ignored),
        # and each granule is retried on network errors.
        ckpt_path = ROOT / "backend" / ".cache" / "imerg" / f"{zid}.json"
        ckpt_path.parent.mkdir(parents=True, exist_ok=True)
        series = json.loads(ckpt_path.read_text(encoding="utf-8")) if ckpt_path.exists() else {}
        for n, granule in enumerate(results, 1):
            link = granule.data_links()[0]
            start = link.split("3IMERG.")[1][:8]
            ym = f"{start[:4]}-{start[4:6]}"
            if ym in series:
                continue
            for attempt in range(4):
                try:
                    (_, value), = list(iter_granule_values(earthaccess.open([granule]), bbox))
                    break
                except Exception as exc:  # network blips (DNS, timeouts, 5xx)
                    if attempt == 3:
                        raise
                    wait = 10 * (attempt + 1)
                    print(f"  {ym}: {type(exc).__name__}, retry in {wait}s")
                    time.sleep(wait)
            series[ym] = value
            ckpt_path.write_text(json.dumps(series), encoding="utf-8")
            if n % 24 == 0:
                print(f"  {ym}: {value} mm ({n}/{len(results)})", flush=True)
        summary = summarise(series)
        out["zones"][zid] = {"basin_es": z["upper_basin"]["name"], "basin_en": z["upper_basin"]["name_en"],
                             "bbox": bbox, "monthly_mm": dict(sorted(series.items())), **summary}
        print(f"  climatology: {summary['climatology_mm_month']}")
        print(f"  seasons: {summary['seasons']}")
    if not dry_run:
        out["verification"] = {
            "status": "requires_manual_review",
            "start_year": start_year,
            "zone": zone,
            "max_granules_allowed": max_granules,
            "note": "Review months, bbox, source granules and season coverage before publishing."
        }
        SEED_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"written {SEED_PATH}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--start", type=int, default=2015)
    p.add_argument("--zone", choices=sorted(ZONES), default="barranca")
    p.add_argument("--max-granules", type=int, default=160)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    main(args.start, args.zone, args.max_granules, args.dry_run)
