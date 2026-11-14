# Fixed Debian base: native GDAL/rasterio dependencies must be available at runtime.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

# Rasterio's binary wheels may link libexpat.so.1; slim omits it.
# Keep this native dependency explicit and check imports before deploying.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Fail at Docker build time, not when Render attempts to launch the new instance.
RUN python -c "import rasterio; import planetary_computer; from app.main import app; assert '/api/environment/sentinel-2/parcel-ndvi' in app.openapi()['paths']; assert '/api/environment/smap/regional-daily' in app.openapi()['paths']; assert '/api/environment/gaez-v5/selected-layer' in app.openapi()['paths']; assert '/api/environment/gaez-v5/selected-layer/raw-cell' in app.openapi()['paths']; assert '/api/environment/gpm-imerg/polygon-daily' in app.openapi()['paths']; assert '/api/rotation/compare' in app.openapi()['paths']; print('Native raster / FastAPI import OK')"

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
