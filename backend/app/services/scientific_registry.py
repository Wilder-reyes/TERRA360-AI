"""Public science-source inventory; metadata is not evidence of a successful observation.

Never interpret ``linked_reference`` as an active machine ingestion connector.
This registry is also a contract for the source links shown to farmers.
"""
from __future__ import annotations

from typing import Any


SOURCES: tuple[dict[str, Any], ...] = (
    {
        "id": "hls", "provider": "NASA HLS", "dataset": "Harmonized Landsat and Sentinel-2 v2.0",
        "status": "historical_series_when_scene_quality_sufficient", "kind": "historical_pixel_observations",
        "unit": "NDVI (unitless)", "nominal_resolution_m": 30,
        "spatial_support": "quality_masked_pixel_history_not_verified_crop_identity",
        "temporal_support": "scene_dates_with_gaps", "source_url": "https://hls.gsfc.nasa.gov/",
        "endpoint": "/api/rotation/history", "used_in_agricultural_ranking": True,
        "application_scope": "vegetation_seasonality_not_local_crop_species_or_yield",
    },
    {
        "id": "esa_sentinel2", "provider": "ESA / Copernicus", "dataset": "Sentinel-2 Level-2A",
        "status": "live_scene_query_when_available", "kind": "quality_masked_pixel_observations",
        "unit": "NDVI (unitless)", "nominal_resolution_m": 10,
        "spatial_support": "parcel_polygon_with_clear_pixel_qa_not_crop_id",
        "temporal_support": "scene_dates_with_cloud_gaps", "source_url": "https://dataspace.copernicus.eu/",
        "endpoint": "/api/environment/sentinel-2/parcel-ndvi", "used_in_agricultural_ranking": False,
    },
    {
        "id": "nasa_gibs_ndvi", "provider": "NASA GIBS", "dataset": "MODIS Terra NDVI 8-Day",
        "status": "configured_external_wms_live_unverified", "kind": "raster_visualization",
        "unit": "NDVI (adimensional; escala según la leyenda del proveedor)",
        "nominal_resolution_m": 250, "spatial_support": "regional_pixel_not_parcel_measurement",
        "temporal_support": "8-day_composite_requested_date_may_snap_to_available_period",
        "source_url": "https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/",
        "layer_id": "MODIS_Terra_NDVI_8Day", "endpoint": "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi",
        "used_in_agricultural_ranking": False,
    },
    {
        "id": "nasa_gibs_imerg", "provider": "NASA GIBS", "dataset": "GPM IMERG precipitation rate",
        "status": "configured_external_wms_live_unverified", "kind": "raster_visualization",
        "unit": "precipitation rate (consultar leyenda oficial)",
        "nominal_resolution_m": 10000, "spatial_support": "regional_pixel_not_parcel_measurement",
        "temporal_support": "date_specific_requested_date_may_snap_to_available_period",
        "source_url": "https://nasa-gibs.github.io/gibs-api-docs/python-usage/",
        "layer_id": "IMERG_Precipitation_Rate", "endpoint": "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi",
        "used_in_agricultural_ranking": False,
    },
    {
        "id": "nasa_power", "provider": "NASA POWER", "dataset": "Daily point agroclimate",
        "status": "live_request_when_available", "kind": "gridded_point_estimate",
        "unit": "precipitation mm/day; temperature degC; relative humidity %",
        "nominal_resolution_m": None, "spatial_support": "regional_model_grid_not_farm_station",
        "temporal_support": "daily_utc", "source_url": "https://power.larc.nasa.gov/",
        "endpoint": "/api/environment/nasa-power/daily", "used_in_agricultural_ranking": True,
        "application_scope": "coastal_reference_climate_for_rotation_not_measured_irrigation",
    },
    {
        "id": "srtm", "provider": "NASA/USGS via Open Topo Data", "dataset": "SRTM90m DEM",
        "status": "live_request_when_available", "kind": "gridded_terrain_estimate",
        "unit": "m above sea level; approximate gradient degrees",
        "nominal_resolution_m": 90, "spatial_support": "neighbourhood_not_surveyed_plot",
        "temporal_support": "static_dem", "source_url": "https://www.opentopodata.org/datasets/srtm/",
        "endpoint": "/api/environment/terrain", "used_in_agricultural_ranking": False,
    },
    {
        "id": "gpm_polygon", "provider": "NASA GPM IMERG", "dataset": "Late V07 daily regional grid",
        "status": "requires_authorized_granule", "kind": "polygon_weighted_regional_estimate",
        "unit": "mm/day", "nominal_resolution_m": 10000,
        "spatial_support": "regional_grid_overlap_not_subpixel_measurement",
        "temporal_support": "daily_utc", "source_url": "https://gpm.nasa.gov/data/imerg",
        "endpoint": "/api/environment/gpm-imerg/polygon-daily", "used_in_agricultural_ranking": False,
    },
    {
        "id": "smap", "provider": "NASA NSIDC SMAP", "dataset": "SPL3SMP_E V006 DCA",
        "status": "requires_authorized_granule", "kind": "regional_surface_soil_moisture",
        "unit": "m3/m3", "nominal_resolution_m": 9000,
        "spatial_support": "regional_grid_not_parcel_sensor",
        "temporal_support": "daily", "source_url": "https://nsidc.org/data/spl3smp_e/versions/6",
        "endpoint": "/api/environment/smap/regional-daily", "used_in_agricultural_ranking": False,
    },
    {
        "id": "era5", "provider": "ECMWF via Open-Meteo", "dataset": "ERA5-Land historical archive",
        "status": "live_request_only_mantaro", "kind": "regional_reanalysis",
        "unit": "mm per historical year; degC",
        "nominal_resolution_m": 9000, "spatial_support": "regional_grid_not_farm_frost_alert",
        "temporal_support": "historical_complete_year", "source_url": "https://open-meteo.com/en/docs/historical-weather-api",
        "endpoint": "/api/andes/era5-land", "used_in_agricultural_ranking": False,
    },
    {
        "id": "ecostress", "provider": "NASA ECOSTRESS", "dataset": "V003 scenes",
        "status": "metadata_only_quality_unverified", "kind": "catalogue_metadata",
        "unit": None, "nominal_resolution_m": None,
        "spatial_support": "none_until_thermal_qa", "temporal_support": "scene_dates",
        "source_url": "https://ecostress.jpl.nasa.gov/data", "endpoint": "/api/andes/ecostress-scenes",
        "used_in_agricultural_ranking": False,
    },
    {
        "id": "senamhi", "provider": "SENAMHI Perú", "dataset": "Red de estaciones hidrometeorológicas",
        "status": "official_reference_no_live_data_ingested", "kind": "external_catalogue",
        "unit": None, "nominal_resolution_m": None, "spatial_support": "station_specific_after_verification",
        "temporal_support": "depends_on_station", "source_url": "https://www.senamhi.gob.pe/servicios/?p=estaciones",
        "endpoint": None, "used_in_agricultural_ranking": False,
    },
    {
        "id": "inia", "provider": "INIA Perú", "dataset": "Technical crop guidance",
        "status": "linked_reference_not_observation", "kind": "agronomic_reference",
        "unit": None, "nominal_resolution_m": None, "spatial_support": "publication_specific",
        "temporal_support": "publication_specific", "source_url": "https://www.gob.pe/inia",
        "endpoint": None, "used_in_agricultural_ranking": False,
    },
    {
        "id": "ana", "provider": "ANA Perú", "dataset": "Official water information",
        "status": "linked_reference_not_observation", "kind": "hydrology_reference",
        "unit": None, "nominal_resolution_m": None, "spatial_support": "source_specific",
        "temporal_support": "source_specific", "source_url": "https://www.ana.gob.pe/",
        "endpoint": None, "used_in_agricultural_ranking": False,
    },
    {
        "id": "midagri", "provider": "MIDAGRI Perú", "dataset": "Agricultural statistics",
        "status": "linked_reference_not_observation", "kind": "agronomic_reference",
        "unit": None, "nominal_resolution_m": None, "spatial_support": "published_region_or_sector",
        "temporal_support": "publication_specific", "source_url": "https://siea.midagri.gob.pe/",
        "endpoint": None, "used_in_agricultural_ranking": False,
    },
    {
        "id": "fao", "provider": "FAO", "dataset": "FAO-56 crop water guidelines",
        "status": "linked_reference_not_observation", "kind": "scientific_method_reference",
        "unit": None, "nominal_resolution_m": None, "spatial_support": "reference_not_automatically_localized",
        "temporal_support": "reference", "source_url": "https://www.fao.org/4/x0490e/x0490e00.htm",
        "endpoint": None, "used_in_agricultural_ranking": False,
    },
)


def public_catalog() -> dict[str, Any]:
    """Stable, serializable source metadata; no remote availability asserted."""
    return {
        "version": "2026-11-15", "purpose": "scientific_provenance_not_live_station_measurements",
        "sources": [dict(item) for item in SOURCES],
        "limitations": [
            "A rendered map tile is not a quality-validated observation at the farmer's plot.",
            "Regional climate grids must not be described as in-situ farm readings.",
            "SENAMHI is an official external reference; no station values have been ingested.",
        ],
    }
