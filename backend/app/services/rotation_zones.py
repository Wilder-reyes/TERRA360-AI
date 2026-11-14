# AI-assisted: written with Claude Code (Anthropic) and reviewed by the TERRA360 team.
"""Demo zones for the coastal rotation comparator (Field Shift).

Both centroids come from the SAME official source: MIDAGRI Padrón Nacional de
Sectores Estadísticos 2024 (statistical-sector centroids, NOT parcels or
cadastral boundaries). The 2024 PDF URL on siea.midagri.gob.pe now redirects,
so the Internet Archive snapshot used to verify the rows is also recorded.

Upper-basin boxes are rough rectangles for regional rainfall context only; they
are NOT official watershed delineations (ANA).
"""
from __future__ import annotations

PADRON_URL = ("https://siea.midagri.gob.pe/portal/media/attachments/publicaciones/"
              "superficie/sectores/2024/Padron_Nacional_SE_2024_0403.pdf")
PADRON_ARCHIVE_URL = "https://web.archive.org/web/20250621172257/" + PADRON_URL

ZONES: dict[str, dict] = {
    "huaral": {
        "id": "huaral",
        "name": "Huaral",
        "valley": "Chancay-Huaral",
        "sector": {"name": "HUANDO", "code": "15060105", "district": "Huaral",
                   "province": "Huaral", "region": "Lima",
                   "sector_area_ha": 2183.86, "agricultural_area_ha_2024": 1434.31,
                   "padron_row": 5016},
        "lat": -11.47918514, "lng": -77.18041962,
        "upper_basin": {"name": "Cuenca alta del río Chancay-Huaral (rectángulo aproximado)",
                        "name_en": "Upper Chancay-Huaral basin (approximate box)",
                        "bbox": [-76.95, -11.50, -76.45, -11.05]},
    },
    "barranca": {
        "id": "barranca",
        "name": "Barranca",
        "valley": "Pativilca / Supe",
        "sector": {"name": "CHACARITA", "code": "15020105", "district": "Barranca",
                   "province": "Barranca", "region": "Lima",
                   "sector_area_ha": 1755.55, "agricultural_area_ha_2024": 1533.61,
                   "padron_row": 4887},
        "lat": -10.73888977, "lng": -77.72982679,
        "upper_basin": {"name": "Cuenca alta del río Pativilca (rectángulo aproximado)",
                        "name_en": "Upper Pativilca basin (approximate box)",
                        "bbox": [-77.35, -10.60, -76.80, -10.05]},
    },
}

COMMON = {
    "coordinate_type": "official_sector_centroid_not_parcel",
    "source": "MIDAGRI, Padrón Nacional de Sectores Estadísticos 2024",
    "source_url": PADRON_URL,
    "source_archive_url": PADRON_ARCHIVE_URL,
    "boundary_validated": False,
}


def list_zones() -> list[dict]:
    return [{**zone, **COMMON} for zone in ZONES.values()]


def get_zone(zone_id: str) -> dict:
    if zone_id not in ZONES:
        raise KeyError(zone_id)
    return {**ZONES[zone_id], **COMMON}
