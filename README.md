# NSPACE BIOTEX · plataforma agrícola con evidencia

Aplicación React/TypeScript/Vite/Leaflet y backend Python/FastAPI independientes. Estado actual: **candidato de entrega NSPACE BIOTEX — etapas 0–8 integradas en ZIP**, sin despliegue nuevo y con build/Playwright y backend externo todavía por verificar.

Una aplicación, cuatro pasos: **Mi terreno → Mis cultivos → Mis prioridades → Mi plan agrícola**. Permite dibujar o importar una parcela, registrar cultivos, consultar información científica opcional y comparar opciones dentro del ámbito disponible. Las antiguas vistas por `?vista=` o `?pilot=` ya no son páginas independientes.

La costa de Lima conserva el comparador relativo de 24 meses. El Valle del Mantaro conserva una comparación exploratoria de cuatro campañas dentro del mismo recorrido. El ejemplo de Chalhuas es sintético y no acredita propiedad ni aptitud. No se aplica a Junín el calendario ni el modelo de Barranca.

## Ciencia y reproducibilidad

- Se conservan los siete historiales HLS, catálogos y evidencia originales versionados, los conectores y los scripts científicos.
- El modelo HLS de una parcela Barranca utiliza 44 observaciones válidas, entrenamiento temporal 33/11 y Brier reproducido 0.23408067 frente a 0.48025712. Sobre el holdout de 11 meses: accuracy 63.64%, precision 100%, recall 55.56%, F1 71.43% (muestra pequeña; no validez espacial externa). Es un proxy de vegetación baja, no identidad de cultivo, rendimiento, ahorro de agua ni precisión de Chalhuas.
- POWER, IMERG, SMAP, SRTM y ERA5 son productos con resolución y límites propios. No representan instrumentos dentro de la parcela. ECOSTRESS conserva metadatos sin inventar temperaturas.
- La foto opcional permanece en el dispositivo; no se sube ni se interpreta automáticamente. BIO es el tutorial, no un chatbot.

```sh
python scripts/reproduce_field_shift_ai.py --check
python docs/audit/reproduce_classification.py
```

## Despliegue de prueba en el repositorio ACTUAL

**Repositorio GitHub de prueba: `Wilder-reyes/TERRA360-AI`**. La identidad pública de producto seguirá siendo **NSPACE BIOTEX**. En esta fase no se creará un repositorio nuevo: se publicará el paquete de las etapas 0–8 sobre el `main` actual, conservando el historial. Después se importará ese mismo repositorio en un **proyecto nuevo de Vercel**. La publicación preserva además el archivo IMERG añadido a `main` en el PR #41 después de crear el ZIP original; su estado de revisión científica sigue siendo el declarado en los metadatos.

- [Guía operativa de publicación, pruebas, limpieza segura de ramas y Vercel](docs/CURRENT_REPOSITORY_DEPLOY.md).
- `scripts/publish_current_repo.ps1` clona el repositorio y ejecuta pruebas antes de `git push`.
- `scripts/prune_legacy_branches.ps1` respalda las refs remotas, preserva ramas protegidas y limpia las históricas cuando la publicación esté comprobada.

**No se ha subido todavía el paquete a GitHub ni se ha iniciado el despliegue.** Las pruebas integrales pendientes impiden declararlo certificado para producción.

## Trabajo local y comprobaciones

Frontend, dentro de frontend:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Backend, desde la raíz con un entorno virtual:

```sh
python -m pip install -r backend/requirements.txt
# PowerShell: $env:PYTHONPATH='backend'
# POSIX: export PYTHONPATH=backend
python -m unittest discover -s tests -p 'test_*.py' -v
python -m pip check
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Las dependencias Node y Playwright están fijadas en package-lock.json. Python 3.12 y Node 22 son los entornos declarados en CI; la laptop utilizada se documenta en el estado de implementación. Los entrenadores opcionales que usan scikit-learn/joblib mantienen `scripts/requirements-ml.txt` separado de producción.

## Documentación vigente

- [Arquitectura y responsabilidades](docs/BIOTEX_ARCHITECTURE.md).
- [Estado, pruebas, cambios y bloqueos](docs/BIOTEX_IMPLEMENTATION_STATUS.md).
- [Preparación del despliegue manual y revisión de integraciones](docs/vercel-deployment.md).
- [Modelo histórico HLS](docs/BIOTEX_v026_IA_reproducible.md).
- [Reglas permanentes](AGENTS.md).

La única configuración estática está en frontend/vercel.json. Usar **Root Directory = frontend** y `VITE_API_URL` para el origen público de un backend nuevo. No hay direcciones de despliegues antiguos como requisito. Las guías roadmap y matrices v0.x se conservan como documentos históricos, no como instrucciones de publicación vigentes.

La publicación en el repositorio actual está autorizada por el propietario; no se ha podido ejecutar desde el entorno aislado de este asistente. Eliminar archivos locales no desvincula integraciones autorizadas en cuentas externas.
