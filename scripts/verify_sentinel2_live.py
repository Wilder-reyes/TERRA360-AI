#!/usr/bin/env python3
"""Opt-in network integration check: actual B04/B08/SCL COG reads for Calca.

Never substitute this external test for radiometric/field accuracy validation.
"""
import asyncio
import json
from app.services.sentinel_ndvi import calculate_parcel_ndvi

# Approximate 250m x 240m area near Calca, Cusco. NOT a surveyed farm.
PARCEL = {"type":"Polygon","coordinates":[[
    [-71.95720,-13.32270],
    [-71.95490,-13.32270],
    [-71.95490,-13.32050],
    [-71.95720,-13.32050],
    [-71.95720,-13.32270]
]]}


async def main():
    result = await calculate_parcel_ndvi(PARCEL, days=240, cloud_limit=50)
    report = {
        "status": result["status"],
        "scene": result["scene"],
        "metrics": result["metrics"],
        "attempted_scenes": result["attempted_scenes"],
        "period": result["period"],
        "used_in_crop_decision": result["used_in_crop_decision"],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if result["status"] != "available":
        raise SystemExit("LIVE SATELLITE CHECK INCONCLUSIVE: no sufficiently clear image pixels; not proof the algorithm failed.")
    m = result["metrics"]
    assert m["ndvi"] is not None
    assert 20 <= m["valid_pixels"] <= m["parcel_pixels"]
    assert m["valid_fraction_percent"] >= 60
    assert -1 <= m["ndvi"]["mean"] <= 1
    assert not result["used_in_crop_decision"]
    print("LIVE SENTINEL-2 RASTER PIPELINE VERIFIED. Not a field-validation result.")


if __name__ == "__main__":
    asyncio.run(main())
