
from datetime import date
from pathlib import Path
import math
from typing import Any

import xarray as xr
from app.connectors.earthdata import download_daily_granule, EarthdataError


GPM_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "gpm"
GPM_PRODUCT = "GPM_3IMERGDL"
GPM_VERSION = "07"
GPM_RUN = "Late"
GPM_VARIABLE = "precipitation"
GPM_ENGINE = "h5netcdf"

FILL_VALUE = -9999.900390625


class GPMIMERGError(RuntimeError):
    """Raised when GPM IMERG data cannot be read or processed."""



def find_daily_file(target_date: date) -> Path:
    """Find a local IMERG file or download it from NASA Earthdata."""

    date_text = target_date.strftime("%Y%m%d")
    pattern = f"3B-DAY-L.MS.MRG.3IMERG.{date_text}-S000000-E235959.*.nc4"

    files = sorted(GPM_DATA_DIR.glob(pattern))

    if files:
        return files[0]

    try:
        downloaded_file = download_daily_granule(target_date)
        return downloaded_file
    except EarthdataError as exc:
        raise GPMIMERGError(
            f"Could not obtain GPM IMERG data for {target_date.isoformat()}: {exc}"
        ) from exc

def extract_daily_precipitation(
    target_date: date,
    latitude: float,
    longitude: float,
) -> dict[str, Any]:
    """Extract the nearest IMERG grid-cell precipitation estimate."""

    if not -90 <= latitude <= 90:
        raise ValueError("Latitude must be between -90 and 90")

    if not -180 <= longitude <= 180:
        raise ValueError("Longitude must be between -180 and 180")

    file_path = find_daily_file(target_date)

    try:
        with xr.open_dataset(file_path, engine=GPM_ENGINE) as dataset:
            if GPM_VARIABLE not in dataset:
                raise GPMIMERGError(
                    f"Variable '{GPM_VARIABLE}' not found in GPM file"
                )

            pixel = dataset[GPM_VARIABLE].sel(
                lon=longitude,
                lat=latitude,
                method="nearest",
            ).isel(time=0)

            selected_latitude = float(pixel.lat)
            selected_longitude = float(pixel.lon)
            raw_value = pixel.item()

            if raw_value is None:
                precipitation = None
            else:
                raw_value = float(raw_value)
                precipitation = (
                    raw_value
                    if math.isfinite(raw_value) and raw_value != FILL_VALUE
                    else None
                )

    except (OSError, ValueError, KeyError) as exc:
        raise GPMIMERGError(
            f"Could not process GPM IMERG file: {exc}"
        ) from exc

    return {
        "source": "NASA GPM IMERG",
        "product": GPM_PRODUCT,
        "version": GPM_VERSION,
        "run": GPM_RUN,
        "date": target_date.isoformat(),
        "requested_location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "grid_cell": {
            "latitude": selected_latitude,
            "longitude": selected_longitude,
        },
        "spatial_resolution": "0.1 x 0.1 degree",
        "spatial_representation": (
            "Satellite-derived gridded estimate; "
            "not an in-situ station measurement"
        ),
        "variable": GPM_VARIABLE,
        "precipitation_mm_day": precipitation,
        "unit": "mm/day",
        "missing_value": precipitation is None,
        "file": file_path.name,
    }
