# Hoja de ruta TERRA360 AI — v0.12 (corte técnico 14 noviembre 2026)

La [v0.11](roadmap-v0.11.md) sigue siendo el detalle del producto y las
restricciones científicas. Esta actualización documenta avances **técnicos**
que no sustituyen datos agronómicos validados.

## Avances medibles

| Entregable | Estado | Evidencia y límites |
|---|---|---|
| Auditoría FAO ECOCROP de 2.568 registros | Implementada, PR #5 | Calidad formal y procedencia; no validación regional |
| NDVI de una escena Sentinel-2 en polígono | Implementado y en Render, PR #6 | B04/B08, SCL, baseline, límites, 596 píxeles reales en prueba |
| Contenedor Render reproducible con rasterio | Implementado, PR #8 | CI construye Docker y prueba importaciones nativas |
| Serie dispersa de NDVI por diferentes fechas | Implementación PR #9; validación real aprobada | Máximo 4 observaciones, 8 escenas examinadas, filtro por fecha y calidad |
| Interfaz de tabla de observaciones | Implementación PR #9 | Distingue NDVI de dato faltante; no infiere tendencia |
| Contrato FAO GAEZ v5 y licencia por capa | Documentado | Origen y variables verificados; sin raster de aptitud integrado |
| GPM/SMAP cuantitativos por polígono | Pendiente | NASA GIBS solo visual; no atribuir medición de parcela |
| DEM de pendiente real por parcela | Pendiente | Solo muestras gruesas de entorno SRTM |
| Calendarios/aptitud regionales validados | Pendiente | Cultivares y datos locales ausentes |
| Incertidumbre física calibrada y validación de campo | Pendiente | Las estadísticas espaciales no son intervalos de confianza |
| Ensayos con agricultores/agrónomos | Pendiente | No inventar participantes ni resultados |

## Prueba de serie Sentinel-2 con escenas auténticas

[GitHub Actions #43591201536](https://github.com/Wilder-reyes/TERRA360-AI/actions/runs/43591201536):
**PASS** contra COG B04/B08 y SCL de Copernicus en área **ilustrativa**
cerca de Calca; de 68 escenas del muestreo STAC se intentaron 5,
3 con cobertura válida 98,3 %, 2 rechazadas por falta de píxeles claros.

| Fecha | NDVI medio | Cobertura válida aproximada | Uso |
|---|---:|---:|---|
| 2026-09-05 | 0,1721 | 98,3 % | Solo observación |
| 2026-09-25 | 0,1867 | 98,3 % | Solo observación |
| 2026-10-10 | 0,1846 | 98,3 % | Solo observación |
| 2026-10-25 | Sin dato | 0 % | Excluida |
| 2026-11-06 | Sin dato | 0 % | Excluida |

**No es un campo agrícola identificado.** Pese a contar con datos por fecha,
NO se obtiene una tendencia agrícola, predicción de cosecha, salud o estrés
vegetal. La máscara SCL de 20 m, condiciones atmosféricas y etapas agrícolas
siguen siendo limitaciones. Tampoco se ha evaluado calibración.

## Próximos pasos científicos, no declarados hechos

1. Seleccionar y adquirir una capa concreta de aptitud GAEZ v5 con licencia,
   cultivo, periodo, riego/manejo, resolución y no-data verificados
   ([contrato de fuentes](gaez-v5-source-contract.md)).
2. Evaluar lluvia GPM IMERG real a resolución nominal 0,1° (~10 km) y
   SMAP 9 km, sin atribuir variaciones artificiales a un polígono pequeño.
3. Validar geometrías, calidad atmosférica y levantamientos de campo para
   identificar incertidumbre instrumental y exactitud.
4. Seleccionar agricultores voluntarios y agrónomos independientes para
   evaluar comprensión y utilidad sin promesas agronómicas.

Fuentes: [método de series](sentinel2-ndvi-series.md) ·
[documentación GAEZ oficial](https://www.fao.org/gaez/en).
