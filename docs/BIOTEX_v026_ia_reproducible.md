# BIOTEX v0.26 — inteligencia artificial reproducible con datos NASA HLS

**Problema específico:** ayudar a agricultores de Barranca–Pativilca/Supe a comparar la rotación actual con alternativas para cuidar el agua y mantener cubierta la tierra.
**Demo visible:** una parcela de estudio barranca-1 de aproximadamente 2,24 ha. El polígono no se atribuye a un agricultor o cosecha real sin verificación.

## Observaciones verdaderas y entrenamiento

- Producto: NASA HLS v2.0 (Landsat 8/9 y Sentinel-2), observaciones NDVI de 30 m con máscara de nubes y escenas originales identificadas.
- Datos: cuatro polígonos de estudio de Barranca, conservados en backend/app/data/history_seed/*.json, con hashes Git de los archivos originales en el artefacto.
- Entrenamiento (2021–2025): **158 observaciones NDVI válidas**. No se interpolaron meses nublados.
- Prueba separada por tiempo (2026): **41 observaciones no usadas para ajustar los parámetros**.
- Estimador: **k-means no supervisado, k=3**, inicializado con cuantiles observados fijos; sin aleatoriedad. Aprende vegetación observada baja/media/alta.
- Centroides NDVI entrenados: **0,252074; 0,4559943; 0,6657158**.
- Error cuadrático de reconstrucción para 2026: **0,0062997** frente a **0,0476666** con una sola media; reducción de distorsión **86,784 %**.
- **La reducción de distorsión NO es precisión de predicción de cultivos, rendimiento, fertilidad, ni de recomendaciones de rotación.**
- Se calculan transiciones entre estados únicamente entre meses consecutivos observados.

## Reproducibilidad por cualquier juez

Artefacto: backend/app/data/ai/barranca_hls_regimes_v1.json.
Entrenamiento e inferencia: backend/app/services/hls_regime_model.py.
Comando: **python scripts/train_hls_regimes.py --check** (desde la raíz del repo; requiere Python 3.12 y las dependencias del backend).
También: python scripts/train_hls_regimes.py --output /tmp/nuevo_modelo.json.
La verificación forma parte del pipeline .github/workflows/ci.yml y compara parámetros, observaciones, métricas y hashes fuente.
La reproducción del **entrenamiento** no requiere red ni claves porque las observaciones NASA procesadas están en el repositorio. Reprocesar todas las imágenes HLS originales sí requiere consultar la fuente STAC y las escenas identificadas.

## IA realmente integrada en la elección

1. Se utiliza el historial HLS exacto de la parcela marcada. No se imputa otro terreno.
2. El modelo clasifica los últimos 24 **meses de calendario** con imágenes disponibles y calcula la proporción observada con vegetación baja.
3. Con al menos 12 meses válidos, esa proporción ajusta entre 1,0 y 1,6 el peso de **cobertura del suelo**, pero solo si el agricultor prioriza cuidar la tierra.
4. El comparador mantiene NASA POWER 2001–2025, FAO-56, Kc y calendario agrícola de Lima para contrastar rotaciones S0/S1/S2.
5. La IA NO puede recomendar mayor demanda de agua en meses secos cuando el agricultor declara escasez; tampoco puede promover aumentos superiores al 25 % en otras condiciones.
6. API /api/rotation/compare devuelve ai_analysis y ai_decision_impact: selección sin IA, selección con IA y si cambiaron. Así la influencia es **auditable**.

## Experiencia del agricultor (UI UX Pro Max)

Cuatro pantallas: señalar chacra, anotar cultivos, elegir si prioriza agua/suelo, conocer la propuesta. La IA se explica en lenguaje simple: meses con vegetación baja observada y por qué se considera la cobertura del suelo. Detalles científicos bajo una sección opcional y en informe A4. El mapa mantiene su contorno real y capas NASA.

## Limitaciones científicas

- El NDVI no demuestra el tipo de cultivo, las propiedades químicas del suelo, el caudal de riego ni el rendimiento.
- Los cuatro polígonos son ejemplos de estudio, no una muestra representativa de agricultores ni validación presencial.
- El holdout de 2026 prueba reconstrucción de **patrones NDVI** en la misma zona, no generalización a productores desconocidos.
- NASA POWER climatológico es regional. NASA IMERG es lluvia, no disponibilidad efectiva de agua en canal.
- No existe modelo entrenado de rentabilidad o rendimiento; eso requiere cosechas verificadas. La IA v1 es un componente ambiental aprendido dentro de un motor de decisión agronómico explicable.

## Fuentes

- NASA HLS: https://hls.gsfc.nasa.gov/
- NASA POWER: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
- GPM IMERG: https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07
- FAO-56: https://www.fao.org/4/x0490e/x0490e00.htm

**Estado:** modelo entrenado y artefacto incluidos. Los indicadores científicos se verificarán con las pruebas automatizadas en GitHub antes de integrar a main.
