# BIOTEX · Diseño centrado en el agricultor (UX v0.27)

## Decisión de producto
La versión v0.27 rediseña la interfaz principal **sin tocar modelos, endpoints ni cálculos**. Se mantiene BIOTEX v0.26 como la versión científica del modelo NASA HLS: 44 meses observados y 33/11 entrenamiento/evaluación. El alcance de inferencia es **la parcela de estudio** de Barranca de ~2,24 ha.

## Jerarquía de información: pregunta → dato → decisión
1. **Mi chacra.** No empezar con NDVI ni índices. Presentar un ejemplo de Barranca junto con la opción completa de buscar/dibujar, mantener las tres capas del mapa (foto aérea, vegetación NASA, lluvia NASA), guardado y restauración. En móvil, ejemplo primero para que no sea necesario dibujar para conocer la herramienta.
2. **Mis cultivos.** El agricultor declara sus siembras. Hasta 10 campañas, fecha y especie como antes. El apoyo del satélite se mantiene como disclosure; nunca adivinar automáticamente la especie.
3. **Mis prioridades.** Tres opciones grandes con subtítulo (agua, cobertura, ambas). Disponibilidad de agua, cultivo principal, año y datos opcionales de suelo/agua, sin perder campos.
4. **Mi propuesta.** Presentar primero la secuencia de cultivos y sus fechas. Después las diferencias relativas, verificaciones de campo (ANA, SENAMHI), datos NASA HLS aprendidos y alternativas. Detalles científicos, económicos y fuentes quedan accesibles en disclosures.

## Decisiones de UI UX Pro Max aplicadas
- **Jerarquía y legibilidad:** título grande, preguntas humanas, subtítulos claros y una acción primaria por pantalla.
- **Carga cognitiva:** divulgación progresiva para gráficos NDVI, resultados Brier, presupuesto y pruebas de procedencia.
- **Diseño accesible:** controles al menos ~44 px, foco visible, texto y color semántico, anchos fluidos, lector de pantalla y reducción de animaciones.
- **Móvil primero:** parcela de ejemplo arriba, mapa con controles visibles, formularios a una columna y tarjetas cómodas para el pulgar.
- **Sin promesas falsas:** riesgos y condiciones por verificar junto con la decisión; el modelo no predice rendimientos ni clasifica cultivos.
- **Rendimiento y costo:** CSS puro para ilustración y componentes, sin imágenes ni fonts externas nuevas, sin funciones Vercel; mapa Leaflet e IA existente.

## Fundamentación profesional consultada
- Jakob Nielsen: [10 heurísticas de usabilidad](https://www.nngroup.com/articles/ten-usability-heuristics/) — lenguaje cotidiano, control, reconocimiento en lugar de memoria, visibilidad del estado y recuperación de errores.
- Nielsen Norman Group: [8 recomendaciones para aplicaciones complejas](https://www.nngroup.com/articles/complex-application-design/) — menos ruido visual sin eliminar funciones; disclosure de opciones secundarias.
- Nielsen Norman Group: [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — pantalla principal enfocada en acciones frecuentes y detalles accesibles cuando se necesitan.
- Steve Krug, *Don't Make Me Think* — rutas obvias, preguntas directas y claridad de navegación.
- Don Norman, *The Design of Everyday Things* — affordances, señales y retroalimentación sobre la acción.
- Jeff Johnson, *Designing with the Mind in Mind* — respetar las limitaciones de atención y memoria.
- Stephen Few, *Information Dashboard Design* — indicadores subordinados a decisiones específicas, no paneles saturados.
- Cole Nussbaumer Knaflic, *Storytelling with Data* — significado antes que decoración, y contexto para cifras.
- [NASA Space Apps 2025 Global Winners](https://www.spaceappschallenge.org/2025/awards/global-winners/) y [categorías de premios](https://www.spaceappschallenge.org/2025/awards/) — comunicar impacto local, validez y narración.
- [TerraFarm, equipo indonesio premiado 2024](https://stei.itb.ac.id/redesign/tim-tanimakmur88-itb-raih-best-social-impact-di-nasa-spaceapps-challenge-2024-berkat-inovasi-terrafarm/) — referencia de centrado en agricultor; **no** copiamos su diseño ni atribuimos funcionalidades no verificadas a BIOTEX.
- Guía local [UI UX Pro Max](../.agents/skills/ui-ux-pro-max/SKILL.md).

No existe un «diseño ganador universal». Se toman principios verificables, no afirmaciones de causalidad entre estilo visual y premio de NASA.

## Contrato de conservación funcional
- API de rotación y su modelo, comparador S0/S1/S2, agua y suelo sin modificaciones.
- NASA POWER, NASA HLS, NASA GIBS, FAO-56, capas y mapa Leaflet sin modificación.
- Modo de ahorro de datos, búsqueda, dibujo, deshacer, restauración local, satélite y selección manual, comparativa y guardado, PDF, WhatsApp, idiomas español/inglés, vista de especialistas, revisión de riesgos y cuenta económica se conservan.
- Fuente y métricas reproducibles disponibles en [BIOTEX v0.26](BIOTEX_v026_IA_reproducible.md).

## Pruebas
- `npm run build` y `npm run test` en frontend.
- Browser Playwright: recorrido de Barranca, dibujo/búsqueda, historial, restricciones, resultado, IA opcional, A4, mapa 390 px, enlaces y acciones.
- CI backend, Docker y reproducibilidad NASA sin modificaciones.

## Validación pendiente con agricultores
Este rediseño se sustenta en heurísticas, fuentes y pruebas de navegador. Todavía **no existe evidencia de pruebas de usabilidad con agricultores**. Validación siguiente: tareas cronometradas y entrevistas en español sencillo con agricultores de Barranca, Pativilca y Supe; observar dónde se bloquean y revisar etiquetas, comprensión y confianza.
