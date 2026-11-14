# NASA GPM IMERG Late V07 por polígono — v0.13

**Fecha:** 14 noviembre 2026. **Estado:** procesador regional implementado
y probado con NetCDF de formato original **sintético de prueba**; el servicio
público no tiene garantizado acceso a archivos diarios NASA y se abstiene
de mostrar datos en ese caso.

## Fuente y permisos

- [NASA GPM IMERG Late Daily V07, GPM_3IMERGDL](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary)
- [Descripción oficial en NASA Open Data / DOI 10.5067/GPM/IMERGDL/DAY/07](https://data.nasa.gov/dataset/gpm-imerg-late-precipitation-l3-1-day-0-1-degree-x-0-1-degree-v07-gpm-3imergdl-at-ges-disc-dc951)
- [Directorio NASA GPM y documentación de la versión 07](https://gpm.nasa.gov/data/directory)
- [Registro AWS del producto NASA: acceso S3 controlado](https://registry.opendata.aws/nasa-gpm3imergdl/)
- [NASA Earthdata Login](https://urs.earthdata.nasa.gov/).

**Origen:** IMERG V07 Late Run, precipitación diaria,
variable `precipitation`, unidades **mm/día**, cuadrícula nativa 0,1° x 0,1°
(~10 km; tamaño físico depende de latitud). V07 calcula la tasa media diaria
ponderando observaciones válidas del día. El producto **NO es un pluviómetro**
ni garantiza precipitación exacta a escala de un campo.

**Distinción importante:** NASA GIBS dibuja teselas visuales de una capa; no
se extraen valores numéricos de esos colores. La ruta v0.13 lee directamente
la variable científica `precipitation` del archivo de datos `.nc4`.

## Endpoint público conservador

`POST /api/environment/gpm-imerg/polygon-daily`

Petición de ejemplo con contorno ilustrativo, no una finca validada:

```json
{
  "polygon": {
    "type": "Polygon",
    "coordinates": [[
      [-71.9572, -13.3227], [-71.9549, -13.3227],
      [-71.9549, -13.3205], [-71.9572, -13.3205],
      [-71.9572, -13.3227]
    ]]
  },
  "target_date": "2026-11-06"
}
```

La API permite fechas entre **2 y 365 días en el pasado**, exige polígonos
WGS84 de 0,1 a 500 hectáreas sin agujeros, y limita la cantidad de celdas
para controlar recursos. No admite rutas de archivo ni URL arbitrarias.

**Si hay un NetCDF NASA autorizado y preparado en `backend/data/gpm/`:**
el servicio lee únicamente las celdas cercanas al contorno usando `xarray`
y `h5netcdf`; valida sus coordenadas a 0,1°, dimensiones, unidades
`mm/day`, valor no-data y `precipitation_cnt` cuando está disponible.
Calcula área geodésica de la intersección de cada celda con el polígono;
presenta promedio ponderado por área solo con ≥80 % de cobertura válida.
No usa la interpolación para incrementar la resolución de NASA.

**Si NO hay NetCDF disponible:** responde `status: "data_unavailable"`,
`precipitation_mm_day: null`, `cells: []`, más advertencias; HTTP 200
porque la petición es válida pero **no hay datos**, no porque haya llovido
0 mm. Una celda sin datos es `null`, en cambio lluvia cero auténtica es `0`.

Los archivos locales en un servicio gratuito efímero se pueden perder con
un reinicio. **No se habilitaron descargas masivas anónimas**: para presentar
datos reales de modo continuo se necesita proceso de ingesta autorizado
(Earthdata token en secretos), almacenamiento persistente u objeto y
control de cuota/caducidad. El conector existente
`backend/app/connectors/earthdata.py` permite una descarga autenticada
por fecha en un entorno controlado, separada de la ruta pública. No subir
credenciales, tokens o granules grandes al repositorio.

## Lo que no se calcula

- Lluvia local exacta ni diferencias de precipitación dentro de una
  celda NASA de ~10 km.
- Probabilidad de lluvia, pronóstico, riego, umbral de estrés,
  validación instrumental o porcentaje de error calibrado.
- Mapas exactos de acumulación intra-diaria ni humedad de suelo SMAP.
- Índice de cultivo, productividad ni decisión ARIE. El campo
  `used_in_crop_decision` es falso.

Las variaciones entre celdas pueden reflejar artefactos o error de
recuperación; en relieve complejo (Cusco) es necesario contraste con
pluviómetros locales.

## Pruebas técnicas realizadas

- `tests/test_imerg_polygon.py` genera fixture de NetCDF georreferenciado
  para lectura con `h5netcdf` real y verifica una celda, cruce de borde,
  media de dos celdas, `precipitation_cnt=0`, lluvia 0, no-data negativo
  o NaN, unidades no válidas, acceso sin archivo y API.
- `frontend/e2e/farmer.spec.ts` simula respuestas con y sin datos para
  verificar la claridad de la interfaz. **Son pruebas UX simuladas**.
- `scripts/smoke_public_demo.py` verifica que la producción no invente
  valores cuando no existe archivo NASA preparado.

**No afirmar que se verificaron valores numéricos NASA reales en producción
hasta que una ingesta auténtica y el smoke los confirmen.**
