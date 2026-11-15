> **Guía histórica / futura.** El plan vigente es publicar en `Wilder-reyes/TERRA360-AI` y crear un proyecto **nuevo de Vercel**. Consultar [`CURRENT_REPOSITORY_DEPLOY.md`](CURRENT_REPOSITORY_DEPLOY.md). No crear repositorio nuevo ahora.

# NSPACE BIOTEX — nuevo repositorio y despliegue manual

**Nombre público:** NSPACE BIOTEX. **Identificador de repositorio propuesto:** `Wilder-reyes/NSPACE-BIOTEX` (GitHub no admite espacios en el identificador). El ZIP no contiene `.git` ni despliega nada; el usuario decide cuándo crearlo y publicar.

## 1. Antes de subir

1. Descomprimir `NSPACE-BIOTEX-etapas-0-8.zip` en una carpeta **nueva**. No volver a subir las carpetas de resultados generados, `.env`, `node_modules` o `.venv`.
2. Desde la raíz: `python scripts/reproduce_field_shift_ai.py --check` y `python docs/audit/reproduce_classification.py`.
3. Crear un entorno Python 3.12 e instalar `backend/requirements.txt`. Ejecutar `PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py'` (PowerShell: `$env:PYTHONPATH='backend'`).
4. `cd frontend && npm ci && npm test && npm run build`. Luego `npx playwright install chromium && npm run test:e2e`.
5. Revisar reporte de fallos. **No usar el término listo para producción** hasta que se completen estos pasos y la comprobación del backend independiente.
6. Buscar secretos privados y revisar licencias y uso de fuentes NASA/FAO antes de hacer público el nuevo repositorio.

## 2. Crear repositorio nuevo

Crear desde GitHub un repositorio vacío llamado `NSPACE-BIOTEX`, sin README generado si se van a usar los archivos incluidos. Desde la nueva carpeta de proyecto:

```bash
git init
git branch -M main
git add .
git commit -m "feat(biotex): initial NSPACE BIOTEX release candidate"
git remote add origin https://github.com/Wilder-reyes/NSPACE-BIOTEX.git
git push -u origin main
```

Estos comandos son **manuales**, no fueron ejecutados por el asistente.

## 3. Backend FastAPI (necesario para análisis funcional)

- Desplegar la carpeta `backend` como servicio Python/Docker independiente en proveedor a elección; `backend/Dockerfile` incluye los paquetes rasterio / GDAL para el entorno correspondiente. No crear un backend Python como frontend estático de Vercel.
- Definir `CORS_ORIGINS=https://<TU-NUEVO-PROYECTO>.vercel.app` sustituyendo por el origen **real**; valores separados por coma si son varios orígenes.
- Proteger en variables privadas las credenciales Earthdata, R2/S3; `VITE_*` no es seguro para credenciales.
- Verificar `GET /api/health`, `GET /api/environment/scientific-sources` y `GET /api/ai/validated-models` en el nuevo backend. Verificar salud, control de errores, limites de cuota y tiempos de respuesta; estas rutas no garantizan por sí solas disponibilidad de archivos NASA.
- NASA Earthdata y la ingesta privada no se ejecutan automáticamente: el workflow de ingesta se dejó **manual** para proteger la cuota gratuita.

## 4. Frontend nuevo de Vercel

Crear **New Project** y elegir el nuevo repositorio `Wilder-reyes/NSPACE-BIOTEX`.

| Ajuste | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Variable pública | `VITE_API_URL=https://tu-backend-real.example` (sustituir por HTTPS real, sin `/api`) |

`frontend/vercel.json` es la **única** configuración y no reescribe peticiones a ningún backend antiguo. El contenido científico requiere el backend disponible. Si VITE_API_URL está vacía en producción, la aplicación usa el mismo origen; en el proyecto estático nuevo esto no resuelve `/api` y la función backend fallará hasta configurarse.

Vercel puede desplegar automáticamente tras vincular Git. Para un flujo estrictamente manual, crear el proyecto desde la CLI o revisar previamente la configuración de despliegue en la **nueva** cuenta y repositorio. No reactivar el sitio antiguo.

## 5. Comprobaciones posteriores al deploy

- Abrir desde móvil y escritorio la vista satelital; elegir **una parcela nueva**; dibujar/editar y guardar subparcelas; completar las cuatro etapas; observar mensajes de datos nulos.
- Verificar el comparador costero y **separadamente** Chalhuas. La IA de Barranca solo debe activarse para su polígono HLS exacto; Chalhuas no debe mostrar métricas como si fueran locales.
- Generar PDF A4 desde el navegador y comprobar visualmente márgenes **18 mm**, mapas de campañas, leyendas, encabezados, tablas y límites. Evaluar con 1 y con varias subparcelas.
- Ejecutar el smoke con URLs reales elegidas por el usuario: `python scripts/smoke_configured_backend.py --site https://... --api https://...`. No guardar tokens en registros.
- **No declarar listo para producción** si falla CI, el build, la conectividad de API, el PDF o las pruebas de navegador.

## Alcances científicos

El modelo entrenado y evaluado sigue siendo NASA HLS **Barranca** con 44 observaciones (33/11), objetivo binario `NDVI < 0.20`; métricas reproducibles sobre 11 meses de prueba. No se han obtenido etiquetas independientes de identificación de cultivo, rendimiento o validación espacial para Chalhuas. La comparación andina es agronómica **exploratoria**. NASA POWER/SMAP/GPM/ERA5 son productos regionales, no sensores instalados en la parcela. Las guías FAO-56 (`ETc = Kc × ET0`) estiman evapotranspiración del cultivo, no la cantidad efectivamente bombeada o entregada como riego.
