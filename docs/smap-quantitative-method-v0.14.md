# NASA SMAP cuantitativo SPL3SMP_E V006 — contrato de evidencia

**Producto oficial:** NASA/NSIDC SMAP Enhanced L3 Radiometer Global and Polar
Grid Daily 9 km EASE-Grid Soil Moisture, versión 6,
[DOI 10.5067/M20OXIZHY3RJ](https://nsidc.org/data/spl3smp_e/versions/6).

**Resolución nativa:** 9 km. Es estimación de humedad volumétrica
superficial (~0–5 cm), **NO humedad de la zona radicular ni humedad medida
en una parcela**.

## Lectura HDF5

- Raster original: grupo `Soil_Moisture_Retrieval_Data_AM` (solo AM).
- Coordenadas nativas: `latitude` y `longitude` 2D.
- Variable: `soil_moisture_dca` (algoritmo Dual Channel, versión 6).
- Calidad: `retrieval_qual_flag_dca == 0` es aceptable según NSIDC.
- Valor debe ser finito, en rango físico 0–1 m³/m³ y diferente de
  `_FillValue`.
- Por ahora solo se elige la **celda original más cercana al punto
  interior de un contorno declarado**, sin interpolación; distancia
  máxima 20 km. No es una media exacta del polígono, y puede contener
  mosaicos de usos del suelo.
- No se mezclan AM/PM ni algoritmos DCA, SCAV y SCAH.

## API

`POST /api/environment/smap/regional-daily`

```json
{"polygon":{"type":"Polygon","coordinates":[
 [[-71.9572,-13.3227],[-71.9549,-13.3227],
  [-71.9549,-13.3205],[-71.9572,-13.3205],
  [-71.9572,-13.3227]]
]},"target_date":"2026-11-06"}
```

Estados: `available` solo con valor genuino validado;
`insufficient_quality` si falla calidad; `out_of_spatial_coverage` si
no existe celda próxima; `data_unavailable` si no se ha ingerido el
HDF5 autorizado. Los fallos de integridad dan 503.

La interfaz del mapa distingue esta lectura numérica de la tesela NASA
GIBS `SMAP_L4_Analyzed_Surface_Soil_Moisture`, que es **un producto
distinto y solo visual**. Nunca se asignan los datos SMAP a ARIE.

## Evidencia y pendientes

`tests/test_nasa_archive_smap.py` verifica lectura HDF5 real con
contenidos **sintéticos deterministas** (no resultados NASA), bandera
de calidad, no-data y la API. Se requiere un archivo auténtico del
NSIDC mediante Earthdata y validar comparaciones de referencia.

Documentación: [NSIDC V006](https://nsidc.org/data/spl3smp_e/versions/6)
· [User Guide oficial](https://nsidc.org/sites/default/files/documents/user-guide/spl3smp_e-v006-userguide.pdf).
