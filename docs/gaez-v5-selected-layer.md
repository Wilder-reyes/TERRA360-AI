# FAO GAEZ v5 — verificación real y consulta de código original (v0.15)

Este documento describe la consulta antigua de **yuca** y conserva su alcance
de código bruto. La nueva [vista de aptitud agrícola regional](agricultural-suitability.md)
usa otras doce capas de maíz, papa y cebada con leyenda y licencia verificadas.
Su clasificación no transforma esta consulta antigua en diagnóstico de parcela.

**Fecha de comprobación:** 14 de noviembre de 2026. Esta integración separa
tres cosas: (1) raster original auténtico, (2) código numérico bruto de celda
y (3) clasificación científica de aptitud. **En esta consulta de yuca solo
(1) y (2) están implementados; no se ofrece diagnóstico de parcela.**

## Fuente oficial verificada

FAO/IIASA GAEZ v5, tema 4, Suitability and Attainable Yield.

| Campo | Selección |
|---|---|
| Variable | `RES05-SIX`, suitability / class index |
| Cultivo | `CSV`, yuca / cassava (*Manihot esculenta*) |
| Periodo | `HP0120`: 2001–2020, promedio histórico |
| Clima | `AGERA5`, escenario `HIST` |
| Agua y manejo | `LRLM`: secano, bajos insumos |
| Archivo original | `GAEZ-V5.RES05-SIX.HP0120.AGERA5.HIST.CSV.LRLM.tif` |
| Bucket original | FAO Google Cloud Storage, directorio `RES05-SIX` |
| Producto | GeoTIFF de una banda `uint8`, CRS EPSG:4326 |
| Tamaño | 437 903 bytes |
| Forma | 4320 × 2160 píxeles |
| Resolución | 5′ = 0,083333° (aprox. 9 km en el ecuador) |
| No-data declarado | 0 |
| SHA-256 del original | `196c8d806e2fa2e6da4bc09fe30de2c6e40607ba2436d5b484d5957bb7c25156` |
| Referencia de Calca (−71,95605, −13,32175) | Código bruto `8`; **no es 8 %** |

Estos datos provienen de un **download auténtico temporal y lectura rasterio
de la capa oficial**, no de una imagen inventada. Evidencia:
[GitHub Actions (inspección y artefacto de metadatos)](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43600588841).

La guía y el notebook mantenidos por FAO ofrecen el inventario Excel
`LIST_FILES` con **109 056 registros** y especifican el nombre de la
combinación exacta. El código valida que exista una sola fila y comprueba
mediante HEAD la existencia del objeto GCS antes de descargarlo.

El conjunto de datos FAO catalogado como *Crop suitability, class index
(Global - 20 years average - ~10 km) - GAEZ v5* declara licencia
**Creative Commons Attribution 4.0 International (CC BY 4.0)**. El
[CKAN de FAO](https://data.apps.fao.org/catalog/dataset/514c92d5-9e01-4c70-814a-80ea1ca9fe6a)
está unido al Excel `RES05` por el identificador de recurso confirmado.
[Auditoría automatizada](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43601050348).

La licencia del conjunto de datos **no descarta condiciones o avisos
adicionales del objeto**; estos deberán respetarse antes de redistribuir
masivamente GeoTIFFs o proporcionar un producto comercial.

## Acceso a datos originales sin disco persistente

`POST /api/environment/gaez-v5/selected-layer/raw-cell`

Acepta un polígono dibujado (0,1–500 ha, ≤100 vértices). Después de validar
su geometría, puede obtener un raster oficial (≤1 MiB) de **URL fija de FAO**
y confirmar **tamaño + SHA-256**. Se almacena temporalmente en Render,
donde los archivos pueden borrarse tras un despliegue. La primera petición
puede tardar más; las posteriores reutilizan el archivo mientras conserven
su integridad. El caché impide descargas repetidas ante errores durante
90 segundos. La API no acepta URLs remotas suministradas por usuarios.

El resultado contiene `original_cell_class_code`, centro y límites de celda,
fecha histórica y procedencia; `suitability_index: null`,
`can_recommend_crop: false`, `region_suitability_evaluated: false`
y `used_in_crop_decision: false`.

El código de clase 8 en una celda que contiene la referencia de Calca es
un **valor crudo de GeoTIFF**. No se deduce un 8 % de aptitud ni se dice
que el campo está apto/no apto. Además, esa celda cubre un territorio
mucho mayor que una finca individual. No se recomienda cultivar yuca a
partir del código.

El endpoint anterior `selected-layer/sample` permanece protegido por un
interruptor de autorización de interpretación y licencia, SHA oficial
inmutable, escala y no-data verificados: no entrega índice de aptitud
hasta que la interpretación haya sido validada.

## Metodología, pruebas y alcances

- [Notebook original FAO](https://github.com/un-fao/gaezv5/tree/main/GAEZ-v5-Platform/Data-Access-Notebooks).
- [FAO GAEZ v5 Theme 4](https://data.fao.org/catalog/dataset/gaez-v5-master-config/resource/31abf121-1644-4473-8c1b-bfec83112749).
- `scripts/verify_gaez_res05_official.py`: valida inventario y HEAD.
- `scripts/inspect_fao_gaez_raster.py`: inspecciona GeoTIFF en CI, calcula
  SHA y muestrea celda **sin** publicar recomendaciones.
- `scripts/audit_fao_gaez_license.py`: audita licencia de la ficha
  FAO y confirma la vinculación al recurso Excel `RES05`.
- `backend/app/services/gaez_original_raw.py`: cache SHA y lectura
  de celda original, sin descarga del TIFF a GitHub ni registro de
  porcentajes de aptitud.
- `tests/test_gaez_original_raw.py`: GeoTIFF de prueba, no-data,
  descarga única del caché, corrupción SHA y contrato de API.
- `tests/test_nasa_private_storage_e2e.py`: almacenamiento S3/R2 simulado,
  checksum, límites y retención sin credenciales reales.

**Pendiente:** confirmar el significado y escala del entero por clases,
verificar posibles condiciones del archivo en particular, adoptar una
clasificación adecuada para un cultivo/territorio, y contrastar con
mediciones de campo. Nada de esto se obtiene por el mero hecho de
abrir exitosamente el GeoTIFF.
