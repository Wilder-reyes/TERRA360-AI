> Registro histórico de la etapa 0, commit ea75de7. Para el estado actual consulte ../BIOTEX_IMPLEMENTATION_STATUS.md.

# BIOTEX — Estado de implementación y auditoría

Fecha: 2026-11-15 (America/Bogota). Fase actual: **etapa 0 completada, preparación y diagnóstico**. Este documento no declara implementadas las etapas de la nueva hoja de ruta. Los estados históricos v0.24–v0.28 describen otro ciclo de trabajo.

## Procedencia y control local

- Repositorio oficial: https://github.com/Wilder-reyes/TERRA360-AI.
- Copia nueva: `C:\Users\Wilder\Documents\Codex\2026-11-15\files-pasted-by-the-user-biotex\TERRA360-AI`.
- No había repositorio en la carpeta inicial del chat. El usuario confirmó que no tiene una copia local confirmada y autorizó clonar. No se alteró ninguna otra copia.
- HEAD inicial descargado: `a354338fffb8b40d9a16535167bff053167fab06`, coincidente con el traspaso. Al verificar de nuevo, `main` había avanzado a **`e6b6fd4e179165b6d30a0815c9956f5730ef0a3b`**, asunto `fix(v0.23.1): S1 card collapsed by CSS class collision; English crop names in EN (#29)`. Se descargó ese cambio y se actualizó la base de la rama local antes del commit de auditoría. La verificación final de pruebas corresponde a e6b6fd4.
- `origin` fetch/push: `https://github.com/Wilder-reyes/TERRA360-AI.git`. No se ejecutó push, merge, deploy ni cambio en servicios externos.
- Estado inicial de la copia: limpio, `main...origin/main`. Rama local creada: `dev/biotex-stage-0`. Main local quedó alineada a origin/main e6b6fd4, sin commits propios. Para adelantar la rama de trabajo se guardó temporalmente solo la edición propia de AGENTS con stash, se aplicó rebase local y se restauró sin conflictos. Los documentos nuevos permanecieron conservados. No se reescribió ninguna rama remota.
- Commit correspondiente: el commit local titulado `docs(biotex): complete stage 0 repository audit` que introduce este documento. Se identifica sin autorreferencia circular mediante `git log -1 --format=%H -- docs/BIOTEX_IMPLEMENTATION_STATUS.md`. El hash final se entrega también en el informe de salida.

## Cambios realizados

1. Clonado completo y rama independiente; inventario de código, ramas, datos, modelos, pruebas y despliegues.
2. Actualización aditiva de `AGENTS.md` con las reglas permanentes actuales. No se reescribieron instrucciones históricas: se definió su prioridad para resolver conflictos de despliegue, diseño y validación.
3. Creación de este estado y evidencias de reproducción HLS. Entorno virtual Python y dependencias Node instalados localmente, fuera del control de versiones.
4. Sin cambios al producto, modelos, datasets, skills, dependencias declaradas, lockfile o configuraciones de despliegue. Sin archivos eliminados. Correcciones de producto y rediseño quedan para etapas posteriores.

## Inventario de ramas

`main` y `dev/biotex-stage-0` son locales. En el clonado se encontraron las siguientes referencias remotas, que no se modificaron:

```text
origin/David
origin/chore/codex-ui-ux-pro-max-biotex
origin/chore/vercel-only-chalhuas-smoke
origin/docs/chalhuas-explicit-skills-and-map-contract
origin/docs/roadmap-v028-chalhuas-agro-ai
origin/docs/v017-huaral-farmer-first-vision
origin/feat/biotex-chalhuas-rotation-pilot
origin/feat/biotex-farmer-workflow-v022
origin/feat/biotex-ux-pro-max-farmer-demo
origin/feat/biotex-v024-clear-evidence-demo
origin/feat/biotex-v025-agricultural-decision-evidence
origin/feat/biotex-v026-trained-hls-ai-barranca
origin/feat/biotex-v026-trained-nasa-model-reproducible
origin/feat/biotex-v027-ux-pro-max-farmer-redesign
origin/feat/ecocrop-quality-audit
origin/feat/gaez-official-inventory-nasa-hardening-v015
origin/feat/gpm-imerg-polygon-v013
origin/feat/nasa-persistent-ingest-smap-gaez-v014
origin/feat/sentinel2-parcel-ndvi
origin/feat/sentinel2-quality-timeseries-v012
origin/feat/v017-huando-peruvian-farmer-ux
origin/feat/v018-farmer-dashboard-crop-guidance-pdf
origin/fix/biotex-income-priority-v0221
origin/fix/ci-proxy-network-regression-v015
origin/fix/nasa-smap-bounded-calca-subset-v016
origin/fix/render-rasterio-native-runtime
origin/fix/v0181-netlify-farmer-release-no-camera
origin/fix/v019-satellite-map-farmer-responsive
origin/fix/vercel-static-only-v026-storage
origin/main
origin/plan/ml-dl-agricultural-decisions
origin/test/sentinel2-public-smoke
```

`origin/HEAD` apunta a `origin/main`. El inventario no implica que las ramas históricas estén integradas o deban fusionarse.

## Frontend

- `frontend/src`: 47 archivos versionados. React/TypeScript/Vite, Leaflet y react-leaflet; i18next/react-i18next para idioma y Recharts para gráficos. Manifiesto interno `terra360-frontend` versión `0.5.0`, distinto de los identificadores de producto/documentación.
- Versiones bloqueadas: React/React DOM 19.3.1, Vite 8.3.8, TypeScript 7.0.2, Leaflet 1.9.4, react-leaflet 5.0.0, Recharts 3.10.1, plugin-react 6.3.0. Existe `package-lock.json` y `npm ci` funciona.
- `main.tsx` monta por defecto `BiotexFarmerApp`; `?pilot=chalhuas` carga `ChalhuasPilotApp`; `?vista=tecnica` carga `App`; `?vista=clima`, `FarmerApp`; `?vista=comparador-tecnico`, `RotationApp`. Son rutas históricas con comportamientos distintos, no una interfaz final unificada.
- Mapas/capas: FarmerMap, GeoWorkspace, SatelliteScenes, SatelliteEvidence, ParcelNDVI, SentinelSeries, GpmPolygon, SmapRegional y GaezRaw. Evidencias: FarmDecisionEvidence y FarmerAIEvidence. Tutorial: BioTour. Utilidades compartidas: geometry, domain, network, manualRotation, rotationCalendar, rotationZones e i18n.
- Cinco aplicaciones raíz conservan responsabilidades solapadas de terreno, formularios, escenarios y resultados. Riesgo de divergencia de tipos locales, textos, guardado y CSS. No se confirma equivalencia funcional ni se elimina nada en esta etapa.
- Comparación SHA-256 de todos los archivos versionados no vacíos: **ningún duplicado binario exacto**. La duplicación identificada es funcional y de configuración, no archivos idénticos.
- `design-system/biotex/MASTER.md` mantiene un diseño histórico claro y objetivos de 44 px. Las reglas actuales requieren Dark Mode y 48 × 48 CSS px. Esta auditoría no certifica contraste, ergonomía ni PDF profesional final.
- Producción usa `API=''` en `network.ts`, ignorando `VITE_API_URL` fuera de desarrollo. La aplicación depende de un proxy `/api`; una URL nueva en variables de build, por sí sola, no conectará el backend final.

## Backend y conectores

`backend/app`: 63 archivos versionados. FastAPI en `main.py`, versión de API `0.23.0`; 11 routers registrados. No se encontró base de datos transaccional configurada en el inventario. Hay JSON versionados, cachés locales y almacenamiento externo opcional.

| Área | Archivos principales | Estado observado |
|---|---|---|
| API general y clima | api/routes.py, schemas/environment.py, connectors/nasa_power.py | Consultas POWER, normalización y control de datos faltantes |
| IMERG | connectors/earthdata.py, connectors/gpm_imerg.py; services/imerg_polygon.py, imerg_basin.py | Descarga autenticada y agregación regional/polígono; no equivale a riego de parcela |
| HLS | services/hls_history.py | HLS v2 vía STAC Planetary Computer, máscaras Fmask, series mensuales, semillas/cache |
| Sentinel-2 | connectors/planetary_computer.py; services/sentinel_ndvi.py, sentinel_timeseries.py | Catálogo y ráster NDVI con QA; fuente ESA/Copernicus, no etiquetar como NASA |
| SMAP | services/smap_regional.py, smap_subset.py; api/smap_routes.py | Producto regional y subconjuntos; disponibilidad real depende de archivo/procedencia |
| Relieve | api/terrain_routes.py | SRTM90m mediante OpenTopoData; servicio externo con límites, no levantamiento catastral |
| ECOSTRESS | services/andes_rotation.py | Búsqueda de metadatos CMR; no acredita temperatura/ET numérica validada |
| ERA5-Land | services/era5_land_context.py | Histórico regional vía Open-Meteo, cache y límites; no estación local ni pronóstico |
| FAO | services/gaez_selected.py, gaez_original_raw.py; data/ecocrop_* | Inventarios/catálogos, abstención y procedencia; no asumir idoneidad comprobada |
| Rotaciones | services/rotation_engine.py, andes_rotation.py, rotation_zones.py | Comparador costero y piloto andino separados; no intercambiar calendarios |
| IA y evidencia | services/field_shift_ai.py, decision_ai.py, agro_evidence.py; ml/rain_model.py | Un modelo HLS acotado y pipelines experimentales; no generalización agronómica validada |
| Archivo y auxiliares | services/r2_archive.py, verified_archive.py, seasonality.py, power_climatology.py, environment_metrics.py, planning_preview.py, farmer_crop_guidance.py, crop_search.py, arie.py | Dependencias a preservar y revisar antes de limpiar datasets/modelos |

Conectores directos en `backend/app/connectors`: `earthdata.py`, `gpm_imerg.py`, `nasa_power.py`, `planetary_computer.py` y `__init__.py`. Parte de las integraciones se implementa en servicios o routers, no en ese directorio. NASADEM y un conector Landsat independiente no se identificaron; Landsat participa en HLS. Las menciones de fuentes no prueban una integración operativa.

## Datasets y modelos

- `backend/app/data/history_seed`: siete series HLS JSON de 71 meses cada una, para barranca-1, barranca-2, barranca-test-1, barranca-test-2, huaral-1, huaral-2 y huaral-test-1. El sufijo `test` de un lugar no acredita independencia de evaluación.
- Modelo versionado: `backend/app/data/models/barranca_hls_bare_v1.json`. Fuente: `history_seed/3365819f83a772e737d341ec1058efac.json`; hash Git blob `8846b0ceb4669c8372d0ea724263d263a4bf37d7` verificado por el reproductor.
- Catálogos: ecocrop_species.json, rotation_crops.json, parameter_catalog.json; módulos crop_directory.py y ecocrop_catalog.py. Evidencia histórica complementaria: official_evidence/ana_historical_context.json.
- Los originales ráster NASA, descargas GPM, archivos privados S3/R2 y cachés no vienen completos con el repositorio. `backend/data`, `backend/models` y `backend/.cache` están ignorados. Los JSON mensuales son datos derivados versionados con metadatos de procedencia, no una nueva descarga independiente de ráster en esta auditoría.
- Entrenamiento: scripts/reproduce_field_shift_ai.py reproduce Barranca; scripts/train_chalhuas_hls.py prepara compuertas de entrenamiento andino; scripts/train_agro_model.py requiere registros agrícolas reales; backend/train_rain_ai.py es experimental para lluvia regional. `scripts/requirements-ml.txt` incluye scikit-learn/joblib opcionales, no necesarios para reproducir HLS.
- No se encontró modelo Chalhuas entrenado/versionado. No se entrenó uno con datos sintéticos. No se descargaron nuevos datos científicos ni se ejecutaron pipelines de ingesta con credenciales.

### Reproducción de Barranca

`python scripts/reproduce_field_shift_ai.py --check` terminó correctamente: 71 meses totales, 44 observados y 27 faltantes. Ajuste con 33 observaciones, holdout temporal con 11 (2025-12 a 2026-11). Brier reproducido **0.23408067** frente a **0.48025712** de prevalencia del entrenamiento. Se verificaron coeficientes del ajuste de entrenamiento, ajuste final y probabilidades publicadas. El ajuste final con las 44 observaciones no se usó para calcular la clasificación de holdout.

Evaluación descriptiva de clasificación sobre esos 11 meses reservados, con probabilidad ≥0.5 y etiqueta NDVI <0.20: TP=5, TN=2, FP=0, FN=4; exactitud 63.64%, precisión positiva 100% (solo cinco predicciones positivas), sensibilidad 55.56%, especificidad 100% (solo dos negativos), F1 71.43% y exactitud balanceada 77.78%. El baseline que siempre predice negativo a este umbral tiene exactitud 18.18%; predecir siempre positivo daría 81.82%, por lo que mejorar Brier **no acredita superioridad en exactitud**. No se seleccionó otro umbral para mejorar estas métricas.

Son meses posteriores al ajuste de una sola parcela, con dependencia temporal posible y cambio de prevalencia (8/33 positivos en entrenamiento frente a 9/11 en holdout), no una validación geográfica externa. No es precisión de identidad de cultivos, rendimiento, riego ni Chalhuas. El 100% sobre denominadores tan pequeños no debe promocionarse como garantía. No se comprobaron de nuevo las escenas originales contra NASA en esta etapa. La reproducción informática comprueba coherencia con datos derivados versionados.

Evidencias: `docs/audit/stage-0-model-validation.json` y `docs/audit/stage-0-classification-validation.json`. El script de auditoría `python docs/audit/reproduce_classification.py` reproduce el segundo JSON y se comparó su salida con la evidencia guardada. No altera el modelo ni el producto.

## Configuraciones de despliegue y riesgos

- `vercel.json` y `frontend/vercel.json`: variantes para distinta raíz de proyecto; ambas reescriben `/api` a **[backend histórico retirado en etapa 1]**, backend histórico. Ninguna se usó para publicar ni consultar ese servicio. Deben revisarse antes de configurar un proyecto nuevo.
- `render.yaml`: blueprint antiguo para terra360-api, con variables externas. `backend/Dockerfile` usa Python 3.12 slim Debian, dependencias GDAL/rasterio y libexpat; `.dockerignore` y `.env.example` existen. No acredita infraestructura nueva.
- `.vercelignore` y `frontend/.vercelignore` controlan empaquetado; no se borraron. No se encontró configuración Netlify versionada actual, aunque quedan referencias/ramas históricas.
- `.github/workflows/pages.yml` permite publicar GitHub Pages manualmente y pasa VITE_API_URL, incompatible con el comportamiento actual de `network.ts` en producción. Flujo heredado, no ejecutado.
- Hay 12 workflows: ci, e2e, ai-reproducible, imerg-barranca, import-ecocrop, ingest-nasa-private, pages, smoke-production, verify-gaez-res05-source, verify-gibs, verify-sentinel2-live y verify-sentinel2-series-live. Los de ingesta, smoke y publicación pueden consultar servicios o escribir fuera del entorno local: no se dispararon.
- E2E tiene filtros de cambios que omiten varias raíces actuales (BiotexFarmerApp, ChalhuasPilotApp y CSS relacionados). Riesgo de cambios futuros sin ejecutar automáticamente toda la cobertura de navegador.

## Dependencias y compatibilidad

- Máquina: Windows, Node 26.13.1, npm 11.20.0, Python 3.13.17. CI usa Node 22/Python 3.12; backend/.python-version y Docker declaran 3.12. Pasar aquí no certifica la imagen Linux ni todas esas versiones.
- `npm outdated --json`: i18next instalado/bloqueado 27.1.1, wanted/latest 27.1.2. No se actualizó. `latest` en muchas dependencias del manifiesto hace riesgoso regenerar el lockfile; npm ci usa las versiones congeladas.
- Consulta PyPI `pip list --outdated`: FastAPI 0.128.2 → 0.163.1; Starlette 0.50.0 → 1.10.0; python-dateutil 2.9.0.post0 → 4.0.0; botocore 1.43.117 → 1.44.3. Pip 26.2.2 → 26.3 es herramienta del entorno, no dependencia del producto. Una versión más nueva no demuestra vulnerabilidad ni compatibilidad. FastAPI/Starlette están fijados intencionalmente; python-dateutil tiene límite <3 y botocore restricciones transitivas. No actualizar sin evaluación separada.
- Python carece de lockfile completo; rangos amplios permiten diferencias de versiones transitivas. `requirements-ml.txt` no equivale a un entorno científico congelado.
- Playwright 1.58.0 se instala de forma transitoria en CI y en esta auditoría (`--no-save --package-lock=false`); no figura como dependencia de desarrollo del proyecto. Es una limitación de reproducibilidad del comando E2E tras npm ci.
- Build: advertencia por chunk principal de unos 514 kB sin comprimir (159 kB gzip), además del chunk de gráficos de unos 367 kB. Riesgo de rendimiento móvil; no se cambió el umbral para ocultarlo.

## Pruebas y comandos

Inventario: 35 módulos Python `tests/test_*.py`; seis archivos frontend `tests/*.test.mjs`; cuatro suites E2E `farmer.spec.ts`, `farmer-dashboard.spec.ts`, `biotex.spec.ts`, `chalhuas.spec.ts`. Cobertura funcional no equivale a validación científica independiente.

| Verificación | Resultado |
|---|---|
| npm ci | Aprobado con el lockfile existente |
| npm test | 23 aprobadas, 0 fallidas |
| npm run build | Aprobado; advertencia de tamaño de chunk |
| Reproductor HLS --check | Aprobado; conteos, hash y métricas reproducidos |
| unittest discover | 253 aprobadas, 0 fallidas, 0 omitidas; 12.736 s; ejecución fuera del sandbox sobre e6b6fd4. Antes: 252 aprobadas sobre a354338 |
| pip check | Aprobado: No broken requirements found |
| Playwright Chromium headless, cuatro suites | 36 aprobadas, 0 fallidas, 0 omitidas; 1.1 minutos, sobre e6b6fd4, preview local con respuestas de prueba |
| Script de clasificación, sintaxis de auditoría y JSON | Aprobados; salida idéntica a evidencia guardada |
| git diff --check | Aprobado |
| Docker Linux | No ejecutado: no se encontró comando docker en esta máquina |
| Servicios NASA/archivo privado y despliegues públicos | No ejecutados; no se acredita disponibilidad operativa |

Comandos principales ejecutados (PowerShell; Python usa `.venv\Scripts\python.exe` cuando corresponde):

```powershell
git status --short --branch
git log -8 --oneline
git log -1 --format=fuller
git branch -avv
git rev-parse HEAD
git remote -v
git ls-remote https://github.com/Wilder-reyes/TERRA360-AI.git HEAD
git clone https://github.com/Wilder-reyes/TERRA360-AI.git TERRA360-AI
git switch -c dev/biotex-stage-0
rg --files --hidden -g '!.git' -g '!package-lock.json'
git ls-files '*lock*' '*requirements*' '*netlify*' '*vercel*' '*render*'
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip list --outdated --format=json
python scripts/reproduce_field_shift_ai.py --check --report ../work/model-validation.json
cd frontend
npm.cmd ci --no-audit --no-fund
npm.cmd test
npm.cmd run build
npm.cmd outdated --json
npm.cmd install --no-save --package-lock=false @playwright/test@1.58.0
npx.cmd playwright install chromium
git fetch origin main
git stash push -m biotex-stage-0-audit-docs -- AGENTS.md
git rebase origin/main
git stash pop
git branch -f main origin/main
python docs/audit/reproduce_classification.py
npx.cmd playwright install chromium --only-shell
$env:PLAYWRIGHT_BROWSERS_PATH='C:\Users\Wilder\Documents\Codex\2026-11-15\files-pasted-by-the-user-biotex\work\playwright-browsers'
npx.cmd playwright test --config playwright.config.ts --reporter=line --output ../../work/playwright-test-results
git diff --check
git add AGENTS.md docs/BIOTEX_IMPLEMENTATION_STATUS.md docs/audit
git diff --cached --check
git -c user.name=Codex -c user.email=codex@localhost commit -m "docs(biotex): complete stage 0 repository audit"
git status --short --branch
```

También se leyeron AGENTS, ambas skills locales, diseño histórico, manifiestos, routers, conectores, modelos, tests y workflows con Get-Content/rg. Se calcularon duplicados exactos por SHA-256 y clasificación sobre el holdout. Logs intermedios en `../work` del chat. Incidencias operativas: el directorio inicial no era Git; la primera consulta Git de red falló por DNS del sandbox y se repitió con acceso autorizado; un intento inicial del reproductor desde frontend no encontró el script y se corrigió ejecutándolo desde la raíz. Un npm ci sin red se interrumpió y se repitió correctamente. Las pruebas Python dentro del sandbox quedaron bloqueadas en socket.accept de _fallback_socketpair al crear el event loop de TestClient; faulthandler permitió identificarlo y la suite pasó al ejecutarse fuera del sandbox. El extractor Node de Playwright quedó detenido después de descargar los ZIP oficiales (Chrome completo y luego headless); se detuvieron esos intentos y se extrajo el ZIP headless ya descargado con zipfile de Python, validando que las rutas permanecieran dentro de ../work/playwright-browsers. No se utilizó un navegador externo sin verificar su procedencia. Una comprobación temporal del JSON de clasificación usó inicialmente una codificación incorrecta y se corrigió a UTF-8; la comparación posterior pasó. Estas incidencias no son fallos del producto.

## Skills, bloqueos y próximos pasos

- Se leyeron `.agents/skills/ui-ux-pro-max/SKILL.md` y `.agents/skills/biotex-farmer-experience/SKILL.md`. La primera incluye LICENSE MIT. La segunda es un contrato local. Las doce guías Aura constan como seleccionadas en la hoja de ruta; sus paquetes y licencias individuales no están verificados ni se instalaron/incorporaron en esta etapa.
- Sin pruebas de producto fallidas en la ejecución final: 23 frontend + 253 Python + 36 navegador. Se corrigieron las incidencias de ejecución descritas; no fue necesario cambiar el producto para que pasaran. Las respuestas de prueba y ráster sintéticos de los tests comprueban comportamiento de software y no se presentaron como evidencia científica o entrenamiento real. Chromium descargado funcionó tras extracción alternativa; no queda ese impedimento abierto. No hubo ensayo físico ni despliegue.
- No había identidad de autor Git configurada en esta copia; el commit de auditoría utiliza `Codex <codex@localhost>` mediante opciones por comando, sin modificar configuración global ni atribuirse la identidad del usuario.
- Las reglas históricas de conservar Render o exigir pruebas físicas no autorizan conectar servicios antiguos ni exigir experimentos físicos: prevalece el AGENTS actualizado y el encargo actual.
- Bloqueos externos: backend nuevo no configurado; credenciales Earthdata/archivo privado no verificadas; cobertura/QA y origen de escenas no reconsultados; no hay dataset/modelo Chalhuas verificado. No se fingió resolverlos.
- Prioridades de depuración para la etapa que el usuario autorice: (1) contrato de API y configuración de proyecto nuevo sin backend antiguo; (2) consolidación del recorrido y modelos de estado duplicados; (3) compatibilidad/reproducibilidad de dependencias y pruebas; (4) trazabilidad científica y abstención por parcela; (5) diseño Dark Mode, controles de 48 px, estados vacíos/errores y PDF A4 de 18 mm; (6) cobertura E2E y rendimiento móvil. Esta lista no autoriza empezar esas tareas ahora.
- **Esperar el prompt de etapa 1.**
