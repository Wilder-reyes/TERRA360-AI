"""Public metrics only. Adapter weights and training artifacts remain private."""
from datetime import date, datetime
from typing import Literal

from pydantic import Field, model_validator
from app.schemas.rain_forecast import Contract, ForecastRequest


class ExperimentScore(Contract):
    examples: Literal[24]
    mae_mm: float = Field(ge=0)
    seasonal_mae_mm: float = Field(ge=0)
    p10_p90_coverage: float = Field(ge=0, le=1)


class ExperimentDates(Contract):
    train_from: date
    train_to: date
    validation_from: date
    validation_to: date
    test_from: date
    test_to: date


class ExperimentConfiguration(Contract):
    method: Literal["lora"]
    rank: int = Field(ge=1, le=32)
    alpha: int = Field(ge=1, le=64)
    steps: int = Field(ge=10, le=200)
    learning_rate: float = Field(ge=1e-6, le=1e-3)
    batch_size: int = Field(ge=1, le=16)
    context_length: int = Field(ge=24, le=256)
    seed: int
    minimum_validation_improvement: Literal[0.05]


class ExperimentSelection(Contract):
    selected: Literal["original", "lora"]
    chosen_using: Literal["development_validation_only"]
    original: ExperimentScore
    lora: ExperimentScore


class ExperimentFold(Contract):
    from_month: date
    to_month: date
    original: ExperimentScore
    lora: ExperimentScore
    seasonal_mae_mm: float = Field(ge=0)


class ExperimentCandidate(Contract):
    experiment_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    learning_rate: float = Field(ge=1e-6, le=1e-3)
    steps: int = Field(ge=10, le=200)
    validation_mae_mm: float = Field(ge=0)


class RainExperimentReport(Contract):
    schema_version: Literal[1]
    experiment_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    candidate_experiment_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    records_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    created_at: datetime
    as_of: date
    location: ForecastRequest
    model_id: Literal["amazon/chronos-2"]
    model_revision: str = Field(pattern=r"^[a-f0-9]{40}$")
    history_months: int = Field(ge=158)
    training_months: int = Field(ge=84)
    independent_series: Literal[1]
    lead_months: int = Field(ge=2, le=3)
    dates: ExperimentDates
    configuration: ExperimentConfiguration
    adapter_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    trainable_parameters: int = Field(gt=0)
    total_parameters: int = Field(gt=0)
    packages: dict[str, str]
    validation: ExperimentSelection
    test_folds: list[ExperimentFold] = Field(min_length=2, max_length=2)
    test_previously_examined: Literal[True]
    candidates: list[ExperimentCandidate] = Field(min_length=3, max_length=3)
    eligible_for_publication: bool
    published: Literal[False]
    limitations: list[str]

    @model_validator(mode="after")
    def chronological(self):
        def ordinal(day):
            return day.year * 12 + day.month - 1
        d = self.dates
        if not d.train_from <= d.train_to < d.validation_from <= d.validation_to < d.test_from <= d.test_to:
            raise ValueError("Training, validation and test must be chronological")
        if ordinal(d.train_to) > ordinal(d.validation_from) - self.lead_months or ordinal(d.validation_to) > ordinal(d.test_from) - self.lead_months:
            raise ValueError("The selection must be available before each next evaluation origin")
        if self.trainable_parameters >= self.total_parameters:
            raise ValueError("LoRA must adapt a subset of model parameters")
        if self.test_folds[0].from_month != d.test_from or self.test_folds[-1].to_month != d.test_to:
            raise ValueError("Test fold dates do not match the experiment")
        if any(ordinal(fold.to_month) - ordinal(fold.from_month) != 23 for fold in self.test_folds):
            raise ValueError("Each test fold must cover 24 consecutive months")
        if ordinal(self.test_folds[1].from_month) != ordinal(self.test_folds[0].to_month) + 1:
            raise ValueError("Test folds must be consecutive and non-overlapping")
        if ordinal(d.train_to) - ordinal(d.train_from) + 1 != self.training_months:
            raise ValueError("Training sample count does not match its dates")
        if ordinal(d.test_to) - ordinal(d.train_from) + 1 != self.history_months:
            raise ValueError("History sample count does not match its dates")
        if ordinal(d.validation_to) - ordinal(d.validation_from) != 23:
            raise ValueError("Validation must cover 24 targets")
        for fold in self.test_folds:
            if abs(fold.original.seasonal_mae_mm - fold.seasonal_mae_mm) > 1e-8 or abs(fold.lora.seasonal_mae_mm - fold.seasonal_mae_mm) > 1e-8:
                raise ValueError("Both models must use the same seasonal reference")
        best = next((c for c in self.candidates if c.experiment_id == self.candidate_experiment_id), None)
        if len({c.experiment_id for c in self.candidates}) != 3:
            raise ValueError("Three distinct candidate runs are required")
        if best is None or best.learning_rate != self.configuration.learning_rate or best.steps != self.configuration.steps:
            raise ValueError("Selected adapter configuration does not match the candidate")
        if abs(best.validation_mae_mm - self.validation.lora.mae_mm) > 1e-8 or any(c.validation_mae_mm < best.validation_mae_mm - 1e-8 for c in self.candidates):
            raise ValueError("Candidate must be selected using minimum validation MAE")
        from app.ml.rain_adaptation import publish_adaptation, select_on_validation
        if self.validation.selected != select_on_validation(self.validation.original.model_dump(), self.validation.lora.model_dump(), self.configuration.minimum_validation_improvement):
            raise ValueError("Selection does not match validation results")
        if self.eligible_for_publication != publish_adaptation(self.validation.selected, [fold.model_dump() for fold in self.test_folds]):
            raise ValueError("Publication eligibility does not match test gates")
        return self
