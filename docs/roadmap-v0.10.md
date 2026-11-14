# Hoja de ruta TERRA360 AI — v0.10 · estado verificable

**Fecha:** 13 de noviembre de 2026 (Perú). **Destino:** https://terra360-ai.netlify.app/. **API:** https://terra360-api.onrender.com/. Los cambios técnicos se publican automáticamente desde `main`. Un commit aprobado en CI no equivale a verificación científica ni de experiencia real.

## Resultado ejecutivo

**Implementación técnica realizada:**
- Mapa central en los tres pasos con delimitación rectangular y poligonal, esquinas arrastrables, áreas aproximadas y topografía visual.
- Localidades globales buscables desde el mapa mediante Open-Meteo/GeoNames.
- Capas NASA GIBS de lluvia IMERG, humedad SMAP, vegetación MODIS NDVI (no Sentinel-2) y relieve SRTM; leyenda oficial por WMS, fecha y advertencias espaciales.
- Cuadro esquemático de 0,1° en vista IMERG, claramente separado de los límites del productor; no se inventa pixelado exacto.
- NASA POWER, lluvia histórica mensual y años completos dentro del panel lateral del mapa.
- Altitud y desnivel aproximados a partir de cinco muestras SRTM90m (Open Topo Data), solicitadas manualmente, con caché y límites para el proveedor público.
- **2.568 registros de FAO ECOCROP**, importados reproduciblemente y almacenados en el repositorio, más los 95 registros iniciales. Se identifican coincidencias posibles; los 2.568 no equivalen a recomendaciones válidas para una región.
- ARIE permite seleccionar hasta cinco cultivos y comparar una secuencia estructural; se abstiene de certificar cultivos exploratorios. Las fichas enseñan referencias en lenguaje sencillo.
- Plan de campañas no prescriptivo: indica secuencia, información faltante y ninguna fecha de cosecha inventada.
- Sin S0/S1/S2 visibles como opciones ni botones para abrir archivos JSON en el flujo agrícola. La API sí utiliza JSON internamente.
- Pruebas Python/React CI aprobadas; pruebas reales de Chromium escritorio/móvil **3 de 3 aprobadas**; smoke externo Netlify, Render, ARIE y NASA POWER **aprobado**. Estas pruebas son técnicas, no ensayos con agricultores.

**Lo no concluido científicamente:** importación e interpretación espacial específica de GAEZ v5, cálculo propio de NDVI Sentinel-2 con máscara SCL, estadísticas exactas de rasters GPM/SMAP sobre polígonos, calibración de calendarios/aptitud por variedad y lugar, modelo predictivo agronómico entrenado y validado, revisión independiente por agrónomos, pilotos con agricultores. **No se pueden marcar como hechos sin datos adicionales ni participantes.**

## Prioridad 1 — Reconstrucción geoespacial

| Entregable | Estado | Verificación |
|---|---|---|
| Mapa persistente, selección y delimitación con rectángulo o polígono editable | **Implementado; CI** | `frontend/src/GeoWorkspace.tsx`, `geometry.ts`, tests |
| Superficie geodésica aproximada y rechazo de polígonos cruzados | **Implementado; CI** | No es levantamiento catastral |
| Búsqueda de localidades | **Implementado; integración externa por comprobar** | Open-Meteo (GeoNames), no ubica la parcela exacta |
| NASA POWER: lluvia, temperatura, humedad y gráficos históricos | **Implementado; API verificada** | Datos regionales, sin predicción |
| Capas GPM IMERG, SMAP L4, MODIS NDVI y SRTM desde NASA GIBS | **Implementado; identificadores de las 4 capas comprobados en NASA WMS/metadata, mosaicos de fechas específicas requieren revisión visual** | WMS en navegador; **no** se extraen estadísticas científicas de los píxeles |
| Leyendas oficiales, metadatos y cuadro ilustrativo de 0,1° IMERG | **Implementado/parcial** | Algunas capas pueden no tener leyenda disponible; no confundir cuadrícula ilustrativa con píxel exacto |
| Altitud y gradiente del entorno SRTM90m | **Implementado; consulta externa sujeta a cupo** | OpenTopoData, 5 puntos a ±180 m, no pendiente de parcela |
| Detección real de vegetación Sentinel-2 B04/B08, calidad SCL, NDVI por parcela | **Pendiente** | Requiere procesamiento raster georreferenciado, calidad, muestras y pruebas |
| Lluvia/SMAP GPM raster cuantitativo por polígono con cobertura e incertidumbre | **Pendiente** | Actualmente imagen visual + punto NASA POWER como producto distinto |
| Mapa completo de pendiente derivada de DEM en área e incertidumbre | **Pendiente** | Actual: indicador grueso solo del entorno |
| Caché persistente, medición de latencia y control de cuotas por proveedor | **Parcial** | Terreno usa caché local y cuota conservadora; faltan tests de carga |

**Criterio de aceptación:** una zona coloreada debe indicar producto, periodo, origen, resolución, significado, calidad y límites; nunca inferir mediciones a escala de parcela sin procesar los datos apropiados.

## Prioridad 2 — Catálogo agrícola global

| Entregable | Estado | Verificación |
|---|---|---|
| Perfiles iniciales con nombre español y bibliografía | **Implementado** | 95 entradas: 5 originales con referencias y 90 de taxonomía inicial |
| Catálogo FAO ECOCROP de 2.568 especies, fuente inmutable y trazable | **Implementado; CI** | `scripts/import_ecocrop.py`, `backend/app/data/ecocrop_species.json` |
| Búsqueda por nombre común/científico/sinónimos; tildes, paginación y filtros | **Implementado; CI** | `backend/app/services/crop_search.py`, UI React |
| Fichas en lenguaje sencillo con rangos de temperatura, lluvia anual y pH | **Implementado; CI** | Se ocultan valores extremos sospechosos; referencias **no** miden el campo |
| Revisión de valores incoherentes y validación regional de cada especie | **Pendiente** | ECOCROP contiene registros incompletos y errores publicados |
| FAO GAEZ v5: importar capas de aptitud por manejo/periodo/cultivo y región | **Pendiente de selección, acceso, licencia, capa y verificación** | GAEZ **no** es ECOCROP; no se debe etiquetar el catálogo como aptitud espacial |
| Nombre de variedad/cultivar, mercados y disponibilidad regional verificadas | **Pendiente** | Requiere instituciones agrarias y datos locales |

**Procedencia ECOCROP:** FAO → archivo CSV de OpenCLIM `ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4` → CGIAR Climate Action Data Hub (CC BY 4.0, nota de atribución). SHA Git blob `849cc89873ef766690b12ac8251db4639c642084`; SHA256 de la descarga `4187e8846336e185c4583165211c5981855e95adfbefd897bd2bd481de48d106`. El importador rechaza cambios de origen y verifica 2.568 filas. **Advertencia FAO/CGIAR:** son estimaciones expertas, con faltantes y algunas anomalías; se conserva la fuente, pero no se infiere aptitud.

## Prioridad 3 — ARIE AI 2.0

| Entregable | Estado | Verificación |
|---|---|---|
| Exploración reproducible de hasta cinco cultivos y 120 permutaciones | **Implementado; CI** | Comparación taxonómica, no optimización agronómica |
| Historial real frente a organización alternativa en palabras sencillas | **Implementado; CI** | Sin identificadores internos S0/S1/S2 visibles |
| Agua y suelo por separado (no falsa tercera alternativa) | **Implementado; CI** | Advertencias sobre datos no disponibles |
| Plan visual por campañas, mes inicial elegido y verificaciones previas | **Implementado; CI** | Sin fechas ni cosechas fabricadas |
| Abstención cuando solo hay taxonomía/umbrales ECOCROP no validados | **Implementado; CI** | Estatus `exploratory_catalog_only` interno |
| Restricciones comprobadas de patógenos, fenología, agua disponible, mercado, equipo | **Parcial/pendiente** | Solo restricciones declaradas y algunas comprobaciones estructurales |
| Calendarios de cultivo por región y variedad, sostenibilidad, incertidumbre calibrada | **Pendiente** | Necesita experimentos/agrometeorología local |
| Modelo predictivo entrenado y evaluado por región/campaña | **Pendiente** | No confundir motor simbólico con predictor certificado |

**Criterio de aceptación:** si faltan datos, comunicar qué falta y cómo comprobarlo. Nunca prometer ahorro, rendimiento, aptitud o rentabilidad basados en nombres o promedios NASA regionales.

## Prioridad 4 — Validación de uso real

| Entregable | Estado | Verificación |
|---|---|---|
| CI Python y React | **Implementado y aprobado** | `.github/workflows/ci.yml` |
| Importación ECOCROP pinneada con integridad | **Implementado y aprobado** | `.github/workflows/import-ecocrop.yml` |
| Pruebas matemáticas de geometría y flujo por API | **Implementado y aprobado** | `frontend/tests`, `tests` |
| Pruebas con navegador desktop/móvil | **Implementadas y aprobadas: 3/3 Chromium** | `.github/workflows/e2e.yml` |
| Smoke de Netlify público, backend, ARIE, NASA POWER | **Automatizado y aprobado tras activar acceso público** | `.github/workflows/smoke-production.yml` |
| Rendimiento en móvil real, accesibilidad/auditoría de colores y teclado | **Pendiente de pruebas manuales** | CI no sustituye interacción en dispositivos reales |
| Cinco agricultores voluntarios y revisión agronómica independiente | **Pendiente de participantes** | `docs/farmer-validation-protocol.md` |
| Validación espacial de rasters y resultados de campo | **Pendiente de observaciones** | Documentar exactitud y límites antes de decisiones |

**Criterio de aceptación:** 4/5 agricultores entienden el flujo sin capacitación, distinguen datos regionales de parcela y no necesitan JSON ni códigos. Es una meta, no un resultado reportado.

## Comprobaciones técnicas aprobadas y reproducibles

- **Render y Netlify públicos:** [smoke de producción #43546352130](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43546352130): acceso anónimo a la web, proxy, salud, directorio FAO, ARIE y observaciones reales NASA POWER **PASS**.
- **Pruebas navegador Chromium:** [#43546516271](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43546516271), **3/3 PASS** (mapa, búsqueda de localidad y cultivo, y vista móvil con API simulada). No sustituye comprobar dispositivos físicos, lectores de pantalla ni usuarios reales.
- **Capas NASA GIBS:** [#43546285634](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43546285634) comprobó los cuatro identificadores WMS y metadatos oficiales. No certifica disponibilidad de cada píxel/fecha ni su precisión agronómica.
- **Integridad FAO ECOCROP:** [#43544489911](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43544489911) obtuvo 2.568 filas desde una versión inmutable y las fijó en el repositorio.
- **Código Python/TypeScript y tests:** [#43546516297](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43546516297) pasó ambos trabajos en el último commit de código.

Estas comprobaciones permiten afirmar que la integración técnica funciona. **No permiten afirmar que ARIE ya optimiza fechas de siembra, productividad, riego ni salud del suelo.**

## Reglas de la web

1. Mapa central, preguntas en lenguaje cotidiano y conclusiones interpretativas. JSON se limita al intercambio entre programas.
2. Distinguir fotografía Esri, punto NASA POWER, cuadrícula ilustrativa de IMERG, visualizaciones NASA GIBS y contorno aproximado declarado.
3. Aplicar fecha, procedencia, unidad, escala espacial y aviso ante datos insuficientes.
4. Los programas públicos imponen límites; mantener deshabilitadas descargas protegidas GPM mientras no haya caché/autoridad/cupos.
5. Los resultados son demostrativos y no reemplazan análisis de suelo, visitas de campo ni orientación local.

## Fuentes

- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [NASA POWER](https://power.larc.nasa.gov/)
- [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg)
- [SMAP](https://smap.jpl.nasa.gov/)
- [SRTM vía OpenTopoData](https://www.opentopodata.org/datasets/srtm/)
- [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api)
- [FAO ECOCROP](https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en)
- [CGIAR Data Hub — ECOCROP](https://cgiar-climate-data-hub.github.io/catalog/ecocrop/)
- [FAO GAEZ v5](https://www.fao.org/gaez/en)

**Próximo cierre científico obligatorio:** seleccionar capas GAEZ v5 con descarga/legalidad/metadatos reales, calcular NDVI Sentinel-2 sobre un polígono, validar rasters y cultivares en campo y realizar ensayos con agricultores/agrónomos. Estas tareas no se pueden declarar completadas mediante commits o tests de software.
