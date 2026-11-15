> Documento histórico: no configura ni publica la versión actual. Consulte `docs/BIOTEX_ARCHITECTURE.md` y `docs/vercel-deployment.md`.

# Hoja de ruta TERRA360 AI — v0.13 · lluvia regional NASA IMERG

**Fecha:** 14 noviembre 2026. **Base técnica:**
[v0.12](roadmap-v0.12.md). El alcance sigue siendo exploratorio y no
prescriptivo.

## Entregado en PR #10

| Componente | Estado | Restricciones |
|---|---|---|
| NASA IMERG V07 NetCDF: superposición geodésica de celda y polígono | Implementado | Solo archivos NASA preparados; cuadrícula 0,1° sin resolución de campo |
| Endpoint read-only `/api/environment/gpm-imerg/polygon-daily` | Implementado | El público no puede descargar datos NASA ni seleccionar rutas |
| QA diaria con no-data, unidades mm/día y conteo de muestras | Implementado | Exige 80 % cobertura geográfica válida |
| Interfaz de lluvia regional y datos faltantes | Implementada | Diferencia cero lluvia de dato ausente |
| Tests Python de NetCDF y Playwright | Implementados | Los valores de fixtures son sintéticos, no mediciones NASA |
| Smoke de contrato público y abstención | Implementado | Acepta `data_unavailable` sin inventar lluvia |
| Ingesta autenticada y persistente de granules NASA | **Pendiente** | Requiere credenciales Earthdata gestionadas como secreto y almacenamiento adecuado |
| SMAP cuantitativo (9 km) y QA por bandera | **Pendiente** | Requiere acceso autorizado al granule y metadatos |
| FAO GAEZ v5, raster de aptitud y mapeo por cultivo | **Pendiente** | [Contrato de fuentes documentado](gaez-v5-source-contract.md) |
| Pendiente de parcela con DEM y validación in situ | **Pendiente** | No simular nivel de detalle o exactitud |
| Estudios con agricultores y revisión agronómica | **Pendiente** | No sustituibles con CI |

## Alcance científico

El método IMERG es **promedio ponderado de cuadrícula original**, no una
estimación nueva de lluvia espacial dentro de un campo; el área de
intersección define pesos, no resolución instrumental. Si solo existe una
celda, el valor es el de una región amplia. Sin archivos NASA, TERRA360 se
abstiene y dice claramente `data_unavailable`.

Fuentes:
- [NASA GPM IMERG Late V07](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDL_07/summary).
- [Método v0.13, QA y permisos](imerg-polygon-method.md).
- [FAO GAEZ v5, condiciones previas de aptitud](gaez-v5-source-contract.md).
- [SMAP L3 9 km, versión 6 (NSIDC)](https://nsidc.org/data/spl3smp_e/versions/6).

## Trabajo siguiente

1. Habilitar ingesta segura NASA IMERG con cuota, caché y control de ciclo
   de vida en almacenamiento persistente; verificación independiente contra
   un granule oficial y métricas de disponibilidad reales.
2. Incorporar SMAP L3 Enhanced V006 interpretando mapas proyectados,
   `retrieval_qual_flag` y no-data; abstenerse si no hay datos.
3. Adquirir una capa concreta FAO GAEZ v5 con parámetros, licencia y
   resolución verificables antes de calcular aptitud por ubicación.
4. Revisar en campo sesgos y utilidad para agricultores de Cusco.
