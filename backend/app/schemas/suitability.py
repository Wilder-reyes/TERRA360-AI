"""Bounded, geographic requests; management assumptions must be explicit."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator


class SuitabilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    crop_id: Literal["maize", "potato", "barley", "faba"]
    management: Literal["LRLM", "HRLM", "LILM", "HILM"]
    # GeoJSON order, degrees, EPSG:4326. Dateline-crossing boxes are unsupported.
    bbox: tuple[float, float, float, float]

    @model_validator(mode="after")
    def geographic_box(self):
        west, south, east, north = self.bbox
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError("bbox must be [west, south, east, north], ordered within geographic bounds")
        if east - west < 1e-7 or north - south < 1e-7:
            raise ValueError("bbox spans must be at least 1e-7 degrees")
        return self
