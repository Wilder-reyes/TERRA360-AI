# NSPACE BIOTEX · Entrega acumulada de etapas 4–8

Fecha: 15 de noviembre de 2026. Base: `BIOTEX-etapas-0-3.zip`; la copia recibida de Codex tenía previamente las etapas 0 y 1, y las etapas 2 y 3 se trabajaron sobre ZIP, sin `.git` conservado. **NO** se hizo push, merge, despliegue ni conexión con proyectos antiguos. Esta entrega es un **candidato de release para pruebas**, no una certificación de funcionamiento completo en Vercel.

## Etapa 4 · IA real y evaluación

- Se conservó el modelo de regresión logística NASA HLS, exclusivamente para **barranca-1** (objetivo: NDVI mensual menor de 0,20 = proxy de vegetación baja).
- Se añadió `backend/app/ml/holdout_metrics.py` para métricas binarias reproducibles, sin ajustar el umbral sobre el holdout; se integró en la evaluación acotada y en la interfaz.
- Resultados de 11 meses de prueba posteriores a los 33 de entrenamiento: TP=5, TN=2, FP=0, FN=4; accuracy 63,6364%; precision 100%; recall 55,5556%; F1 71,4286%; Brier 0,2340806663 vs baseline 0,4802571166.
- La muestra es **muy pequeña y de un único terreno**; el 100% de precision sobre el holdout no garantiza transferibilidad.
- Nuevo endpoint de auditoría `/api/ai/validated-models`, con metadata verificable y abstención expresa para Chalhuas; **no** realiza predicción en coordenadas arbitrarias.
- Se complementó el entrenador opcional de Chalhuas con evaluación de clasificación fuera de muestra y separación del validador geográfico de las dependencias satelitales. **No** se ha entrenado modelo nuevo para Chalhuas: no hay historial de escenas local suficiente y revisado incluido en el ZIP.

## Etapa 5 · Motor agrícola

- El motor andino conserva S0 registrado/ejemplo y las referencias R1/R2 con `automatic_recommendation = null`.
- Según agua/suelo/ambos, `comparison_summary_es`, `comparison_summary_en` y `priority_evidence` distinguen qué puede compararse con datos disponibles. La estructura de familias y repeticiones de cultivos sí puede contarse; cuantificar riego, fertilidad o aptitud **no**.
- Cada alternativa trae diferencias estructurales frente a la secuencia del agricultor. No hay una puntuación arbitraria ni ranking de ahorro de agua.
- Fundamento metodológico externo: FAO-56 `ETc = Kc × ET0`; esta relación describe demanda evapotranspirativa del cultivo, no volumen de agua efectivamente suministrado por turno. INIA y el estudio agrológico local siguen siendo fuentes citadas, no ensayos de campo realizados.

## Etapa 6 · Visualización de campañas

- `frontend/src/campaignPlan.ts`: contrato reutilizable para resolver cultivos propuestos por subparcela y campaña, calcular superficies aproximadas y generar croquis de impresión.
- Se eliminó el desplazamiento **automático** de cultivos entre subparcelas sintéticas. La opción seleccionada se aplica a toda subparcela, salvo que el agricultor edite su asignación.
- `frontend/src/CampaignVectorMap.tsx`: croquis vectorial con contorno del usuario y colores de cultivos propuestos. No identifica especies vía NASA. Áreas estimadas por geometría, no información catastral.
- La pantalla muestra superficie por especie en la campaña seleccionada. Persistencia local y BIO se reutilizan, sin nuevas páginas.

## Etapa 7 · Informe PDF A4

- Se amplió la hoja de impresión andina: datos de parcela, cuatro campañas comparadas, asignación por subparcela, **cuatro mapas vectoriales**, fuentes, límites, estado de IA y advertencias.
- Tema blanco con márgenes A4 de 18 mm, leyendas, tablas sin dividir filas y saltos de página entre grupos de dos mapas. Regla de paginación añadida en `style.css` en navegadores que soportan cajas marginales CSS.
- Se creó una **maqueta sintética independiente**, sin datos científicos falsamente atribuidos, para comprobar el aspecto de impresión. Se renderizó a PDF usando WeasyPrint: **2 páginas A4**. Se inspeccionaron visualmente ambos PNG y se corrigió el problema de mover todos los mapas juntos a la segunda hoja.
- **Pendiente obligatorio:** abrir el resultado en Chromium/Playwright con frontend compilado y verificar la impresión real de React, incluido el portal, márgenes y numeración. La muestra PDF no demuestra esa integración en navegador.

## Etapa 8 · Auditoría y preparación del nuevo repositorio

- `frontend/vercel.json` continúa siendo la configuración única del frontend estático, sin proxy antiguo. Backend FastAPI es independiente y necesita un nuevo servicio HTTPS y `CORS_ORIGINS` configurado.
- Nuevo repositorio **planeado**, NO creado por el asistente: `Wilder-reyes/NSPACE-BIOTEX`. Guía `docs/NSPACE_BIOTEX_NEW_REPO_AND_DEPLOY.md`.
- Ingesta privada NASA y reimportación FAO pasan a disparo **solo manual**, para evitar descargas/costes automáticos en el nuevo repositorio.
- Se actualizaron README, reglas de agentes, manifest de release y CI con denominación NSPACE BIOTEX sin borrar el historial científico.

## Resultados de pruebas realmente ejecutadas en este entorno

| Comprobación | Resultado |
|---|---|
| `node --experimental-strip-types --test frontend/tests/*.test.mjs` | **39/39 aprobadas**, incluye 3 pruebas nuevas de campañas, croquis y superficie |
| `PYTHONPATH=backend python -m unittest -q tests.test_stage4_5_ai_priority tests.test_chalhuas_training_gate` | **7 casos, 6 aprobados, 1 omitido** (el API requiere dependencia `earthaccess` ausente) |
| Reproducción frozen NASA HLS | **Aprobada**; 44 observaciones, split 33/11, Brier igual al original |
| Reproducción clasificación etapa 4 | **Aprobada**; matriz TP=5 TN=2 FP=0 FN=4 |
| Parser de TS/TSX (TypeScript global) | **32 archivos sin errores de sintaxis**; NO equivale a typecheck completo |
| `python -m compileall -q backend scripts tests` | **Aprobada** |
| Auditoría de imports locales, patrones de credenciales y sintaxis | **Aprobada** en árbol de trabajo; no valida secretos del historial Git |
| PDF maqueta con WeasyPrint | **2 páginas A4 renderizadas e inspeccionadas**; maqueta estática sintética, no ejecución React |
| `npm ci` | **No completada**: descarga de dependencias no avanzó y la ejecución finalizó por timeout de 28 s |
| `npm run build` | **No verificada**: faltan `react`, `react-dom`, `typescript/vite` locales instalados y sus tipos |
| Playwright de UI real | **No ejecutado**, faltan paquetes frontend |
| Suite Python completa | **No aprobada** en este entorno: 123 pruebas descubiertas y 19 errores de importación por `earthaccess`, `planetary_computer` y `s3fs` faltantes; no son pruebas funcionales fallidas certificadas |
| Docker, pruebas NASA/SENAMHI externas y API pública | **No verificadas** |

**Resultado:** proyecto acumulado **preparado para validación final local/CI y un nuevo despliegue manual**, pero **NO declarado listo para producción**. Un test de importación que falla por falta de dependencias no se interpreta como prueba de funcionalidad científica. Para certificarlo hay que instalar `backend/requirements.txt` y `npm ci`, correr todas las suites y probar el frontend junto a un backend real.
