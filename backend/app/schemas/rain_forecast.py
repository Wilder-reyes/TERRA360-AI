"""Contracts shared by the offline experiment and the lightweight public API."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ForecastRequest(Contract):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RainMonth(Contract):
    month: date
    total_mm: float = Field(ge=0)


class RainQuantiles(Contract):
    p10_mm: float = Field(ge=0)
    median_mm: float = Field(ge=0)
    p90_mm: float = Field(ge=0)

    @model_validator(mode="after")
    def ordered(self):
        if not self.p10_mm <= self.median_mm <= self.p90_mm:
            raise ValueError("Rain quantiles must be ordered")
        return self


class ForecastModel(Contract):
    id: Literal["amazon/chronos-2"]
    revision: str = Field(pattern=r"^[a-f0-9]{40}$")
    package_version: str
    mode: Literal["pretrained_zero_shot"]
    fine_tuned: Literal[False] = False


class ForecastSource(Contract):
    name: Literal["NASA POWER"] = "NASA POWER"
    url: Literal["https://power.larc.nasa.gov/api/temporal/daily/point"]
    time_standard: Literal["UTC"] = "UTC"
    representation: str
    records_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    first_month: date
    last_month: date
    complete_months: int = Field(ge=1)
    retrieved_at: datetime


class ForecastFold(Contract):
    from_month: date
    to_month: date
    examples: int = Field(gt=0)
    mae_model_mm: float = Field(ge=0)
    mae_seasonal_mm: float = Field(ge=0)
    relative_improvement: float
    empirical_p10_p90_coverage: float = Field(ge=0, le=1)


class ForecastEvaluation(Contract):
    status: Literal["beat_seasonal_reference", "did_not_beat_seasonal_reference"]
    folds: list[ForecastFold] = Field(min_length=2, max_length=2)
    minimum_improvement_per_fold: float
    lead_months: int = Field(ge=1, le=3)
    independent_field_validation: Literal[False] = False
    data_vintages: Literal["retrospective_final_data_not_archived_vintages"]
    interval_calibrated: Literal[False] = False


class RainForecastReport(Contract):
    schema_version: Literal[1] = 1
    status: Literal["available"] = "available"
    issued_at: datetime
    as_of: date
    location: ForecastRequest
    model: ForecastModel
    source: ForecastSource
    target_month: date
    prediction: RainQuantiles
    seasonal_reference_mm: float = Field(ge=0)
    clipped_negative_quantiles: int = Field(ge=0)
    evaluation: ForecastEvaluation
    history: list[RainMonth] = Field(min_length=12, max_length=12)
    limitations: list[str]
    is_field_forecast: Literal[False] = False
    used_in_crop_decision: Literal[False] = False
    is_irrigation_prescription: Literal[False] = False

    @model_validator(mode="after")
    def coherent_dates(self):
        next_month = date(self.as_of.year + (self.as_of.month == 12), self.as_of.month % 12 + 1, 1)
        if self.target_month != next_month:
            raise ValueError("Target must be the next full calendar month")
        if self.source.last_month >= self.as_of.replace(day=1):
            raise ValueError("Only complete past months may enter the context")
        if any(row.month.day != 1 for row in self.history):
            raise ValueError("Monthly observations use month-start dates")
        if self.history[-1].month != self.source.last_month:
            raise ValueError("History and source must have the same last month")
        return self
