# Alertas agrícolas regionales

En la aplicación, abrir **Alertas agrícolas**. Se consultan automáticamente los datos preparados del piloto; el mapa muestra nueve puntos y el panel permite filtrar por riesgo y revisar cada punto. **Volver a consultar** recupera el informe disponible en la API: no lanza descargas meteorológicas. El operador actualiza los datos con el preparador descrito abajo.

## Qué se implementó

- Cinco indicadores: riesgo de sequía, temperaturas extremas, exceso de precipitaciones, posible erosión y posible estrés hídrico.
- Cuatro estados: **revisión prioritaria**, **monitorear**, **sin señal del indicador** y **datos insuficientes**. Sin señal no significa zona segura.
- Mapas de puntos regionales, filtro por indicador, evidencia numérica, fechas, cobertura de entradas, umbrales explicados y acciones de seguimiento.
- API offline que valida los datos, su SHA-256, sus coordenadas y su vigencia antes de calcular las señales.
- Caducidad también en una pestaña abierta: al vencer el informe, se retiran marcadores y alertas.
- Enlace a [avisos oficiales de SENAMHI](https://www.senamhi.gob.pe/?p=aviso-meteorologico), separados de los indicadores experimentales de TERRA360. No se envían correos, mensajes ni notificaciones externas.

Son reglas de vigilancia de **TERRA360**, sin calibración agronómica local ni estimación de pérdidas. Se reutilizan modelos meteorológicos publicados y relieve real; no se entrena ni se usa Chronos para estas alertas. No se infiere una prohibición de siembra, abandono de una parcela o dosis de riego.

## Cobertura y datos

Piloto de nueve coordenadas: latitudes -13,25/-13,50/-13,75 y longitudes -72,25/-72,00/-71,75, identificadas P01–P09. Son posiciones de consulta en torno a Cusco, no distritos o parcelas medidas. Las áreas entre puntos no se clasifican y el tamaño de los círculos es solo visual.

Se solicitan explícitamente **ECMWF IFS 0.25°**, para siete días completos desde mañana, y **ERA5 0.25°**, para lluvia y agua modelada del perfil 0–100 cm. Ambas consultas fijan selección de celda más cercana y desactivan el ajuste a la elevación del usuario. Se comprueban coordenadas devueltas, orden de ubicaciones, unidades, fechas y longitudes de los arrays. Son datos regionales de unos **27 km**, no sensores de campo. [API de pronóstico](https://open-meteo.com/en/docs), [API histórica y modelos](https://open-meteo.com/en/docs/historical-weather-api).

El histórico reciente tiene 30 días y termina **siete días antes de la preparación**, para respetar la disponibilidad del reanálisis. La referencia tiene 30 ventanas equivalentes que terminan en los años **1991–2020**. Para una ventana que cruza el año se incluye el diciembre anterior; el 29 de febrero se ajusta al 28 en años no bisiestos. Este periodo de referencia sigue la convención de normales de treinta años de la [OMM](https://public.wmo.int/media/news/updated-30-year-reference-period-reflects-changing-climate); los percentiles del indicador son una elección de TERRA360.

Para el relieve se leen dos GeoTIFF **Copernicus DEM GLO-90, edición AWS 2021**, con hashes fijados. Se calcula la pendiente por diferencias centrales sobre ventanas de unos 3 × 3 km, usando distancias elipsoidales WGS84, y se resume su percentil 75. Se exige al menos 95 % de pendientes válidas. Es un **modelo de superficie (DSM)**, que puede incluir vegetación y construcciones; no una pendiente medida de la parcela. [Distribución y edición](https://registry.opendata.aws/copernicus-dem/), [especificaciones y atribución](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM).

## Reglas de vigilancia v1

Configuración versionada: `backend/app/data/risk_rules.json`. Los umbrales son exploratorios, visibles en cada tarjeta y no equivalen a umbrales oficiales o específicos de un cultivo/etapa. Las respuestas incluyen el hash de las reglas y los umbrales aplicados.

| Indicador | Monitorear | Revisión prioritaria | Alcance |
| --- | --- | --- | --- |
| Sequía | Percentil de lluvia acumulada de 30 días ≤10 | Percentil ≤5 | Déficit relativo al histórico modelado; no SPI ni declaración oficial de sequía |
| Temperaturas | Tmin ≤0 °C o Tmax ≥35 °C | Tmin ≤−3 °C o Tmax ≥40 °C | Aire regional a 2 m; el daño depende de cultivo, duración y etapa |
| Precipitaciones | ≥20 mm/día o ≥50 mm en 3 días consecutivos | ≥40 mm/día o ≥80 mm en 3 días | Pronóstico determinista; no probabilidad de inundación |
| Posible erosión | Pendiente P75 ≥10° y activación de un umbral de lluvia | No se asigna categoría alta de erosión | Señal para inspección, sin cuantificar pérdida de suelo |
| Posible estrés hídrico | Percentil de agua modelada del suelo ≤20 **y** déficit previsto ET₀−P ≥10 mm/7 días | Percentil ≤10 **y** déficit ≥20 mm/7 días | Proxy combinado; no estrés fisiológico observado ni necesidad de riego del cultivo |

El percentil empírico usa `100 × (valores menores + 0,5 × valores iguales) / N`. Se requieren al menos **25 ventanas anuales completas** por variable. Si todos los años y el reciente tienen cero lluvia, el percentil es 50: no se convierte una estación normalmente seca en una alerta de sequía. No se extrapola una probabilidad de daño a partir del percentil.

La señal de suelo compara la media de sus últimos siete días con las medias equivalentes del mismo modelo ERA5. **No compara percentiles de suelo entre modelos distintos.** Se combina con demanda climática prevista, `max(0, ΣET₀ − ΣP)`, sin contabilizar riego, coeficientes de cultivo o humedad medida. ET₀ es una referencia de superficie bien regada, no evapotranspiración real del cultivo.

La [FAO describe los factores necesarios para USLE](https://www.fao.org/land-water/land/land-governance-and-planning/land-resources-planning-toolbox/detail/universal-soil-loss-equation/en). Aquí faltan erodibilidad, longitud de pendiente, cobertura y prácticas de conservación: **no se calcula USLE/RUSLE ni toneladas de suelo perdidas**. La [definición de helada de FAO](https://www.fao.org/4/y7223e/y7223e07.htm) apoya el uso de 0 °C como señal de frío; no valida los demás umbrales ni una predicción de daño local.

## Datos faltantes y vigencia

Un cero válido se conserva. Fechas ausentes, valores nulos, booleanos, no finitos o fuera de rango no se convierten en cero. Lluvia acumulada y humedad media requieren todos los días de la ventana. No se suman tres días separados por un hueco. Un extremo de temperatura o lluvia conocido puede activar una alerta aunque falten otros días; se muestra su cobertura parcial. Si no hay un disparador conocido y falta información, la categoría queda como **datos insuficientes**.

El nivel combinado es la señal de mayor prioridad. Si no hay señales pero algún indicador no pudo evaluarse, el punto combinado queda sin datos suficientes. La posible erosión nunca escala a una categoría cuantificada alta, porque sus factores están incompletos.

El informe vence al primero de estos límites: **doce horas desde el inicio de preparación o medianoche en Perú**. No se publica si la fecha de preparación está en el futuro, si el periodo no corresponde al horizonte declarado o si no se verifica el hash. `issued_at` identifica preparación de datos, **no** la hora de ejecución del modelo meteorológico, que no se proporciona como vintage fijado. Los avisos vencidos se retiran tanto en la API como en una pestaña abierta; no se conserva un mapa antiguo como si fuera actual.

## Operación y reproducción

Desde la raíz, con las dependencias normales del backend:

```bash
backend/.venv/bin/python scripts/prepare_risk_alerts.py
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s tests -p 'test_risk_alerts.py' -q
```

La primera ejecución realiza treinta consultas históricas multicoordenada, una reciente y una de pronóstico, más dos descargas DEM. Se respetan tamaño máximo de respuesta y pausas entre peticiones. Las ventanas históricas y los originales DEM se almacenan en `backend/data/risk_alerts/`, excluido de Git. Las siguientes ejecuciones reutilizan esa referencia y siempre consultan un pronóstico nuevo. Sin datos de relieve verificables, erosión queda sin evaluar. Un fallo de la preparación no reemplaza el último informe completo por datos parciales inventados.

Salidas pequeñas: `backend/app/data/risk_alerts/pilot-snapshot.json` y `pilot-manifest.json`. Contienen entradas regionales, referencia, procedencia y hash; la API calcula los indicadores al consultarlas. No se incluyen rasters completos, tokens ni pesos. Para entregar actualizaciones sin reiniciar la API se puede definir `RISK_ALERTS_DATA_DIR` a un directorio de informes preparado por un operador.

**La renovación periódica no está activada ni desplegada.** Para operar alertas continuas hay que ejecutar el preparador de forma programada —por ejemplo, cada seis horas alineadas con medianoche de Perú— y entregar sus dos archivos al directorio de la API. `Volver a consultar` solo recupera lo que ya esté preparado. La API pública no permite disparar descargas costosas a voluntad de visitantes. La API gratuita de Open-Meteo se usa para este piloto de hackatón; su [servicio gratuito tiene límites y alcance no comercial](https://open-meteo.com/en/terms).

Endpoints:

- `GET /api/agro/risks/catalog`: reglas, umbrales, cobertura, fuentes y límites.
- `GET /api/agro/risks/report`: `available`, `not_prepared`, `invalid_report` o `stale_report`. Solo `available` contiene indicadores y puntos.

Quedan pendientes calibración con datos locales, validación independiente de alertas y falsos positivos, adaptación a cultivo/etapa y expansión espacial. Las pruebas de software no establecen un porcentaje de éxito agrícola.

Validación técnica de esta entrega: **225 pruebas de backend, tres suites de frontend y 26 pruebas de navegador aprobadas**, con compilación de producción correcta. Se revisó además el informe real en Chromium: nueve puntos y sus etiquetas dentro del mapa, sin errores de JavaScript ni desbordamiento en escritorio y móvil. Las seis pruebas del nuevo panel se repitieron después de ajustar la presentación de fechas.
