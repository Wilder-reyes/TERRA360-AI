# BIOTEX — Development guidelines for coding agents

## Requisitos permanentes vigentes (etapa 1, 2026-11-15)

Estas instrucciones actualizan los criterios históricos de este repositorio y sus skills. Ante contradicción, prevalecen las instrucciones actuales del usuario. Cada etapa es independiente: finalizar solamente la solicitada y esperar el próximo prompt.

- Trabajar sobre la copia local, en una rama de desarrollo independiente. Conservar todos los cambios no confirmados preexistentes. Verificar HEAD, estado y rama antes de editar. Realizar commits locales de cambios verificables; no incluir cambios ajenos.
- No hacer push, merges remotos ni despliegues automáticos. No conectar con proyectos antiguos de Vercel, Netlify o Render ni ejecutar sus comprobaciones públicas. El despliegue final lo hará manualmente el usuario en un proyecto NUEVO de Vercel para el frontend estático; Python necesita un backend independiente todavía por configurar. Los archivos heredados no acreditan un backend nuevo.
- Dentro de la etapa autorizada, completar autónomamente las ediciones ordinarias y las comprobaciones realizables. Registrar bloqueos externos sin dar por resuelto lo no verificado.
- No borrar archivos en la etapa 0. No eliminar datasets originales ni modelos sin comprobar sus dependencias en etapas posteriores. No actualizar dependencias masivamente como parte de una auditoría.
- Arquitectura prevista: React, TypeScript, Vite y Leaflet; Python/FastAPI para conectores científicos y motor de IA. Vercel estático no ejecuta Python.
- Una aplicación con cuatro etapas: Mi terreno, Mis cultivos, Mis prioridades y Mi plan agrícola. Evitar páginas redundantes y laboratorios técnicos en la navegación principal. Permitir seleccionar libremente parcelas, registrar cultivos y prioridades, comparar rotaciones y visualizar su distribución espacial.
- BIO es exclusivamente la mascota del tutorial inicial; no es un chatbot.
- Diseño final Agricultural Dark Mode: fondo #0B0E0C; tarjetas #141A16; superficies interactivas #1E2620; texto #F0F4F1; secundario #A3B2A8; acento #4CD964; advertencias #F59E0B; bordes #35453A. Alto contraste, navegación móvil ergonómica y objetivos táctiles de al menos 48 x 48 píxeles CSS. PDF profesional con fondo blanco, A4 y márgenes de 18 mm.
- NASA es fuente principal, no exclusiva. Se permiten HLS, Landsat, GPM IMERG, SMAP, POWER, NASADEM, SRTM, ECOSTRESS, SENAMHI, INIA, ANA, MIDAGRI, FAO, ERA5-Land, publicaciones indexadas y otras fuentes públicas verificables. Conservar procedencia, fechas, resolución, QA, unidades, ausencia de datos e incertidumbre.
- No inventar datos científicos, métricas o resultados. No presentar observaciones sintéticas como entrenamiento científico real, datos regionales como mediciones exactas de la parcela, NDVI como identidad comprobada de cultivo, ni escenarios como rendimientos o ahorros validados.
- IA real entrenada y evaluada dentro de su ámbito válido. Reproducir dataset, entrenamiento y métricas antes de citar el modelo histórico HLS de Barranca. Brier no es porcentaje de exactitud y ese modelo no valida Chalhuas. Reportar clasificación porcentual solo si aplica, sobre un conjunto independiente del ajuste, indicando umbral, tamaño, clases y límites; no evaluar el ajuste final sobre sus propios datos como validación.
- Utilizar validación histórica y computacional; no exigir experimentos físicos para avanzar. Registrar por separado cualquier revisión externa pendiente.
- Leer las skills locales UI UX Pro Max y biotex-farmer-experience si existen y aplicar las pertinentes. Las doce guías Aura seleccionadas son referencias pendientes de comprobar disponibilidad y licencia; no declararlas instaladas por estar citadas. No instalar guías externas sin comprobar su contenido y licencia; no adelantar un rediseño de producto en etapas de depuración.
- Ejecutar las pruebas disponibles y corregir errores introducidos en cada etapa. Registrar fallos heredados con su causa y alcance; cualquier corrección de producto que exceda la etapa se programa para el siguiente prompt.
- Mantener docs/BIOTEX_IMPLEMENTATION_STATUS.md con fase, cambios, comandos, pruebas aprobadas/fallidas, bloqueos, próximos pasos y referencia al commit local correspondiente.

Los apartados históricos siguientes siguen aplicando cuando no contradicen estos requisitos. No conservar una conexión o un despliegue antiguo por exigencia de una skill histórica.

This is the NASA Space Apps Field Shift crop-rotation decision-support project, developed by NSPACE BIOTEX. Its GitHub repository and internal Python/Node identifiers remain TERRA360-AI; the project presentation calls the platform BIOTEX. A coordinated rename must be a separate change.

## UI/UX workflow
- For any task affecting the React user interface, user experience, accessibility, charts, maps, colors, typography or layout, read `.agents/skills/ui-ux-pro-max/SKILL.md` and the existing visual baseline in `design-system/biotex/MASTER.md`.
- For a new page or redesign, use the local catalog **before** coding: `python .agents/skills/ui-ux-pro-max/scripts/search.py "agricultural decision-support accessible mobile dashboard" --design-system -p BIOTEX`. Run a separate `--stack react` search for React guidance.
- Treat the catalogs as design suggestions. They must not replace the established farmer workflow or the current green identity without a clear user request.
- Preserve: field selection/drawing and GeoJSON, NASA HLS estimated history and farmer crop confirmation, farmer priorities, S0 current versus S1 water versus S2 soil over 24 months, five-section explanations and print/PDF.
- Keep Spanish and English working; optional Quechua remains marked in preparation unless validated. Do not simplify away data source labels, uncertainty, unknown values or no-data states.
- Do not present NASA POWER regional data as parcel measurements; NDVI alone does not prove crop identity; comparisons are NOT validated predictions of yields, profits or irrigation savings.
- This skill is development-time only. Do not import Python skill files into React, alter the FastAPI backend, change deployment providers or install new runtime dependencies merely to activate it.

## Review and validation
- Prefer small, reviewable PRs to wholesale redesigns.
- Run `cd frontend && npm ci && npm run test && npm run build` after frontend changes.
- For backend modifications run `PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py'`.
- Inspect mobile at 375 px and desktop at 768/1024/1440 px; keyboard focus, contrast, touch targets, map interactions, spinner states and print/PDF.
- Keep environment secrets and NASA Earthdata credentials out of Git.

## Arquitectura vigente desde etapa 1
- Usar solamente `main.tsx → BiotexFarmerApp` y sus cuatro pasos. Integrar capacidades opcionales en ellos; no reintroducir páginas por `vista`/`pilot`.
- Mantener separados los perfiles costero/Mantaro y sus ámbitos científicos.
- Configuración única: `frontend/vercel.json`, Root Directory frontend, `VITE_API_URL` pública configurable también en producción. Backend independiente y CORS explícito. No hay proxy predeterminado ni configuración raíz de despliegue.
- Leer `docs/BIOTEX_ARCHITECTURE.md` y `docs/vercel-deployment.md`; las hojas de ruta v0.x son históricas. Conservar modelos/datos/scripts reproducibles aun si su página antigua se retira.

## Sistema visual definitivo — etapa 2 (2026-11-15)

- Las cuatro etapas comparten `frontend/src/agricultural-dark.css` como fuente canónica de tokens y controles. Reutilizar el diseño; posteriores etapas **no** deben introducir rediseños globales ni nuevos shells de navegación.
- `Mi terreno` inicia en Chalhuas como punto de navegación, sin seleccionar un polígono automáticamente. Las parcelas ficticias o de estudio exigen selección explícita y etiqueta inequívoca.
- El agricultor puede dibujar, importar o editar el contorno, definir subparcelas voluntarias y guardar/restituir geometrías localmente. No inventar divisiones automáticas.
- Verificación pendiente de la entrega ZIP etapa 2: instalar dependencias completas y ejecutar `npm run build`, Playwright y suite Python en un entorno apto antes de afirmar que está lista para producción. Informe: `docs/BIOTEX_STAGE_2_DELIVERY.md`.


## Catálogo científico y QA — etapa 3 (2026-11-15)

- `backend/app/services/scientific_registry.py` describe fuentes y estados, sin afirmar conectividad externa. Fuente registrada **no** significa observación obtenida. El nuevo endpoint de metadatos es `/api/environment/scientific-sources`.
- Conservar el contrato `quality` de `GET /api/environment/nasa-power/daily`: días válidos reales por variable, cobertura, nulos y rangos. No reemplazar faltantes por cero ni llamar precipitación anual a suma de días parciales.
- En el frontend, reutilizar `scientificLayers.ts` y `scientificEvidence.ts` para fuentes/capas, soporte geográfico y resultados; no construir otra UI ni re-colorear los mapas NASA.
- SENAMHI/ANA/INIA/MIDAGRI/FAO están registrados como fuentes o referencias; en esta entrega no se ha verificado descarga de datos nuevos de estaciones SENAMHI. Evitar textos comerciales que insinúen integración en vivo.
- Pendiente antes de publicar: ejecutar build Vite, Playwright, suite Python completa y verificar conexiones científicas reales en un entorno con sus dependencias. Ver `docs/BIOTEX_STAGE_3_DELIVERY.md`.

## Entrega acumulada, etapas 4–8 (ZIP final)

- Se mantiene un solo recorrido, tema oscuro, BIO y backend independiente. No restablecer páginas históricas ni proveedores anteriores.
- Modelo de Barranca: usar `backend/app/ml/holdout_metrics.py` y `app.services.field_shift_ai.evaluated_holdout()` para métricas de 11 meses; no transferir a Chalhuas. El entrenamiento Chalhuas sigue bloqueado sin historial real revisado y pruebas locales.
- Comparador andino: `priority_evidence` solo describe estructura botánica; ahorro de agua y predicción de rendimientos no están validados.
- Distribución: `frontend/src/campaignPlan.ts` comparte asignaciones entre pantalla/impresión; el croquis vectorial es una propuesta, no imagen satelital.
- No se ha ejecutado build Vite, Playwright, backend Docker ni pruebas científicas en vivo sobre el ZIP final en este entorno. Ejecutarlos con las dependencias antes de declarar disponibilidad productiva.
- El destino previsto es un repositorio NUEVO con nombre público **NSPACE BIOTEX**, identificador `Wilder-reyes/NSPACE-BIOTEX`, frontend Vercel manual y backend Python separado. Ver `docs/NSPACE_BIOTEX_NEW_REPO_AND_DEPLOY.md`.
- Los workflows de ingesta NASA y de reimportación FAO quedan manuales, sin cron ni push para evitar descargas y gastos automáticos.


## Encargo de publicación actual (15 de noviembre de 2026)

- El propietario pidió usar **el repositorio existente** `Wilder-reyes/TERRA360-AI` para un **proyecto nuevo de Vercel**, sin crear `NSPACE-BIOTEX` todavía. La identidad pública de producto sigue siendo NSPACE BIOTEX.
- La publicación del release candidato requiere build, pruebas y verificación del backend; utilizar `docs/CURRENT_REPOSITORY_DEPLOY.md` y los scripts de publicación/limpieza incluidos.
- Las instrucciones de no hacer push durante las etapas anteriores eran restricciones de aquella ejecución; el propietario autorizó posteriormente publicar el proyecto. Esta copia de entrega todavía no ha sido publicada remotamente.
- No borrar las ramas `main`, `David` ni ramas de PR abiertos, y no purgar refs remotas sin un respaldo Git verificado.

## Identidad y diseño vigentes — CHAKRA (autorizado 2026-11-15)

El propietario renombró el producto público a CHAKRA y autorizó el rediseño premium con fondo #050806, acento #D6F866, Inter y PT Serif cursiva en una palabra del hero. La fuente de los nuevos tokens es frontend/src/chakra.css. Estas instrucciones reemplazan la paleta e identidad históricas anteriores. Conservar nombre del repositorio, claves localStorage y los IDs/artefactos científicos del modelo; no son nombres públicos de producto. Solo Barranca permanece como recorrido público. Las imágenes de fondo son ilustrativas y nunca evidencia NASA. La UI debe usar lenguaje simple, alto contraste y controles táctiles claros. No inventar testimonios, rendimiento ni mediciones.
