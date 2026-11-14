# Fundamento científico de TERRA360 AI v0.6

**Alcance:** apoyo a decisiones para explorar rotaciones, **no** prescripción de riego o fertilización, predicción de rendimiento o sustitución de la experiencia local. Un punto en el mapa no delimita una parcela. El catálogo contiene cinco cultivos andinos como ejemplo documentado, no un sistema universal de aptitud de especies.

## Evidencia verificada y qué NO permite afirmar

| Referencia | Hallazgo/uso metodológico | Límite para TERRA360 |
|---|---|---|
| Challand, Vismara, de Tourdonnet (2025), *Agricultural Systems* 222:104154, https://doi.org/10.1016/j.agsy.2024.104154 | Programación por restricciones, diseño iterativo con agricultores | No proporciona coeficientes universales de rendimiento o agua |
| Visscher et al. (2024), *Science of the Total Environment* 912:168725, https://doi.org/10.1016/j.scitotenv.2023.168725 | Ensayos con especies andinas, condiciones térmicas y manejo de fertilidad | No se extrapolan resultados particulares a todas las parcelas |
| Meza et al. (2025), *Agriculture, Ecosystems & Environment* 394:109884, https://doi.org/10.1016/j.agee.2025.109884 | Ensayos de barbecho forrajero andino, nutrientes y carbono | Una rotación con leguminosas no es equivalente al tratamiento del estudio |
| FAO (1998), *Crop evapotranspiration: FAO Irrigation and Drainage Paper 56*, https://www.fao.org/4/X0490E/X0490E00.htm | ET0 Penman–Monteith, ETc y coeficientes Kc por fase | Kc genérico no equivale a demanda o suministro real de una parcela |
| NASA POWER API, https://power.larc.nasa.gov/docs/services/api/temporal/daily/ | Series meteorológicas diarias regionales | No son lecturas en terreno, tampoco pronósticos |
| GPM IMERG, https://gpm.nasa.gov/data/imerg | Precipitación estimada mediante múltiples satélites | No equivale a una estación local ni demuestra cuál fuente es correcta |
| SMAP L4, https://data.nasa.gov/dataset/smap-l4-global-3-hourly-9-km-ease-grid-surface-and-root-zone-soil-moisture-analysis-update-a568e | Humedad superficial y zona de raíces a ~9 km | No demuestra humedad de una parcela; aún no está integrado en v0.6 |
| HLS, https://hls.gsfc.nasa.gov/algorithms/ | Reflectancia armonizada Landsat/Sentinel-2, con calidad y enmascarado | NDVI no identifica la causa de estrés ni diagnostica fertilidad; aún no integrado |

La obra de Challand et al. fundamenta el **enfoque metodológico** del sistema de búsqueda con restricciones. No afirmamos reproducir literalmente el algoritmo de ese estudio ni su validación de campo.

## Parámetros estructurados

La fuente de verdad del catálogo es `backend/app/data/parameter_catalog.json` (también disponible en `GET /api/arie/parameters`). Cada variable incorpora etiqueta comprensible, unidad, fuente, tipo de observación/entrada, resolución y estado real de integración. Los estados distinguen `live`, `live_on_demand`, `optional_input`, `research_not_integrated` y `not_evaluable`.

Indicadores principales disponibles: lluvia diaria y mensual histórica, temperatura y humedad del aire en NASA POWER; comparación diaria GPM bajo disponibilidad; familias botánicas y limitaciones del agricultor. No se presenta SMAP, NDVI, pendiente ni ET0 como dato **ya calculado**.

## Motor AI — reglas auditables

1. El productor selecciona cultivos, historial, prioridad y, si los conoce, agua/mercado/maquinaria/mes de siembra/suelo.
2. ARIE genera todas las permutaciones del conjunto de cultivos propuestos (máximo 120 para cinco especies) sin agregar especies no solicitadas.
3. Cuenta transiciones contiguas de la misma familia botánica, considerando el último cultivo histórico cuando existe. Ordena de manera lexicográfica por **menos transiciones**, **menos cambios respecto al orden propuesto** y desempate determinista.
4. Un recuento menor representa únicamente una **diferencia estructural** de secuencia. NO demuestra menor incidencia de plagas, mayor fijación de N, mejor fertilidad, menores costos o más rendimiento.
5. S0 es el historial declarado; S1 el orden que minimiza transiciones taxonómicas; S2 la propuesta condicionada a verificar suministro hídrico y etapas. S2 puede coincidir con el orden propuesto; no debe inventarse una estrategia de menor consumo sin datos suficientes.
6. Si el usuario declara que todos sus cultivos deben venderse y especifica cuáles tienen salida de mercado, la IA detecta conflictos (autodeclarados). El sistema no infiere precios, demanda o rentabilidad.
7. Si el objetivo es agua o ingresos, ARIE se **abstiene** de proclamar una opción ganadora mientras no haya datos locales suficientes. Si existe una mejora estructural para suelo/diversidad, identifica S1 como «opción a revisar» y no como orden de siembra.
8. El informe y la API conservan criterios, alternativas, restricciones, evidencia faltante, ubicación y procedencia.

Este diseño implementa **IA simbólica por búsqueda/optimización con restricciones**. **No** implica que haya un predictor supervisado de rendimiento entrenado ni que los resultados de una rotación estén validados en campo.

## Integración espacial y temporal

- POWER, GPM y futuras capas SMAP/HLS tienen resoluciones distintas. No debe remuestrearse una cuadrícula regional a 30 m para presentar precisión parcelaria ficticia.
- Solo se comparan periodos compatibles. Los 10 años completos de la ruta `/seasonality` producen medianas por mes cuando al menos cinco años cuentan con cobertura suficiente.
- Los meses sin suficiente cobertura aparecen como `null`, no como 0 mm.
- Las cifras recientes de 14/30/90 días no son una «tendencia climática»; la comparación de diez años no equivale a pronóstico ni prueba de cambio climático.
- Los datos de pH, materia orgánica y textura son **declarados**, no validados por NASA. Las bases estadounidenses WSS, PRISM, SSURGO, NAIP y CDL no se usan como si cubrieran cualquier región del mundo.

## Investigación de parámetros no integrada en esta versión

Para cuantificar demanda de agua se requiere ET0 con variables y método comprobados (radiación, humedad del aire, viento, temperatura y presión), ETc por cultivo y etapa, agua disponible por temporada, propiedades de suelo y raíces, así como validación local. No corresponde usar solo `Kc_mid` como volumen total ni hacer restas de lluvia–ETc y llamarlas balance completo.

Para erosión sería necesario terreno, erosividad de la lluvia, erodibilidad del suelo, cobertura y prácticas. Para riesgo de enfermedades, un modelo específico de plagas, variedades, historial de enfermedad y manejo. Para ingresos, precios, insumos, costos, mano de obra, acceso a mercado y datos fechados. Sin ellos el estado correcto es **No evaluable**.

## Intervención humana

La herramienta solicita revisión local ante: disponibilidad real de agua, calendario de siembra y cosecha, diagnóstico fitosanitario, resultados de laboratorio, compatibilidad con equipos/semillas, mercado y riesgos económicos. Una recomendación condicionada es una hipótesis para contrastar, no una autorización para sembrar.

## Cómo validar la experiencia

Hacer pruebas con agricultores y personas no técnicas sin dar instrucciones. Medir finalización del recorrido, comprensión de las 3 opciones y límites, errores, tiempo de uso y opinión sobre utilidad real. No se reporta esa validación como realizada.
