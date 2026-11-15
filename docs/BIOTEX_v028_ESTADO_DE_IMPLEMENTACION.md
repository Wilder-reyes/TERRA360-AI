> Documento histórico: no configura ni publica la versión actual. Consulte `docs/BIOTEX_ARCHITECTURE.md` y `docs/vercel-deployment.md`.

# BIOTEX v0.28 — Estado verificado de ejecución de la hoja de ruta (Chalhuas)
Fecha de corte: 15 de noviembre de 2026. Esta matriz debe actualizarse con CI y evidencia geográfica cada vez que se publique.

## Enlace y compatibilidad
- Vista experimental: `/?pilot=chalhuas`. **No sustituye todavía** la vista estable Barranca `/`.
- Repositorio: [TERRA360-AI](https://github.com/Wilder-reyes/TERRA360-AI).
- Deploy: Vercel solo React/Vite estático; FastAPI/servicios en Render.
- Fuentes consideradas: estudio agrológico histórico Chalhuas, manual INIA de rotación de papa, Copernicus ERA5-Land, NASA HLS, NASA ECOSTRESS, NASA GIBS, SRTM/USGS.
- La ubicación del sector es `(-12.04700155, -75.36633862)`. La región de prueba dibujada automáticamente es **sintética**; no implica titularidad ni aptitud agronómica.

## Matriz de cumplimiento honesta
| Fase | Entregas de código | Estado comprobable / pendiente |
|---|---|---|
| **0. Auditoría** | Corrección de conversión HLS `AAAA-MM` a mes de la campaña; migración de año del guardado; pruebas unitarias | Implementado. Una grabación antigua sin año de base es inherentemente ambigua y se solicita confirmación; no se inventa una fecha |
| **1. Parcela piloto** | Navegador centrado en sector de Chalhuas; mapa de contorno sintético y dibujo a mano; superficie aproximada | Implementación de UX. **Parcela real verificada, propiedad/consentimiento y límites reales pendientes** |
| **2. Catálogo agronómico** | `andes_rotation.py`: papa, arveja, haba, quinua, cebada, avena, familias botánicas, tres secuencias de referencia y fuentes | Implementación exploratoria. **Fechas locales por especie/variedad, agua disponible, suelos y revisión de agrónomo pendientes**. No se aplica el catálogo costero |
| **3. Mapa y datos** | NASA GIBS MODIS NDVI/GPM con fechas y aviso de no-data; base topográfica Esri, SRTM 90m vía servicio existente; ERA5-Land histórico vía Open-Meteo; HLS bajo demanda; búsqueda NASA ECOSTRESS vía CMR | Conectores e interfaz implementados. **Validación de cobertura y QA en el polígono real pendiente**. ECOSTRESS devuelve solo metadatos de escenas: ningún LST falso; GLDAS permanece como investigación |
| **4. Motor de rotaciones** | API independiente `/api/andes/compare` de 4 campañas anuales; indicadores de familias, repeticiones y leguminosas; referencias INIA; distingue ejemplo vs historia del agricultor | Implementado como **comparador exploratorio, sin recomendación automática**. Reglas duras de clima/suelo/agua requieren validación local |
| **5. IA de Chalhuas** | `scripts/train_chalhuas_hls.py` reproduce entrenamiento si hay historia HLS real, parcela revisada, mínimo 40 meses válidos, holdout cronológico y mejora Brier | **Pipeline preparado; modelo local NO entrenado.** Sin datos y revisión del polígono no se activa. El modelo Barranca no se reutiliza |
| **6. Distribución espacial** | Vista de 4 años con colores por especie, dos subparcelas sintéticas, dibujo de subparcelas reales, verificación geodésica de límites/no-solapamiento, guardado local y cambio de cultivo por año | Implementado funcionalmente en el piloto. Subparcelas sintéticas son demostrativas; **zonificación real y aptitud no verificadas** |
| **7. UX/UI y BIO** | UI responsive y tutorial de BIO con salto/atrás/siguiente/repetir; propia `biotex-farmer-experience/SKILL.md`, guía UI UX Pro Max existente | Implementado. Las doce Aura skills se consideran guías seleccionadas **no instaladas automáticamente**; copiar sus archivos está sujeto a verificación de licencia |
| **8. Calidad/validación/publicación** | Pruebas frontend TypeScript, Python, Docker y Playwright, rutas independientes, exportación por impresión y WhatsApp; metadatos de versión actualizados | Comprobar en CI por commit. **Prueba con agricultores, evaluación agronómica externa y validación NASA de la nueva parcela pendientes**. No se debe promover como piloto validado en producción |

## Endpoints nuevos
- `GET /api/andes/catalog`: lista exploratoria de cultivos locales, procedencia y estado de calendario.
- `POST /api/andes/compare`: secuencias, indicadores de familias y restricciones **sin dictamen agronómico**.
- `POST /api/andes/validate-subplots`: área elipsoidal y comprobación de que las subparcelas están dentro de la parcela y no se solapan.
- `GET /api/andes/era5-land?latitude=...&longitude=...&year=2025`: climatología retrospectiva de ERA5-Land, valores solo si la serie supera la verificación de calidad.
- `GET /api/andes/ecostress-scenes?latitude=...&longitude=...`: metadatos de escenas NASA CMR, sin LST ni ET hasta QA.
- `GET /api/andes/sources`: contrato de procedencia y estado de cada capa.

## Seguridad científica y criterios reales de finalización
1. Revisar una parcela agrícola real en Chalhuas; registrar evidencia del polígono, imágenes, procedencia y consentimiento cuando corresponda. Hasta entonces, todo ejemplo lleva la etiqueta **sintético**.
2. Descargar/consultar observaciones NASA HLS, documentar número de meses con píxeles válidos, ausencia de nubes, escenas originales, fechas, polígono y fuente. Los meses sin observaciones permanecen nulos.
3. Entrenar solo si los datos cumplen las compuertas del pipeline y el holdout temporal supera un baseline. De lo contrario, presentar **modelo no disponible**.
4. Verificar cultivos, variedades, periodos de siembra, suelo, agua, heladas, plagas, costos y mercado con INIA/SENAMHI/ANA y un agrónomo local. No considerar un estudio histórico evidencia suficiente de 2026.
5. Obtener revisión de usabilidad de agricultores reales de la zona. No sustituirla por Playwright.
6. Promover a ruta principal únicamente cuando la experiencia del agricultor y la evidencia científica hayan sido validadas; mantener respaldo del piloto Barranca.

## Pruebas automáticas
- `npm run build`, `npm run test` en `frontend`; Playwright `frontend/e2e/chalhuas.spec.ts`.
- `python -m unittest discover -s tests -p 'test_andes_pilot.py'`.
- `python -m unittest discover -s tests -p 'test_chalhuas_training_gate.py'`.
- Comprobación API Render y Vercel previa a anunciar funcionalidad pública.
- Los datos regionales ERA5 (~11 km), IMERG (~10 km), MODIS (~250 m) y SRTM90 no constituyen mediciones puntuales de una parcela.

## Fuentes y método
- [Estudio agrológico de Chalhuas](https://cdn.www.gob.pe/uploads/document/file/5501553/4903730-estudio-agrologico.pdf?v=1701297728)
- [INIA — Manejo integrado del cultivo de papa](https://repositorio.inia.gob.pe/bitstream/20.500.12955/1146/1/MANUAL%20T%C3%89CNICO%20-%20MANEJO%20INTEGRADO%20DEL%20CULTIVO%20DE%20PAPA.pdf)
- [ERA5-Land (ECMWF)](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land)
- [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api)
- [NASA ECOSTRESS](https://ecostress.jpl.nasa.gov/data)
- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/)
- [Hoja de ruta maestra](BIOTEX_HOJA_DE_RUTA_ACTUAL_CHALHUAS.md).
