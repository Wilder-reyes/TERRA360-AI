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

## Gestión de skills, con nombres y responsabilidades explícitas

**Estado comprobado:** `.agents/skills/ui-ux-pro-max/SKILL.md` ya está en GitHub. Las doce guías de Aura se **seleccionaron para aplicación selectiva**; no afirmar que están instaladas, habilitadas o con licencia para copia hasta verificar su contenido y licencia individualmente. Si una no se puede incorporar legal o técnicamente, aplicar sus principios verificables mediante reglas propias, no afirmar que ejecutamos su skill original.

| # | Skill elegida | Responsable de / tarea específica en BIOTEX | Prueba de aceptación |
| --- | --- | --- | --- |
| **Base** | **UI UX Pro Max** (ya existe) | Sistema visual general, componentes y experiencia del agricultor | Auditoría de jerarquía, accesibilidad, contraste, móviles y diseño consistente |
| 1 | **Web Interface Guidelines** (Vercel Labs) | Reglas para controles, estados sin datos, errores, mapas e interacción | Revisión por checklist WCAG 2.2 AA; foco visible, teclado, etiquetas y contraste |
| 2 | **UX Copywriting Guide** | Microtextos de BIO, agricultura en español sencillo, leyendas y advertencias honestas | Cada indicador responde «qué significa» y «qué puedo hacer»; no confundir lluvia regional con riego de parcela |
| 3 | **Web Design Reviewer** | Inspección visual y de comportamiento en resultados, mapa, diálogos y formularios | Playwright desktop/móvil con casos sin datos, errores y desbordes |
| 4 | **Responsive Design** | Diseño móvil para trabajo de campo y mapas; uso con conectividad limitada | Vista de 360, 390, 768 y 1280 px sin controles bloqueados ni desbordes horizontales |
| 5 | **UI Design System Toolkit** | Tokens, componentes reutilizables, tarjetas de cultivo, cronologías, leyendas y tipografía | Un solo sistema de color y unidades; contrastes semánticos y consistencia entre los 4 pasos |
| 6 | **Interaction Design** | Tutorial guiado de BIO con resalte de objetivos reales, siguiente, atrás, omitir y repetir | Tour completo y sin bloqueos; animaciones reducidas según preferencia del dispositivo |
| 7 | **Design State Ownership** | Persistencia de recorrido/tour, historial con fechas absolutas, subparcelas, cambios de campaña y prioridades | Restauración sin desplazamiento de fechas, sin pérdida de datos; reinicio y eliminación voluntaria |
| 8 | **Build Interactive Dashboards** | Panel científico y cartográfico; selector de capas y periodos, leyendas, gráficos comparativos y transparencia | Capa muestra fuente, sensor, fecha, resolución, unidades, escala, calidad y estado no-data |
| 9 | **Frontend Developer Expert** | Arquitectura React/TypeScript, separación de capas y motor, carga bajo demanda, pruebas de componentes | Compilación y test; sin cálculos científicos duplicados en frontend |
| 10 | **UI Consistency Auditor** | Revisión transversal de etiquetas, botones, hitos, tipos de mapa y versión español/inglés | Mismos nombres, unidades, estado y comportamiento entre las cuatro pantallas y el PDF |
| 11 | **Image Optimization Analysis** | Tamaño de recursos de BIO, mosaicos, leyendas e ilustraciones; cargas lazy y caché | Sin imágenes externas innecesarias; medir rendimiento y datos consumidos en móvil |
| 12 | **Skill Creator** | Crear y mantener `.agents/skills/biotex-farmer-experience/SKILL.md`, específica del proyecto | Instrucciones versionadas con ejemplo, checklist de decisiones, fuentes, BIO y regresión |

**Condición de uso:** estas skills son guías de creación y revisión; no incorporan por sí solas conexiones a NASA, modelos, leyes agronómicas o nuevas funcionalidades. Se comprobarán las licencias y el funcionamiento antes de copiar archivos externos.

### Nueva skill especializada: biotex-farmer-experience
Archivo por crear en fase 7: `.agents/skills/biotex-farmer-experience/SKILL.md` (no confundir plan con una creación ya realizada). Deberá exigir:
1. **BIO solo guía el tutorial introductorio** y la ayuda contextual de navegación; no será chatbot, asesor ni fuente de datos.
2. **Evidencia geoespacial honesta:** cada capa tendrá procedencia, fecha, resolución, unidad, leyenda, incertidumbre y estado sin datos; NDVI no reconoce especies.
3. **Agronomía verificable:** prohibido trasladar calendarios de Lima o Cusco a Chalhuas; distinguir estimación climática, condición declarada del suelo, restricciones verificadas y autorización de campo.
4. **Cronología consistente:** usar fechas de siembra absolutas, horizonte declarado y pruebas de desplazamiento de un mes/cambio de año.
5. **Asignación espacial:** no mostrar polígonos propuestos como cultivos observados; subparcelas dentro de la geometría confirmada; áreas sumadas y no solapadas.
6. **Información para decidir:** propuesta, por qué, cuándo, dónde, riesgos y siguiente verificación; detalles técnicos desplegables.
7. **Regresión:** preservar API, Vercel estático + Render, PDF, WhatsApp, idiomas, modo de bajo consumo, mapas y pruebas automatizadas.

### Aplicación de las skills por fase de la hoja de ruta
- **Fase 0:** Web Interface Guidelines + Web Design Reviewer + UI Consistency Auditor + Frontend Developer Expert para eliminar errores heredados; UI UX Pro Max como base.
- **Fases 1 y 3:** Build Interactive Dashboards + Responsive Design + UX Copywriting Guide + Image Optimization Analysis para mapa, leyendas, filtros temporales y fuentes.
- **Fases 2, 4 y 5:** Frontend Developer Expert para contratos reproducibles; Skill Creator y reglas propias para preservar trazabilidad científica. Las reglas agronómicas requieren fuentes INIA, SENAMHI, ANA, MIDAGRI y especialistas; **no se derivan de skills visuales**.
- **Fase 6:** UI Design System Toolkit + Design State Ownership + Build Interactive Dashboards para asignación espacial y cronología por subparcela.
- **Fase 7:** Interaction Design + UX Copywriting Guide + Design State Ownership para el onboarding de BIO.
- **Fase 8:** Web Design Reviewer + UI Consistency Auditor + Responsive Design y Playwright para validación de la publicación.

## Contrato específico de nuevas visualizaciones geográficas
- **Ya existente (reutilizar, no duplicar):** NASA HLS, Sentinel-2, NASA POWER, GPM IMERG, SMAP, NASA GIBS y FAO GAEZ. Integrado no implica que la nueva parcela tenga datos adecuados; verificar caso por caso.
- **Nuevo 1: NASADEM/SRTM** → DEM, elevación, pendiente, orientación, sombreado; no inferir directamente erosión, drenaje o fertilidad.
- **Nuevo 2: ERA5-Land** → temperatura y humedad regional, mínimos históricos y episodios fríos; no presentar como sensor de helada ni pronóstico del lote.
- **Nuevo 3: ECOSTRESS** → temperatura de superficie, evapotranspiración y estrés evaporativo, condicionado a escenas disponibles, QA/píxeles válidos y licencia/producto correcto.
- **Estudio complementario: GLDAS** → contraste hidrológico regional solo si añade valor y no duplica SMAP/POWER; no posicionarlo como capa de parcela.
- **Instituciones locales:** INIA para prácticas/variedades, SENAMHI para alertas/estaciones con fecha, ANA y junta de usuarios para agua real y MIDAGRI/FAO para calendario y referencia agronómica.
- **Controles UI exigidos:** elegir capas sin saturar, escoger período/fecha, ajustar opacidad, hacer clic para consultar la variable, ver leyenda con escala/unidad y abrir procedencia; modo bajo consumo y estado «sin observación válida».
- **Etiquetas obligatorias por valor:** «observación satelital», «estimación regional», «valor declarado por agricultor» o «simulación de rotación». **Nunca interpolar una celda regional de 9–50 km como certeza de una parcela.**
- **Cierre:** no publicar una capa como funcional en Chalhuas hasta demostrar cobertura, calidad, funcionamiento y límites en el polígono seleccionado.

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
