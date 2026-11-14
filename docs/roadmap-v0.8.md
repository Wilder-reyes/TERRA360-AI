# Hoja de ruta TERRA360 AI — V0.8 y siguientes

Estado al 13 de noviembre de 2026: plan de prioridades acordado con el creador. Cada tarea se marca como **implementada**, **parcial** o **pendiente**, nunca se atribuyen funcionalidades no comprobadas al sitio.

## Prioridad 1 — Reconstrucción geoespacial

**Objetivo:** mapa central, delimitación de terrenos, gestión de capas, leyendas científicas, selección temporal e interpretación contextual.

**Implementado en esta iteración (pendiente de validación de despliegue):**
- React Leaflet como espacio central de trabajo en los tres pasos
- Selección de ubicación por clic y rectángulo aproximado dibujado mediante dos puntos
- Mapa de calles OSM y fotografía aérea de fondo Esri, diferenciada de una capa de datos NASA
- Información puntual de NASA POWER: lluvia diaria, temperatura y humedad relativa, selector de fecha, explicación y unidades
- Búsqueda STAC de fechas Sentinel-2 por radio aproximado, con límites claros (no procesa NDVI ni imágenes)
- Referencias visuales diferenciadas: punto de consulta, rectángulo del agricultor y área de búsqueda satelital

**Pendiente antes de afirmar cobertura geoespacial científica completa:**
- Polígonos editables georreferenciados, cálculo geodésico de superficie, validación topológica y exportaciones estándar
- Cuadrículas/raster auténticos GPM, SMAP, SRTM, y procesamientos Sentinel-2 NDVI con máscaras de nubes
- Interpretaciones verificables con resolución espacial, periodo y cobertura real de cada fuente
- Optimización, caché y cuotas para mapas y descargas en el hosting gratuito
- Búsqueda de lugares/autocompletado geográfico

**Criterio de aceptación:** el mapa no inventa datos de parcela; cada capa que se active muestra valores reales y declara el nivel espacial de certeza.

## Prioridad 2 — Catálogo agrícola global

**Objetivo:** integrar información verificable de FAO ECOCROP y GAEZ v5, búsqueda por especie/variedad y disponibilidad por región.

**Implementado (introducción, no importación FAO):**
- 95 entradas de nombres/especies y familias, incluidos cinco perfiles iniciales con referencias
- Búsqueda insensible a tildes por nombre común/científico y filtro de categoría
- Hasta cinco especies a la vez para comparación de órdenes taxonómicos; errores por ID desconocido
- Aviso estructurado obligatorio para los perfiles que carecen de evidencia regional
- Sin coeficientes de cultivo ni rendimientos inventados para los 90 perfiles exploratorios

**Pendiente:** importación de datasets ECOCROP/GAEZ con licencia, fecha y calidad comprobadas, regionalización, variedad/cultivar, fenología por clima, cientos/miles de especies adicionales con búsqueda paginada y pruebas agronómicas.

**Advertencia:** la FAO indica que ECOCROP cubre 2.568 especies, pero fue descontinuada alrededor de 2015 y se ofrece a través de GAEZ. No afirmar que nuestra selección de 95 registros proviene de una importación directa; no representa aptitud agrícola global. https://www.fao.org/land-water/resources/tools/databases/ecocrop/en

## Prioridad 3 — ARIE AI 2.0

**Objetivo:** generar secuencias, respetar restricciones agronómicas, escenarios temporales, riesgos, incertidumbre y explicaciones sencillas.

**Implementado/parcial:** los identificadores de escenarios se conservan solo internamente; la UI usa nombres comprensibles. Motor actual: búsqueda simbólica de permutaciones (hasta cinco cultivos), taxonomía, selección del agricultor, algunas restricciones declaradas y advertencias. No es un modelo predictivo entrenado.

**Pendiente:** modelo agronómico comprobable, calendarios multicampaña, criterios de rotación más allá de familias, riesgos climáticos y de suelo por cultivo, incertidumbre cuantificada validada, evaluación local, y diferenciación real de estrategias. S2 es revisión de agua y suelo, no un plan de siembra equivalente a S1.

## Prioridad 4 — Validación de uso real

**Objetivo:** probar selección del terreno → lectura de datos → elección de cultivo → decisión; comprobar NASA y comprensión del agricultor.

**Implementado/parcial:** tests unitarios CI de API y web, pruebas de catálogo y límites. La web estaba publicada antes de esta iteración. Las nuevas funciones requieren su propio smoke test en producción y evaluación con agricultores reales.

**Pendiente:** tests de navegador con latencias reales y móvil, fiabilidad del proveedor Netlify/Render, criterios de accesibilidad y pilotos con agricultores.

## Principios de comunicación obligatorios

- El agricultor **nunca** necesita conocer S0/S1/S2, abrir JSON ni entender Swagger/API.
- Mostrar gráficos, leyendas, fuentes breves e interpretaciones, con explicaciones adaptadas a tareas.
- No confundir puntos regionales NASA con medidas de la parcela, la fotografía de Esri con imágenes procesadas Sentinel-2, ni el catálogo taxonómico con cultivos aptos para la ubicación.
- Las APIs internas y datos JSON entre React y FastAPI continúan por compatibilidad, aunque no son una pantalla de usuario.
- No habilitar GPM en el plan gratuito hasta diseñar permisos, caché y límites seguros.
- Evitar prometer predicción o ahorros no validados.
