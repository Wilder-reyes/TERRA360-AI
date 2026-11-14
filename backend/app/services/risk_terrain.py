"""Operator-only native GLO-90 DSM slope screening over a ~3 km neighborhood."""
import math

import numpy as np
import rasterio
from rasterio.merge import merge
from pyproj import Geod


def summarize_terrain(latitude, longitude, paths):
    from contextlib import ExitStack
    lat_half = 1500 / 111320
    lon_half = lat_half / math.cos(math.radians(latitude))
    bounds = (longitude-lon_half, latitude-lat_half, longitude+lon_half, latitude+lat_half)
    with ExitStack() as stack:
        sources = [stack.enter_context(rasterio.open(path)) for path in paths]
        if any(s.crs.to_epsg() != 4326 or not 0 < s.res[0] < .001 or not 0 < s.res[1] < .001 for s in sources):
            raise ValueError("Unexpected DEM grid")
        values, transform = merge(sources, bounds=bounds, nodata=float("nan"), dtype="float32")
    return slope_summary(values[0], transform.a, abs(transform.e), latitude)


def slope_summary(values, step_lon, step_lat, latitude):
    if values.ndim != 2 or min(values.shape) < 3:
        raise ValueError("A neighborhood DEM is required")
    geod = Geod(ellps="WGS84")
    dx = geod.inv(0, latitude, step_lon, latitude)[2]
    dy = geod.inv(0, latitude, 0, latitude+step_lat)[2]
    gy, gx = np.gradient(values.astype(float), dy, dx)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))[1:-1, 1:-1]
    valid = np.isfinite(slope)
    fraction = float(valid.mean())
    return {"slope_p75_degrees": round(float(np.percentile(slope[valid], 75)), 3) if valid.any() else None,
            "valid_fraction": round(fraction, 4), "neighborhood_km": 3.0}
