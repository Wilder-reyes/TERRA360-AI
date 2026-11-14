# TERRA360 AI — hoja de ruta v0.14 (14 noviembre 2026)

Base: [v0.13](roadmap-v0.13.md).
**Estado: implementación en PR #11; las pruebas software no sustituyen
ingesta autorizada ni validación científica.**

| Entregable | Estado | Evidencia y límite |
|---|---|---|
| Archivo de objetos privado S3/R2, SHA-256 y manifiesto | Código listo | Necesita bucket y credenciales de operador |
| Cuotas de 32 granules/1 GiB, 65 MiB c/u, 14 días de retención | Código listo | No se activa ni paga almacenamiento automáticamente |
| Ingesta Earthdata CMR, GPM Late V07 y SMAP V006 | Código listo | Requiere token NASA; máximo 1 producto/fecha por ejecución |
| Workflow diario programado y manual con puerta de secretos | Integrado | Sin secretos omite ingesta, no crea datos |
| GPM cuantitativo desde S3/R2 | Implementado | Solo con granule NASA real; en Render sin datos regresa null |
| SMAP HDF5 DCA AM: lectura nativa 9 km y bandera QA | Implementado | Pruebas sintéticas; requiere archivo NSIDC real |
| SMAP separado de mapa GIBS y de ARIE | Implementado | No es humedad de campo ni recomendación |
| Selección FAO GAEZ v5 RES05-SIX / yuca / HP0120 / LRLM | Catalogada | El TIFF exacto y su licencia no están verificados ni importados |
| Rutina para leer TIFF FAO aprobado con SHA/CRS/nodata/escala | Implementada con abstención | No disponible en producción sin raster oficial confirmado |
| Observaciones de campo, validación agronómica y precisión instrumental | Pendiente | Nunca inferir solo con CI, NASA o FAO |
| Hospedaje estable y estado real de los datos | Parcial | Render Free no tiene disco; objeto S3/R2 es externo |

## Integración técnica

- [Ingesta y configuración de acceso privado](nasa-private-archive-v0.14.md).
- [SMAP 9 km, algoritmo DCA y control de calidad](smap-quantitative-method-v0.14.md).
- [Selección FAO GAEZ v5 y adquisición que falta](gaez-v5-selected-layer.md).
- [Método NASA GPM por polígono](imerg-polygon-method.md).
- [Serie real Sentinel-2 NDVI](sentinel2-ndvi-series.md).

## Por qué no declarar producción NASA/GAEZ completa

No hay un bucket duradero configurado, no se han instalado secretos
Earthdata/S3-R2 ni se han almacenado granules SMAP y GPM mediante el
workflow en producción. Tampoco se ha verificado un TIFF concreto GAEZ v5.
El sistema responde `data_unavailable` o
`source_selected_raster_not_verified`, sin valores falsos.

## Condiciones necesarias para cerrar operación

1. Configurar bucket privado compatible S3/R2 y permisos mínimos,
   revisar presupuesto. Render Free no acepta volumen persistente.
2. Configurar token Earthdata y bucket credentials como secretos de
   GitHub Actions; configurar credenciales **lectura** en Render.
3. Ejecutar el workflow manual de ingesta y comprobar fechas, SHA
   de originales CMR, no-data y resultados públicos.
4. Confirmar el nombre exacto, licencia y hash de una GeoTIFF GAEZ v5
   oficial; cargarla en infraestructura apropiada y probar georreferencia.
5. Realizar validación con estaciones y especialistas antes de
   activar cualquier cálculo de recomendación.

La infraestructura de software puede aprobar sin estos pasos; en tal
caso **no significa que existan mediciones NASA o FAO publicadas**.
