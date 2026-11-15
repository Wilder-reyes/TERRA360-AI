"""Geodesic area and containment, independent of HTTP and crop inference."""
from app.schemas.andes import Subplot

def verified_subplots(field:dict,subplots:list[Subplot])->dict:
    """Geometry validation, not cadastral ownership or botanical suitability."""
    from shapely.geometry import shape
    from pyproj import Geod
    geod=Geod(ellps="WGS84")
    try:
        outer=shape(field)
        if outer.geom_type!="Polygon" or not outer.is_valid or not outer.exterior.is_simple:
            raise ValueError("Polígono principal inválido")
        outer_area=abs(geod.geometry_area_perimeter(outer)[0])/10000
        if not .1<=outer_area<=500:
            raise ValueError("La parcela debe tener entre 0,1 y 500 ha")
        if len({item.id for item in subplots})!=len(subplots):
            raise ValueError("Las subparcelas deben tener identificadores únicos")
        result=[]
        seen=[]
        for item in subplots:
            poly=shape(item.polygon)
            if poly.geom_type!="Polygon" or not poly.is_valid or not outer.covers(poly):
                raise ValueError("Una subparcela está fuera de la parcela principal o es inválida")
            area=abs(geod.geometry_area_perimeter(poly)[0])/10000
            if area<.01: raise ValueError("Subparcela demasiado pequeña")
            if any(poly.intersection(prev).area>1e-12 for prev in seen):
                raise ValueError("Las subparcelas no pueden solaparse")
            seen.append(poly)
            result.append({"id":item.id,"area_ha_approx":round(area,4),
                           "percent_of_field":round(area/outer_area*100,2)})
        return {
            "status":"geometry_validated_not_cadastral_or_agronomic",
            "field_area_ha_approx":round(outer_area,4),
            "subplots":result,
            "unallocated_area_ha_approx":round(max(0,outer_area-sum(row["area_ha_approx"] for row in result)),4),
            "crop_identity_verified":False,"land_ownership_verified":False,
        }
    except (TypeError,KeyError,ValueError,AttributeError) as exc:
        raise ValueError(str(exc)) from exc
