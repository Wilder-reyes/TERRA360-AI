# Sentinel-2 NDVI por parcela: método y límites

**Fuente:** ESA/Copernicus Sentinel-2 L2A (reflectancia BOA), mosaicos COG de
Microsoft Planetary Computer / catálogo STAC `sentinel-2-l2a`.
Las bandas son **B04 roja 10 m** y **B08 infrarrojo cercano 10 m**,
más **SCL nativa 20 m**. No es un producto de NASA.

## Procesamiento

1. La persona dibuja un polígono WGS84 aproximado, sin huecos; el servidor
   valida geometría no autointersecante, área de 0,1 a 500 ha, <=100 vértices.
2. Se buscan escenas en 120 días (configurable 30–365), con nubosidad global <=65 %
   (configurable). Se procesan como máximo tres escenas recientes elegibles,
   una por una. No se crea un mosaico temporal.
3. Se firman los activos exclusivamente del proveedor admitido y se leen
   ventanas recortadas sobre el polígono. No se descargan escenas completas.
4. SCL se alinea a la cuadrícula de B04 mediante **vecino más cercano**:
   se admiten 4 (vegetación) y 5 (suelo no vegetado). Se excluyen nubes,
   sombra, agua, nieve, defectos y desconocido; la clasificación puede fallar.
5. Se usa la versión `s2:processing_baseline` de cada escena. Desde 04.00,
   reflectancia BOA = (DN − 1000) / 10000; antes, DN / 10000. DN=0 es
   **sin datos**, nunca reflectancia negativa. Se rechazan versiones ausentes.
6. NDVI = (B08 − B04) / (B08 + B04), solo denominador positivo y valores
   físicos entre −1 y 1. Se informa la fracción de píxeles válidos del polígono.
   Se exige al menos 20 píxeles y 60 % de cobertura válida antes de mostrar
   promedio, mediana, desviación y percentiles 10/90.
7. Si no se encuentran escenas, no se pueden leer imágenes o la máscara excluye
   demasiados píxeles, el resultado es explícitamente insuficiente o no disponible.

Las cifras espaciales son **aproximadas por conteo de centros de píxel y área
nominal**, sobre un contorno declarado. Los percentiles describen diferencias
**entre píxeles**, no calibración, error instrumental, intervalo de confianza,
variación de campaña ni salud del cultivo.

El índice es descriptivo de reflectancia en una fecha. No se emplea en ARIE
para aptitud, plagas, productividad ni decisiones de siembra. La exactitud exige
verificación independiente con control de calidad atmosférica/geométrica y
levantamientos de campo, idealmente con agrónomos.

## Privacidad, rendimiento y acceso

- Endpoint `POST /api/environment/sentinel-2/parcel-ndvi`. El usuario envía
  `{"polygon":{"type":"Polygon","coordinates":[[[lon,lat],...]]}}`.
- Sin tokens del agricultor ni URLs de activos arbitrarias; nunca se devuelve
  un enlace SAS firmado. La cuenta pública de Planetary Computer está sujeta
  a cuotas y bloqueos. Se usa un caché en memoria, no persistente, de 1 h.
- Límite de 160.000 píxeles por ventana, dos cálculos simultáneos por proceso.
- Se reserva la verificación de datos reales en un workflow **manual**, porque
  las interrupciones del proveedor no deben volver rojo el CI determinista.

## Fuentes verificables

- [ESA L2A y resolución SCL](https://sentinels.copernicus.eu/sentinel-data-access/sentinel-products/sentinel-2-data-products/collection-1-level-2a)
- [SCL oficial](https://s2.pages.eopf.copernicus.eu/msi/s2msi/main/PDFS_ADFS/L2/PDFS_S2_MSI_L2.html)
- [ESA/L2A offset BOA](https://sentiwiki.copernicus.eu/web/s2-processing)
- [Microsoft Planetary Computer - firma](https://planetarycomputer.microsoft.com/docs/concepts/sas/)

## Primera verificación real (14 de noviembre de 2026)

GitHub Actions: [Sentinel-2 live raster verification #43588640412](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43588640412), **PASS**. El workflow
leyó los COG reales ESA/Copernicus Sentinel-2C del **4 de noviembre de 2026**
(escena `S2C_MSIL2A_20261104T145721_R039_T18LZL_20261104T174703`,
processing baseline `05.13`) alrededor de un polígono ilustrativo en Calca.

- **596** píxeles dentro del contorno y **596** válidos tras máscara SCL;
  cobertura aproximada **98,3 %**; clases SCL: 48 vegetación y 548 suelo no vegetado.
- NDVI medio **0,1776**, mediana **0,1277**, percentil 10 **0,0128**,
  percentil 90 **0,4404**; son estadísticas de esta escena, NO diagnóstico.
- Dos escenas intentadas; la seleccionada tuvo **30,52 % de nubosidad global**
  (no se confunde con la nubosidad del terreno).

**Este resultado verifica ejecución contra datos raster reales y metadatos, no
exactitud frente a estaciones, mediciones de campo ni cultivos identificados.**
El polígono de prueba no corresponde a una finca verificada.
