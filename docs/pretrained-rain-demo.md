# Demo de lluvia regional con Chronos-2

Esta entrega integra el checkpoint público `amazon/chronos-2`, revisión `29ec3766d36d6f73f0696f85560a422f50e8498c`, con `chronos-forecasting==2.3.2`. Se usan los pesos originales, **sin fine-tuning**. El experimento es de precipitación regional; sus resultados no entran en ARIE ni determinan aptitud de cultivos o necesidades de riego.

Se completó después un [experimento real de adaptación LoRA con treinta años](rain-fine-tuning-experiment.md). Sus tres candidatos no mejoraron lo suficiente la validación, por lo que la estimación activa continúa utilizando los pesos originales. El panel muestra ambas evaluaciones por separado.

## Abrir la demo

Ejecutar backend y frontend con los comandos del [README](../README.md). En el mapa:

1. Seleccionar **Predicción de lluvia**.
2. Pulsar **Ir al piloto de Calca**.
3. Pulsar **Consultar estimación de lluvia**.

El backend puede servir el pequeño informe JSON auténtico incluido en `backend/app/data/rain_forecasts/`. **No necesita instalar PyTorch ni descargar pesos para mostrar ese informe.** Otras coordenadas devuelven un estado de informe no preparado; no se sustituye silenciosamente su ubicación por Calca. El punto de Calca es una referencia de localidad, no una parcela medida.

Los informes caducan a los siete días y cuando cambia el mes objetivo. Un informe vencido no se muestra como predicción actual; se debe regenerar con datos reales.

## Preparar o actualizar el informe

Desde la raíz del repositorio, con Python 3.12 o 3.13 y un entorno virtual:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install torch==2.15.0 --index-url https://download.pytorch.org/whl/cpu
backend/.venv/bin/python -m pip install -r backend/requirements-ml.txt
PYTHONPATH=backend backend/.venv/bin/python -m scripts.audit_ml_readiness
PYTHONPATH=backend HF_HOME=/tmp/terra360-hf-cache backend/.venv/bin/python -m scripts.prepare_rain_forecast --pilot --output-dir backend/app/data/rain_forecasts
```

En Windows se usan los ejecutables de `backend\.venv\Scripts\` y la sintaxis de variables de entorno de PowerShell. El modelo y los históricos requieren conexión en la primera ejecución. El cache de pesos puede ocupar cientos de MB; se mantiene separado del informe JSON y del repositorio. No hay un servicio de ML de pago requerido por este flujo.

Para otra ubicación se reemplaza `--pilot` por `--latitude ... --longitude ...`. El script consulta quince años mediante el conector NASA POWER existente y conserva un cache local bajo `backend/data/chronos_power/`, excluido de Git. Si falta información suficiente o no se puede cargar el modelo, termina con error y no fabrica un informe de sustitución.

`--local-files-only` impide descargar pesos al repetir la ejecución. El directorio de salida predeterminado es `backend/models/rain_forecasts/`, también excluido de Git. `--output-dir backend/app/data/rain_forecasts` prepara los JSON pequeños para incluirlos expresamente en la imagen actual de la API; la imagen no incorpora el modelo.

## Inferencia local opcional

El modo normal es servir informes preparados. Para calcular al consultar una ubicación, instalar el entorno ML, preparar antes los pesos con el CLI y arrancar el backend en ese mismo entorno/cache:

```bash
CHRONOS_INFERENCE_ENABLED=true HF_HOME=/tmp/terra360-hf-cache backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

El modo local permite un cálculo a la vez por proceso y devuelve 429 si ya existe otro en curso. Usar un único worker en equipos de memoria limitada. Las solicitudes públicas **no descargan pesos**: la carga usa `local_files_only=True`. No se habilita este modo en Render Free por defecto. Si se necesita persistencia, configurar `RAIN_FORECAST_REPORT_DIR`; el cache de NASA y los pesos también deben persistir en una operación prolongada.

## Contratos y método

- `GET /api/agro/pilot`: región, cuatro cultivos, referencia geográfica, modelo y estado explícito de capacidades no evaluables.
- `POST /api/agro/rain-forecast`, con `latitude` y `longitude`: informe preparado o cálculo local habilitado; estados de ausencia, caducidad, fuente/modelo no disponible e historial insuficiente.
- El servidor valida el esquema del informe, coordenadas, fechas, finitud y orden de los cuantiles antes de mostrarlo.
- Se conserva lluvia cero y se rechazan meses con días faltantes, valores inválidos o duplicados contradictorios. Una brecha histórica no se comprime como si fueran meses consecutivos.
- El objetivo es el **próximo mes calendario completo** respecto de la emisión. Como el contexto termina en un mes pasado completo, la predicción puede tener dos o tres pasos mensuales; se omite la estimación del mes en curso. Se exige contexto reciente y al menos 84 meses anteriores a cada origen de prueba.
- Se comparan 48 objetivos retrospectivos en dos bloques consecutivos de 24 meses. Cada contexto y referencia estacional solo usa observaciones anteriores al origen correspondiente; `cross_learning=False` evita compartir información entre orígenes de prueba de un mismo batch.
- La referencia es la mediana del mismo mes del año calculada únicamente con ese contexto. Se exige al menos 5 % de reducción del MAE en ambos bloques para indicar mejora frente a la referencia. Un resultado que no pasa permanece visible como **experimental** con advertencia; nunca se promueve a decisión agrícola.
- Los cuantiles 0,1/0,5/0,9 no se presentan como un intervalo calibrado localmente. Los valores negativos se limitan a cero y el informe registra cuántos cuantiles de los objetivos evaluados y del mes futuro se recortaron.
- El reporte identifica versión de paquete, revisión de pesos, fechas y SHA-256 de los registros normalizados utilizados. No se distribuyen datos sintéticos como resultados del proveedor.

La prueba retrospectiva usa la versión final disponible de NASA, no sus publicaciones archivadas en cada fecha. Tampoco se ha descartado solapamiento entre esos históricos y el preentrenamiento del modelo. No equivale a validación prospectiva, espacial ni de campo.

## Ejecución real del 14 de noviembre de 2026

Se consultaron 180 meses completos de NASA POWER para la referencia de Calca y se ejecutó el checkpoint fijado en CPU. Para diciembre de 2026 se obtuvo una mediana aproximada de **111,1 mm**, con cuantiles del modelo de **66,7–233,8 mm**. Son resultados experimentales regionales, no lluvia garantizada.

| Periodo de prueba | MAE Chronos-2 | MAE referencia estacional |
|---|---|---|
| Noviembre 2022–octubre 2024 | 19,14 mm | 21,79 mm |
| Noviembre 2024–octubre 2026 | 39,21 mm | 39,11 mm |

El modelo **no pasó el criterio de mejora en ambos bloques**. Este hallazgo se conserva en el JSON y en la interfaz; no se reemplazaron datos ni se seleccionó una ventana favorable para ocultarlo. El siguiente experimento puede comparar ajuste de pesos o nuevas covariables manteniendo pruebas externas a la selección.

## Verificación y referencias

Las pruebas offline de `tests/test_chronos_rain.py` usan fixtures sintéticos identificados para probar fechas, faltantes, fuga temporal, caché, caducidad, concurrencia y contratos. `frontend/e2e/rain-forecast.spec.ts` comprueba la interacción con fixtures explícitos. La inferencia NASA/Chronos anterior constituye una comprobación real separada, no una métrica agronómica.

Verificación local de esta entrega, Python 3.13 y Node 22:

- 174 pruebas del backend aprobadas en un entorno sin `torch` ni `chronos` instalados.
- Tres grupos de pruebas del frontend aprobados; compilación de producción completada.
- 14 pruebas de navegador aprobadas, incluidas consulta del piloto, falta de informe, cambio de ubicación y vista móvil.
- Recorrido completo adicional contra la API real: informe de Calca visible, sin excepciones del navegador ni desbordamiento horizontal a 390 px.
- Inferencia repetida con el snapshot local fijado, sin conexión ni consultas de descubrimiento de adaptadores. Si falla una descarga NASA, el servicio cancela y espera las demás antes de liberar el turno de cálculo.

Documentación de referencia: [modelo y licencia de Amazon](https://huggingface.co/amazon/chronos-2), [implementación oficial de Chronos](https://github.com/amazon-science/chronos-forecasting), [API diaria NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).
