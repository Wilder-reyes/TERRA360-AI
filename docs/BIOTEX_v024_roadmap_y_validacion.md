# BIOTEX — hoja de ruta verificable después de v0.24

**Ámbito de la demo:** Barranca · Pativilca / Supe, Perú. Público principal: agricultores que usan teléfonos móviles y no trabajan con datos geoespaciales. La opción de buscar otras localidades **no** equivale a validar recomendaciones para todo el Perú.

## Estado de los 28 puntos (no atribuir validación inexistente)

| # | Requisito | Estado de la implementación | Evidencia necesaria para cierre real |
| --- | --- | --- | --- |
| 1 | IMERG lluvia en la parte alta | **Preparado, datos pendientes**: flujo manual acotado `.github/workflows/imerg-barranca.yml` y `scripts/precompute_imerg_basins.py` | Credenciales NASA Earthdata privadas, aceptación GES DISC, descarga, revisión de archivos y resumen estadístico publicado |
| 2 | NASA directamente en el mapa | **Implementado**: capas regionales GIBS MODIS NDVI y GPM; fuente y resolución visibles | Validar que las teselas se carguen en la fecha/localidad seleccionada; las capas regionales NO son mediciones de parcela |
| 3 | Dos terrenos auténticos | **Pendiente de terreno**: interfaz pública usa una única parcela seleccionada para demo | Propiedad/consentimiento y cultivos reales comprobados; no inferir propiedad/cultivo por el polígono |
| 4 | Suelo | **Entrada disponible**: textura, pH, salinidad, materia orgánica y drenaje declarados por el agricultor | Laboratorio/agronomía local para reglas de compatibilidad y confianza |
| 5 | Agua real ANA/junta | **Entrada disponible**: cantidad declarada m³/ha, no usada para descartar | Documentos ANA/junta para sector, campaña, caudal y derechos/turno |
| 6 | Validación agronómica | **Pendiente externo** | Revisión firmada/registrada de ingeniero agrónomo local |
| 7 | Plagas por rotación | **Parcial**: penalización ligera por repetición de familias | Validar especies, patógenos, ciclos y cultivos hospedantes |
| 8 | Análisis económico | **No implementado** | Fuentes de costos, rendimientos, precios y ventana comercial para Barranca |
| 9 | Compatibilidad de suelo | **No implementado** (no inferirla de SMAP regional) | Rangos por variedad y calidad analítica de suelo |
| 10 | Agua realmente disponible | **Parcial**: evita destacar una rotación con mayor demanda estimada cuando agricultor declara escasez | Reglas de riego por turno y caudal, eficiencia y canal; demanda FAO-56 no es asignación de agua |
| 11 | Alertas de pronóstico | **No implementado en el plan** | Pronósticos oficiales verificables con horizonte, fecha y ubicación |
| 12 | Calendario personalizado | **Parcial/implementado**: selector del año de inicio, meses, cultivo, duración; ciclo inicia en agosto | Cultivos y ventanas de siembra/fecha de cosecha verificados localmente |
| 13 | Multicriterio | **Parcial**: agua, tiempo con cultivos, familia botánica; datos económicos y de suelo aún no intervienen | Validación de pesos, objetivos, incertidumbre y restricciones reales |
| 14 | Calidad e incertidumbre | **Implementado parcialmente**: fuente HLS vs MODIS, origen del historial y diferencias <5% calificadas | Modelo cuantitativo calibrado, intervalos de incertidumbre |
| 15 | Guardar chacra | **Implementado localmente**: guardar/recuperar en el navegador, sin cuenta | Pruebas de privacidad, borrado voluntario y multi-dispositivo si se amplía |
| 16 | Compartir plan | **Implementado**: resumen por WhatsApp e imprimir/guardar A4 | Verificar lectura, accesibilidad y preferencia del agricultor |
| 17 | Guía del mapa | **Implementado**: tres pasos visibles al dibujar | Prueba con agricultores y accesibilidad de teclado del dibujo |
| 18 | Informe A4 | **Implementado**: cultivo/fecha/duración, croquis de contorno, tabla, gráficos y fuentes | Prueba en impresoras reales A4 y con idiomas distintos |
| 19 | Rendimiento NASA | **Parcial**: historial HLS precalculado para parcelas conocidas; cache local/servidor | Object store/cache distribuido y cuotas de red para parcelas nuevas |
| 20 | Bajo consumo de datos | **Parcial**: modo mapa básico OSM sin superposición NASA | Medir consumo y tiempos reales en 3G/4G |
| 21 | Ampliar al Perú | **Solo buscador/mapa**: recomendaciones aplican al corredor costero de Lima | Calendarios, agua y suelos regionales; no reutilizar reglas de Lima |
| 22 | Pruebas con agricultores | **Pendiente presencial** (Playwright automatizado ya pasa) | Observación con agricultores de Barranca, tasa de tareas completas |
| 23 | IA entrenada agrícola | **Pendiente**: motor actual es optimización determinista | Dataset de campo etiquetado, métrica y validación fuera de muestra |
| 24 | Aprendizaje adaptativo | **No implementado** | Resultados reales de campaña y permisos de los agricultores |
| 25 | Explicación natural | **Implementada mediante reglas** (ES/EN; sin IA generativa) | Pruebas lingüísticas y comprensión con agricultores |
| 26 | Cloudflare R2 | **Integración privada opcional preparada**, nunca activada en producción | Claves R2 privadas, cuota real libre, consentimiento y una carga científica real comprobada |
| 27 | Panel de evaluación científica | **Parcial**: tests backend/frontend y fuentes de modelos; sin dashboard de validación agraria | Métricas, errores, datos de campo y evaluadores |
| 28 | Quechua | **En preparación**; mantener selector deshabilitado | Traducciones generales validadas por hablantes y revisión agronómica, código `qu` |

## Reglas verificables de la presentación

- El agricultor ve primero **qué cultivo**, **cuándo sembrarlo**, **meses aproximados**, **qué puede mejorar** y **qué riesgo tiene**.
- La diferencia de agua menor a **5%** se etiqueta explícitamente como pequeña, no como ahorro probado.
- Si declara escasez de agua, **no se destaca** una rotación con mayor demanda calculada en meses secos.
- Una alternativa con **>25%** de aumento de demanda seca no aparece como opción destacada (aunque sigue visible como comparación).
- Una fotografía regional NASA MODIS es distinta de la lectura HLS de la parcela; el enlace científico señala la observación HLS.
- El mapa regional GPM **no equivale** al resumen de lluvia de cuenca del archivo IMERG pendiente, ni a caudal ANA, agua disponible o humedad del suelo.
- No automatizar recomendaciones basadas en pH, salinidad o m³/ha declarados hasta que existan reglas locales validadas.
- No afirmar validación de agricultores, laboratorios o agrónomos sin registros.
- La skill UI UX Pro Max para el repositorio está en `.agents/skills/ui-ux-pro-max/` y guía accesibilidad, móvil y jerarquía.

## Procesamiento científico seguro (requiere autorización del titular)

1. Configurar **GitHub Actions secret** `EARTHDATA_TOKEN`, sin mostrarlo en commits/chat/logs.
2. Ejecutar el workflow manual `BIOTEX · NASA IMERG Barranca ingest (manual, bounded)` en modo `dry-run`.
3. Confirmar número de gránulos y necesidad de almacenamiento; modo ingest permitido hasta **160 gránulos**; usar año inicial que cumpla el límite.
4. Descargar el JSON como *artifact* privado y revisar archivos originales, cobertura temporal, cuenca, calidad y meses faltantes antes de aprobar `backend/app/data/imerg_basin_seed.json`.
5. Si se decide usar Cloudflare R2, configurar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` fuera del código y habilitar `BIOTEX_R2_ENABLED=1` solo en una ejecución explícita de `scripts/archive_nasa_r2.py`. El límite de 8 GB es **por este bucket**, no protege los cargos agregados de otros buckets ni las operaciones.
6. Nunca crear un flujo automático de descarga/archivo de gran escala en la demo.

**Criterio de entrega:** CI y navegador en verde + despliegue Vercel verde prueban integridad del software, NO precisión o eficacia agronómica. 
