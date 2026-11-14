# Publicar TERRA360 AI en Netlify (sitio gratuito)

## Repositorio preparado

GitHub privado: `Wilder-reyes/TERRA360-AI` — rama `main`.

El archivo `netlify.toml` en la raíz ya configura el monorepositorio para compilar React + Vite:

| Opción Netlify | Valor efectivo |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `frontend/dist` (se define como `dist` en `netlify.toml`) |
| Node | `22` |
| Production branch | `main` |
| Framework | Vite / React |
| URL | Netlify asigna un `*.netlify.app` disponible |

El archivo versionado prevalece sobre los valores de construcción editados en la interfaz de Netlify. Si Netlify autocompleta otras rutas, utiliza la configuración anterior y evita duplicar `frontend/frontend`.

## Paso 1. Conectar el repositorio

1. En Netlify, pulsa el repositorio `Wilder-reyes/TERRA360-AI`.
2. Verifica `main` y la configuración descrita.
3. Pulsa la acción para desplegar el sitio cuando el plan seleccionado sea el gratuito.
4. Espera el resultado del deploy en el panel (no presupongas que ya está publicado).
5. Conserva la URL real `https://<nombre>.netlify.app`.

## Paso 2. Activar funciones reales (necesario antes de presentar la demo completa)

Netlify sirve **solo la interfaz estática React**. La API `FastAPI`, ARIE AI y las consultas NASA se ejecutan en un hosting Python independiente, por ejemplo Render con Docker:

- Publica `backend/Dockerfile` usando `render.yaml` en el repositorio.
- Obtén la URL real HTTPS de tu backend (`https://<servicio>.onrender.com`) y comprueba `/api/health`.
- Netlify → Site configuration → Environment variables: crea `VITE_API_URL` con esa URL HTTPS del backend **sin barra final**.
- Ejecuta un **nuevo deploy** de Netlify para que Vite inserte la URL pública en el JavaScript.
- Render → Environment: configura `CORS_ORIGINS=https://<nombre>.netlify.app` con el origen exacto, sin barra final; añade URLs de preview solo si realmente las utilizas y entiendes sus implicaciones.
- Prueba en la web: cargar catálogo, seleccionar ubicación, consultar NASA POWER y evaluar ARIE AI.

**Importante:** mientras no exista `VITE_API_URL`, el frontend se puede compilar y publicar, pero las consultas al backend **no funcionan**. No presentes el sitio estático como una demo integrada hasta completar estos pasos.

## Token NASA Earthdata

- Guarda `EARTHDATA_TOKEN` **exclusivamente** en las variables privadas del backend (Render), nunca en Netlify, GitHub, JavaScript, `netlify.toml` o capturas.
- NASA POWER y Planetary Computer STAC no requieren ese token en estas rutas.
- El Blueprint usa `GPM_DOWNLOADS_ENABLED=false` porque la descarga de granulares GPM para visitantes anónimos puede agotar el servidor.
- Habilita descargas GPM solo después de controlar concurrencia, límites de uso, almacenamiento y acceso protegido; un token no protege por sí solo un endpoint público.

## Diagnóstico

- Error `Failed to fetch` o `/api/arie/catalog` 404: define `VITE_API_URL` y vuelve a desplegar.
- Error CORS en navegador: añade exactamente el dominio Netlify a `CORS_ORIGINS` en Render.
- Error 502/503: revisa salud de API, límites de hosting y disponibilidad de datos externos.
- Si Netlify muestra `publish directory not found`, verifica que `dist` se resuelva desde la carpeta `frontend`.

Fuentes oficiales:
- https://docs.netlify.com/build/configure-builds/monorepos/
- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/build/configure-builds/environment-variables/
