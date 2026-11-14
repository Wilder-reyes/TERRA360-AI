"""NASA NSIDC SMAP SPL3SMP_E Version 6: regional 9 km *AM* cell sample.

Reads native HDF5 DCA quality flags and coordinates. No interpolation, no
plot-scale soil moisture, no API-triggered NASA login/download.
"""
from __future__ import annotations

from datetime import date
from math import radians, sin, cos, asin, sqrt, isfinite
from pathlib import Path
from typing import Any

import h5py
import numpy as np
from app.services.sentinel_ndvi import validate_parcel

DATASET = "SPL3SMP_E"
VERSION = "006"
SOURCE_URL = "https://nsidc.org/data/spl3smp_e/versions/6"
GROUP = "Soil_Moisture_Retrieval_Data_AM"
MAX_DISTANCE_KM = 20.0


class SMAPError(RuntimeError):
    pass


def haversine_km(lat1: float, lon1: float, lat2: np.ndarray, lon2: np.ndarray) -> np.ndarray:
    a = np.radians(lat1)
    b = np.radians(lon1)
    c = np.radians(lat2)
    d = np.radians(lon2)
    h = np.sin((c-a)/2)**2 + np.cos(a)*np.cos(c)*np.sin((d-b)/2)**2
    return 6371.0088 * 2 * np.arcsin(np.sqrt(np.clip(h, 0, 1)))


def read_smap_am(file_path: Path, raw_polygon: dict, target_date: date) -> dict[str, Any]:
    polygon, area_m2 = validate_parcel(raw_polygon)
    center = polygon.representative_point()
    try:
        with h5py.File(file_path, "r") as h5:
            if GROUP not in h5:
                raise SMAPError("Falta el grupo oficial SMAP AM.")
            group = h5[GROUP]
            required = ("latitude", "longitude", "soil_moisture_dca",
                        "retrieval_qual_flag_dca")
            if any(name not in group for name in required):
                raise SMAPError("Faltan coordenadas o variables DCA SMAP oficiales.")
            shape = group["latitude"].shape
            if (len(shape) != 2 or group["longitude"].shape != shape or
                group["soil_moisture_dca"].shape != shape or
                group["retrieval_qual_flag_dca"].shape != shape or
                shape[0] > 4000 or shape[1] > 5000):
                raise SMAPError("Dimensiones HDF5 de SMAP no verificadas.")
            # Native SMAP geolocation: large sparse lat/lon arrays. Read only
            # geolocation, not entire soil moisture/quality data into RAM.
            latitude = np.asarray(group["latitude"][:], dtype=np.float32)
            longitude = np.asarray(group["longitude"][:], dtype=np.float32)
            valid_geo = (np.isfinite(latitude) & np.isfinite(longitude) &
                         (latitude >= -90) & (latitude <= 90) &
                         (longitude >= -180) & (longitude <= 180))
            local = (valid_geo & (np.abs(latitude-center.y) <= .22) &
                     (np.abs(longitude-center.x) <= .22))
            if not local.any():
                return _answer(target_date, area_m2, "out_of_spatial_coverage", None)
            rows, cols = np.where(local)
            distances = haversine_km(center.y, center.x,
                                     latitude[rows, cols], longitude[rows, cols])
            k = int(np.argmin(distances))
            row, col, distance = int(rows[k]), int(cols[k]), float(distances[k])
            if distance > MAX_DISTANCE_KM:
                return _answer(target_date, area_m2, "out_of_spatial_coverage", None)
            data_ds = group["soil_moisture_dca"]
            flag_ds = group["retrieval_qual_flag_dca"]
            raw_value = float(data_ds[row, col])
            flag = int(flag_ds[row, col])
            # SPL3SMP_E Version 6 DCA baseline: flag 0 is acceptable.
            fill = data_ds.attrs.get("_FillValue")
            fill_value = float(np.asarray(fill).flat[0]) if fill is not None else None
            good = (flag == 0 and isfinite(raw_value) and
                    0 <= raw_value <= 1 and
                    (fill_value is None or raw_value != fill_value))
            cell = {
                "center_latitude": round(float(latitude[row,col]), 5),
                "center_longitude": round(float(longitude[row,col]), 5),
                "distance_from_requested_center_km": round(distance, 2),
                "retrieval_quality_flag_dca": flag,
                "soil_moisture_m3_m3": round(raw_value, 4) if good else None,
            }
            return _answer(target_date, area_m2,
                           "available" if good else "insufficient_quality", cell)
    except (OSError, KeyError, TypeError) as exc:
        raise SMAPError("No se pudo leer el archivo HDF5 oficial SMAP.") from exc


def _answer(target_date: date, area_m2: float,
            status: str, cell: dict | None) -> dict[str, Any]:
    return {
        "status": status,
        "source": "NASA NSIDC SMAP Enhanced L3 Radiometer V006",
        "source_url": SOURCE_URL,
        "doi": "10.5067/M20OXIZHY3RJ",
        "product": DATASET,
        "version": VERSION,
        "date": target_date.isoformat(),
        "overpass": "AM",
        "algorithm": "DCA (dual channel algorithm)",
        "variable": "soil_moisture_dca",
        "unit": "m3/m3",
        "native_resolution_m": 9000,
        "parcel_area_ha_approx": round(area_m2 / 10000, 3),
        "representation": "nearest_native_9km_cell_not_field_sensor",
        "soil_moisture_m3_m3": (cell or {}).get("soil_moisture_m3_m3"),
        "cell": cell,
        "used_in_crop_decision": False,
        "can_infer_field_soil_moisture": False,
        "limitations": [
            "Un único píxel SMAP de 9 km no mide la humedad del suelo dentro de una parcela.",
            "El algoritmo DCA y la bandera de calidad solo indican validez del producto, no calibración local.",
            "La observación AM representa humedad superficial estimada (aprox. 0–5 cm), no toda la zona radicular.",
            "No se extrapola, interpola, calcula riego ni se modifica el motor de recomendaciones.",
        ],
    }


def regional_smap_from_archive(raw_polygon: dict, target_date: date) -> dict[str, Any]:
    polygon, area = validate_parcel(raw_polygon)
    from app.services.verified_archive import staged_granule, ArchiveError
    try:
        with staged_granule("smap", target_date) as path:
            if path is None:
                result = _answer(target_date, area, "data_unavailable", None)
                result["limitations"].append("No existe un HDF5 SMAP autenticado y verificado en el archivo privado.")
                return result
            result = read_smap_am(path, raw_polygon, target_date)
            result["provenance"] = "sha256_verified_calca_native_grid_subset_from_nasa_original"
            result["archive_format"] = "NASA-native-grid-regional-subset"
            result["limitations"].append(
                "El archivo archivado es un subconjunto regional de celdas NASA nativas; "
                "no es el HDF5 global original ni una medición de la parcela."
            )
            with h5py.File(path, "r") as derived:
                original_sha = derived.attrs.get("source_original_sha256")
                if isinstance(original_sha, str) and len(original_sha) == 64:
                    result["source_original_sha256"] = original_sha
            return result
    except ArchiveError as exc:
        raise SMAPError("Archivo privado SMAP inaccesible o sin integridad verificable.") from exc
