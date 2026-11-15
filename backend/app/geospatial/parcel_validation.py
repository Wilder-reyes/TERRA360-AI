"""WGS84 GeoJSON polygon validation without satellite/network dependencies.

This gate is shared by the *optional* Chalhuas training CLI. It does not assert
land ownership, crop identity or suitability; area is a geodesic estimate.
"""
from __future__ import annotations
from math import isfinite
from shapely.geometry import Polygon
from pyproj import Geod

_MAX_VERTICES = 100
_GEOD = Geod(ellps='WGS84')

def validate_parcel(raw: dict) -> tuple[Polygon, float]:
    if not isinstance(raw,dict) or raw.get('type')!='Polygon':
        raise ValueError('Se requiere un polígono GeoJSON WGS84.')
    rings=raw.get('coordinates')
    if not isinstance(rings,list) or len(rings)!=1 or not isinstance(rings[0],list):
        raise ValueError('Solo se admite un contorno exterior sin huecos.')
    ring=rings[0]
    if not 4<=len(ring)<=_MAX_VERTICES+1 or ring[0]!=ring[-1]:
        raise ValueError('Se requieren 3–100 vértices y el contorno cerrado.')
    clean=[]
    for point in ring:
        if not isinstance(point,list) or len(point)!=2:
            raise ValueError('Las coordenadas deben ser [longitud,latitud].')
        longitude,latitude=point
        if (type(longitude) not in (float,int) or type(latitude) not in (float,int)
            or not isfinite(longitude) or not isfinite(latitude)
            or not -180<longitude<180 or not -80<=latitude<=80):
            raise ValueError('Coordenadas geográficas inválidas.')
        clean.append((float(longitude),float(latitude)))
    polygon=Polygon(clean)
    if polygon.is_empty or not polygon.is_valid or polygon.area<=0:
        raise ValueError('El polígono está vacío o se cruza consigo mismo.')
    minx,_,maxx,_=polygon.bounds
    if maxx-minx>=1:
        raise ValueError('No se admiten polígonos que crucen el antimeridiano.')
    area_m2=abs(_GEOD.geometry_area_perimeter(polygon)[0])
    if not 1000<=area_m2<=5_000_000:
        raise ValueError('Área admitida: 0.1–500 hectáreas.')
    return polygon,area_m2
