# TERRA360 AI — NASA Space Apps Challenge 2026

**Demo pública:** https://terra360-ai.netlify.app/  
**Backend:** https://terra360-api.onrender.com/api/health  
**Repositorio:** `Wilder-reyes/TERRA360-AI` (privado)  
**Estado:** prototipo demostrativo; **no** herramienta de prescripción de siembra.

## Qué puede hacer un agricultor

**Explorar su terreno.** Seleccionar una ubicación en un mapa mundial, delimitar un rectángulo o polígono aproximado, ajustar vértices y consultar:
- Datos puntuales de lluvia, temperatura y humedad del aire de NASA POWER.
- Gráficos históricos de meses y años completos, sin convertirlos en pronósticos.
- Mapas visuales de lluvia IMERG, humedad de suelo SMAP L4 e índice de vegetación MODIS NDVI desde NASA GIBS, con fecha y advertencias de escala regional.
- Fechas de imágenes Sentinel-2 L2A disponibles en el catálogo ESA/Copernicus de Microsoft Planetary Computer. **No calcula NDVI Sentinel-2** ni diagnostica cultivos.

**Buscar cultivos.** Directorio introductorio de 95 especies y cultivos; búsqueda por nombre común, nombre científico, familia y sinónimos. De ellos, solo los cinco perfiles iniciales tienen referencias agronómicas particulares, y **ninguno demuestra aptitud local automática**. La API adicional `/api/arie/crops` permite consultas paginadas e insensibles a tildes.

**Comparar opciones.** ARIE AI explora órdenes de hasta cinco cultivos por familias botánicas y restricciones declaradas. Presenta un plan gráfico por campañas, la información faltante y comprobaciones antes de sembrar. Se abstiene de afirmar que un cultivo exploratorio es apto para una región. No predice cosechas, ahorro de agua, rentabilidad ni establece calendarios locales.

## Arquitectura

- `frontend/`: React + TypeScript + Vite + React Leaflet + Recharts; publicación automática por Netlify.
- `backend/`: Python + FastAPI; Docker y Render Free; NASA POWER, GIBS visual en navegador, catálogo Sentinel-2 STAC, comparador de cultivos.
- `tests/` y `frontend/tests/`: pruebas de contratos, catálogo, validaciones, motores y geometría.
- `netlify.toml`: proxy de `/api/*` desde Netlify a Render.
- `render.yaml`: configuración del backend Render gratuito.
- `.github/workflows/ci.yml`: validación automática.
- `.github/workflows/smoke-production.yml`: comprobación **manual** de la web pública, el backend y NASA POWER. No confundir pruebas automáticas con evaluación agronómica.

## Ejecutar localmente (Windows PowerShell)

En una terminal, desde la raíz del repositorio:

```powershell
py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
$env:PYTHONPATH = (Resolve-Path .\backend).Path
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

En otra terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run test
npm.cmd run build
npm.cmd run dev
```

Abre `http://localhost:5173/`. Para consultar GPM con Earthdata en un entorno privado, utiliza únicamente las variables seguras del backend. **No compartas ni subas `EARTHDATA_TOKEN` a Netlify ni al frontend.** El servicio público Render mantiene `GPM_DOWNLOADS_ENABLED=false` para evitar descargas protegidas sin control de uso; las visualizaciones NASA GIBS son un servicio público independiente.

## Fuentes y límites

- NASA POWER, NASA GIBS, GPM IMERG y SMAP: datos regionales. La imagen de fondo Esri no es un producto agronómico NASA.
- Sentinel-2 pertenece a ESA/Copernicus; el servicio STAC está alojado por Microsoft.
- FAO-56, INIA y artículos científicos son referencias; no sustituyen la validación local.
- ECOCROP (2.568 especies según FAO) y GAEZ v5 **aún no se han importado** ni se usan para determinar aptitud. Los 90 perfiles adicionales son un directorio exploratorio.
- El motor ARIE es **simbólico y explicable**, no un modelo entrenado de predicción agrícola. No se han realizado pilotos con agricultores que validen sus recomendaciones.

## Desarrollo y criterios de finalización

[Hoja de ruta verificable](docs/roadmap-v0.8.md) · [Requisitos UX centrados en el agricultor](docs/farmer-first-ux-redesign.md) · [Protocolo de validación](docs/farmer-validation-protocol.md) · [Datos y capas](docs/gibs-layers.md).

**Punto principal:** un agricultor no tiene que abrir JSON ni entender los códigos internos de las estrategias. Cada mapa debe indicar qué se observó, de dónde viene, qué significa y qué falta confirmar. El proyecto es un sistema de apoyo, no una recomendación agronómica certificada.
