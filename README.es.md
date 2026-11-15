# BIOTEX v0.26 · NSPACE BIOTEX

**Frontend Vercel:** https://terra360-ai-eta.vercel.app/  
**API Render:** https://terra360-api.onrender.com/api/health

La versión final para demostración evalúa **una parcela de ~2,24 hectáreas en Barranca–Pativilca/Supe**. El agricultor ve el mapa, registra sus cultivos y compara rotaciones priorizando cobertura vegetal y demanda estimada de agua.

La IA **sí está entrenada** con 44 observaciones mensuales válidas NASA HLS. En una evaluación cronológica de 33 observaciones para entrenamiento y 11 para prueba, obtuvo error Brier **0,234** frente a **0,480** de una referencia. La señal aprendida es vegetación baja derivada de NDVI, no rendimiento de cultivos. Solo se aplica a la parcela estudiada. NASA POWER, FAO-56 y las prioridades declaradas continúan interviniendo en las recomendaciones.

La experiencia del agricultor es sencilla; la evidencia detallada está disponible opcionalmente. La validación de campo sigue pendiente.

- [Método de entrenamiento y resultados reproducibles](docs/BIOTEX_v026_IA_reproducible.md)
- [Cómo publicar la versión ligera en Vercel sin Functions](docs/vercel-deployment.md)
- [Información principal del proyecto](README.md)

**Arquitectura vigente:** frontend React/Vite exclusivamente en Vercel (`terra360-ai-eta.vercel.app`) y API científica FastAPI exclusivamente en Render. Ningún dato científico se fabrica para simular observaciones faltantes.
