# TERRA360 AI · NASA Space Apps Challenge 2026

**Interfaz:** https://terra360-ai.netlify.app/  
**API:** https://terra360-api.onrender.com/api/health  
**Tipo:** prototipo de apoyo a decisiones agrícolas; **no** ofrece prescripciones de siembra validadas.

## Qué hace hoy la plataforma

- Mapa central con búsqueda mundial de localidades, ubicación por clic, polígonos editables y mediciones aproximadas de área.
- Datos históricos regionales de NASA POWER y gráficos de lluvia en el panel del mapa.
- Mapa de **aptitud agrícola histórica** FAO/IIASA GAEZ v5 para maíz, papa y cebada en una ventana de estudio de Cusco: aptas, moderadas, poco aptas, sin datos y agua. Cuatro escenarios de agua/manejo y clases originales consultables. [Método y uso](docs/agricultural-suitability.md).
- Capas visuales de NASA GIBS: precipitación IMERG, humedad de suelo SMAP, NDVI MODIS y relieve SRTM, con fuente, fecha, escala y enlace a leyenda oficial. No se extraen píxeles de estos mosaicos para calcular la salud de cultivos.
- Altitud y gradiente orientativo de cinco muestras SRTM90m a través de OpenTopoData, bajo consulta explícita y con cuota. No es una medición de campo.
- Catálogo ampliado con **2.568 especies FAO ECOCROP + 95 fichas originales** (pueden existir especies repetidas). Búsqueda por nombres comunes, científicos y sinónimos. La fuente ECOCROP es experticia publicada, no aptitud local validada.
- ARIE AI compara hasta cinco cultivos por reglas estructurales y restricciones declaradas, presenta un plan visual para revisar y se abstiene de proponer aptitud cuando faltan evidencias. No predice rendimiento, ahorro de agua ni fechas de cosecha.
- Predicción experimental de lluvia mensual con **Chronos-2 preentrenado**, histórico real NASA POWER y comparación estacional. Incluye un informe preparado de Calca que caduca, sin cargar el modelo en la API pública. [Abrir y actualizar la demo](docs/pretrained-rain-demo.md). El modelo no superó la referencia en ambos periodos de prueba y no interviene en decisiones agrícolas.
- Interfaces de usuario con lenguaje sencillo y sin descargar JSON. JSON sigue siendo el protocolo interno entre React y FastAPI.

## Fuentes y límites

| Sistema | Qué se usa | Qué NO permite afirmar |
| --- | --- | --- |
| NASA POWER | Lluvia, temperatura/humedad y periodos históricos de contexto regional | Agua disponible o sensores de parcela |
| NASA GIBS IMERG/SMAP/MODIS/SRTM | Visualizaciones regionales originales del proveedor, separadas de análisis numéricos | Precipitación, humedad o NDVI exactos en una parcela |
| NASA GPM IMERG Late V07 (por área) | Pondera celdas NASA originales de 0,1° cuando existe granule privado de origen verificado | Lluvia exacta de la parcela; sin bucket y token conectados no existe dato numérico |
| ESA Sentinel-2 vía Planetary Computer | NDVI real por polígono en una escena y observaciones separadas por fecha con B04/B08, corrección BOA, máscara SCL y cobertura | Diagnóstico de salud, crecimiento, tendencias calibradas, rendimiento o aptitud agrícola |
| FAO ECOCROP vía CGIAR | 2.568 fichas de estimaciones de requisitos ecológicos de calidad heterogénea | Aptitud local, producción garantizada o calendario confiable |
| NASA SMAP SPL3SMP_E V006 | Lector HDF5 de humedad superficial DCA AM y calidad de la celda nativa 9 km | Sensor en parcela o agua de zona radicular; requiere granule NSIDC real autenticado |
| FAO GAEZ v5 | Doce extractos verificados RES05-SIX de maíz/papa/cebada, clima 2001–2020 y secano/riego con insumos bajos/altos, con agrupación regional de clases | No es humedad actual medida, éxito de cosecha, diagnóstico de parcela ni recomendación validada. La consulta antigua del código bruto de yuca continúa separada |
| OpenTopoData SRTM90m | Altitud y gradiente ilustrativo de la zona (5 muestras) | Pendiente medida dentro del polígono |

**Fuente de las especies:** FAO ECOCROP mediante [CGIAR Climate Action Data Hub](https://cgiar-climate-data-hub.github.io/catalog/ecocrop/), con procedencia inmutable de OpenCLIM y licencia CC BY 4.0. **Attribution:** Source data from the FAO EcoCrop database, Food and Agriculture Organization of the United Nations. [Método reproducible](scripts/import_ecocrop.py).

## Arquitectura y despliegue

- React / TypeScript / Vite, React Leaflet y Recharts en Netlify.
- FastAPI, Python, Docker en Render Free.
- Netlify enruta `/api/*` a Render; `EARTHDATA_TOKEN` solo en backend, nunca en frontend.
- API: `GET /api/health`, `GET /api/arie/catalog`, `GET /api/arie/crops`, `POST /api/arie/evaluate`, `GET /api/environment/nasa-power/daily`, `GET /api/environment/terrain` y consultas históricas/satélite.
- NASA GPM y SMAP tienen flujo de ingesta autenticada privada preparado con almacenamiento S3/R2 y cuotas; no hay bucket ni credenciales configuradas en Render Free. Las solicitudes públicas nunca descargan archivos NASA ni muestran valores ficticios; las visualizaciones NASA GIBS siguen siendo independientes.
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

[Plan de ML/DL para aptitud agrícola, riesgos y recomendación de cultivos](docs/ml-dl-agricultural-decisions-plan.md).

[Mapa de aptitud agrícola: fuentes, clases y reproducción](docs/agricultural-suitability.md). En el mapa, selecciona **Aptitud agrícola → cultivo → escenario → Mostrar aptitud**. Implementación local en la rama de trabajo; no se ha desplegado al sitio público.

[Primera implementación: modelo preentrenado de lluvia](docs/pretrained-rain-demo.md) · [Alcance del piloto](docs/ml-pilot-scope.md). En el mapa, selecciona **Predicción de lluvia → Ir al piloto de Calca → Consultar estimación de lluvia**.

[Adaptación LoRA: tres entrenamientos reales y comparación con el original](docs/rain-fine-tuning-experiment.md). Se amplió el histórico a treinta años; se conserva el original porque los ajustes no aportaron la mejora mínima de validación.

[Hoja de ruta actualizada v0.15](docs/roadmap-v0.15.md) · [Histórico v0.14](docs/roadmap-v0.14.md) · [Histórico v0.13](docs/roadmap-v0.13.md) · [Histórico v0.12](docs/roadmap-v0.12.md) · [Histórico v0.11](docs/roadmap-v0.11.md) · [Histórico v0.10](docs/roadmap-v0.10.md) · [Requisitos UX](docs/farmer-first-ux-redesign.md) · [Protocolo con agricultores](docs/farmer-validation-protocol.md) · [Capas NASA GIBS](docs/gibs-layers.md) · [GitHub Issues](https://github.com/Wilder-reyes/TERRA360-AI/issues).

**El objetivo es que una persona sin conocimientos técnicos pueda ver, comprender y comparar información regional.** Las clases históricas GAEZ v5 ya se muestran con leyenda y procedencia verificadas; su validación agronómica local sigue pendiente. El NDVI Sentinel-2 por polígono y por fechas separadas se calcula técnicamente con escenas reales, pero todavía no ha sido validado con mediciones de campo ni permite inferir tendencias agrícolas.
