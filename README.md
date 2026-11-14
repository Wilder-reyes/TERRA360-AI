# TERRA360 AI v0.7 — NASA Space Apps Challenge 2026

**Field Shift: Adapting Farms with NASA Data** — herramienta explicable de apoyo a decisiones agrícolas. El usuario elige un lugar del mundo; **no existe ubicación por defecto**. El catálogo inicial se limita a cinco especies andinas con fuentes citadas, **no** constituye cobertura agronómica mundial.

## Nuevo en v0.7

- **Búsqueda de imágenes satelitales** Sentinel-2 disponibles para el punto que elige el usuario mediante el catálogo público Microsoft Planetary Computer (ESA/Copernicus). Muestra fechas y nubosidad, **no calcula NDVI** ni utiliza esas observaciones como indicación de salud agrícola.
- **Preparación para dominio propio NASA Space Apps / GoDaddy Registry / Porkbun**, con instrucciones de canje manual y dos opciones de hosting de React.
- **Preparación para GitHub Copilot**: reglas científicas del proyecto, prompt de revisión, pruebas automatizadas y publicación opcional por GitHub Pages.
- **Backend Python en Docker**, configuración opcional Render, CORS por dominio y conmutador para limitar las descargas GPM en sitios públicos.
- Documentación: [`docs/hosting-and-domain.md`](docs/hosting-and-domain.md). **No se ha reclamado ni desplegado ningún dominio.**

## Qué hace (3 pasos)

1. **Mi terreno:** elegir un punto, ver lluvia, temperatura y gráficos NASA POWER. Opcionalmente, comparar años completos, la lluvia típica de cada mes de diez años y una fecha de GPM IMERG.
2. **Mis cultivos:** seleccionar y ordenar los cultivos; indicar historial real, prioridad, agua; opcionalmente mes de siembra, suelo, equipos, destino de cosecha, mercado y presupuesto.
3. **Mi decisión:** comparar S0 (historial), S1 (búsqueda de orden estructural con menos cultivos consecutivos de la misma familia) y S2 (revisión del agua). ARIE AI enumera hasta 120 órdenes posibles, aplica restricciones declaradas, explica una opción estructural a revisar **o se abstiene de declarar un ganador**. Permite imprimir y exportar datos con fuentes.

**No** predice rendimientos, no prescribe riego ni calcula ingresos a partir de datos insuficientes. IA de restricciones significa búsqueda combinatoria; el predictor climático experimental existe para investigación, **no está entrenado, desplegado ni gobierna las recomendaciones**.

## Instalación Windows — dos terminales (en carpeta extraída)

Python 3.12 y Node.js 22 o posterior. No necesitas crear cuentas adicionales ni contratar servicios de IA.

Terminal 1 en PowerShell:

```powershell
cd "C:\RUTA\TERRA360\backend"
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Para GPM, crea `backend/.env` local con `EARTHDATA_TOKEN=...` y nunca compartas ese archivo. Si existe, no lo sobrescribas. NASA POWER no necesita ese token.

Terminal 2:

```powershell
cd "C:\RUTA\TERRA360\frontend"
npm.cmd ci
npm.cmd run build
npm.cmd run test
npm.cmd run dev
```

Abre http://localhost:5173/ y http://127.0.0.1:8000/docs. La selección del punto es obligatoria para las consultas de clima; NO se usa automáticamente la coordenada de Calca. `npm.cmd` evita el bloqueo de PowerShell a `npm.ps1`.

### Ejecutar pruebas en Windows

Desde la **raíz**, con el virtualenv creado:

```powershell
$env:PYTHONPATH = (Resolve-Path .\backend).Path
.\backend\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

### Experimento de IA predictiva (opcional, NO necesario para usar TERRA360)

Entrena con registros históricos **reales** de NASA POWER en tu ubicación elegida (se conecta a NASA y descarga una cantidad limitada de años). Debes ejecutar este experimento voluntariamente desde `backend`:

```powershell
.\.venv\Scripts\python.exe train_rain_ai.py --latitude -13.32175 --longitude -71.95605 --years 15
```

El comando ejemplifica coordenadas de Calca, pero no selecciona esa localidad en la aplicación. El informe `backend/models/experimental_rain_report.json` muestra dos pruebas cronológicas frente a una referencia estacional; los resultados se consideran exploratorios incluso cuando mejoran. **El predictor no influye en las decisiones de siembra** hasta validación espacial y agronómica.

## API

- `GET /api/health`, `GET /api/pilot` (solo ejemplo histórico, no selección automática)
- `GET /api/environment/nasa-power/daily` (requiere coordenadas)
- `GET /api/environment/nasa-power/history` (requiere coordenadas; años completos)
- `GET /api/environment/nasa-power/seasonality` (requiere coordenadas; lluvia histórica mensual, bajo demanda)
- `GET /api/environment/gpm-imerg/daily` (requiere coordenadas, NASA Earthdata)
- `GET /api/arie/catalog`, `GET /api/arie/parameters`, `GET /api/arie/decision-method`, `POST /api/arie/evaluate`

## Evidencia y límites

- `docs/scientific-foundation.md` — fuentes indexadas y parámetros del sistema.
- `docs/ai-model-card.md` — qué IA está activa y qué ML es experimental.
- `docs/data-expansion.md` — qué fuentes están realmente integradas (y cuáles NO).
- `docs/acceptance-checklist.md` — criterios y pendientes de verificación.
- `QA_REPORT.md` — pruebas ejecutadas y su alcance.
- `backend/app/data/parameter_catalog.json` — catálogo estructurado con 21 parámetros, unidades, procedencia y estados.

No incorporar `.env`, `.venv`, `node_modules`, datos descargados ni modelos locales a repositorios o archivos ZIP. No confundir datos NASA en cuadrícula con medidas in situ de una parcela. Debe intervenir un agricultor/agrónomo local ante calendarios, riego real, plagas, variedades, suelo, equipos y mercados.

## Integración Microsoft Planetary Computer (v0.7)

El usuario elige un punto y, si quiere, pulsa **Buscar imágenes**. El backend llama a STAC y devuelve metadatos de escenas Sentinel-2 para una zona alrededor del punto. Esta búsqueda puede no devolver escenas si hay nubosidad elevada o falta de cobertura; los resultados no son medidas de terreno ni diagnósticos. La integración fue probada con respuestas simuladas, **no con una consulta en vivo comprobada desde este entorno**.

- API: `GET /api/environment/planetary-computer/scenes?latitude=...&longitude=...&days=120&cloud_limit=35`.
- Para preparar dominio, GitHub Copilot y despliegue: `docs/hosting-and-domain.md`.
- Para el proyecto público, configure `CORS_ORIGINS` y proteja las descargas GPM: `GPM_DOWNLOADS_ENABLED=false` en producción inicial.
