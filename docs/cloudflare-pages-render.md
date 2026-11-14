# TERRA360 AI — Publicación gratuita: Render + Cloudflare Pages

Esta guía publica **dos servicios independientes** y no introduce secretos en el repositorio.

## Paso 1. Backend en Render (plan gratuito)

En Render: **New → Blueprint**; conecta el repositorio privado `Wilder-reyes/TERRA360-AI`, rama `main`; usa el archivo `render.yaml` en la raíz. Render creará el servicio web Docker `terra360-api` con `plan: free`. Confirma que el panel indica un precio de **US$0** antes de aprobar el servicio. La instancia gratuita tiene 512 MB RAM, puede dormir tras inactividad y tiene limitaciones; revisa el panel de costos.

Si la interfaz pide variables, agrega:
- `EARTHDATA_TOKEN`: token privado NASA Earthdata, **solo en Render**. No lo publiques ni lo pegues en ChatGPT. Puede dejarse vacío si las consultas protegidas de GPM no se usarán.
- `CORS_ORIGINS`: una vez creada Cloudflare Pages, coloca la URL HTTPS **exacta** de tu sitio, por ejemplo `https://terra360-ai.pages.dev`. No incluyas barra final.
- `GPM_DOWNLOADS_ENABLED=false`: evita descargas de archivos grandes y abuso en la demo pública. NASA POWER y el catálogo satelital público siguen disponibles sin Earthdata.

Cuando termine el deploy, copia tu URL real `https://<servicio>.onrender.com` y comprueba `https://<servicio>.onrender.com/api/health`. No inventes la URL si el proveedor asigna otro nombre.

Si Render no permite configurar todavía el CORS final, puedes actualizar `CORS_ORIGINS` después, desde **Environment**. No uses `*` con credenciales. Comprueba que `/docs` cargue.

## Paso 2. Frontend en Cloudflare Pages (subdominio gratuito)

En Cloudflare: **Workers & Pages → Create application → Pages → Connect to Git**, autoriza **solo** el repositorio privado `Wilder-reyes/TERRA360-AI` y elige rama `main`.

Configura:
- Framework: `React (Vite)` o `Vite`.
- Root directory (advanced): `frontend`.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Variable de entorno de **build**: `VITE_API_URL=https://<TU-SERVICIO-RENDER>.onrender.com` (URL pública del backend, **no** token NASA).

La plataforma asignará una URL `https://<nombre-disponible>.pages.dev`. Esa dirección no se puede conocer antes de crear el proyecto.

## Paso 3. Hacer que ambas partes se comuniquen

En Render → servicio `terra360-api` → **Environment**, cambia `CORS_ORIGINS` por la URL final de Pages, por ejemplo `https://terra360-ai.pages.dev`; guarda para que Render aplique los cambios.

Abre la URL pública de Pages; elige un punto **tú mismo**, luego verifica:
- `GET /api/health` responde correctamente en Render.
- La web carga el catálogo agrícola desde Render.
- La consulta NASA POWER devuelve datos cuando eliges un punto.
- La evaluación ARIE AI responde sin inventar ahorro de agua ni rendimiento.

Si necesitas habilitar GPM en una demo cerrada, revisa primero un control de uso/autorización, caché y cuotas, ya que descargar archivos NASA sin límites desde endpoints públicos puede sobrecargar el servidor gratuito. Una variable `EARTHDATA_TOKEN` válida no sustituye esos controles.

## GitHub Actions

`.github/workflows/ci.yml` comprueba Python y frontend después de cada push.
`.github/workflows/pages.yml` publica **GitHub Pages** únicamente por ejecución manual (opción distinta a Cloudflare Pages). No se ejecuta automáticamente porque exige las variables `PUBLIC_API_URL` y `PUBLIC_DOMAIN`; no afecta al despliegue Cloudflare.

## Seguridad y limitaciones

- No subas `.env`, `.venv`, `node_modules`, tokens NASA, variables de servidor ni credenciales.
- Los datos NASA de cuadrícula no equivalen a sensores de parcela.
- Servicio gratuito puede iniciar lentamente, o fallar por límites de memoria o cuotas.
- El predictor experimental todavía no está validado; el motor ARIE AI aplica restricciones y genera alternativas explicadas, no garantiza rendimiento ni prescribe riego.
- La interfaz funciona sin tener seleccionada por defecto ninguna localidad.

Referencias:
- https://render.com/docs/infrastructure-as-code
- https://render.com/docs/blueprint-spec
- https://render.com/docs/configure-environment-variables
- https://developers.cloudflare.com/pages/configuration/monorepos/
- https://developers.cloudflare.com/pages/get-started/git-integration/
