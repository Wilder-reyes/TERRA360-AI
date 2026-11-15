# BIOTEX — Etapa 3: integración de datos científicos y mapas

**Fecha:** 2026-11-15 (America/Lima).
**Base:** `BIOTEX-etapas-0-2.zip` de la etapa 2; incluye el código de las etapas 0 y 1 de Codex, cuyo commit original fue `c2023c330ca44a658e24d36511d2bf172dd7a3b9`.
**Entrega:** `BIOTEX-etapas-0-3.zip` y parche de la etapa 3. Esta copia archivada no incluye `.git`, por lo que NO tiene commit nuevo y NO se ha hecho push ni deploy.

## Cambios implementados

### 1. Catálogo verificable de fuentes y límites

- Archivo `backend/app/services/scientific_registry.py`: inventario de NASA HLS, NASA GIBS (MODIS NDVI e IMERG), NASA POWER, GPM IMERG (polígono), NASA SMAP, SRTM, ECOSTRESS, Sentinel-2 L2A y ERA5-Land. Registra nombre del producto, resolución nominal cuando corresponde, soporte temporal y espacial, URL oficial, ruta interna y estado del conector.
- Fuentes complementarias: SENAMHI, INIA, ANA, MIDAGRI y FAO, con estado inequívoco de **referencia externa** cuando no hay ingesta automática. En particular, **no se capturan todavía observaciones de estaciones SENAMHI**.
- Nuevo `GET /api/environment/scientific-sources` sin descargas ni efectos laterales. No debe confundirse la presencia en el catálogo con una observación disponible o validada.
- Se preservan los endpoints de ciencia previamente implementados; no se sustituyen conectores que ya funcionaban.

### 2. NASA POWER y QA

- El endpoint existente `GET /api/environment/nasa-power/daily` ahora incluye `quality` con fechas de consulta, número de días esperados, días disponibles por variable, porcentaje de cobertura y estado `complete`/`partial`.
- `backend/app/quality/evidence.py` es una utilidad pura y testeada: no cuenta duplicados, valores no finitos, booleanos ni fechas fuera de rango como registros válidos. Los faltantes no se sustituyen por cero.
- En `Mi terreno`, el usuario ve la lluvia acumulada **en registros disponibles** y la cobertura exacta, sin declarar total anual cuando faltan días. La temperatura se acompaña de días válidos.
- El cálculo del frontend también comprueba duplicados y filas fuera del periodo; no depende de una afirmación optimista del servidor.

### 3. Capas científicas en el mapa existente

- `frontend/src/scientificLayers.ts` centraliza identificadores reales de NASA GIBS (`MODIS_Terra_NDVI_8Day`, `IMERG_Precipitation_Rate`), resolución nominal, periodicidad, enlace oficial y advertencias.
- El usuario conserva fecha UTC y opacidad. La selección muestra **producto, soporte espacial, escala, interpretación temporal, limitaciones, URL NASA Worldview y acceso a la leyenda WMS `GetLegendGraphic`**.
- La fecha solicitada puede ser distinta de la fecha real del producto devuelto por el WMS. Se indica expresamente que visualizar una tesela **no acredita datos de calidad validada sobre la parcela**.
- No se re-colorean los píxeles NASA ni se cambia el tema de impresión A4 de 18 mm. La celda esquemática de lluvia sigue identificada como ilustrativa.
- Las consultas científicas existentes para polígonos de Sentinel-2, GPM IMERG y SMAP siguen disponibles en el mismo componente opcional.

### 4. Resumen por fuente y opciones oficiales

- `FieldEvidence.tsx` visualiza SRTM, ET0 de referencia NASA POWER y, para el piloto de Mantaro, ERA5-Land con estados faltantes; no inventa datos si fallan los servicios.
- ECOSTRESS continúa marcado como metadatos de escenas no validados; no genera temperatura superficial sin QA.
- SENAMHI se muestra con enlace al directorio oficial y aviso explícito de que sus estaciones no se han descargado ni integrado en cálculos. INIA, ANA, MIDAGRI y FAO están enlazados como referencias, no mediciones.
- Los metadatos de fuente están disponibles para etapas posteriores de IA, motor agronómico e informe.

## Pruebas efectuadas

| Comprobación | Resultado |
|---|---|
| Frontend `node --experimental-strip-types --test tests/*.test.mjs` | **36/36 aprobadas** |
| Backend nuevas pruebas `PYTHONPATH=backend python -m unittest tests.test_scientific_provenance -v` | **5/5 aprobadas** |
| TypeScript módulos puros nuevos (tsc global) | **Aprobado**, sin errores de tipo |
| Analizador TypeScript de los dos componentes React editados | **0 errores de sintaxis** |
| Python `compileall backend/app` | **Aprobado** |
| Modelo NASA HLS, `scripts/reproduce_field_shift_ai.py --check` | **Reproducido**: 44 válidas, 33 train / 11 holdout; Brier 0.23408067 vs baseline 0.48025712. No valida Chalhuas |
| Python suite completa | **No pasó en este entorno**: 117 tests iniciados, 19 errores de importación por dependencias ausentes, principalmente `earthaccess`, `s3fs`, `planetary_computer` |
| `npm ci --offline` | No disponible: faltan tarballs en caché (Vite) |
| `npm ci` con registro de npm | No disponible: error de npm en este entorno (`Exit handler never called`) |
| Build Vite / Playwright | **No ejecutados satisfactoriamente** porque faltan dependencias de frontend |
| Consulta real a NASA/SENAMHI/ECMWF desde servidor nuevo | **No certificada**; las consultas dependen de servicios externos y de la infraestructura futura |

**Validación externa pendiente:** en un equipo con las dependencias del proyecto instaladas ejecutar:

```bash
cd frontend
npm ci
npm run test
npm run build
npm run test:e2e
cd ..
# Instalar primero los requisitos del backend en un entorno aislado:
# python -m pip install -r backend/requirements.txt
PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py'
python scripts/reproduce_field_shift_ai.py --check
```

## Fuentes consultadas

- NASA GIBS: https://nasa-gibs.github.io/gibs-api-docs/access-basics/ (WMS temporal, acceso estándar).
- NASA GIBS catálogo: https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/ (productos y resoluciones de visualización, no equivalentes a sensor de campo).
- NASA GIBS leyenda: https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/ (`GetLegendGraphic`, sujeto a respuesta real del servidor).
- SENAMHI: https://www.senamhi.gob.pe/servicios/?p=estaciones (directorio oficial, no datos importados).

## Limitaciones y próximas etapas

- No se descargaron productos científicos originales nuevos ni se certificó disponibilidad de fechas o celdas específicas en NASA. El backend público nuevo aún no está desplegado; por ello no hay nuevas observaciones reales que reportar para una parcela determinada.
- Algunos proveedores requieren autorización Earthdata y materialización previa de archivos; otros tienen cuotas y resolución regional incompatible con parcelas pequeñas.
- El PNG de leyenda WMS depende de la respuesta del servidor: hay enlace al original como alternativa visual.
- No se ejecutaron los E2E nuevos; el código incluye un caso de navegador para verificar la procedencia y la distinción de SENAMHI.
- Etapa siguiente: **etapa 4 (IA real y evaluación reproducible)**, usando exclusivamente datasets y métricas verificadas, manteniendo la separación geográfica Barranca/Chalhuas y sin reconstruir la interfaz.
