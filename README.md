# BIOTEX v0.26 · NSPACE BIOTEX — NASA Space Apps Challenge 2026

> **Hoja de ruta vigente (15/11/2026):** [BIOTEX — piloto propuesto de rotación de cultivos en Chalhuas, Junín](docs/BIOTEX_HOJA_DE_RUTA_ACTUAL_CHALHUAS.md). La plataforma desplegada continúa en Barranca hasta completar la validación geoespacial, científica y agronómica del nuevo piloto.

**Demostración:** https://terra360-ai-eta.vercel.app/  
**API científica:** https://terra360-api.onrender.com/api/health  
**Versión verificable:** https://terra360-ai-eta.vercel.app/release.json  
**Contrato público Chalhuas:** `python scripts/smoke_chalhuas_public.py` (Vercel + Render)

BIOTEX compara la rotación de cultivos actual con opciones que priorizan agua y cobertura vegetal para una **parcela de estudio de ~2,24 hectáreas en Barranca (Pativilca/Supe), Perú**. Permite marcar la parcela en el mapa, revisar las observaciones NASA, registrar el historial agrícola y obtener un plan comprensible para el agricultor.

## Nueva experiencia UI UX Pro Max · v0.27

La interfaz se rediseñó para que el agricultor entienda el resultado antes de leer índices: **parcela → cultivos → prioridades → propuesta**, con ejemplo listo de Barranca, móvil accesible, comparación de agua/cobertura y advertencias antes de sembrar. Los cálculos y el modelo científico siguen siendo **v0.26**. Consulta [el diseño y la investigación UX](docs/BIOTEX_UX_v027_diseno_agricultor.md) para principios, fuentes y límites de validación.


### Piloto exploratorio Chalhuas (Junín) · desarrollo v0.28

**Vista aislada para pruebas:** [/?pilot=chalhuas](https://terra360-ai-eta.vercel.app/?pilot=chalhuas). El ejemplo de parcela es deliberadamente **sintético**. Incluye: catálogo de cultivos, comparación de cuatro campañas sin prescrición, mapa con capas NASA GIBS y subparcelas propuestas, relieve SRTM desde el conector existente, reanálisis histórico ERA5-Land vía Open-Meteo cuando responda, y guía de introducción **BIO**.

**Lo que NO significa:** no se ha entrenado una IA con una parcela de Chalhuas, no se han validado los calendarios de siembra, la propiedad de los terrenos ni la disponibilidad de agua. ECOSTRESS queda pendiente de escenas con QA. El modelo reproducible de Barranca v0.26 sigue siendo independiente.

**Criterio de publicación final:** datos de parcela georreferenciados/validados, modelo entrenado y probado, agronomía local revisada, usabilidad con agricultores y cobertura de capas verificadas. Hasta entonces el piloto es una experiencia de investigación y Barranca conserva la ruta pública estable.

## IA real y evidencia

- **NASA HLS v2.0:** 44 meses con NDVI válido entre 2021 y noviembre de 2026; 27 meses sin observación válida, nunca inventados.
- **Modelo supervisado reproducible:** regresión logística para clasificar un *indicador de vegetación baja* (NDVI mediano inferior a 0,20) en esa parcela.
- **Evaluación cronológica:** 33 observaciones de entrenamiento y 11 posteriores de prueba. Brier del modelo: **0,234**; referencia: **0,480** (reducción relativa: **51,3 %**).
- **Recomendación:** el riesgo estacional aprendido pondera alternativas de cobertura; NASA POWER, FAO-56, agua disponible declarada y prioridades del agricultor preservan las restricciones agronómicas.
- **Límite científico:** el modelo **no** predice rendimientos, precios, especies cultivadas ni calidad de suelo, y se abstiene fuera del polígono de estudio. La evaluación no equivale a validación agronómica en campo.

**Metodología y reproducción:** [docs/BIOTEX_v026_IA_reproducible.md](docs/BIOTEX_v026_IA_reproducible.md)

```bash
python scripts/reproduce_field_shift_ai.py --check
python -m unittest discover -s tests -p 'test_field_shift_ai.py'
```

## Arquitectura ligera de publicación

- **Vercel:** exclusivamente frontend estático React + Vite (sin Python, Functions ni modelos empaquetados).
- **Render:** FastAPI, fuentes NASA, cálculos y modelo entrenado.
- **Proxy:** `/api/*` se reescribe desde Vercel a Render, manteniendo la misma procedencia para el navegador.
- **GitHub Actions:** pruebas de backend, frontend, navegador, Docker y reproducibilidad de NASA HLS.

**Despliegue:** [docs/vercel-deployment.md](docs/vercel-deployment.md). El proyecto Vercel debe tener **Root Directory = `frontend`**. Se incluye configuración compatible desde la raíz del repositorio como respaldo. No configurar Functions en Vercel ni trasladar allí secretos NASA.

**Verificación:** `/release.json` debe indicar `v0.26-hls-trained-ai-barranca` y `/api/rotation/ai-demo` debe responder JSON desde Render.

Esta es una demostración científica reproducible; ninguna recomendación sustituye la comprobación de suelo, disponibilidad real de riego y asesoramiento agronómico local.
