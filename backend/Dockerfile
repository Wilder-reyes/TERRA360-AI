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

# Small verified JSON forecasts may be bundled under app/data/rain_forecasts.
# Never copy model weights into this lightweight public API image.
RUN python -c "from app.main import app; assert '/api/agro/rain-forecast' in app.openapi()['paths']"

# Verify all small, attributed regional suitability extracts without networking.
RUN python -c "from app.services.suitability import manifest, load_tile; [load_tile(c['id'], m['id']) for c in manifest()['crops'] if c['available'] for m in manifest()['management']]; print('FAO suitability extracts verified')"

# Validate risk inputs at build time; expiry is checked at request time.
RUN python -c "from app.services.risk_alerts import load_snapshot; s = load_snapshot(); assert len(s.points) == 9; print('Risk snapshot inputs verified')"

# Fail at Docker build time, not when Render attempts to launch the new instance.
RUN python -c "import rasterio; import planetary_computer; from app.main import app; assert '/api/environment/sentinel-2/parcel-ndvi' in app.openapi()['paths']; assert '/api/environment/smap/regional-daily' in app.openapi()['paths']; assert '/api/environment/gaez-v5/selected-layer' in app.openapi()['paths']; assert '/api/environment/gaez-v5/selected-layer/raw-cell' in app.openapi()['paths']; assert '/api/environment/gpm-imerg/polygon-daily' in app.openapi()['paths']; print('Native raster / FastAPI import OK')"

EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
