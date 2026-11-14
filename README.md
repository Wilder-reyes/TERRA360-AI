# TERRA360 AI · NASA Space Apps Challenge 2026

**Interfaz:** https://terra360-ai.netlify.app/  
**API:** https://terra360-api.onrender.com/api/health  
**Tipo:** prototipo de apoyo a decisiones agrícolas; **no** ofrece prescripciones de siembra validadas.

## Qué hace hoy la plataforma

- Mapa central con búsqueda mundial de localidades, ubicación por clic, polígonos editables y mediciones aproximadas de área.
- Datos históricos regionales de NASA POWER y gráficos de lluvia en el panel del mapa.
- Capas visuales de NASA GIBS: precipitación IMERG, humedad de suelo SMAP, NDVI MODIS y relieve SRTM, con fuente, fecha, escala y enlace a leyenda oficial. No se extraen píxeles de estos mosaicos para calcular la salud de cultivos.
- Altitud y gradiente orientativo de cinco muestras SRTM90m a través de OpenTopoData, bajo consulta explícita y con cuota. No es una medición de campo.
- Catálogo ampliado con **2.568 especies FAO ECOCROP + 95 fichas originales** (pueden existir especies repetidas). Búsqueda por nombres comunes, científicos y sinónimos. La fuente ECOCROP es experticia publicada, no aptitud local validada.
- ARIE AI compara hasta cinco cultivos por reglas estructurales y restricciones declaradas, presenta un plan visual para revisar y se abstiene de proponer aptitud cuando faltan evidencias. No predice rendimiento, ahorro de agua ni fechas de cosecha.
- Interfaces de usuario con lenguaje sencillo y sin descargar JSON. JSON sigue siendo el protocolo interno entre React y FastAPI.

## Fuentes y límites

| Sistema | Qué se usa | Qué NO permite afirmar |
| --- | --- | --- |
| NASA POWER | Lluvia, temperatura/humedad y periodos históricos de contexto regional | Agua disponible o sensores de parcela |
| NASA GIBS IMERG/SMAP/MODIS/SRTM | Imágenes regionales originales del proveedor, no análisis de píxel propio | Precipitación, humedad o NDVI exactos en una parcela |
| ESA Sentinel-2 vía Planetary Computer | NDVI real por polígono en una escena y observaciones separadas por fecha con B04/B08, corrección BOA, máscara SCL y cobertura | Diagnóstico de salud, crecimiento, tendencias calibradas, rendimiento o aptitud agrícola |
| FAO ECOCROP vía CGIAR | 2.568 fichas de estimaciones de requisitos ecológicos de calidad heterogénea | Aptitud local, producción garantizada o calendario confiable |
| FAO GAEZ v5 | Documentación científica y vínculo para investigación | **Aún no hay rasters de aptitud GAEZ integrados** |
| OpenTopoData SRTM90m | Altitud y gradiente ilustrativo de la zona (5 muestras) | Pendiente medida dentro del polígono |

**Fuente de las especies:** FAO ECOCROP mediante [CGIAR Climate Action Data Hub](https://cgiar-climate-data-hub.github.io/catalog/ecocrop/), con procedencia inmutable de OpenCLIM y licencia CC BY 4.0. **Attribution:** Source data from the FAO EcoCrop database, Food and Agriculture Organization of the United Nations. [Método reproducible](scripts/import_ecocrop.py).

## Arquitectura y despliegue

- React / TypeScript / Vite, React Leaflet y Recharts en Netlify.
- FastAPI, Python, Docker en Render Free.
- Netlify enruta `/api/*` a Render; `EARTHDATA_TOKEN` solo en backend, nunca en frontend.
- API: `GET /api/health`, `GET /api/arie/catalog`, `GET /api/arie/crops`, `POST /api/arie/evaluate`, `GET /api/environment/nasa-power/daily`, `GET /api/environment/terrain` y consultas históricas/satélite.
- Descarga protegida de GPM deshabilitada en hosting público; visualizaciones NASA GIBS independientes.
- CI: `.github/workflows/ci.yml`; pruebas de navegador: `.github/workflows/e2e.yml`; smoke público: `.github/workflows/smoke-production.yml`; actualización de ECOCROP: `.github/workflows/import-ecocrop.yml`.

## Ejecutar localmente (Windows PowerShell)

Terminal 1, desde la raíz:

```powershell
py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

Terminal 2:

```powershell
cd frontend
npm.cmd ci
npm.cmd run test
npm.cmd run build
npm.cmd run dev
```

Abre `http://localhost:5173/`. No publiques archivos `.env`, tokens Earthdata, datos personales, `node_modules` ni modelos locales.

## Seguimiento y validación

[Hoja de ruta actualizada v0.12](docs/roadmap-v0.12.md) · [Histórico v0.11](docs/roadmap-v0.11.md) · [Histórico v0.10](docs/roadmap-v0.10.md) · [Requisitos UX](docs/farmer-first-ux-redesign.md) · [Protocolo con agricultores](docs/farmer-validation-protocol.md) · [Capas NASA GIBS](docs/gibs-layers.md) · [GitHub Issues](https://github.com/Wilder-reyes/TERRA360-AI/issues).

**El objetivo es que una persona sin conocimientos técnicos pueda ver, comprender y comparar información regional.** La validación agronómica real y la importación espacial GAEZ v5 siguen pendientes de datos y ensayos adicionales. El NDVI Sentinel-2 por polígono y por fechas separadas se calcula técnicamente con escenas reales, pero todavía no ha sido validado con mediciones de campo ni permite inferir tendencias agrícolas.
