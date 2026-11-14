"""Validated, dated inputs for deterministic regional risk screening."""
from datetime import date, datetime, timedelta
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

Rain = Annotated[float, Field(ge=0, le=2000, strict=True)]
Soil = Annotated[float, Field(ge=0, le=1, strict=True)]
Temperature = Annotated[float, Field(ge=-90, le=65, strict=True)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class DailyRiskInput(InputModel):
    date: date
    precipitation_mm: Rain | None = None
    soil_m3_m3: Soil | None = None
    tmin_c: Temperature | None = None
    tmax_c: Temperature | None = None
    et0_mm: Annotated[float, Field(ge=0, le=50, strict=True)] | None = None

    @model_validator(mode="after")
    def temperature_order(self):
        if self.tmin_c is not None and self.tmax_c is not None and self.tmin_c > self.tmax_c:
            raise ValueError("Minimum temperature exceeds maximum")
        return self


class BaselineInput(InputModel):
    end_year: Annotated[int, Field(ge=1991, le=2020)]
    precipitation_30d_mm: Annotated[float, Field(ge=0, le=60000, strict=True)] | None
    soil_7d_m3_m3: Soil | None


class TerrainInput(InputModel):
    slope_p75_degrees: Annotated[float, Field(ge=0, le=90, strict=True)] | None
    valid_fraction: Annotated[float, Field(ge=0, le=1, strict=True)]
    neighborhood_km: float = 3.0
    source_assets: list[dict[str, str]] = Field(max_length=4)


class RiskPointInput(InputModel):
    id: Annotated[str, Field(pattern=r"^P0[1-9]$")]
    latitude: Annotated[float, Field(ge=-13.75, le=-13.25)]
    longitude: Annotated[float, Field(ge=-72.25, le=-71.75)]
    history_grid: tuple[float, float]  # [latitude, longitude], from provider.
    forecast_grid: tuple[float, float]
    history: list[DailyRiskInput] = Field(min_length=30, max_length=30)
    forecast: list[DailyRiskInput] = Field(min_length=7, max_length=7)
    baseline: list[BaselineInput] = Field(min_length=30, max_length=30)
    terrain: TerrainInput

    @model_validator(mode="after")
    def grid_and_dates(self):
        for grid in (self.history_grid, self.forecast_grid):
            if abs(grid[0] - self.latitude) > .001 or abs(grid[1] - self.longitude) > .001:
                raise ValueError("Provider grid differs from the fixed regional monitoring point")
        for rows in (self.history, self.forecast):
            if any(b.date - a.date != timedelta(days=1) for a, b in zip(rows, rows[1:])):
                raise ValueError("Daily inputs must be consecutive, ordered and unique")
        if {b.end_year for b in self.baseline} != set(range(1991, 2021)):
            raise ValueError("Baseline must contain each reference year exactly once")
        return self


class RiskSnapshot(InputModel):
    method_version: str
    issued_at: datetime
    expires_at: datetime
    forecast_start: date
    forecast_end: date
    history_start: date
    history_end: date
    points: list[RiskPointInput] = Field(min_length=9, max_length=9)
    provenance: list[dict[str, str]] = Field(min_length=2, max_length=40)

    @model_validator(mode="after")
    def consistent_snapshot(self):
        if self.issued_at.tzinfo is None or self.expires_at.tzinfo is None:
            raise ValueError("Snapshot timestamps need a timezone")
        if not timedelta(0) < self.expires_at - self.issued_at <= timedelta(hours=12):
            raise ValueError("Risk snapshot validity must be at most 12 hours")
        if self.forecast_end - self.forecast_start != timedelta(days=6) or self.history_end - self.history_start != timedelta(days=29):
            raise ValueError("Expected seven forecast days and thirty recent days")
        if self.history_end >= self.forecast_start:
            raise ValueError("History must precede the forecast")
        expected = {(lat, lon) for lat in (-13.25, -13.5, -13.75) for lon in (-72.25, -72.0, -71.75)}
        if {(p.latitude, p.longitude) for p in self.points} != expected or len({p.id for p in self.points}) != 9:
            raise ValueError("Unexpected or repeated regional monitoring points")
        for p in self.points:
            if (p.history[0].date, p.history[-1].date, p.forecast[0].date, p.forecast[-1].date) != (
                    self.history_start, self.history_end, self.forecast_start, self.forecast_end):
                raise ValueError("Point dates differ from the report periods")
        return self
