"""Pure SRTM sampling and quality-checked regional gradient calculation."""
from math import atan,cos,degrees,hypot,radians
OFFSET_METERS=180.0

def sampling_points(lat: float, lon: float) -> list[tuple[float,float]]:
    if not -59.95 <= lat <= 59.95 or not -179.98 <= lon <= 179.98:
        raise ValueError("Out of safe SRTM coverage or too near map edge")
    d_lat = OFFSET_METERS / 111_320.0
    d_lon = OFFSET_METERS / (111_320.0 * max(.1, abs(cos(radians(lat)))))
    return [(lat,lon),(lat+d_lat,lon),(lat-d_lat,lon),
            (lat,lon+d_lon),(lat,lon-d_lon)]


def summarize_elevation(payload: dict, points: list[tuple[float,float]]) -> dict:
    rows=payload.get("results")
    if not isinstance(rows,list) or len(rows)!=5:
        raise ValueError("Elevation service returned incomplete data")
    elevations=[]
    for row in rows:
        if not isinstance(row,dict) or row.get("dataset")!="srtm90m":
            raise ValueError("Unexpected SRTM data provider")
        v=row.get("elevation")
        if not isinstance(v,(int,float)) or isinstance(v,bool) or not (-500<=v<=9000):
            raise ValueError("Missing or implausible SRTM elevation")
        elevations.append(float(v))
    center,north,south,east,west=elevations
    # Neighbouring elevation samples +/-180 m, not the farmer's property.
    dx=(east-west)/(2*OFFSET_METERS)
    dy=(north-south)/(2*OFFSET_METERS)
    angle=degrees(atan(hypot(dx,dy)))
    return {
        "source":"NASA/USGS SRTM v3 90 m via Open Topo Data",
        "source_url":"https://www.opentopodata.org/datasets/srtm/",
        "elevation_m":round(center,1),
        "neighborhood_min_m":round(min(elevations),1),
        "neighborhood_max_m":round(max(elevations),1),
        "approximate_gradient_degrees":round(angle,2),
        "samples":5,
        "spacing_m":OFFSET_METERS,
        "resolution_m_approx":90,
        "representation":"five_DEM_samples_around_query_point_not_property",
        "can_decide_field_slope":False,
        "limitations":"Elevations are interpolated DEM estimates; steep terrain and the actual polygon cannot be measured reliably from five 90-m samples.",
    }
