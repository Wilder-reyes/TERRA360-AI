# BIOTEX · Hoja de ruta vigente — Piloto de rotaciones del Valle del Mantaro
**Actualizada:** 15 de noviembre de 2026  
**Estado:** planificación validable; NO constituye implementación ni autorización agronómica de siembra.  
**Sustituye como plan futuro:** hojas de ruta históricas basadas en Barranca. Las versiones anteriores se conservan para trazabilidad.  
**Producción actual:** BIOTEX v0.26 (IA NASA HLS específica de Barranca) + UX v0.27. No confundir esa producción estable con el futuro piloto.

## Decisión territorial
- **Candidato principal:** Chalhuas, distrito Huáchac, provincia Chupaca, Junín; Valle del Mantaro. Motivo: existe un estudio agrológico oficial de un proyecto de riego en la localidad que documenta rotación anual papa/arveja y varios cultivos locales.
- **Estado del lugar:** candidato, no polígono validado ni predio de agricultor identificado. La ubicación cartográfica del sector no prueba propiedad, superficie, acceso al agua ni aptitud agrícola.
- **Alternativa investigada:** Valle Sagrado de Urubamba, Cusco. Se mantiene como contexto de investigación, pero deja de ser el piloto propuesto de *rotación diversa* hasta nueva evaluación. No reutilizar automáticamente el catálogo del maíz Blanco Gigante para Junín.
- **Cautela documental:** el estudio agrológico de Chalhuas se publicó con el expediente del Gobierno Regional Junín en 2023 e incluye estadísticas y referencias de campañas antiguas; NO presenta por sí solo observaciones actuales, operación efectiva del riego ni estado de las parcelas en 2026.
- **Punto de control territorial:** seleccionar y verificar UNA parcela representativa, límites, tamaño, imágenes HLS útiles y consentimiento/condición de demostración. Sin polígono comprobado: **mapa de sector**, no «datos medidos de mi chacra».

## Propósito fijo
Que un agricultor pueda comprender **qué alternativas de cultivo y rotación vale la pena estudiar, dónde sembrar en su parcela, en qué fechas aproximadas y por qué**, comparando evidencia satelital, agua, suelo, clima, familias botánicas, riesgos y restricciones económicas, con límites de certeza visibles. El producto es **apoyo a decisiones**, no autorización automática para sembrar ni predicción garantizada de rendimiento o rentabilidad.

## Inventario de lo que ya funciona y NO se debe reconstruir
- Frontend React/Vite/TypeScript + Leaflet + Recharts; Vercel estático; FastAPI en Render; GitHub Actions y Playwright.
- Búsqueda y dibujo de parcela, capas satelitales regionales GIBS, guardado local, selector de cultivos, prioridades, informe A4 y envío por WhatsApp, español/inglés, vista de especialistas y ahorro de datos.
- Conectores/funciones existentes: NASA HLS y Sentinel-2 NDVI, NASA POWER, GPM IMERG, SMAP, FAO-56 y FAO GAEZ. Integración parcial no equivale a cobertura comprobada en Chalhuas.
- Modelo HLS de Barranca: conservar código y artefactos reproducibles, **no usar sus 44 observaciones, coeficientes, calidad ni puntuaciones como modelo de Junín**.

## Fases, entregables y condiciones de salida

| Fase | Entregable concreto | Criterio verificable para avanzar |
|---|---|---|
| **0. Auditoría y protección de v0.27** | Inventario API/frontend/tests, contrato de datos, copia funcional de pruebas, incidencia de fechas e índices, revisión de textos ambiguos | Build, unitarias y E2E existentes verdes; pruebas que reproducen y corrigen fechas de rotación, desplazamientos de meses, recuperación de historial al cambiar de año y mensajes de «cultivo identificado» |
| **1. Parcela piloto verificable** | Sector Chalhuas en mapa, contorno de una parcela demostrativa con procedencia, geometría, superficie y cobertura raster | Validación de polígono, coordenadas, área, número de píxeles HLS válidos, ausencia de solapamientos; sin límites reales, se etiqueta explícitamente como simulación y no se hace inferencia puntual |
| **2. Base agronómica Junín** | Catálogo inicial auditado de papa, arveja, haba, quinua, cebada y avena; oca/olluco/tarwi solo si pasan revisión local; fichas fuente/variedad/altitud/agua/etapas/familia/mercado | Reglas justificadas con INIA y evidencia local; sin afirmar aptitud por parcelas no muestreadas. Baseline papa↔arveja histórica y escenarios diversos **como hipótesis**, no recetas. Validación de agrónomo local pendiente de completar en campo |
| **3. Observaciones y mapa científico** | Reutilizar HLS, Sentinel, GPM IMERG, SMAP, POWER, GIBS y GAEZ según cobertura; añadir NASADEM/SRTM, ERA5-Land y ECOSTRESS solo tras evaluar disponibilidad | Cada capa muestra fuente, adquisición, ventana temporal, unidad, resolución, calidad, leyenda y no-data. ECOSTRESS puede quedar apagado si faltan escenas válidas. GLDAS queda solo como estudio complementario si añade señal |
| **4. Motor de rotaciones híbrido** | Rotaciones bajo restricciones, calendario local, familia botánica/patógenos, riesgo de heladas, estimación climática de agua por etapa, cobertura, economía declarada, escenarios 24 meses y horizonte ampliable cuando se validen calendarios | Meses y años absolutos coherentes; 0–23 o 0–47 según horizonte; cultivos no se superponen en la misma subparcela salvo sistema explícito; reglas duras verificadas > ranking. Datos no validados se muestran, pero no se usan como exclusión agronómica |
| **5. IA propia de Chalhuas** | Dataset georreferenciado, datos históricos por escena, política de píxeles válidos, artefacto versionado y reproducible, baseline, validación cronológica y evidencia visual | Sin fuga temporal; hash de origen, train/test y métricas Brier/calibración documentadas; sin datos suficientes o rendimiento demostrable, el sistema se abstiene. IA de vegetación NO clasifica especies ni predice cosechas |
| **6. Mapa de asignación de cultivos** | Subparcelas editables y confirmadas, superficies en ha, colores por especie, vista «campaña actual / propuesta», selector anual/estacional, cronología por lote, exportación de geometría | Las áreas propuestas suman correctamente dentro del polígono, nunca salen de la parcela ni se presentan como áreas efectivamente sembradas. Se distingue **rotación temporal de un lote** frente a **varios cultivos simultáneos** |
| **7. UX/UI + BIO** | Aplicar UI UX Pro Max y guías Aura de accesibilidad, copy, diseño responsive, dashboards, interacción y testing; BIO realiza tutorial introductorio de 4 pasos: terreno, cultivos, prioridades, plan | Tour de primera visita con resalte/avance/retroceso/omitir/repetir; no bloquea Leaflet; teclado, lector de pantalla, reducción de movimiento, modo datos bajos. BIO **no es chatbot** ni inventa recomendaciones. Quechua «En preparación» hasta traducción validada |
| **8. Resultados, validación y publicación** | Comparaciones legibles, qué/dónde/cuándo/por qué, supuestos y advertencias, PDF y WhatsApp, vista científica reproducible, pruebas con usuarios reales, CI y documentación | Resultados sin viñetas vacías ni términos ambiguos; agua estimada ≠ agua ahorrada/turno real; fechas consistentes; E2E desktop/móvil y backend verdes; evidencia de entrevistas y tareas de agricultores identificada honestamente como pendiente hasta ejecutarla; publicar solo después de pasar los controles |

## Contrato de decisión del motor
1. **Entradas del agricultor:** geometría aprobada, cultivos históricos, periodo exacto, prioridad, disponibilidad de riego cuando existe, suelo y límites prácticos; distinguir declarado/no declarado.
2. **Fuentes ambientales:** espacializar solo hasta la resolución real, no crear «microclimas medidos de parcela» desde celdas de 9–50 km.
3. **Reglas de selección:** compatibilidad de estación y ciclo local; familia y hospedantes de plagas; restricciones agronómicas validadas; agua por etapa FAO-56; control de erosión/pendiente; suelo y riesgos; alimento/ingresos/mercado y trabajo cuando estén sustentados.
4. **Comparador:** mostrar rotación actual como referencia (S0) y alternativas de horizonte coherente. No ocultar trade-offs o desventajas.
5. **IA:** apoyo a la clasificación temporal de baja vegetación o señales ambientales validadas en Chalhuas; jamás atribuir identidad de cultivo ni rendimiento a un NDVI.
6. **Salida del agricultor:** propuesta por *subparcela × campaña*: especies/ciclos/fechas/área y razones; incertidumbre y acciones necesarias antes de ejecutar.
7. **Abstención:** si faltan datos clave, la recomendación final debe ser «requiere revisión», sin inventar calidad de suelo, agua de canal, aptitud, cosecha ni precios.

## Cartografía científica
| Familia | Situación | Uso permitido |
|---|---|---|
| HLS/Sentinel, GPM IMERG, SMAP, NASA POWER, GIBS, GAEZ | Capacidad existente; nueva cobertura por comprobar | Índices y contexto a escala correspondiente; GAEZ solo como referencia global |
| NASADEM/SRTM | Nuevo | Altitud, pendiente, orientación y relieve a partir de DEM; pendiente no predice sola erosión |
| ERA5-Land | Nuevo | Contexto histórico regional de temperatura y frío, **no pronóstico de heladas de una parcela** |
| ECOSTRESS V003 | Nuevo condicionado | Temperatura superficial y posible estrés evaporativo, solo con escenas y máscaras de calidad válidas |
| GLDAS | Opcional | Validación regional únicamente si aporta información no redundante |
| SENAMHI / ANA / INIA / MIDAGRI | Validación oficial complementaria | Boletines/series vigentes y prácticas agronómicas, documentando fecha, ámbito, licencia y disponibilidad |

**Leyendas:** capa visible única, transparencia y periodo seleccionable, no-data explícito, unidades correctas, fecha, sensor, resolución, estado de validación y fuente clicable. **Costos:** priorizar recortes de área, datos precalculados/caché y almacenamiento dentro de cuotas gratuitas; no crear descargas globales ni Functions en Vercel.

## Gestión de skills y diseño
- **Disponible en repositorio:** `.agents/skills/ui-ux-pro-max/SKILL.md`.
- **Guías Aura seleccionadas:** Web Interface Guidelines, UX Copywriting Guide, Web Design Reviewer, Responsive Design, UI Design System Toolkit, Interaction Design, Design State Ownership, Build Interactive Dashboards, Frontend Developer Expert, UI Consistency Auditor, Image Optimization Analysis y Skill Creator. **Revisar disponibilidad y licencias** antes de incorporarlas; tratarlas como directrices de desarrollo, no como librerías/productos «instalados».
- **Nueva guía por elaborar:** `.agents/skills/biotex-farmer-experience/SKILL.md` con reglas de evidencia, calendario, geometría, BIO, texto, accesibilidad y regresión.

## Bloqueos y decisiones pendientes verificables
- Elegir y validar polígono: la coordenada del sector no demuestra límites de cultivo ni propiedad. Si no existe, crear escenario marcado **sintético**, sin atribuir observaciones reales de una parcela no verificada.
- Verificar clima, disponibilidad de riego, riesgos fitosanitarios, calendarios y precios **en Chalhuas**, no trasladar Lima/Cusco.
- Determinar con evidencia si un horizonte de cuatro campañas/años es mejor que 24 meses; no alargar automáticamente cultivos.
- Verificar producto ECOSTRESS V003, escena, datos faltantes, QA y licencias; mantenerlo opcional.
- Revisar con expertos locales: la documentación antigua no equivale a validación agrícola actual.
- Las pruebas con agricultores y autorización de datos se consideran **pendientes**, no completadas por tests automatizados.

## Referencias de partida
- Gobierno Regional Junín (2023), expediente Chalhuas: https://www.gob.pe/institucion/regionjunin/informes-publicaciones/4903730-estructura-de-exp-tec-chalhuas-chupaca
- Estudio agrológico de Chalhuas (histórico): https://cdn.www.gob.pe/uploads/document/file/5501553/4903730-estudio-agrologico.pdf?v=1701297728
- INIA (2020), Manejo integrado de papa y rotaciones andinas: https://repositorio.inia.gob.pe/items/cc6df8ae-815c-474d-a25d-e9b7d67b6740
- ECMWF ERA5-Land: https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land
- NASA ECOSTRESS V003: https://doi.org/10.5067/ECOSTRESS/ECO_L2T_LSTE.003
- Método y alcance anterior: [IA NASA Barranca v0.26](BIOTEX_v026_IA_reproducible.md).
