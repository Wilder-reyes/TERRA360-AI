# Serie de NDVI Sentinel-2 por parcela (v0.12, observaciones dispersas)

**Fuente:** ESA/Copernicus Sentinel-2 Level-2A por Microsoft Planetary Computer,
COG B04/B08 y SCL. [Metodología NDVI de una escena](sentinel2-ndvi-method.md).

## Algoritmo comprobable

- Usuario dibuja un polígono WGS84 (0,1–500 ha, sin agujeros, máx. 100 vértices).
- Endpoint `POST /api/environment/sentinel-2/parcel-ndvi-series`.
  JSON: `{"polygon":{"type":"Polygon","coordinates":[[[lon,lat],...]]},
  "days":180,"cloud_limit":60,"max_observations":4}`.
- Busca hasta 120 escenas del catálogo en 60–365 días; filtra nubosidad
  **global** de escena 0–100 %, y selecciona un máximo de 8 escenas
  separadas al menos 12 días, más recientes primero.
- Por cada escena calcula NDVI con el mismo pipeline de una escena:
  reflectancia BOA ajustada según processing baseline, nube/sombra/nieve/agua
  y clasificación dudosa excluidas por SCL nativa 20 m, cuadriculado 10 m.
- Exige mínimo 20 píxeles y 60 % cobertura válida por fecha. Guarda
  `status`, `scene_id`, fecha, nubosidad global, baseline, número de
  píxeles, NDVI medio/mediano y percentiles **solo si hay datos**.
- Si solo hay 1 fecha válida, `status: single_valid_observation`.
  Si 0 y escenas analizadas, `no_usable_observations`; si ninguna escena
  elegible, `no_matching_scenes`. Datos no disponibles no son ceros.
- Se informa un **muestreo parcial**, no censo de todas las imágenes.
  Las consultas se limitan por semáforo, ventanas raster y caché de 1 h.

## Qué NO prueba

Es una **serie de observaciones espectrales aisladas**, NO una línea
temporal agrícola calibrada. Los píxeles válidos pueden ser diferentes entre
fechas: medias diferentes no son crecimiento/reducción de un mismo conjunto
de plantas. También pueden cambiar el cultivo, la cosecha, fenología,
atmosfera, geometría, iluminación, píxeles mixtos y sombra residual. No
interpolamos fechas faltantes; no certificamos una tendencia ni usamos
estos valores en ARIE, productividad, estrés, riego o decisiones de siembra.

Los percentiles siguen siendo **variación espacial**, no error de
medición ni intervalo de confianza. Para dar ese siguiente paso se necesitan
observaciones de campo y análisis de errores atmosféricos y geométricos.

## Verificación

- `tests/test_sentinel_timeseries.py`: selección temporal determinista,
  límites, fechas inválidas, nubes, errores, calidad y API.
- `frontend/e2e/farmer.spec.ts`: una fecha sin datos aparece como «—»,
  fechas válidas conservan su NDVI, avisos de calidad legibles.
- `scripts/verify_sentinel2_series_live.py`: descarga realmente ventanas
  COG y máscara SCL de varias fechas de Calca (polígono ilustrativo;
  no es una finca). Este script puede fallar por nubes o límites del
  proveedor sin invalidar por sí mismo las ecuaciones.
- `.github/workflows/verify-sentinel2-series-live.yml`: workflow externo
  separado del CI offline. Registrar enlace al resultado real cuando apruebe.

## Fuentes

- [Dataset Sentinel-2 L2A y asset keys B04/B08/SCL](https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a)
- [FAO v5 y criterios de resolución](gaez-v5-source-contract.md)
