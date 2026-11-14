import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.arie_routes import router as arie_router
from app.api.history_routes import router as history_router
from app.api.satellite_routes import router as satellite_router
from app.api.terrain_routes import router as terrain_router
from app.api.ndvi_routes import router as ndvi_router

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
