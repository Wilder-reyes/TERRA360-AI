# Capas NASA GIBS incorporadas en TERRA360

Las capas siguientes son imágenes WMS públicas entregadas por NASA GIBS/Worldview en el navegador, sin descargar NetCDF al servidor Render. No implican que TERRA360 lea sus píxeles numéricos ni cuantifique la superficie exacta de cada parcela.

## Conexión técnica
- WMS Web Mercator: `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi`.
- Visualización: `frontend/src/GeoWorkspace.tsx`, componente `WMSTileLayer` de React Leaflet.
- Parámetros: `LAYERS`, `TIME=YYYY-MM-DD`, `FORMAT=image/png`, fondo transparente, atribución NASA GIBS.
- El mapa ofrece un enlace a la leyenda original en NASA Worldview. Un día sin mosaico no equivale a cero lluvia, cero humedad ni cero vegetación.
- **Pendiente de verificación visual y temporal en producción:** el proveedor puede no publicar un mosaico exacto para cada fecha elegida.

## Productos

| Layer ID exacto | Qué representa | Escala aproximada | Límite |
| --- | --- | --- | --- |
| `IMERG_Precipitation_Rate` | Visualización de intensidad/tasa de precipitación derivada de GPM IMERG, no lluvia acumulada de la parcela | IMERG base ~0,1° (alrededor de 10 km en el ecuador) | La visualización diaria puede derivarse de observaciones subdiarias; no es lo mismo que `GPM_3IMERGDF` descargado |
| `SMAP_L4_Analyzed_Surface_Soil_Moisture` | Humedad superficial estimada con un modelo de asimilación SMAP | ~9 km | No es humedad medida en el terreno, ni agua de riego disponible |
| `MODIS_Terra_NDVI_8Day` | Mosaico NDVI de vegetación a partir de MODIS/Terra | ~250 m, periodo compuesto de 8 días | No equivale al NDVI Sentinel-2 de 10 m; no identifica automáticamente estrés ni rendimiento |

Las resoluciones se refieren al producto, no a la precisión exacta de cada píxel renderizado ni a la ubicación seleccionada.

## Diferencias entre productos
- **NASA POWER:** valores regionales históricos solicitados por latitud/longitud; no forman parte de las imágenes GIBS.
- **NASA GIBS:** color y patrón espacial visual del producto; no se usan actualmente para calcular ARIE.
- **Sentinel-2 STAC:** solo fechas y nubosidad de escenas; no NDVI ni imagen multibanda procesada.
- **GPM diario protegido Earthdata:** descarga directa desactivada inicialmente en producción para evitar sobrecarga, aunque la capa visual pública de IMERG sea accesible.
- **Esri World Imagery:** fotografía aérea como fondo geográfico, no una capa científica de NASA.

## Próximos requisitos para análisis cuantitativo por parcela
1. Verificar disponibilidad, período temporal, formatos y georreferenciación de cada capa en NASA.
2. Leer un producto cuantitativo con resolución, máscara de calidad y fecha, sin interpolarlo para simular sensores locales.
3. Si se calcula NDVI Sentinel-2, usar B04/B08 de Sentinel-2 L2A con máscara SCL/nubes y evaluar la cobertura válida.
4. Crear interpretación de estadísticas espaciales con porcentaje de píxeles válidos, incertidumbre y fuente.
5. Validación con puntos de campo y revisión por especialista agronómico antes de convertirlo en consejo de siembra.

## Fuentes oficiales
- NASA GIBS: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- NASA GIBS WMS/Leaflet: https://nasa-gibs.github.io/gibs-api-docs/gis-usage/
- NASA GIBS ejemplos IMERG: https://nasa-gibs.github.io/gibs-api-docs/python-usage/
- NASA Worldview: https://worldview.earthdata.nasa.gov/
- NASA NSIDC SMAP: https://nsidc.org/data/user-resources/help-center/visualize-and-download-nsidc-daac-data-nasa-worldview
