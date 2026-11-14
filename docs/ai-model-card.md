# Tarjeta del modelo — TERRA360 AI v0.6

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
