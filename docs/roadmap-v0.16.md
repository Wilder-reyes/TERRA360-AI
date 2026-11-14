# Hoja de ruta TERRA360 AI — v0.16: primera ingesta NASA real

**Fecha: 14 noviembre 2026. Estado: corrección implementada; validación de ingesta SMAP real pendiente.**

## Evidencia inicial de producción aportada por el operador

El flujo de GitHub Actions pudo autenticarse con NASA Earthdata y el
almacenamiento privado Cloudflare R2.

- **GPM IMERG Late V07:** `status=ingested`, fecha `2026-11-07`,
  tamaño original **27 569 494 bytes**, SHA-256
  `0436848049c7b487e7cf82292941ee510f4dea42ebe6c48707f054bac9ea286f`.
  Se conservó el NetCDF auténtico en R2, junto con un manifiesto SHA-256.
- **SMAP SPL3SMP_E V006:** el primer proceso descargó un HDF5 NASA
  que superó **65 MiB** y lo rechazó sin subirlo al bucket.
  No hay una lectura SMAP real confirmada hasta una ejecución posterior.

El flujo original produjo **Failure** por SMAP aun cuando GPM finalizó
correctamente. Un resultado de CI verde no equivale a validar una
estimación de lluvia/humedad para una finca.

## Corrección técnica preparada

| Recurso | Límite | Persistencia |
|---|---:|---|
| GPM IMERG NetCDF original | 65 MiB | Original y manifiesto SHA-256 |
| SMAP HDF5 global descargado por GitHub Actions | 768 MiB | **Temporal**, se elimina al acabar el trabajo |
| SMAP datos nativos AM para Calca | 5 MiB | HDF5 regional derivado, no archivo original |
| Almacén total GPM+SMAP | 1 GiB; 32 fechas/productos | Retención máxima 14 días |

El subconjunto regional SMAP limita sus geolocalizaciones al rectángulo
W −72,65°, S −14°, E −71,2°, N −12,75° alrededor del piloto Calca, Cusco.
Se preservan sin interpolar las muestras de cuatro datasets nativos de
`Soil_Moisture_Retrieval_Data_AM`:

- `latitude`, `longitude`;
- `soil_moisture_dca`;
- `retrieval_qual_flag_dca`.

Se conservan dtype y atributos de las variables. El manifiesto
`NASA-native-grid-regional-subset` registra el SHA-256 y tamaño
del **HDF5 original NASA**, el SHA-256 del **subconjunto derivado**,
la fuente CMR, límites geográficos y método exacto de extracción.
Un archivo derivado no se presenta nunca como el HDF5 NASA original.

La descarga SMAP se evalúa contra el tamaño en metadatos CMR cuando
existe; si supera el límite temporal se informa sin cargarlo al bucket.
Si las coordenadas AM no contienen observaciones en Calca para esa fecha,
se omite la ingesta y se informa `no_local_am_coverage`, sin reemplazar
el resultado por una medición imaginaria.

## Qué falta verificar con los secretos del operador

1. Ejecutar de nuevo
   [Private NASA GPM and SMAP bounded ingest](https://github.com/Wilder-reyes/TERRA360-AI/actions/workflows/ingest-nasa-private.yml)
   en `main` tras integrar esta corrección.
2. Confirmar `already_verified` para GPM 7 noviembre si se repite ese
   mismo día; para una nueva fecha, comprobar `ingested`.
3. Confirmar `ingested` para SMAP, con `representation=regional_native_grid_subset`.
   Si falla por tamaño de fuente o cobertura AM, registrar ese resultado real.
4. Inspeccionar Cloudflare R2: archivos y manifiestos bajo
   `terra360-nasa-v1/gpm/...` y `terra360-nasa-v1/smap/...`, y cuotas.
5. En Render, usar las APIs de GPM y SMAP con un polígono válido y fecha
   archivada. No afirmar éxito hasta que la lectura autenticada y QA
   sean comprobadas desde producción.
6. Revisar costo efectivo de operaciones/almacenamiento, renovar
   credenciales Earthdata según su vigencia y validar con mediciones
   locales de lluvia y suelo antes de recomendaciones.

## Límites de interpretación

IMERG entrega estimaciones espaciales de celdas de 0,1°; SMAP
`SPL3SMP_E` representa observaciones de radiometría sobre una
rejilla EASE2 de **9 km**, con resolución efectiva del instrumento
más gruesa. Su combinación con un polígono agrícola no convierte
las observaciones satelitales regionales en sensores de parcela.
No se habilitan recomendaciones de riego, rendimiento o aptitud.

Referencias: [NSIDC SMAP V006 User Guide](https://nsidc.org/sites/default/files/documents/user-guide/spl3smp_e-v006-userguide.pdf),
[NASA GPM IMERG Late V07](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary),
[CMR UMM-G SizeInBytes](https://cmr.earthdata.nasa.gov/ingest/site/docs/ingest/api.html).
