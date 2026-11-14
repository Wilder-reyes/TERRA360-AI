# Capas y análisis geoespacial TERRA360 AI

TERRA360 superpone imágenes WMS originales de NASA GIBS. **No lee ni convierte colores de las teselas en mediciones de parcela**. Los números de NASA POWER son un producto distinto.

| Capa WMS | Procedencia | Interpretación y limitaciones |
| --- | --- | --- |
| `IMERG_Precipitation_Rate` | NASA GPM/IMERG V07, precipitación, datos base ~0,1° | Tasa representada en colores, no precipitación acumulada exacta en cada parcela; esquema de cuadrícula azul **ilustrativo** |
| `SMAP_L4_Analyzed_Surface_Soil_Moisture` | NASA SMAP L4, humedad superficial modelada ~9 km | No mide directamente agua disponible en las raíces ni en la parcela |
| `MODIS_Terra_NDVI_8Day` | NASA MODIS/Terra, producto de ~250 m, ventana de 8 días | No es NDVI Sentinel-2 ni diagnóstico del estado del cultivo |
| `SRTM_Color_Index` | NASA SRTM v3, referencia topográfica estática | Muestra relieve visual, no pendiente calculada en parcela |

Todas están en el mapa Leaflet por NASA GIBS WMS EPSG:3857 `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi`. La leyenda de colores procede de `GetLegendGraphic`, si existe; se enlaza el original NASA Worldview y se informa de fechas sin mosaico.

### SRTM cuantitativo, limitado

A solicitud del agricultor, `GET /api/environment/terrain` consulta **cinco** alturas estimadas del DEM SRTM90m por OpenTopoData, alrededor de ±180 m de distancia. Calcula un gradiente espacial con diferencias centrales, informa la elevación/variación y expresa que **no es la pendiente real de la parcela**. Máximo 50 consultas nuevas por día por instancia, separación mínima 1,2 s, caché en memoria 24 h y validación de coordenadas entre latitudes ±59,95°. No se conecta este valor a la recomendación ARIE.

### Futuras capacidades que requieren más datos

- NDVI propio de Sentinel-2 L2A: rojo B04, NIR B08, clasificación/mascarilla SCL, áreas válidas, nubes, sombras, cobertura y metadatos.
- Análisis sobre polígonos de rasters originales GPM y SMAP: valores físicos, porcentaje de píxeles válidos, unidad, resolución y incertidumbre.
- SRTM/DEMs por área: pendiente, orientación, máscara, comparaciones con puntos topográficos validados; no extrapolar cinco muestras a una parcela.
- FAO GAEZ v5: descargar y vincular raster geográfico identificado (cultivo, época, manejo, escala, escenario climático, licencia y método), sin confundir ECOCROP con GAEZ.
- Evaluación de precisión en localidades concretas y validación con agrónomos.

### Fuentes

NASA GIBS: https://nasa-gibs.github.io/gibs-api-docs/access-basics/  
WMS y leyendas: https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/  
GIBS metadata: https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/  
OpenTopoData SRTM: https://www.opentopodata.org/datasets/srtm/  
FAO GAEZ v5: https://www.fao.org/gaez/en
