# Tarjeta del modelo — TERRA360 AI v0.6

**Actualización del 14 de noviembre de 2026:** se añadió Chronos-2 como experimento preentrenado, descrito abajo. Los componentes originales mantienen sus límites.

## Componente 5: mapa de aptitud regional FAO/IIASA GAEZ v5

- **Base:** modelo agroecológico publicado, sin entrenamiento ML propio. RES05-SIX / HP0120 / AGERA5 / HIST, periodo 2001–2020, resolución nativa 5 minutos de arco (~9 km).
- **Entradas integradas por FAO:** clima, balance de agua y almacenamiento del suelo, propiedades edáficas HWSD v2, terreno y pendiente. La capa no mide humedad actual ni permite atribuir un valor individual a cada factor.
- **Salida:** GeoJSON de celdas originales con tres grupos de visualización TERRA360: clases 1–3 aptas, 4–5 moderadas, 6–8 poco aptas; 0 sin datos y 9 agua. Nunca probabilidad de éxito.
- **Cobertura:** ventana rectangular en torno a Cusco; maíz genérico para grano, papa y cebada, con cuatro escenarios explícitos de secano/riego e insumos bajos/altos. Sin capa verificada de haba ni validación de variedades locales.
- **Procedencia:** doce originales FAO con SHA-256 fijado, extractos empaquetados y verificados offline, metadatos específicos de leyenda/licencia CC BY 4.0 archivados. Se indica la modificación por TERRA360.
- **Validación:** integridad, geografía y comportamiento de API/interfaz comprobados; **sin validación agronómica de campo ni métricas de precisión local**. No prescribe siembra ni se conecta a ARIE como decisión agronómica.

[Método, resultados reales del piloto y reproducción](agricultural-suitability.md).

## Componente 3: Chronos-2 preentrenado, integrado como experimento

- **Modelo:** `amazon/chronos-2`, revisión `29ec3766d36d6f73f0696f85560a422f50e8498c`; paquete `chronos-forecasting==2.3.2`.
- **Adaptación:** ninguna; pesos originales, sin fine-tuning ni entrenamiento propio.
- **Objetivo/entrada:** total de lluvia regional del próximo mes completo a partir de una serie mensual de NASA POWER, sin usar valores futuros de covariables.
- **Inferencia:** CLI local; la API ligera sirve JSON preparados, con inferencia local opcional desactivada por defecto. No se han desplegado estos cambios externamente.
- **Evaluación:** dos bloques consecutivos de 24 meses, mismo adelanto mensual que la predicción emitida; mediana estacional calculada solo con el contexto anterior. Cuantiles 0,1/0,5/0,9 sin calibración local.
- **Comprobación real:** 180 meses para Calca y pesos fijados ejecutados en CPU. El modelo no superó el criterio de reducción de MAE de 5 % en ambos bloques; resultado visible como experimental, sin promoción agronómica.
- **Límites:** datos finales retrospectivos; no se dispone de vintages históricos ni se descarta solapamiento con el preentrenamiento. Sin validación espacial, prospectiva o de campo. No se vincula a recomendaciones de cultivos o riego.
- **Vigencia:** informes caducan a siete días o al cambiar el mes objetivo; ubicación del informe verificada antes de servirlo.

[Método, métricas reales e instrucciones de demo](pretrained-rain-demo.md) · [Ficha oficial y licencia del checkpoint](https://huggingface.co/amazon/chronos-2).

## Componente 4: adaptación LoRA, entrenada y mantenida en investigación

- **Datos:** 360 meses reales NASA POWER para la referencia de Calca; una serie regional, sin etiquetas de campo.
- **Ajuste:** 286 meses hasta agosto de 2020; 1.206.912 parámetros entrenables mediante LoRA, con semilla fija. Tres configuraciones de tasa de aprendizaje/pasos, sin alterar el checkpoint original.
- **Selección:** 24 objetivos de validación hasta septiembre de 2022, con separación previa al primer origen de prueba. Ningún candidato alcanza la mejora de MAE de 5 % frente al original; el pronóstico activo no se sustituye.
- **Comparación:** dos bloques retrospectivos de 24 meses de noviembre de 2022 a octubre de 2026. Periodos previamente examinados, no prueba prospectiva nueva; datos finales NASA con los límites ya descritos.
- **Artefactos:** adaptadores y logs bajo `backend/models/` excluidos de Git; comparación pública pequeña, validada y separada del pronóstico.
- **Estado:** entrenamiento real completado, métricas visibles en la demo, adaptadores no publicados como modelo activo. Sin validación agronómica ni de riego.

[Configuración, particiones y resultados de los ajustes](rain-fine-tuning-experiment.md).

## Componente 1: ARIE simbólico, ACTIVO

- **Tipo**: búsqueda exhaustiva acotada de permutaciones y verificación de restricciones (IA simbólica, no aprendizaje profundo).
- **Entradas**: secuencia propuesta (1-5 cultivos de catálogo), historial declarado, prioridad, agua y condiciones opcionales; contexto NASA histórico como fuente regional declarada.
- **Salidas**: S0/S1/S2, opción estructural a revisar o abstención explícita, razones, restricciones y faltantes.
- **Criterio**: evitar transiciones contiguas de una misma familia *como comparación estructural*, sin asumir mejoras agronómicas.
- **Datos de entrenamiento**: ninguno; motor determinista. No se infiere un modelo de rendimientos.
- **Calibración agronómica**: no disponible; faltan datos experimentales propios y validación local.
- **Validación realizada**: pruebas unitarias, de validación de entradas y de contrato API (consultar QA_REPORT).
- **Limitaciones**: no garantiza tres secuencias distintas, ni presenta un ganador cuando el objetivo requiere indicadores sin datos (agua/ingresos).
- **Referencia metodológica**: https://doi.org/10.1016/j.agsy.2024.104154

## Componente 2: predictor experimental de lluvia mensual, NO DESPLEGADO

Archivo: `backend/app/ml/rain_model.py`; ejecutor: `backend/train_rain_ai.py`.

- **Objetivo**: estimar precipitación acumulada del siguiente mes a escala **regional**, en mm, a partir de datos históricos de NASA POWER.
- **Entradas**: mes (seno/coseno), lluvias de los tres meses previos y temperatura media del mes anterior.
- **Variable objetivo**: precipitación del mes posterior a las variables de entrada, calculada solo con meses completos con registros diarios válidos.
- **Algoritmo candidato**: regresión Ridge (modelo supervisado simple, explicable). No se emplea un LLM.
- **Referencia**: mediana histórica de lluvia de ese mismo mes en el periodo de entrenamiento.
- **Validación**: dos conjuntos consecutivos de 24 meses al final de la serie. Solo se marca `accepted_for_experimental_display` si ambos reducen el error absoluto medio al menos un 5% respecto a la referencia estacional, con entrenamiento suficiente anterior a cada conjunto.
- **Control de calidad**: faltantes por día implican mes descartado; cero observado se conserva; divisiones temporales que evitan entrenar con futuros.
- **Alcance de aceptación**: incluso si pasa temporalmente, todavía **no** hay validación espacial ni parcelaria, por lo que **no entra en las decisiones agrícolas**.
- **Artefactos**: se guardan solamente en `backend/models/experimental_rain_report.json` local cuando se ejecuta el entrenamiento. El paquete ZIP no trae métricas inventadas ni modelos ya entrenados.

Comando, desde `backend`, con conexión real a NASA:

```powershell
.\.venv\Scripts\python.exe train_rain_ai.py --latitude -13.32175 --longitude -71.95605 --years 15
```

Las coordenadas del comando son un **ejemplo explícito**. El producto no inicia con ese lugar seleccionado.

### Qué falta para usar predicción en decisiones

Validación espacial fuera de la zona entrenada, estaciones o mediciones independientes, incertidumbre calibrada, relación comprobada entre condiciones atmosféricas y resultados agronómicos y revisión con agrónomos/agricultores. Un predictor de lluvia no es automáticamente un predictor de agua de riego ni de cosechas.
