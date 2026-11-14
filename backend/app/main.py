import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.arie_routes import router as arie_router
from app.api.history_routes import router as history_router
from app.api.satellite_routes import router as satellite_router
from app.api.terrain_routes import router as terrain_router
from app.api.ndvi_routes import router as ndvi_router
from app.api.imerg_polygon_routes import router as imerg_polygon_router
from app.api.smap_routes import router as smap_router
from app.api.gaez_routes import router as gaez_router
from app.api.agro_routes import router as agro_router
from app.api.suitability_routes import router as suitability_router
from app.api.risk_routes import router as risk_router

app = FastAPI(
    title="TERRA360 API",
    description="Earth observation and agricultural decision support for user-selected coordinates worldwide.",
    version="0.10.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip() and origin.strip() != "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(arie_router)
app.include_router(history_router)

app.include_router(satellite_router)
app.include_router(terrain_router)
app.include_router(ndvi_router)
app.include_router(imerg_polygon_router)
app.include_router(smap_router)
app.include_router(gaez_router)
app.include_router(agro_router)
app.include_router(suitability_router)
app.include_router(risk_router)
