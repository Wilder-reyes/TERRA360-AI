#!/usr/bin/env python3
"""Network test: real time-separated Sentinel-2 COG windows and SCL in Calca.

This verifies actual remote processing, not crop conditions or a field survey.
"""
import asyncio
import json
from app.services.sentinel_timeseries import calculate_parcel_ndvi_series

# Illustrative coordinate outline ONLY. Not an identified farm.
POLYGON={"type":"Polygon","coordinates":[[
    [-71.95720,-13.32270],[-71.95490,-13.32270],
    [-71.95490,-13.32050],[-71.95720,-13.32050],
    [-71.95720,-13.32270]
]]}

async def main():
    output=await calculate_parcel_ndvi_series(
        POLYGON,days=240,cloud_limit=70,max_observations=3,
    )
    report={
        "status":output["status"],
        "period":output["period"],
        "catalog_sample_size":output["catalog_sample_size"],
        "attempted_scenes":output["attempted_scenes"],
        "valid_observation_count":output["valid_observation_count"],
        "observations":[{
            "date":p["date"],"id":p["scene_id"],"status":p["status"],
            "scene_cloud_percent":p["scene_cloud_percent"],
            "valid_fraction_percent":(p["metrics"] or {}).get("valid_fraction_percent"),
            "mean_ndvi":((p["metrics"] or {}).get("ndvi") or {}).get("mean"),
        } for p in output["observations"]],
        "can_infer_vegetation_trend":output["can_infer_vegetation_trend"],
        "used_in_crop_decision":output["used_in_crop_decision"],
    }
    print(json.dumps(report,indent=2,ensure_ascii=False))
    if output["status"] != "available":
        raise SystemExit("INCONCLUSIVE LIVE SERIES: fewer than two qualifying raster dates; no synthetic observations allowed.")
    valid=[r for r in output["observations"] if r["status"]=="available"]
    assert len(valid)>=2
    assert len(set(r["date"] for r in valid))==len(valid)
    assert all(r["metrics"]["valid_pixels"]>=20 for r in valid)
    assert all(r["metrics"]["valid_fraction_percent"]>=60 for r in valid)
    assert all(-1<=r["metrics"]["ndvi"]["mean"]<=1 for r in valid)
    assert output["attempted_scenes"]<=8
    assert output["used_in_crop_decision"] is False
    assert output["can_infer_vegetation_trend"] is False
    print("PASS: REAL SENTINEL-2 MULTI-DATE COG READS WITH SCL QUALITY. No field validation.")


if __name__=="__main__":
    asyncio.run(main())
