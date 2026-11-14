# FAO GAEZ v5 — capa de aptitud seleccionada, TIFF pendiente de validación

**Estado 14 nov 2026: selección científica documentada, raster todavía
NO importado ni muestreado desde FAO.**

Una fuente documental no constituye un TIFF verificado: la API no inventa
un índice si no existe el archivo original.

## Selección concreta del catálogo

| Dimensión | Selección |
|---|---|
| Fuente | FAO/IIASA GAEZ v5 · Theme 4 Suitability and Attainable Yield |
| Variable | `RES05-SIX`: Suitability Index |
| Cultivo | `CSV`: cassava / yuca (*Manihot esculenta*) |
| Periodo | `HP0120`: histórico 2001–2020 |
| Clima | AgERA5 / `HIST` |
| Agua y manejo | `LRLM`: secano y bajos insumos |
| Ubicación de familia de rasters | `gs://fao-gismgr-gaez-v5-data/DATA/GAEZ-V5/MAPSET/RES05-SIX/` |
| Estado del objeto TIFF exacto | **Nombre, descarga y hash aún sin verificar** |
| Derechos | Comprobar licencia **del raster específico**, no extrapolar la de otra capa |

Fuente de dimensiones: [FAO GAEZ v5 Theme 4](https://data.fao.org/catalog/dataset/gaez-v5-master-config/resource/31abf121-1644-4473-8c1b-bfec83112749)
y [guía técnica oficial de plataforma](https://github.com/un-fao/gaezv5/wiki/21.-GAEZ-v5-Platform-User-Guide).

## Flujo de adopción sin invenciones

1. Abrir la guía GAEZ v5, su tabla oficial de nombres y el bucket publicado;
   confirmar el **nombre exacto** del objeto de estas seis dimensiones.
2. Verificar accesibilidad, licencia de reutilización, extensión,
   CRS, resolución efectiva, tipo de raster, `nodata`, factor de escala
   e interpretación de los valores. Documentar la procedencia.
3. Descargar una copia de una fuente FAO permitida; calcular SHA-256.
4. Sólo entonces registrar parámetros de operador en entorno seguro
   `GAEZ5_APPROVED_TIFF`, `GAEZ5_APPROVED_SHA256`,
   `GAEZ5_APPROVED_SCALE`, `GAEZ5_APPROVED_NODATA`,
   `GAEZ5_LICENSE_URL`. El endpoint **nunca acepta una ruta de usuario**.
5. Verificar muestra espacial real y contraste local. Una celda de ~1 km o
   10 km no determina la calidad de una finca pequeña.

`GET /api/environment/gaez-v5/selected-layer` muestra el registro de
procedencia. `POST /api/environment/gaez-v5/selected-layer/sample`
se abstiene con `suitability_index:null` hasta que exista un TIFF
autorizado y coincidan SHA, escala, nodata y nombre.

`tests/test_gaez_selected.py` usa un **GeoTIFF artificial** para
verificar el procedimiento; no implica que se hayan leído píxeles reales
de FAO. El código no publica recomendaciones automáticas de cultivo
ni presenta el índice como rendimiento observado.

## Límite actual de infraestructura

Render Free no puede conservar TIFF grandes en disco. Se necesita una
fuente de almacenamiento persistente verificada o una COG pública
comprobada para lectura por ventanas, con infraestructura proporcionada
antes de activarla.

**Estado honesto: capa temática y dimensiones seleccionadas; raster
científico exacto pendiente de adquisición y comprobación independiente.**
