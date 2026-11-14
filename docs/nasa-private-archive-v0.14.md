# TERRA360 v0.14 — ingesta privada NASA y almacenamiento duradero

**Estado real (14 nov 2026):** código de ingesta y cliente privado S3/R2
implementados; **NO hay bucket ni credenciales Earthdata y S3/R2
habilitadas en la producción de Render Free**. En ausencia de archivos,
las APIs responden sin inventar resultados.

## Arquitectura

```text
GitHub Actions privado (cron diario / manual)
  └─ NASA Earthdata Login (secreto EDL)
      ├─ CMR: GPM_3IMERGDL V07 (un día, Late)
      └─ CMR: SPL3SMP_E V006 (un día)
          └─ 1 fichero por producto y ejecución
              └─ valida nombre, fecha, tamaño y estructura científica
                  └─ objeto privado S3/R2 + manifiesto SHA-256
                      └─ Render API: lectura temporal verificada SHA-256
                          ├─ GPM IMERG celdas 0,1° con intersección geodésica
                          └─ SMAP DCA AM: celda nativa 9 km y QA
```

El archivo S3/R2 es el almacenamiento duradero; los ficheros temporales
en Render se destruyen al acabar cada solicitud. **El servicio Render Free
no acepta discos persistentes**. Un bucket privado puede generar costos
de almacenamiento y egreso; no se crea ni se configura automáticamente.

## Credenciales: no pegarlas en chats ni archivos

Crear un bucket **privado** compatible con S3, opcionalmente Cloudflare R2.
Crear credenciales con acceso exclusivamente al prefijo
`terra360-nasa-v1/` (leer/escribir/listar/eliminar únicamente dentro de
ese prefijo, para la tarea de ingesta; a Render dar acceso de solo lectura
si el proveedor permite llaves separadas).

En **GitHub → Settings → Secrets and variables → Actions**, configurar:

| Secret | Uso |
|---|---|
| `EARTHDATA_TOKEN` | NASA Earthdata (token válido, no contraseña) |
| `TERRA_OBJECT_BUCKET` | Bucket privado |
| `TERRA_OBJECT_ENDPOINT` | Endpoint HTTPS S3 o R2; vacío para AWS |
| `TERRA_OBJECT_REGION` | Región; R2 puede usar `auto` |
| `TERRA_OBJECT_ACCESS_KEY_ID` | ID de acceso al bucket |
| `TERRA_OBJECT_SECRET_ACCESS_KEY` | Clave privada |

En **Render → terra360-api → Environment**, configurar:

- `TERRA_OBJECT_BUCKET` con el nombre del mismo bucket;
- `TERRA_OBJECT_ENDPOINT` y `TERRA_OBJECT_REGION`;
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (idealmente **credenciales
  de solo lectura**).

GitHub y Render requieren nombres de secretos distintos por el puente
de CI a las variables estándares del cliente S3; el código no imprime
contraseñas, tokens, claves ni enlaces firmados.

Si no están configurados, el cron diario de ingesta se **omite**
expresamente; no se simula un resultado satisfactorio.

## Límites explícitos

- Máximo **65 MiB por archivo**, una fecha y un producto por ejecución.
- A lo sumo **32 granules** y **1 GiB** de objetos bajo el prefijo
  reservado (manifiestos incluidos).
- Retención de **14 días**, con eliminación de fechas anteriores limitada
  al prefijo dedicado. Si necesitas mantener histórico, ajusta cuotas,
  tamaño y almacenamiento **antes** de activar.
- Un job de GitHub Actions diario, con `concurrency` sin solapamiento;
  el día seleccionado tiene al menos 7 días de antigüedad.
- Lectura HTTP en Render sin búsqueda ni descarga en vivo a NASA.
- El servidor valida versión, nombre, fecha, tamaño y SHA-256 antes de
  interpretar NetCDF/HDF5. Sin archivo → `data_unavailable`.
- Las fallas de integridad producen HTTP 503; no se reemplazan por 0.

Código: `backend/app/services/verified_archive.py`,
`scripts/ingest_nasa_archive.py`,
`scripts/prune_nasa_archive.py`,
`.github/workflows/ingest-nasa-private.yml`.

## Verificaciones que faltan

1. Configurar **un bucket real y token Earthdata**, sin compartir secretos
   en texto visible; confirmar que la política S3/R2 restringe el prefijo.
2. Ejecutar una ingesta manual y observar SHA-256, tamaño y estado
   `ingested`; comparar la fecha con CMR oficial.
3. Validar lectura real en Render mediante las rutas públicas de GPM y SMAP.
4. Revisar tarifas, tráfico, almacenamiento acumulado y costos.
5. Contrastar valores satelitales con registros locales (Cusco) antes de
   emplearlos para decisiones agrícolas.

Fuentes: [NASA Earthaccess](https://earthaccess.readthedocs.io/en/latest/user/explanation/authenticate/)
· [Render: limitaciones Free](https://render.com/docs/free)
· [NASA IMERG V07](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary)
· [SMAP V006](https://nsidc.org/data/spl3smp_e/versions/6).

**No hay medición NASA real persistida en producción antes de
configurar y ejecutar esos pasos.**
