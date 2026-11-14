# Fuentes adicionales: estado real de implementación en v0.6

La ubicación es elegida por el usuario, sin referencia predeterminada. Esto no convierte automáticamente a las cinco especies iniciales en cultivos adecuados en cualquier región.

| Fuente | Estado | Uso / limitación |
|---|---|---|
| NASA POWER diario | **Conector existente** | Precipitación, temperatura, humedad, contexto regional |
| NASA POWER histórico anual | **Conector existente** | Años completos, sin llamar tendencia a una diferencia anual |
| NASA POWER lluvia mensual histórica | **Nuevo endpoint bajo demanda** `/api/environment/nasa-power/seasonality` | Medianas de 10 años completos por mes; cobertura mínima de 5 años |
| NASA GPM IMERG V07 | **Conector existente** | Comparación de lluvia diaria; depende de Earthdata y disponibilidad de producto |
| SMAP L4 | **Investigado; no conectado ni probado** | Humedad superficial/de raíces regional ~9 km; https://data.nasa.gov/dataset/smap-l4-global-3-hourly-9-km-ease-grid-surface-and-root-zone-soil-moisture-analysis-update-a568e |
| NASA HLS | **Investigado; no conectado ni probado** | Cambios de vegetación a 30 m con control de nubes; https://hls.gsfc.nasa.gov/algorithms/ |
| SRTM / NASADEM | **Investigado; no conectado ni probado** | Pendiente y elevación, sin cuantificar erosión automáticamente |
| FAO GAEZ | **Investigado; no conectado ni probado** | Aptitud agroecológica regional de especies cubiertas, no idoneidad parcelaria |
| USDA WSS/PRISM/CDL/NAIP/SSURGO | **No usar globalmente** | Conjuntos concentrados en Estados Unidos |

No existen capas ni mediciones ficticias de SMAP, HLS o SRTM en el frontend. Ninguna se presenta como conectada sin un conector verificado y pruebas de datos reales. Una futura integración debe registrar producto, versión, resolución, fecha de adquisición, máscara de calidad, cobertura y método de agregación espacial y temporal.

Se conservan los términos técnicos solo bajo evidencia y documentación. La interfaz muestra preguntas prácticas: «¿Dónde cultivas?», «¿Qué has sembrado?», «¿Qué es lo más importante?», «¿Qué opción puedes revisar?».
