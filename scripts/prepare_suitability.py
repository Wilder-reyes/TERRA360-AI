#!/usr/bin/env python3
"""Reproduce small Cusco native-grid extracts from twelve pinned FAO GeoTIFFs.

Run with backend/.venv/bin/python scripts/prepare_suitability.py --download.
Without --download this only reads locally cached originals. No ML dependencies.
The application serves these extracts offline, never fetching data per request.
"""
from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "backend/data/gaez-v5"
OUTPUT = ROOT / "backend/app/data/suitability"
BASE = "https://storage.googleapis.com/fao-gismgr-gaez-v5-data/DATA/GAEZ-V5/MAPSET/RES05-SIX/"
CATALOG = "https://data.apps.fao.org/catalog/dataset/514c92d5-9e01-4c70-814a-80ea1ca9fe6a"
README = CATALOG + "/resource/768b08ad-be9c-427a-84be-3a3d6dd7835a/download/_readme_res05.xlsx"
WIKI = "https://github.com/un-fao/gaezv5/wiki/"
# SHA-256 of original public GCS bytes, inspected 2026-11-14; never auto-updated.
HASHES = {
    "MZE.LRLM": "2faebf03fee99822b92ec7d22d797393c58a4ab6fc584e6deb63e4bdcb9f30b4",
    "MZE.HRLM": "8670aa038c18d5b9210afbc0d76fb27e6c417869ba07079f3e0e96b4299e561d",
    "MZE.LILM": "792e4640f4809936690744eca928dbeffa560950c2dc43f42a0272ceb1613b0f",
    "MZE.HILM": "6cf36cff0ea9d4d48c5c132d0753a70a8ec1c3498416b5bdedbc1619121a5e1b",
    "WPO.LRLM": "831af370ae9642775ffc6504321cb46c1846199a0b2c4347ea7d192af9f77ac7",
    "WPO.HRLM": "bd96a0de3402f356ab3d874b072bb4f906ac7a563bb4a7c08de948332b90526e",
    "WPO.LILM": "c500dfa7cabb476c4e9c905af81bdda36fc21d2af973716c2212ec13c3d227a7",
    "WPO.HILM": "80e68c1216de531ee6cb220bacc36e07dd9ef9865842aa1ce69d7df2038ed5c2",
    "BRL.LRLM": "35176b51e02ede5074ea3f460ae07ef16607c201dfc8c0fa9dc6cd9e04cc17dd",
    "BRL.HRLM": "805bf99db03ca5d2acc5e99ce0316cfd7304ba7b20f124edafe20ff6984ccd89",
    "BRL.LILM": "db45dda8a7223026ac122c3c720e1c064c210d96ff6e7aef01a4a9ae4de7df1f",
    "BRL.HILM": "30feefd7c7cd055c61cdd673640cb219d6ea67d2b91950160a0d4c2b3c9106b2",
}
CROPS = [
    {"id": "maize", "code": "MZE", "name": "Maíz (grano)", "name_en": "Maize (grain)",
     "scientific_name": "Zea mays", "available": True},
    {"id": "potato", "code": "WPO", "name": "Papa", "name_en": "White potato",
     "scientific_name": "Solanum tuberosum", "available": True},
    {"id": "barley", "code": "BRL", "name": "Cebada", "name_en": "Barley",
     "scientific_name": "Hordeum vulgare", "available": True},
    {"id": "faba", "code": None, "name": "Haba · sin capa disponible", "name_en": "Faba bean · layer unavailable",
     "scientific_name": "Vicia faba", "available": False},
]
MANAGEMENT = [
    {"id": "LRLM", "name": "Secano · insumos bajos", "name_en": "Rainfed · low inputs"},
    {"id": "HRLM", "name": "Secano · insumos altos", "name_en": "Rainfed · high inputs"},
    {"id": "LILM", "name": "Riego · insumos bajos", "name_en": "Irrigated · low inputs"},
    {"id": "HILM", "name": "Riego · insumos altos", "name_en": "Irrigated · high inputs"},
]


def encode(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def prepare(download=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets = {}
    for crop in CROPS:
        if not crop["available"]:
            continue
        assets[crop["id"]] = {}
        for scenario in MANAGEMENT:
            key = crop["code"] + "." + scenario["id"]
            name = "GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST." + key + ".tif"
            path = CACHE / name
            if not path.exists() and download:
                with httpx.stream("GET", BASE + name, timeout=45, follow_redirects=False) as response:
                    response.raise_for_status()
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > 2 * 1024 * 1024:
                            raise ValueError("Unexpectedly large FAO object")
                if sha256(content).hexdigest() != HASHES[key]:
                    raise ValueError("Original raster changed: " + name)
                path.write_bytes(content)
            raw = path.read_bytes()
            if sha256(raw).hexdigest() != HASHES[key]:
                raise ValueError("Original raster digest mismatch: " + name)
            with rasterio.open(path) as src:
                assert src.crs.to_epsg() == 4326 and src.shape == (2160, 4320)
                assert src.count == 1 and src.dtypes == ("uint8",) and src.nodata == 0
                assert np.allclose(tuple(src.transform)[:6], (1/12, 0, -180, 0, -1/12, 90), rtol=0, atol=1e-10)
                values = src.read(1, window=Window(1272, 1212, 48, 48))
                if not np.isin(values, range(10)).all():
                    raise ValueError("Unknown source classes")
            tile_file = crop["id"] + "-" + scenario["id"] + ".json"
            tile = encode({"source_sha256": HASHES[key], "window": [1272, 1212, 48, 48], "values": values.tolist()})
            (OUTPUT / tile_file).write_bytes(tile)
            assets[crop["id"]][scenario["id"]] = {
                "source_url": BASE + name, "source_sha256": HASHES[key], "source_bytes": len(raw),
                "tile_file": tile_file, "tile_sha256": sha256(tile).hexdigest(),
            }
    data = {
        "source": {"name": "FAO/IIASA GAEZ v5", "map_code": "RES05-SIX", "period": "2001–2020",
                   "climate": "AgERA5", "period_code": "HP0120", "verified_at": "2026-11-14",
                   "catalog_url": CATALOG, "inventory_url": README,
                   "method_url": WIKI + "07.-Module-V-(Integration-of-climatic-and-edaphic-evaluation)",
                   "license": "CC BY 4.0", "license_url": "https://creativecommons.org/licenses/by/4.0/",
                   "attribution": "FAO and IIASA, GAEZ v5 (2025). Native-grid Cusco extract and three-group display by TERRA360. CC BY 4.0.",
                   "locally_validated": False, "current_soil_moisture_measured": False},
        "coverage": {"bbox": [-74, -15, -70, -11], "name": "Ventana de estudio en torno a Cusco",
                     "name_en": "Study window around Cusco", "administrative_boundary": False},
        "pilot_bbox": [-72.33333333333333, -13.75, -71.66666666666667, -13.083333333333329],
        "grid": {"crs": "EPSG:4326", "step_degrees": 1/12, "global_width": 4320, "global_height": 2160, "nodata": 0},
        "crops": CROPS, "management": MANAGEMENT,
        "grouping": {"owner": "TERRA360 display grouping, not an official three-class FAO product",
                     "suitable": [1, 2, 3], "moderate": [4, 5], "low": [6, 7, 8], "no_data": [0], "water": [9],
                     "thresholds": "suitable: SI > 55; moderate: 25 < SI <= 55; low: SI <= 25, including not suitable. SI is not a probability.",
                     "original_class_labels": {"0": "No data", "1": "SI > 85: Very high", "2": "SI > 70: High",
                                               "3": "SI > 55: Good", "4": "SI > 40: Medium", "5": "SI > 25: Moderate",
                                               "6": "SI > 10: Marginal", "7": "SI > 0: Very marginal", "8": "Not suitable", "9": "Water"}},
        "factors": [
            {"id": "temperature", "name": "Temperatura", "name_en": "Temperature", "detail": "Régimen térmico histórico y requerimientos del cultivo (AgERA5).", "detail_en": "Historical thermal regime and crop requirements (AgERA5)."},
            {"id": "precipitation", "name": "Precipitaciones", "name_en": "Precipitation", "detail": "Clima histórico y balance de agua durante el ciclo de cultivo.", "detail_en": "Historical climate and crop-cycle water balance."},
            {"id": "soil_water", "name": "Agua en el suelo", "name_en": "Soil water", "detail": "Disponibilidad hídrica modelada: capacidad de retención, profundidad radicular y déficit de agua. Sin medición actual de humedad.", "detail_en": "Modeled water availability: water-holding capacity, rooting depth and water deficit. No current moisture measurement."},
            {"id": "terrain", "name": "Terreno", "name_en": "Terrain", "detail": "Restricciones del relieve y de la pendiente integradas por GAEZ.", "detail_en": "Terrain and slope constraints integrated by GAEZ."},
            {"id": "soil", "name": "Propiedades del suelo", "name_en": "Soil properties", "detail": "Evaluación edáfica HWSD v2: textura, profundidad, fertilidad y otras limitantes.", "detail_en": "HWSD v2 soil evaluation: texture, depth, fertility and other constraints."},
        ],
        "limitations": [
            "Historical regional model, not field-validated in Cusco and not a yield or success probability.",
            "Five arc-minute cells (~9 km); mixed land within cells, not field boundaries or current cropland masks.",
            "Irrigated scenarios assume irrigation; they do not demonstrate water availability or infrastructure.",
            "Generic crop models, not local cultivar validation, seasonal advice or current soil moisture measurements.",
            "The five factors are model inputs; this layer does not provide per-cell values or causal attribution for each factor.",
        ],
        "assets": assets,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"Prepared {sum(len(v) for v in assets.values())} verified native-grid extracts in {OUTPUT}")


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Fetch missing pinned FAO originals")
    prepare(parser.parse_args().download)
