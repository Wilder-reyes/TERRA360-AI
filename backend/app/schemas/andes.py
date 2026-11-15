"""Transport schemas shared by the API and geometry validation."""
from pydantic import BaseModel,Field

class Subplot(BaseModel):
    id:str=Field(min_length=1,max_length=40)
    polygon:dict

class GeometryRequest(BaseModel):
    field:dict
    subplots:list[Subplot]=Field(max_length=10)
