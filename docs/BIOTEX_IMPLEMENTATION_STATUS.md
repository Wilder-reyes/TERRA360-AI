# BIOTEX — Estado de implementación

> **ACTUALIZACIÓN ETAPA 2 — 2026-11-15:** Recibido el ZIP de Codex de las etapas 0–1. En esta copia se integró Agricultural Dark Mode, coordenadas y edición libre de parcelas, subparcelas voluntarias y ajuste de BIO sin rehacer la arquitectura. **31 pruebas unitarias frontend aprobadas**; Vite y Playwright sin verificar por bloqueo de instalación npm/DNS y 19 módulos Python no importables por dependencias científicas ausentes. No hubo push ni despliegue. Por proceder de `git archive`, esta copia no contiene `.git`; no se creó un commit local. Detalle: [BIOTEX_STAGE_2_DELIVERY.md](BIOTEX_STAGE_2_DELIVERY.md). La etapa 3 no está iniciada.

Fecha: 2026-11-15, America/Bogota. **Etapas 0–3 recibidas/actualizadas en copia ZIP.** La etapa 1 original fue entregada por Codex en rama local; etapas 2 y 3 son entregas ZIP realizadas fuera del repositorio Git. No hay backend nuevo desplegado.

## Control de cambios

- Repositorio local: `C:\Users\Wilder\Documents\Codex\2026-11-15\files-pasted-by-the-user-biotex\TERRA360-AI`.
- Estado inicial limpio. Base: `ea75de761b822d71ca0230cb8a10808c5ee20ab6` (auditoría local de etapa 0), sobre main `e6b6fd4e179165b6d30a0815c9956f5730ef0a3b`.
- Rama nueva: **dev/biotex-stage-1**. Sin push, merge remoto, despliegue, modificación de permisos o borrado de proyectos externos.
- Commit correspondiente: commit local titulado `refactor(biotex): consolidate stage 1 architecture`. Obtener su SHA con `git log -1 --format=%H -- docs/BIOTEX_IMPLEMENTATION_STATUS.md`; el comprobante de entrega incluye el hash final sin una autorreferencia circular.
- La auditoría previa se conserva en [audit/BIOTEX_STAGE_0_STATUS.md](audit/BIOTEX_STAGE_0_STATUS.md). Las hojas de ruta v0.x son documentos históricos, no instrucciones de despliegue vigentes.

## Cambios y resultado arquitectónico

1. Una única entrada `main.tsx → BiotexFarmerApp` y un único recorrido: **Mi terreno → Mis cultivos → Mis prioridades → Mi plan agrícola**. Eliminados los selectores de páginas por vista/pilot y el enlace a especialistas. `lang=en` conserva el mismo recorrido en inglés.
2. Herramientas científicas integradas bajo demanda en Mi terreno; historial/catálogo/foto local en Mis cultivos. Comparación costera y comparación Mantaro son capacidades regionales del mismo recorrido, con ámbitos y resultados diferenciados. No se traslada el modelo de Barranca a Chalhuas.
3. Recuperación de guardados costeros y andinos conservada, con validación de subparcelas recuperadas. Las respuestas de consultas anteriores no pueden enviar otra parcela a resultados. El tutorial BIO se comparte y su botón de repetición queda en el footer para no cubrir controles.
4. Separación explícita de obtención, calidad, geoespacial, inferencia, comparación y presentación. Extraídos QA POWER/ECOSTRESS, geometría de subparcelas/relieve y composición de resultados; los adaptadores científicos especializados conservan sus funciones para no introducir cambios de producto o procedencia. Detalle en [BIOTEX_ARCHITECTURE.md](BIOTEX_ARCHITECTURE.md).
5. Configuración estática única en `frontend/vercel.json`, Root Directory frontend. `VITE_API_URL` configura el backend público también en producción; validación de formato durante el build y exposición exclusiva de esa variable pública. No existe proxy predeterminado, URL de servicio anterior ni ejecución Python en el frontend estático.
6. Limpieza de CSS histórico sin rediseñar la aplicación. La impresión conserva A4 con márgenes de 18 mm; el plan andino imprime fuera del contenedor de pantalla ocultado por print. El rediseño final Agricultural Dark Mode no se adelanta en esta etapa.

## Archivos conservados, fusionados y retirados

| Archivos/grupo | Decisión y motivo |
|---|---|
| BiotexFarmerApp, main y utilidades de geometría/fechas/historial | Conservados y consolidados como única aplicación; importación GeoJSON opcional estricta, selección/dibujo libres y guardado |
| SatelliteEvidence, FarmerAIEvidence, FarmDecisionEvidence | Conservados: procedencia HLS, modelo acotado, contexto oficial y economía opcional |
| ParcelNDVI, SentinelSeries, GpmPolygon, SmapRegional, GaezRaw, SatelliteScenes | Conservados e integrados mediante FieldEvidence, sin otra página ni implementación científica duplicada |
| CropPhotoGuide y BioTour | Conservados: fotografía solo local y tutorial; sin identificación automática ni chatbot |
| ChalhuasPilotApp y chalhuas-pilot.css | Contenido útil fusionado en AndesRotation/andesProfile y CSS regional; retirados shell, navegación y selección duplicados. Campañas, mapa propuesto, validación, guardado e impresión conservados |
| App, FarmerApp, RotationApp, GeoWorkspace y FarmerMap | Retirados como páginas/mapas raíz duplicados. Datos/catálogos/cálculos/capas útiles se integran en el recorrido; se retiran los dashboards y gráficos históricos como presentaciones independientes. Los endpoints científicos permanecen para compatibilidad y reproducción |
| biotex-v027.css | Fusionado en biotex-farmer.css respetando el orden de cascada; selectores ya imposibles retirados |
| farmer-app.css, geo-workspace.css, rotation.css, crop-search.css, copy.ts, pilot.ts, i18n/index.ts | Retirados tras verificar el grafo de imports y migrar las pruebas. El ES/EN del recorrido actual ya usa sus diccionarios y no depende de i18next |
| style.css | Reemplazada hoja global histórica por reset mínimo y estilos compartidos necesarios; eliminada la descarga de fuentes remotas |
| backend/app/data completo, modelos, catálogos y entrenadores | Conservados sin cambios de bytes: necesarios para reproducción y pruebas. Ningún dataset/modelo eliminado |
| Backend API | Conservadas las 39 rutas distintas y sus métodos. No se borran endpoints por retirar una página. Inventario en audit/stage-1-endpoints.json |
| backend/Dockerfile, requisitos y scripts científicos | Conservados como backend independiente, sin vinculación a proveedor. Retiradas ramas de runtime Python que dependían de detectar VERCEL |
| vercel.json raíz, .vercelignore raíz y render.yaml | Retirados: duplicidad de raíz y blueprint del servicio antiguo. Único modo de publicación previsto: frontend estático y backend nuevo configurable |
| .github/workflows/pages.yml y smoke-production.yml | Retirados: publicación Pages y comprobación del despliegue anterior. CI, E2E y workflows científicos conservados; no se ejecutaron remotamente |
| scripts/smoke_public_demo.py y smoke_chalhuas_public.py | Retirados: dominios/prestaciones antiguos. Sustituidos por smoke_configured_backend.py con --site y --api obligatorios, sin defaults de servicios reales; solo se ejecutó --help localmente |
| docs/cloudflare-pages-render.md, docs/hosting-and-domain.md, README.es.md | Guías de hosting antiguas retiradas; documentación unificada en README y docs/vercel-deployment.md. README.es queda como enlace para evitar instrucciones divergentes |
| Cachés, descargas, .venv y datos privados ignorados | No borrados ni incluidos en Git. No se descargaron nuevos datos científicos ni se ejecutó una ingesta privada |

Registro individual de **24 rutas retiradas**, con SHA-256 previo y motivo: [audit/stage-1-removed-files.json](audit/stage-1-removed-files.json). Antes de borrarlas se recorrieron imports desde main, imports transitivos/dinámicos, componentes, tests y configuraciones. El contenido anterior sigue en Git. SOURCE_MANIFEST_SHA256.txt se conserva como instantánea histórica, no como manifiesto del árbol actual.

## Ciencia y dependencias

- Reproducción HLS aprobada: 44 observaciones válidas, split 33/11; Brier **0.23408067** frente a **0.48025712**. Dataset y artefacto mantienen su fingerprint. Evidencia: audit/stage-1-model-validation.json.
- No se entrenó un modelo nuevo, no se utilizaron datos sintéticos como ciencia y no se consultaron de nuevo los ráster originales para certificar procedencia externa. La reproducción computacional no valida rendimientos, cultivos ni otro lugar.
- POWER booleano se trata como dato desconocido, no número. IDs duplicados de subparcelas se rechazan para evitar sobrescribir asignaciones. Los tests nuevos cubren estas correcciones.
- Retirados recharts, i18next y react-i18next, cuyo uso pertenecía a páginas eliminadas. React/Vite/Leaflet/TypeScript se fijan a las versiones ya verificadas; herramientas de build pasan a devDependencies. Playwright 1.58.0 queda declarado y bloqueado, en vez de instalarse transitoriamente en CI.
- Backend: se retira pydantic-settings sin imports y la declaración directa de python-dateutil; se declaran pydantic, python-dotenv y s3fs, que sí se importan. pandas se conserva por xarray y scripts científicos. python-dateutil sigue como dependencia transitiva. No se hizo una actualización masiva del entorno científico ni se desinstalaron paquetes del entorno local existente.
- `npm outdated`: Playwright 1.58.0, latest 1.65.1. Se conserva la versión ya comprobada. `pip list --outdated`: FastAPI 0.128.2 → 0.163.1, Starlette 0.50.0 → 1.10.0, botocore 1.43.117 → 1.44.3 y python-dateutil 2.9.0.post0 → 4.0.0; pip 26.2.2 → 26.3 es herramienta. Que exista una versión nueva no demuestra vulnerabilidad ni compatibilidad con esta ciencia.
- Evidencias de versiones y audit npm en audit/stage-1-dependencies.json, stage-1-npm-audit.json y stage-1-npm-outdated.json. Python mantiene rangos transitivos, no un lockfile completo; se documenta como límite de reproducibilidad del entorno.

## Pruebas y revisión

Entorno: Windows, Python 3.13.17, Node 26.13.1/npm 11.20.0. CI declara Python 3.12/Node 22; no se disparó CI remoto.

| Verificación final | Resultado |
|---|---|
| Instalación limpia npm ci, lockfile actualizado | Aprobada; 30 paquetes instalados en esta plataforma |
| Frontend unitario | **27 aprobadas**, 0 fallidas/omitidas |
| Build TypeScript + Vite | Aprobado, 95 módulos; chunk principal ~473.11 kB (~145.95 kB gzip), sin advertencia de >500 kB. Era ~514 kB en etapa 0 |
| Python unittest discover | **257 aprobadas**, 0 fallidas/omitidas; 11.470 segundos |
| Navegador Chromium headless | **39 aprobadas**, 0 fallidas/omitidas; 58.9 segundos en la pasada completa. Incluye búsqueda, guardado, consultas QA/no-data, origen de API, fotos locales, recuperación andina, respuesta tardía e inglés |
| API configurable en build productivo | Caso adicional focalizado aprobado con origen .example interceptado por Playwright; no conectado a servicio real |
| Exposición de variables de frontend | Bundle incluye origen público configurado y excluye un sentinel de prueba de otra variable VITE_*; no se usó un token real |
| pip check / npm ls --depth=0 | Sin conflictos ni dependencias rotas |
| npm audit | **0 vulnerabilidades** reportadas por el registro en esta consulta |
| Imports relativos frontend y sintaxis Python | Sin errores en auditoría estática; TypeScript/build y pruebas de API completan la comprobación ejecutable |
| Secretos | Sin candidatos evidentes en patrones estáticos de archivos del árbol de trabajo que pueden entrar en Git. Ejemplos frontend solo exponen VITE_API_URL; backend tiene Earthdata vacío y descargas deshabilitadas por defecto |
| Reproducción HLS / diff de datos | Aprobada; ningún cambio en backend/app/data |
| git diff --check | Aprobado |
| Responsive/visual | Comprobados 375/768/1024/1440 px; capturas móvil/escritorio inspeccionadas. Repetición BIO ya no tapa controles. Las teselas externas pueden no haber cargado completamente en la captura móvil; no se certifica ese proveedor |
| Docker Linux / integración científica real | No ejecutados. No se encontró Docker en esta laptop; no se certifican disponibilidades externas ni un despliegue nuevo |

No se retiraron pruebas para ocultar fallos: las cuatro suites E2E anteriores se migraron por capacidad (36 casos) y se añadieron tres regresiones. Los tests de la reescritura obligatoria a un proveedor antiguo se adaptaron al contrato solicitado, conservando el control de publicación estática y secretos. Se agregaron cuatro casos Python de arquitectura/calidad y cuatro unitarios frontend de origen/GeoJSON/ámbito.

Fallos intermedios resueltos: tests de configuración todavía buscaban vercel.json raíz y proxy antiguo; un regexp de bootstrap era demasiado amplio; una edición introdujo codificación incorrecta en textos; un test seguía buscando el enlace a especialistas; la impresión generó un texto duplicado entre pantalla y reporte; un selector exacto no incluía la flecha del botón Continuar. Se corrigieron código/expectativas según la arquitectura y se repitieron las comprobaciones afectadas. La primera actualización offline del lockfile falló por caché ausente y se repitió consultando el registro. No quedan fallos finales por esas causas. Se conserva la advertencia de deprecación de module.register del runner en Node 26, sin ocultarla ni atribuirle un fallo.

## Comandos principales ejecutados

```powershell
git status --short --branch
git log -2 --oneline
git switch -c dev/biotex-stage-1
# Inventario y trazado: Get-Content, rg, git show, grafo de imports y hashes previos.
npm.cmd install --package-lock-only --ignore-scripts --prefix frontend
npm.cmd ci --prefix frontend --no-audit --no-fund
npm.cmd test --prefix frontend
npm.cmd run build --prefix frontend
npm.cmd ls --depth=0 --prefix frontend
npm.cmd audit --json --prefix frontend
npm.cmd outdated --json --prefix frontend
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip list --outdated --format=json
python scripts/reproduce_field_shift_ai.py --check --report ../work/stage1-hls-validation.json
python scripts/audit_repository.py
python scripts/smoke_configured_backend.py --help
# Dentro de frontend, con Chromium local:
npm.cmd run test:e2e -- --reporter=line
# Focalizados: suite andina y caso de VITE_API_URL con URL .example interceptada.
git diff --check
git add -A
git diff --cached --check
git -c user.name=Codex -c user.email=codex@localhost commit -m "refactor(biotex): consolidate stage 1 architecture"
git status --short --branch
```

Los scripts intermedios y logs están en ../work del chat; las evidencias revisables están en docs/audit. Las pruebas Python/navegador se ejecutaron con acceso autorizado fuera del sandbox por los sockets locales necesarios; no utilizaron despliegues antiguos. El commit usa la identidad local de agente Codex, sin modificar configuración global.

## Bloqueos y acciones manuales pendientes

- Backend NUEVO no configurado. Antes de publicar, definir su origen público y el CORS del frontend nuevo. No se presupone que Vercel ejecute Python.
- Vercel/Netlify/Render/GitHub pueden conservar instalaciones, webhooks, auto-deploy, Deploy Hooks, secretos o dominios de integraciones anteriores. **Eliminar archivos del repositorio no los revoca**. No se consultó ni modificó su estado. Revisión manual detallada en [vercel-deployment.md](vercel-deployment.md).
- Earthdata/almacenamiento privado, QA de nuevas escenas y datos/modelo local de Chalhuas siguen sin certificar. Se conserva la abstención científica. No se exigen experimentos físicos para continuar.
- El análisis de secretos es estático y no garantiza ausencia de secretos en todo el historial Git ni revocación de credenciales externas. No se incluyeron caches ni entornos ignorados.
- Las doce guías Aura siguen siendo referencias seleccionadas, sin paquetes/licencias individuales verificados ni instalación nueva. Se aplicaron las dos skills locales; se actualizó su regla obsoleta de proveedor a backend independiente.
- Esperar exclusivamente el próximo prompt de **etapa 2**. No se inicia rediseño final, entrenamiento nuevo ni despliegue.


## Etapa 3 — integración científica y mapas (ChatGPT, 2026-11-15)

- Ver `docs/BIOTEX_STAGE_3_DELIVERY.md` para detalle técnico, comandos, pruebas y límites.
- Catálogo de fuentes en `backend/app/services/scientific_registry.py` y endpoint `/api/environment/scientific-sources`; SENAMHI es directorio de referencia, NO hay observaciones de estación ingeridas.
- El endpoint NASA POWER diario aporta porcentaje de cobertura por variable y preserva valores faltantes. El frontend diferencia lluvia en registros disponibles de un total anual completo.
- NASA GIBS mantiene fechas UTC, opacidad, escala, fuente y leyendas oficiales sobre el mapa ya existente. Los píxeles mostrados no se presumen validados por visualización.
- Pruebas: 36 frontend unitarias, 5 backend nuevas, TypeScript puro, sintaxis TSX y compileall aprobados; reproducción HLS Barranca aprobada. Build Vite/Playwright y suite Python completa pendientes por falta de dependencias del entorno.
- Sin commit nuevo (ZIP sin `.git`), push, merge ni despliegue. La siguiente etapa autorizable es la 4 (IA).

## 2026-11-15: Etapas 4 a 8 incorporadas en ZIP (sin publicación)

Estado final de esta copia: **candidato de release para pruebas, NO validado para producción**. Ver `docs/BIOTEX_STAGE_4_TO_8_DELIVERY.md` y `docs/NSPACE_BIOTEX_NEW_REPO_AND_DEPLOY.md`. Los resultados científicos originales no se editaron; se añadió evaluación reproducible de clasificación y API de evidencia acotada a Barranca. La rotación andina conserva incertidumbre hídrica y de suelo, y los resultados espaciales/impresión se basan únicamente en las subparcelas elegidas. Se corrigió la composición del PDF al dividir croquis en dos filas independientes.

Pruebas locales: 39 frontend unitarias, 6 Python de alcance específico aprobadas y 1 omitida por `earthaccess`, HLS repro aprobado, análisis sintáctico TSX y compileall aprobados; maqueta PDF A4 revisada. **Pendientes**: instalación npm completa, build Vite, Playwright y pruebas Python completas con dependencias, Docker y servicio científico externo. No hay commits de las etapas 2–8 en el GitHub existente; el ZIP no contiene `.git`. Nunca se hizo push/deploy. El nuevo repositorio planeado es `Wilder-reyes/NSPACE-BIOTEX`.

## Publicación autorizada — 2026-11-15

Destino: Wilder-reyes/TERRA360-AI, base main 28359f896e305e1656884e99cef664b92a775b3b. Entrega acumulada 0–8. No crear otro repositorio ni desplegar Vercel.

- Conservado byte por byte backend/app/data/imerg_basin_seed.json, SHA-256 ce633db4e3ed63623107bb5b8ac559ad917f5fdc230937bb93b239f4cffb449a.
- Corregido tipo del evento original del mapa (TS7006) y texto de alcance Barranca en field_shift_ai.
- frontend/vercel.json: git.deploymentEnabled=false durante esta publicación; reactivar solo al autorizar despliegue.
- npm ci; npm test: 39/39; npm run build: correcto.
- PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py' -v: 266/266 correctos.
- python scripts/reproduce_field_shift_ai.py --check; python docs/audit/reproduce_classification.py: correctos, 11 meses holdout.
- python scripts/audit_repository.py: sin candidatos de credenciales, imports rotos ni errores sintácticos.
- Playwright local bloqueado por socket() Operation not permitted al arrancar Chromium; no es un resultado de pruebas funcionales. Docker no está instalado. Verificar ambos en GitHub Actions antes de limpiar ramas.
- Respaldo Git de todas las ramas: BIOTEX-branches-20261115.bundle, verificado con git bundle verify. Mantener main, David y ramas de PR abiertos (#20 y #33).
- Commit correspondiente: commit que incorpora esta sección (git log -- docs/BIOTEX_IMPLEMENTATION_STATUS.md).

### Controles remotos de la publicación

Commit b101c21919f3dcee04b1dfe4a26d66c8ccaea041: quality checks (backend 266, frontend 39, build y Docker) y HLS reproducible aprobados. Playwright: 39/43; cuatro expectativas de versión/copy heredadas del paquete se actualizan al contrato actual (stage-8, advertencia IMERG y asignaciones propuestas). No se omiten pruebas.
Respaldo duradero: BIOTEX-branches-20261115.bundle, libfile_44a6cac587388191ab6b8a9e07154504. Ninguna rama eliminada: autenticación adicional de Google bloqueada por revisión automática del navegador; continuar requiere autorización de ese origen.
