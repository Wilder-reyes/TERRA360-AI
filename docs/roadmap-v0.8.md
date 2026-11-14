# Hoja de ruta de TERRA360 AI — desarrollo y validación

**Estado de referencia: 13 de noviembre de 2026.** Esta hoja de ruta recoge las cuatro prioridades acordadas. Los estados documentan **código incorporado**, no certifican que proveedores externos, imágenes particulares o recomendaciones agronómicas se hayan validado experimentalmente. La web está alojada en https://terra360-ai.netlify.app/, pero una prueba externa sin iniciar sesión recibió **HTTP 401**; debe activarse la visibilidad pública. La API funciona en https://terra360-api.onrender.com.

## Objetivo y criterio final

El agricultor identifica una zona, la delimita, consulta **capas visuales con fecha, fuente, resolución e interpretación**; busca un cultivo en lenguaje sencillo y comprende una comparación agrícola **sin abrir JSON, códigos internos ni rutas de desarrollador**. Ningún valor NASA regional se confunde con un sensor de parcela; ninguna lista de especies se confunde con evidencia de aptitud. Antes de proponer cultivos reales se exige validación local y agronómica.

Estado global: **MVP funcional ampliado / validación científica y de usuarios pendiente.** No asignamos un porcentaje ficticio de completitud.

### Leyenda de estados
- **Implementado y probado en CI:** existe código y pasó pruebas automáticas; puede requerir verificación visual y en producción.
- **Implementado, pendiente de comprobar en producción:** código integrado, las pruebas unitarias no garantizan la disponibilidad del proveedor externo.
- **Parcial:** hay una interfaz o arquitectura inicial, pero no la capacidad completa.
- **Pendiente / depende de fuente externa:** falta conectar o validar datos, acuerdos, muestras, licencias o pruebas de campo.

## Prioridad 1 — Reconstrucción geoespacial

**Objetivo:** mapa como elemento central, límites de terrenos, capas comprobables, fechas y leyendas comprensibles.

| Entregable | Estado | Evidencia / próximo criterio |
| --- | --- | --- |
| Mapa principal presente en todo el recorrido; calles OSM y foto aérea Esri | Implementado y probado en CI | `frontend/src/GeoWorkspace.tsx`; confirmar interacción en móvil real |
| Selección de punto y coordenadas; datos puntuales NASA POWER | Implementado y probado en CI | API `/api/environment/nasa-power/daily`; campo no se declara medido |
| Rectángulo aproximado con superficie en hectáreas | Implementado y probado en CI | No equivale a límites catastrales |
| Polígono WGS84 con múltiples vértices, ajuste por arrastre y verificación de cruces | Implementado y probado en CI | `frontend/src/geometry.ts`; pruebas de intersección y área; sin edición catastral |
| Gráficos de lluvia histórica mensual y años completos en el inspector del mapa | Implementado y probado en CI | `getSeasonality` y `getHistory`; no pronóstico |
| Capas de imagen GPM IMERG, SMAP L4 y MODIS NDVI desde **NASA GIBS** | Implementado, pendiente de comprobar en producción por fechas y lugares | `WMSTileLayer` WMS GIBS; colores y leyendas oficiales en NASA Worldview; valores son regionales |
| Consulta Sentinel-2 L2A por fecha y nubosidad | Implementado y probado con datos simulados; consulta real requiere comprobación | API STAC Microsoft Planetary Computer; no genera NDVI Sentinel-2 |
| Leyenda interpretativa y atribución de la capa | Parcial | Se indican fuente, fecha, resolución y que es regional. La paleta numérica completa se consulta en NASA Worldview |
| Capas SRTM relieve y pendiente; cálculo Sentinel-2 NDVI con máscaras de nubes | Pendiente | Autenticidad del producto, licencias de acceso, calibración de banda, nube y prueba con datos reales |
| Exportación de polígono estándar GeoJSON/KML para GIS | Pendiente; **no exponer JSON crudo a agricultores** | Ofrecer únicamente a técnico en panel avanzado, previa comprobación de CRS, topología y consentimiento |
| Geocodificación/autocompletado geográfico | Pendiente | Elegir servicio con límites, política de privacidad y cuotas antes de conectar |
| Caché de teselas/descargas, límites y supervisión de cuotas | Parcial | GIBS se solicita como imagen al proveedor sin descargarse en Render; controlar errores, caché y uso de API propia |

**Aceptación P1:** el usuario distingue imagen de fondo, capa NASA, fecha y terreno dibujado; puede comprobar la fuente; no se promete que una cuadrícula de 9–10 km mida su parcela.

## Prioridad 2 — Catálogo agrícola global

**Objetivo:** miles de nombres de especies y variedades con filtros geográficos **solo cuando existan fuentes verificadas**.

| Entregable | Estado | Evidencia / próximo criterio |
| --- | --- | --- |
| Directorio inicial de 95 especies/cultivos, 5 con referencias y 90 exploratorios | Implementado y probado en CI | `backend/app/data/crop_directory.py`, `arie.py`, `test_extended_crops.py` |
| Búsqueda por nombre común, científico y familia; insensible a tildes | Implementado y probado en CI | React y API `/api/arie/crops` |
| Sinónimos y errores tipográficos con sugerencias; paginación y filtros por categoría | Implementado y probado en CI | `backend/app/services/crop_search.py` y tests; paginación lista para un directorio más grande |
| Identificación del alcance de evidencia de cada cultivo | Implementado y probado en CI | No se infiere aptitud regional; ningún coeficiente inventado |
| ECOCROP (FAO, 2.568 especies) — importación **verificada** | Pendiente de obtener descarga/permiso/estructura comprobados | FAO remite a GAEZ; no hay 2.568 registros incorporados |
| GAEZ v5 — datos de aptitud por cultivo/área/escenario | Pendiente de licencia, resolución, acceso y validación | La fuente describe hasta ~280 cultivos/usos, no es lo mismo que miles de especies ECOCROP |
| Validación especie-variedad, calendarios por clima, suelo, mercados | Pendiente de datos por zona | No ofrecer aptitud ni productividad con perfiles sin calibración |

**Aceptación P2:** un nombre encontrado no genera una recomendación local automática. Cada perfil incluye procedencia exacta, alcance espacial, fecha, licencia y nivel de validación cuando se incorpore a decisiones.

## Prioridad 3 — ARIE AI 2.0

**Objetivo:** órdenes de rotación propuestos y entendibles, limitaciones, campañas, incertidumbre y riesgos trazables.

| Entregable | Estado | Evidencia / próximo criterio |
| --- | --- | --- |
| Explorar hasta 120 permutaciones de cinco cultivos, respetando el historial y la preferencia declarada | Implementado y probado en CI | Motor simbólico, **no** predicción de rendimiento |
| Separar historial, opción de organización y revisión de agua/suelo en la interfaz | Implementado y probado en CI | IDs internos S0/S1/S2 no se usan como encabezados de usuario |
| No clasificar un cultivo exploratorio como apto | Implementado y probado en CI | `exploratory_catalog_only`, `chosen_for_review=null` |
| Búsqueda con condiciones declaradas: agua, historial, mes, mercado, presupuesto, maquinaria | Parcial | Algunas detectan conflictos; no se comparan costos y equipos sin tablas verificadas |
| Vista gráfica de campañas con secuencia, mes inicial declarado y tareas pendientes | Implementado y probado en CI | `backend/app/services/planning_preview.py`; **no** inventa fecha de cosecha |
| Alertas explicables de evidencia faltante e incertidumbre | Implementado/parcial | Advertencias cualitativas; probabilidad/intervalos requerirían validación estadística |
| Restricciones fitosanitarias, fenología local, descansos, sucesiones multianuales validadas | Pendiente | Construir con expertos y fuentes por especie-variedad-zona |
| ETo/ETc y balance hídrico por etapa agrícola, aptitud, proyecciones de rendimiento e ingreso | Pendiente | Se requieren datos locales, modelos calibrados y pruebas cruzadas; no fabricar índices |
| Modelos predictivos entrenados y validados espacial/temporalmente | Pendiente | Experimentos actuales no gobiernan la recomendación; publicar métricas y limitaciones antes de activarlos |

**Aceptación P3:** ARIE puede abstenerse y explicar qué dato falta. Solo se presenta una recomendación agronómica cuando las restricciones y datos de validación son suficientes. Sin un plan independiente, la revisión de agua/suelo no se publica como tercera estrategia equivalente.

## Prioridad 4 — Validación de uso real

**Objetivo:** verificar la cadena mapa → datos NASA → selección de cultivos → decisión y la comprensión de los usuarios.

| Entregable | Estado | Evidencia / próximo criterio |
| --- | --- | --- |
| Pruebas de contratos API, catálogo, plan, errores y geometría | Implementado y probado en CI | `tests/test_*.py`, `frontend/tests/*.test.mjs` |
| Compilación TypeScript/React y Python automáticas | Implementado y probado en CI | `.github/workflows/ci.yml`; revisar resultado del último commit |
| Actualización de acciones GitHub con versiones basadas en Node.js 24 | Implementado y probado en CI | checkout v5, setup-node v5, setup-python v6 |
| Smoke de producción Netlify → Render → ARIE y NASA POWER | **Ejecutado, parcialmente aprobado** | Render salud, búsqueda, ARIE y NASA POWER = PASS; Netlify web y proxy = FAIL por **HTTP 401**; workflow `smoke-production.yml` |
| QA visual en escritorio y móvil, accesibilidad, lectores de pantalla | Pendiente de prueba directa con navegador real | Documentar capturas, navegación por teclado, contraste, métricas |
| Rendimiento y fiabilidad bajo demanda concurrente | Pendiente | Simular carga limitada, medir latencia cold-start y fallas remotas |
| Pruebas con agricultores de varias regiones y agrónomos | Pendiente de participantes y consentimiento | `docs/farmer-validation-protocol.md`; no se han realizado entrevistas |
| Revisión científica externa y reproducibilidad espacial | Pendiente | Validar parcelas reales, fuentes, unidades, incertidumbre y sesgos |

**Bloqueo operativo actual:** Netlify → Project configuration → General → Visitor access → Edit visibility → Production visibility = **Public**. Tras el cambio, ejecutar otra vez el workflow de smoke o comprobar acceso desde un navegador sin sesión. Esto requiere una acción del propietario de Netlify; no se soluciona cambiando GitHub.

**Aceptación P4:** agricultores sin capacitación técnica completan y explican el flujo; al menos 4/5 distinguen datos regionales de datos de parcela y nadie necesita JSON o códigos internos. Es una **meta de prueba**, no un resultado ya obtenido.

## Reglas obligatorias de la interfaz

1. El usuario ve resultados gráficos, leyendas y explicaciones cortas; nunca necesita abrir JSON, Swagger, trazas ni rutas internas. JSON sigue siendo necesario para comunicar frontend y backend.
2. El mapa es central; controles avanzados aparecen cuando se solicitan, sin secciones inferiores desconectadas.
3. Todas las capas tienen fuente, fecha, resolución o escala espacial y un aviso cuando falta información. Imagen Esri no es NDVI ni NASA POWER.
4. No se publican rendimientos, ahorros de agua, precios, dosis de riego ni aptitud local sin evidencia específica y evaluación experta.
5. Mantener accesibilidad móvil, errores comprensibles, datos personales mínimos y control de cargas en el alojamiento gratuito.

## Fuentes primarias y límites de integración

- NASA GIBS: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- NASA Worldview: https://worldview.earthdata.nasa.gov/
- NASA POWER: https://power.larc.nasa.gov/
- NASA GPM IMERG: https://gpm.nasa.gov/data/imerg
- NASA SMAP: https://smap.jpl.nasa.gov/
- ESA/Copernicus Sentinel-2 vía Planetary Computer: https://planetarycomputer.microsoft.com/
- FAO ECOCROP: https://www.fao.org/land-water/resources/tools/databases/ecocrop/en
- FAO GAEZ: https://www.fao.org/land-water/resources/tools/databases/gaez/en

**Advertencia esencial:** un mosaico WMS NASA GIBS visualiza un producto remoto, pero **no equivale a integrar sus píxeles numéricos en ARIE**. Las fechas y escalas de SMAP/IMERG/MODIS difieren. No afirmar cálculos Sentinel-2 NDVI ni SRTM sin procesamiento validado.

## Próximas dependencias no resolubles solo con código

Para cerrar científicamente todas las prioridades hacen falta: una descarga legítima de ECOCROP/GAEZ con licencia y metadatos; cultivares con requisitos verificados; uno o más conjuntos de parcelas y mediciones agronómicas locales; procesamiento satelital georreferenciado probado con nubes; y agricultores/agrónomos voluntarios para evaluación. Ninguna prueba CI sustituye ese trabajo experimental.
