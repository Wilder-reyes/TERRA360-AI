# TERRA360 AI · NASA Space Apps Challenge 2026

**Interfaz:** https://terra360-ai.netlify.app/  
**API:** https://terra360-api.onrender.com/api/health  
**Tipo:** prototipo de apoyo a decisiones agrícolas; **no** ofrece prescripciones de siembra validadas.

## Nueva dirección de producto (v0.17, en planificación)

El siguiente piloto tiene como público objetivo a **agricultores peruanos** y se inicia en el **sector agrícola Huando (distrito y provincia de Huaral, Lima)**, usando el centroide estadístico MIDAGRI 2024 únicamente para orientar el mapa. Aún no se dispone de un perímetro verificado de chacra. Se priorizará un mapa móvil con **colores, leyendas y frases sencillas**, y un flujo de **fotografía para reconocer el posible tipo de cultivo**, con confirmación humana y selección manual si el modelo desconoce la planta. El catálogo completo de cultivos y la futura inferencia visual pertenecen al **backend**, no a una lista compleja que tenga que recorrer el agricultor.

**Importante:** el primer incremento v0.17 ya abre el mapa en Huando, simplifica las leyendas y permite una vista previa local de foto; **no existe un modelo visual entrenado ni se envían fotos al backend**. La programación automática de recortes SMAP de **Calca, Cusco** está en pausa hasta migrar con una zona verificada. No presentar los datos Calca como si midieran Huaral.

[Plan de producto, privacidad, arquitectura y criterios de aceptación v0.17](docs/roadmap-v0.17-huaral-farmer-vision.md).

## Experiencia principal v0.18: entender mi chacra

La interfaz predeterminada ahora se organiza en **Mi terreno → Cultivos para mi zona → Mi tablero e informe**, con ubicación inicial en Huando (Huaral), búsqueda por nombre de cultivo y una sola selección suficiente. Permite revisar opciones para investigar mediante **NASA POWER (5 años completos) + rangos generales FAO ECOCROP**, siempre con la advertencia de que **no existe validación de aptitud agronómica ni recomendación real de siembra**. El tablero combina gráficos de lluvia, temperatura y humedad con la opción de **Imprimir o guardar como PDF** desde el navegador.

La fotografía del cultivo es **solo una vista previa local**: el reconocimiento visual con IA aún no está entrenado ni desplegado. Las funciones avanzadas continúan disponibles en `/?vista=tecnica`, sin saturar la interfaz del agricultor.

[Alcance, ciencia y pruebas v0.18](docs/roadmap-v0.18-farmer-dashboard.md).

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
| NASA GIBS IMERG/SMAP/MODIS/SRTM | Visualizaciones regionales originales del proveedor, separadas de análisis numéricos | Precipitación, humedad o NDVI exactos en una parcela |
| NASA GPM IMERG Late V07 (por área) | Pondera celdas NASA originales de 0,1° cuando existe granule privado de origen verificado | Lluvia exacta de la parcela; sin bucket y token conectados no existe dato numérico |
| ESA Sentinel-2 vía Planetary Computer | NDVI real por polígono en una escena y observaciones separadas por fecha con B04/B08, corrección BOA, máscara SCL y cobertura | Diagnóstico de salud, crecimiento, tendencias calibradas, rendimiento o aptitud agrícola |
| FAO ECOCROP vía CGIAR | 2.568 fichas de estimaciones de requisitos ecológicos de calidad heterogénea | Aptitud local, producción garantizada o calendario confiable |
| NASA SMAP SPL3SMP_E V006 | Lector HDF5 de humedad superficial DCA AM y calidad de la celda nativa 9 km | Sensor en parcela o agua de zona radicular; requiere granule NSIDC real autenticado |
| FAO GAEZ v5 | GeoTIFF original de yuca (RES05-SIX/CSV/HP0120/AGERA5/HIST/LRLM) descargado temporalmente desde FAO con SHA-256 verificado; se consulta código bruto regional | Código bruto **no es porcentaje de aptitud**; no se habilita clasificación, recomendación ni diagnóstico del campo |
| OpenTopoData SRTM90m | Altitud y gradiente ilustrativo de la zona (5 muestras) | Pendiente medida dentro del polígono |

**Fuente de las especies:** FAO ECOCROP mediante [CGIAR Climate Action Data Hub](https://cgiar-climate-data-hub.github.io/catalog/ecocrop/), con procedencia inmutable de OpenCLIM y licencia CC BY 4.0. **Attribution:** Source data from the FAO EcoCrop database, Food and Agriculture Organization of the United Nations. [Método reproducible](scripts/import_ecocrop.py).

## Arquitectura y despliegue

- React / TypeScript / Vite, React Leaflet y Recharts en Netlify.
- FastAPI, Python, Docker en Render Free.
- Netlify enruta `/api/*` a Render; `EARTHDATA_TOKEN` solo en backend, nunca en frontend.
- API: `GET /api/health`, `GET /api/arie/catalog`, `GET /api/arie/crops`, `POST /api/arie/evaluate`, `GET /api/environment/nasa-power/daily`, `GET /api/environment/terrain` y consultas históricas/satélite.
- NASA GPM IMERG ya completó una primera ingesta real autenticada a Cloudflare R2 (7 nov 2026; SHA-256 verificado, según los registros compartidos por el operador). La primera ingesta SMAP superó el límite inicial de 65 MiB; v0.16 introduce una extracción regional de celdas nativas con SHA del original, sin guardar el HDF5 global. La repetición de SMAP y lectura en Render aún requieren verificación en producción. Las solicitudes públicas no descargan granules NASA ni inventan valores; NASA GIBS es independiente.
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

[Hoja de ruta actualizada v0.16](docs/roadmap-v0.16.md) · [Histórico v0.15](docs/roadmap-v0.15.md) · [Histórico v0.14](docs/roadmap-v0.14.md) · [Histórico v0.13](docs/roadmap-v0.13.md) · [Histórico v0.12](docs/roadmap-v0.12.md) · [Histórico v0.11](docs/roadmap-v0.11.md) · [Histórico v0.10](docs/roadmap-v0.10.md) · [Requisitos UX](docs/farmer-first-ux-redesign.md) · [Protocolo con agricultores](docs/farmer-validation-protocol.md) · [Capas NASA GIBS](docs/gibs-layers.md) · [GitHub Issues](https://github.com/Wilder-reyes/TERRA360-AI/issues).

**El objetivo es que una persona sin conocimientos técnicos pueda ver, comprender y comparar información regional.** La validación agronómica real y la interpretación por clases de GAEZ v5 siguen pendientes de metodología y ensayos adicionales; el TIFF original de FAO ya se ha verificado técnicamente, pero solo se consulta el código bruto de una celda regional. El NDVI Sentinel-2 por polígono y por fechas separadas se calcula técnicamente con escenas reales, pero todavía no ha sido validado con mediciones de campo ni permite inferir tendencias agrícolas.
