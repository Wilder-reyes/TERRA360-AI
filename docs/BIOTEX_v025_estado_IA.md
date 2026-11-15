# Estado del motor de IA agrícola

**Producción:** BIOTEX utiliza un motor de búsqueda/optimización matemática de rotaciones con reglas agronómicas y estimaciones hídricas basadas en FAO-56 y NASA POWER. **No hay un modelo de aprendizaje automático agrícola entrenado y validado**, y no debe anunciarse así.

**Desarrollo reproducible:** `scripts/train_agro_model.py` contiene un entrenamiento supervisado de rendimiento por hectárea con `HistGradientBoostingRegressor`. Se ejecuta **únicamente** si hay un CSV con 200 o más campañas reales, consentimiento y 30 o más parcelas independientes en Barranca/Pativilca/Supe. Divide por parcela, contrasta contra una mediana y guarda solo un candidato con al menos 10 % de mejora relativa de MAE. El archivo resultante **nunca se sirve automáticamente** en las recomendaciones. La auditoría de agrónomos y la comprobación independiente de la utilidad agronómica siguen pendientes.

**Criterio para activar predicciones:** evaluación sobre otro conjunto de parcelas reales y distinto periodo, sesgos por cultivo/zona, error por subgrupo, incertidumbre, revisión agronómica, consentimiento de datos, mecanismo de abstención, registro de versión y reversión. Sin esos criterios, no activar.

**Fuente de características:** predictores de clima, historial satelital y mediciones de parcela; la etiqueta es rendimiento real reportado y validado, nunca una pseudoetiqueta inferida del mismo motor.

**Ejecución local (solo con un CSV de campo verdadero):**
```bash
python -m pip install -r scripts/requirements-ml.txt
python scripts/train_agro_model.py /ruta/protegida/campanas_verificadas.csv
```

**Privacidad:** el archivo de entrenamiento no debe subirse al repositorio ni a un almacenamiento público. Anonimizar identificadores y obtener autorización explícita.
