# Adaptación LoRA de Chronos-2 para Calca

**Ejecución real: 14 de noviembre de 2026.** Se ajustaron y guardaron tres adaptadores LoRA de Chronos-2 usando datos reales NASA POWER de la referencia de Calca. Se entrenaron 1.206.912 parámetros de un total de 120.684.576, aproximadamente el 1 %. Los pesos del modelo original se conservaron.

**Resultado:** ninguna configuración redujo al menos 5 % el error de validación. El pronóstico de la aplicación sigue usando el modelo original; la interfaz permite consultar el resultado del experimento en **Predicción de lluvia → Consultar estimación de lluvia → ¿Mejoró al adaptar el modelo?**.

## Datos y separación temporal

El conector existente se amplió con un parámetro local acotado de historial. La API pública continúa consultando quince años por defecto; el experimento descargó treinta años y reutilizó los archivos ya disponibles en el cache.

| Uso | Periodo | Observaciones |
|---|---|---|
| Serie completa | Noviembre 1996–octubre 2026 | 360 meses completos y consecutivos de una serie regional. |
| Ajuste de pesos | Noviembre 1996–agosto 2020 | 286 meses. |
| Validación para escoger checkpoint y configuración | Octubre 2020–septiembre 2022 | 24 objetivos mensuales. |
| Comparación retrospectiva | Noviembre 2022–octubre 2026 | Dos bloques de 24 objetivos. |

Se dejan separaciones para respetar el adelanto de dos pasos mensuales: al estimar el primer objetivo de validación, los pesos no pueden haber aprendido observaciones posteriores al contexto disponible; al estimar el primer objetivo de prueba, la elección del adaptador tampoco puede haber usado meses posteriores a ese contexto. El código calcula esas separaciones para dos o tres pasos y las comprueba en el contrato público.

Los meses de contexto de cada origen pueden avanzar conforme se observan nuevas fechas. Los pesos del candidato evaluado permanecen fijos después del ajuste; no se vuelven a entrenar con los objetivos de prueba.

Estos periodos de prueba **ya habían sido examinados con el modelo original**. Se identifican expresamente como comparación retrospectiva, sin afirmar que sean una prueba prospectiva nueva. Se usan los productos finales disponibles de NASA y no se reconstruyen sus publicaciones históricas. No se ha descartado solapamiento entre esos datos y el preentrenamiento original.

## Configuraciones y elección

Se utilizó la implementación oficial `Chronos2Pipeline.fit`, LoRA de rango 8, alpha 16, batch 8, contexto de entrenamiento de 96 meses y semilla 2026. Los checkpoints se eligieron por pérdida en validación; la comparación entre candidatos se hizo por MAE de los 24 objetivos de validación. Los modelos original y adaptado reciben los mismos contextos al comparar sus predicciones.

| Tasa de aprendizaje | Pasos | MAE de validación |
|---|---|---|
| Modelo original | Sin ajuste | 50,01861 mm |
| 0,00001 | 60 | 50,00897 mm |
| 0,0001 | 120 | 50,06552 mm |
| 0,001 | 120 | 51,12688 mm |

La mejor adaptación redujo el error de validación en aproximadamente **0,02 %**, por debajo del 5 % exigido. Por ello se eligió conservar el modelo original antes de puntuar la comparación final. La selección se escribe en disco antes de acceder a los objetivos de esa comparación. Las dos configuraciones adicionales se ejecutaron con `--development-only`, sin calcular sus métricas de prueba.

La selección quedó fijada en el candidato de 60 pasos como mejor adaptación a comparar. Se cargó nuevamente su adaptador desde disco y se verificó su SHA-256 antes de evaluarlo:

| Periodo retrospectivo | Original | Mejor adaptación | Referencia estacional |
|---|---|---|---|
| Noviembre 2022–octubre 2024 | 20,124 mm | 20,128 mm | 21,048 mm |
| Noviembre 2024–octubre 2026 | 38,163 mm | 38,187 mm | 37,906 mm |

Un MAE menor es mejor. La adaptación tampoco mejora consistentemente esos periodos. Estos errores del original difieren de la primera demo porque ambos candidatos reciben ahora el histórico ampliado de treinta años; la referencia estacional también se calcula con ese contexto ampliado. El informe activo de quince años se conserva y no se presenta esta comparación como una mejora suya.

## Repetir el experimento

Desde la raíz del repositorio, con el entorno ML y los pesos fijados preparados según la [guía de demo](pretrained-rain-demo.md):

```bash
backend/.venv/bin/python -m pip install -r backend/requirements-ml-tuning.txt
PYTHONPATH=backend HF_HOME=/tmp/terra360-hf-cache backend/.venv/bin/python -m scripts.adapt_rain_forecast --development-only
PYTHONPATH=backend HF_HOME=/tmp/terra360-hf-cache backend/.venv/bin/python -m scripts.adapt_rain_forecast --development-only --learning-rate 0.0001 --steps 120
PYTHONPATH=backend HF_HOME=/tmp/terra360-hf-cache backend/.venv/bin/python -m scripts.adapt_rain_forecast --development-only --learning-rate 0.001 --steps 120
PYTHONPATH=backend HF_HOME=/tmp/terra360-hf-cache backend/.venv/bin/python -m scripts.compare_rain_adaptations
```

El historial se puede descargar la primera vez; la carga de pesos se hace desde el snapshot local fijado. Cuando los archivos NASA ya estén en cache, puede utilizarse `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1` para una repetición sin red.

Cada ejecución guarda configuración, semilla, particiones, fechas, decisión de validación, adaptador y hash bajo `backend/models/rain_adaptation/`, excluido de Git. Una ejecución terminada se reutiliza en lugar de reentrenarla silenciosamente. Una ejecución interrumpida conserva su carpeta para revisión. El script rechaza la ausencia de PEFT; no permite que la biblioteca cambie silenciosamente de LoRA a ajuste completo.

La comparación final comprueba que estén terminadas las tres configuraciones previstas, que sus datos/configuración correspondan al experimento y que coincidan los hashes de los adaptadores. Solo exporta un JSON pequeño de métricas a `backend/app/data/rain_experiments/`; los pesos, checkpoints y estados de entrenamiento permanecen locales.

## Uso en la API y límites

La respuesta de `POST /api/agro/rain-forecast` puede incluir `experiment`, separado del pronóstico activo. La API valida fechas, separación temporal, recuentos, métricas finitas, selección por validación y elegibilidad para sustituir el modelo. Solo adjunta la comparación a la misma ubicación y fecha final del histórico del pronóstico. Si el JSON falta, no coincide o es inválido, el pronóstico sigue funcionando sin esa comparación. No se carga PyTorch para servirla.

`eligible_for_publication` indica exclusivamente si se cumplen los criterios retrospectivos internos: selección previa por validación, mejora de al menos 5 % frente a la referencia estacional en ambos bloques y menor MAE que el original. No establece validación agronómica. `published` permanece en `false` en este estudio y los tres adaptadores quedan como resultados de investigación.

No hay mediciones independientes de campo ni calibración local de cuantiles. Una serie de 360 meses no son 360 parcelas independientes; las ventanas superpuestas de entrenamiento tampoco crean nuevas campañas agrícolas observadas. No se infieren aptitud de cultivos, estrés hídrico o necesidades de riego a partir de estos resultados.

## Verificación de software

- 187 pruebas del backend aprobadas, incluidas separación temporal, selección por validación, rechazo de informes incoherentes y conservación del modelo original. El entorno de API no instala PyTorch ni PEFT.
- Tres grupos de pruebas del frontend y compilación de producción completados.
- 15 pruebas de navegador aprobadas, incluida la comparación de adaptaciones en móvil sin desbordamiento horizontal.
- Adaptadores reales guardados y cargados nuevamente para la comparación; hashes verificados. Los tests con datos sintéticos prueban el software y no se presentan como evidencia de precisión agrícola.

Fuentes de implementación: [código oficial de Chronos](https://github.com/amazon-science/chronos-forecasting), [LoRA/PEFT](https://huggingface.co/docs/peft/package_reference/lora).
