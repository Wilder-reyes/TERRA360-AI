from datetime import date
from pydantic import BaseModel, Field


class EnvironmentQuery(BaseModel):
    latitude: float = Field(default=-13.32175, ge=-90, le=90)
    longitude: float = Field(default=-71.95605, ge=-180, le=180)
    start: date
    end: date
