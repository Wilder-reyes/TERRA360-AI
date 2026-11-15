# BIOTEX v0.26 — modelo de IA reproducible sobre datos NASA reales

## Objetivo único

**Parcela de estudio:** `barranca-1`, un polígono de aproximadamente **2,24 hectáreas** en el corredor irrigado de Barranca–Pativilca/Supe. Es una parcela de estudio delimitada sobre imágenes: la identificación del propietario, sus cultivos y sus rendimientos no se han comprobado. No utilizamos sus datos como si fueran etiquetas agronómicas verificadas.

**Problema que resolvemos:** elegir entre la rotación actual y dos alternativas, considerando demanda de agua (NASA POWER + FAO-56), continuidad de la cobertura del terreno y prioridades del agricultor. El **modelo entrenado** utiliza datos históricos NASA HLS para identificar *temporadas con mayor posibilidad de vegetación muy baja*, de modo que cubrir esos meses tenga mayor valor en la comparación.

## Datos NASA reales de entrenamiento

| Elemento | Dato reproducible |
| --- | --- |
| Producto | NASA HLS v2.0, Landsat/Sentinel armonizados (30 m); observaciones procedentes del catálogo STAC Planetary Computer |
| Parcela | `frontend/src/exampleFields.json`, `team_fields[0]`, ID `barranca-1` |
| Historial fuente | `backend/app/data/history_seed/3365819f83a772e737d341ec1058efac.json` |
| Hash Git blob | `8846b0ceb4669c8372d0ea724263d263a4bf37d7` |
| Periodo | 2021-01-01 a 2026-11-14 |
| Meses | 71 del periodo; 44 con NDVI válido; 27 sin observación válida (NO se imputan) |
| Etiqueta aprendida | 1 cuando la mediana de NDVI despejado de la parcela fue inferior a 0,20; 0 si fue al menos 0,20 |
| Advertencia | La etiqueta indica *vegetación baja* según un umbral exploratorio; NO identifica especie, cosecha, suelo desnudo necesariamente ni deterioro confirmado |

Se utiliza cada mes el mayor valor NDVI de las escenas válidas (mediana espacial por escena después de Fmask). Este filtrado puede sesgar la probabilidad de cobertura respecto a las observaciones continuas. La señal se interpreta únicamente como *indicador histórico*, no predicción agronómica.

## Modelo de aprendizaje automático

**Regresión logística L2**, implementada con Python estándar, sin llamar a servicios de IA de pago. Cinco características temporales más intercepto: seno/coseno del mes, segundo armónico y año escalado `(año-2021)/6`. Entrenamiento determinista con descenso de gradiente, 5 000 iteraciones, paso 0,13, regularización 0,02.

La partición preserva el tiempo: primeras 33 **observaciones válidas** para el ajuste inicial, 11 últimas observaciones para evaluación (no se mezclan meses futuros en el entrenamiento inicial). Se compara contra una referencia constante que usa la frecuencia de vegetación baja aprendida solo de los 33 meses de entrenamiento. Tras esa evaluación, se ajustan los coeficientes de producción usando las 44 observaciones y se congela el año de referencia del predictor en 2026 para no extrapolar artificialmente la tendencia a 2027/2028.

| Evaluación cronológica (11 meses) | Brier; más bajo = mejor |
| --- | ---: |
| Modelo entrenado | **0,23408067** |
| Referencia sin aprendizaje estacional | **0,48025712** |
| Reducción relativa del error vs referencia | **51,26 %** |

**Lectura correcta:** esas cifras describen la capacidad para aproximar el estado de baja vegetación observado en **esta parcela y ese periodo**. No validan el rendimiento, rentabilidad o capacidad de recomendación en parcelas de otros agricultores. El conjunto de prueba tiene solo 11 observaciones, en un periodo con alta frecuencia de vegetación baja: existen riesgos de sesgo temporal y espacial.

Los coeficientes y métricas congelados están en `backend/app/data/models/barranca_hls_bare_v1.json`. El código `backend/app/services/field_shift_ai.py` recalcula coeficientes, puntuaciones Brier y predicciones, verifica el hash de origen y se abstiene ante cualquier discrepancia. No hay llamadas de red, valores aleatorios, pseudodatos ni credenciales privadas necesarios para repetir esta prueba.

## Cómo influye en las recomendaciones

1. El usuario indica su rotación actual, prioridad de agua/suelo y escasez de riego.
2. El optimizador existente construye hasta tres estrategias (S0 situación actual, S1 agua, S2 cobertura del suelo) a partir de FAO-56, calendarios de cultivos de Lima y climatología NASA POWER.
3. El modelo NASA HLS calcula una probabilidad estacional de baja vegetación para cada uno de los 12 meses, usando el **año de referencia 2026**, sin pronosticar cosechas.
4. Para cada alternativa, se suma esa probabilidad durante los meses en los que el calendario dejaría la parcela sin cultivo; el resultado se normaliza para comparar de forma relativa.
5. El motor de decisión añade una ponderación de **0,8 × prioridad de suelo × reducción relativa de exposición aprendida**. Si el agricultor dice que le falta agua, se prohíbe destacar una alternativa con mayor demanda hídrica seca; jamás se elimina la regla del límite de 25 %.
6. El frontend muestra una frase humana y abre los detalles técnicos solo cuando se solicita; los valores NDVI y Brier no ocupan la pantalla principal.

### Qué NO hace el modelo

- No afirma que pueda reconocer maíz, camote u otros cultivos desde NDVI.
- No usa GPM regional como caudal de riego medido ni SMAP de kilómetros como humedad de esta chacra.
- No calcula rendimiento, ganancia económica ni incremento causal de materia orgánica.
- No se aplica automáticamente a otros terrenos: se exige la **coincidencia exacta del polígono de entrenamiento** y del hash científico.
- No utiliza etiquetas inventadas para entrenar una predicción agrícola. Un modelo posterior de cosecha requiere campañas reales verificadas.

## Reproducibilidad para el jurado

```bash
python -m pip install -r backend/requirements.txt
python scripts/reproduce_field_shift_ai.py --check
python -m unittest discover -s tests -p "test_field_shift_ai.py"
```

Para verificar visualmente, el endpoint `GET /api/rotation/ai-demo` expone métricas, 44 valores mensuales NASA HLS de la parcela y probabilidades estacionales. `POST /api/rotation/compare` recibe el **polígono exacto** y los cultivos declarados; responde `ai_analysis`, `recommended_strategy_id`, razones, alternativas, cobertura y agua. No se necesita una cuenta NASA para repetir el entrenamiento porque el historial se conserva en el repositorio junto con su procedencia.

## Fuentes metodológicas

- [NASA Field Shift 2026](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/)
- [NASA Harmonized Landsat-Sentinel HLS](https://hls.gsfc.nasa.gov/)
- [NASA POWER](https://power.larc.nasa.gov/)
- [FAO Irrigation and Drainage Paper 56](https://www.fao.org/4/x0490e/x0490e00.htm)

## Criterios NASA Space Apps

- **Impacto:** decisión agrícola concreta de agricultores costeros de Barranca.
- **Creatividad:** fusión de evidencia NASA HLS aprendida, demanda hídrica NASA POWER/FAO, contexto local y prioridades, con un resultado comprensible.
- **Validez:** observaciones reales versionadas, hash, evaluación cronológica, métricas reproducibles, pruebas automáticas y límites explícitos.
- **Relevancia:** explora al menos tres estrategias (actual, agua, suelo), sus ventajas, riesgos y lagunas de información.
- **Presentación:** una sola parcela, mapa + historia NASA, simulación con IA y recomendación legible.

**No confundir reproducibilidad del software con validación científica en campo:** revisión agronómica, caudal ANA de la parcela, pruebas de suelo y desempeño de cosecha siguen siendo trabajos con datos y especialistas reales.
