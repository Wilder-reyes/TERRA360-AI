"""Explicit, bounded farmer inputs for evidence-traceable rotation exploration."""
from typing import Literal
from datetime import date
from pydantic import BaseModel, Field, model_validator, ConfigDict
from app.data.crop_directory import KNOWN_CROP_IDS

CropId = str  # Restricted by the shared maintained directory, not by an arbitrary hard-coded Literal.
WaterAccess = Literal['unknown', 'rainfed', 'irrigated']
Priority = Literal['balanced', 'water', 'soil', 'diversity', 'income']
Texture = Literal['sandy', 'loamy', 'clayey', 'unknown']
Equipment = Literal['unknown', 'manual', 'animal', 'tractor', 'mixed']
MarketIntent = Literal['unknown', 'consumption', 'sale', 'mixed']


class ClimateContext(BaseModel):
    """Optional summary provided by the client from NASA POWER observations.

    It is displayed for provenance and NEVER used as a calibrated field forecast.
    """
    model_config = ConfigDict(allow_inf_nan=False)
    source: Literal["NASA POWER"] = "NASA POWER"
    start: date
    end: date
    valid_rain_days: int = Field(ge=0, le=366)
    precipitation_total_mm: float | None = Field(default=None, ge=0)
    temperature_mean_c: float | None = Field(default=None, ge=-100, le=70)

    @model_validator(mode="after")
    def validate_period(self):
        if self.start > self.end:
            raise ValueError("Climate start cannot follow end")
        if (self.end - self.start).days > 365:
            raise ValueError("Climate period must be at most 366 days")
        if self.valid_rain_days > (self.end - self.start).days + 1:
            raise ValueError("Valid days exceed requested period")
        if self.valid_rain_days == 0 and self.precipitation_total_mm is not None:
            raise ValueError("Rain total must be null when no valid rain days exist")
        return self


class ClimateSeasonality(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    source: Literal['NASA POWER'] = 'NASA POWER'
    months: list[float | None] = Field(min_length=12, max_length=12)
    years_with_data: int = Field(ge=0, le=50)

    @model_validator(mode='after')
    def validate_monthly_values(self):
        if any(v is not None and v < 0 for v in self.months):
            raise ValueError('Monthly rainfall cannot be negative')
        return self


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    crops: list[CropId] = Field(min_length=1, max_length=5)
    water_access: WaterAccess = 'unknown'
    soil_test_available: bool = False
    farmer_validation: bool = False
    climate_context: ClimateContext | None = None
    baseline_crops: list[CropId] = Field(default_factory=list, max_length=5)
    priority: Priority = 'balanced'
    soil_texture: Texture | None = None
    soil_ph: float | None = Field(default=None, ge=0, le=14)
    soil_organic_matter_pct: float | None = Field(default=None, ge=0, le=100)
    plot_name: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=500)
    sowing_month: int | None = Field(default=None, ge=1, le=12)
    equipment_access: Equipment = 'unknown'
    market_intent: MarketIntent = 'unknown'
    market_available_crops: list[CropId] | None = Field(default=None, max_length=5)
    budget_limit: float | None = Field(default=None, ge=0, le=1_000_000_000)
    region_crop_validation: bool = False
    # User-selected coordinates are only a NASA query point, not a surveyed parcel.
    climate_seasonality: ClimateSeasonality | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


    @model_validator(mode='after')
    def unique_proposed_crops(self):
        for crop in [*self.crops, *self.baseline_crops, *(self.market_available_crops or [])]:
            if crop not in KNOWN_CROP_IDS:
                raise ValueError('Unknown crop identifier; select a crop from the directory')
        if len(set(self.crops)) != len(self.crops):
            raise ValueError('Each crop may appear only once in the proposed sequence')
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError('Provide both latitude and longitude, or neither')
        if self.market_available_crops is not None and len(set(self.market_available_crops)) != len(self.market_available_crops):
            raise ValueError('Duplicated market crops are not allowed')
        # Observed baseline allows repetitions: actual rotations may repeat a crop.
        return self
