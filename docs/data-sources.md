# TERRA360 — fuentes y trazabilidad (noviembre de 2026)

| Fuente | Variable o evidencia | Integración | Restricción de interpretación |
| --- | --- | --- | --- |
| [NASA POWER Daily API](https://power.larc.nasa.gov/) | PRECTOTCORR, T2M, T2M_MAX, T2M_MIN, RH2M | Activa: coordenadas y periodos 14/30/90 días | Serie de estimaciones en cuadrícula; no medición in situ, no predicción. |
| [NASA POWER: comparación anual](https://power.larc.nasa.gov/) | Precipitación y temperatura en años calendario completos | Bajo demanda, cinco años | Años parciales no se muestran como precipitación anual completa; comparación descriptiva, no tendencia climática. |
| [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) | Precipitación diaria Late Run V07, GPM_3IMERGDL | Consulta puntual voluntaria de un día; Earthdata puede requerir token | Cuadrícula satelital distinta de POWER; no fusionar series y no usar para prescribir riego. |
| [FAO-56](https://www.fao.org/4/X0490E/X0490E00.htm) | Kc genéricos (maíz de grano, haba grano seco, papa, cebada) | Catálogo ARIE | No calibrados para Calca, no se calcula ETc sin ETo. No se atribuye Kc válido al tarwi. |
| [INIA](https://repositorio.inia.gob.pe/handle/20.500.12955/87) | Maíz Blanco Urubamba, referencia de ciclo | Catálogo de cultivos | No es fecha de siembra de una parcela específica. |
| [Visscher et al., Science of the Total Environment (2024)](https://doi.org/10.1016/j.scitotenv.2023.168725) | Manejo de fertilidad y cultivos tradicionales andinos | Evidencia cualitativa de contexto | Resultados experimentales no equivalen a rendimiento en Calca. |
| [Perennial forage-based fallows, Agriculture, Ecosystems & Environment (2025)](https://doi.org/10.1016/j.agee.2025.109884) | Trayectorias de carbono/nutrientes en rotaciones andinas | Evidencia cualitativa | No establece una secuencia óptima de cultivos para esta parcela. |

## Fuentes consideradas, **no integradas**

En el material adjunto por el usuario aparecen SMAP, Landsat, MODIS/VIIRS, SRTM, ECOSTRESS, USDA Ag Data Commons, ESA Sentinel-2 y FAO GAEZ. **No se afirma que estén conectadas.** Varias bases USDA son exclusivas de Estados Unidos y no aportan mediciones de suelo para Calca.

## Procedencia de cada dato en pantalla

- Los indicadores y gráficos derivan de `/api/environment/nasa-power/daily`; valores nulos nunca se transforman en cero.
- La comparación de una fecha usa `/api/environment/gpm-imerg/daily`; un fallo produce estado de error, no valores simulados.
- Los campos de suelo, prioridad, historial y validación son declaraciones del usuario.
- ARIE aplica reglas descriptivas documentadas en `backend/app/services/arie.py`; devuelve identificadores de fuentes, hechos calculados y limitaciones explícitas.
- El navegador resume POWER y envía `climate_context` a ARIE como **contexto aportado por el cliente**, sin verificación criptográfica ni sustitución de mediciones de campo.
