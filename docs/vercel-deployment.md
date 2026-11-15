# BIOTEX v0.26 — despliegue Vercel estático + API Render

## Configuración requerida del proyecto terra360-ai

Vercel → **Project → Settings → Build and Deployment**:

| Campo | Valor |
| --- | --- |
| Git | `Wilder-reyes/TERRA360-AI`, branch `main` |
| **Root Directory** | **`frontend`** |
| Framework Preset | **Vite** |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Serverless Functions | **Ninguna** |

`frontend/vercel.json` define el frontend estático y dos reglas de reescritura: `/api/:path*` hacia `https://terra360-api.onrender.com/api/:path*` (primera) y el resto hacia `/index.html` (SPA). El `vercel.json` de la raíz admite además desplegar si Root Directory sigue siendo la raíz del monorepositorio: construye exclusivamente `frontend` y usa `frontend/dist`. La opción recomendada es siempre **Root Directory = frontend** para no incluir archivos Python ni evidencias NASA en el proyecto Vercel.

**No crear un servicio backend en Vercel.** No almacenar `EARTHDATA_TOKEN`, archivos NetCDF, dependencias Rasterio o modelos Python allí. `VITE_API_URL` no es necesario en producción: el navegador usa rutas relativas `/api/` que el CDN reescribe a Render.

## Comprobaciones después de publicar

1. `https://terra360-ai-xi.vercel.app/release.json`: `release` = `v0.26-hls-trained-ai-barranca`.
2. `https://terra360-ai-xi.vercel.app/api/health`: JSON real del backend (nunca el HTML de React).
3. `https://terra360-ai-xi.vercel.app/api/rotation/ai-demo`: observaciones reales NASA HLS y evidencia del modelo.
4. Probar el flujo: seleccionar parcela Barranca → declarar cultivos → prioridades → comparar rotaciones → abrir evidencia IA.
5. Vercel → Usage debe mostrar **cero Functions nuevas** originadas por esta compilación estática. Los archivos JS/CSS están en `dist`; el modelo funciona en Render.

## Si sigue bloqueado: Functions Storage 11,27 GB / 10 GB

Cambiar el código evita **crear nuevas Functions**, pero **NO borra automáticamente** almacenamiento contabilizado de despliegues anteriores. Este exceso es del panel de Vercel, no del tamaño del repositorio GitHub. En Vercel → Usage → Functions Storage filtrar por el proyecto y localizar qué despliegues almacenan las Functions. Revisar Deployment Retention y borrar únicamente previews antiguos prescindibles; conservar la producción y un rollback válido. Los contadores pueden tardar en reflejar la liberación y, bajo Hobby, algunos límites requieren el siguiente periodo. Si permanece bloqueado tras depurar la retención, contactar soporte de Vercel con capturas de Usage y el mensaje exacto.

**Un redeploy manual puede seguir rechazado por la cuota**, incluso si el código ya es estático. No repetir builds fallidos sin comprobar primero el estado de Usage. No prometer recuperación inmediata.

Fuentes Vercel: https://vercel.com/docs/monorepos · https://vercel.com/docs/routing/rewrites · https://vercel.com/docs/plans/hobby · https://vercel.com/docs/deployment-storage/optimize
