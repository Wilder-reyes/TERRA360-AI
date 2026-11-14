"""Bounded, provenance-preserving native-grid SMAP AM subset for the Calca pilot.

The official NASA global SPL3SMP_E V006 HDF5 can be hundreds of MiB.
Only exact observed AM cells (coordinates, DCA values and QA) are retained
under a fixed Calca geographic bounding box; no interpolation or resampling.
The derived file is never represented as an original NASA granule.
"""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path

import h5py
import numpy as np

from app.services.verified_archive import (
    ArchiveError, MAX_SMAP_SOURCE_BYTES, MAX_SMAP_SUBSET_BYTES,
    SMAP_CALCA_BOUNDS,
)

GROUP = "Soil_Moisture_Retrieval_Data_AM"
FIELDS = ("latitude", "longitude", "soil_moisture_dca", "retrieval_qual_flag_dca")
MAX_WINDOW_CELLS = 160


def create_calca_native_subset(source_path: Path, destination: Path) -> dict | None:
    """Return auditable original-source metadata, or None if no local AM geolocation.

    Output coordinates and DCA flags are copied from native HDF5 cells,
    with original dtype/attributes and no fabricated pixel values.
    """
    original_size = source_path.stat().st_size
    if not 1 <= original_size <= MAX_SMAP_SOURCE_BYTES:
        raise ArchiveError("SMAP original fuera del límite temporal autorizado.")
    checksum = sha256()
    with source_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(chunk)
    original_sha256 = checksum.hexdigest()

    try:
        with h5py.File(source_path, "r") as src:
            if GROUP not in src:
                raise ArchiveError("SMAP original no contiene grupo AM.")
            group = src[GROUP]
            if any(name not in group for name in FIELDS):
                raise ArchiveError("SMAP original no contiene coordenadas, DCA o calidad.")
            shape = group["latitude"].shape
            if (len(shape) != 2 or any(group[name].shape != shape for name in FIELDS)
                    or shape[0] > 4000 or shape[1] > 5000):
                raise ArchiveError("Dimensiones del SMAP original inválidas.")
            latitude = np.asarray(group["latitude"][:], dtype=np.float32)
            longitude = np.asarray(group["longitude"][:], dtype=np.float32)
            west, south, east, north = SMAP_CALCA_BOUNDS
            inside = (np.isfinite(latitude) & np.isfinite(longitude) &
                      (latitude >= south) & (latitude <= north) &
                      (longitude >= west) & (longitude <= east))
            if not inside.any():
                return None
            rows, cols = np.where(inside)
            r0, r1 = max(0, int(rows.min()) - 1), min(shape[0], int(rows.max()) + 2)
            c0, c1 = max(0, int(cols.min()) - 1), min(shape[1], int(cols.max()) + 2)
            if r1 - r0 > MAX_WINDOW_CELLS or c1 - c0 > MAX_WINDOW_CELLS:
                raise ArchiveError("Ventana regional SMAP excede dimensiones seguras.")
            destination.parent.mkdir(parents=True, exist_ok=True)
            with h5py.File(destination, "w") as out:
                out.attrs["terra360_derived_subset"] = "native_grid_calca_am_v1"
                out.attrs["source_product"] = "SPL3SMP_E"
                out.attrs["source_version"] = "006"
                out.attrs["source_original_sha256"] = original_sha256
                out.attrs["source_original_size_bytes"] = original_size
                out.attrs["native_resolution_m"] = 9000
                out.attrs["no_interpolation"] = True
                target_group = out.create_group(GROUP)
                for name in FIELDS:
                    original = group[name]
                    selected = original[r0:r1, c0:c1]
                    derived = target_group.create_dataset(
                        name, data=selected, compression="gzip", compression_opts=4,
                    )
                    for key, value in original.attrs.items():
                        derived.attrs[key] = value
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise ArchiveError("No fue posible extraer datos científicos SMAP nativos.") from exc
    size = destination.stat().st_size
    if not 1 <= size <= MAX_SMAP_SUBSET_BYTES:
        destination.unlink(missing_ok=True)
        raise ArchiveError("El subconjunto SMAP supera el límite de archivo privado.")
    return {
        "source_original_sha256": original_sha256,
        "source_original_size_bytes": original_size,
        "subset_bounds": list(SMAP_CALCA_BOUNDS),
        "subset_method": "unmodified_native_grid_AM_window_v1",
    }
