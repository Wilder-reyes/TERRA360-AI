# Netlify + Render — despliegue TERRA360 AI (demo)

## Estado de los servicios

- GitHub privado: `Wilder-reyes/TERRA360-AI`, rama `main`
- Backend FastAPI: `https://terra360-api.onrender.com` — Render Free
- Frontend Netlify: la URL de producción se obtiene del panel de Netlify; una URL del tipo `<hash>--<nombre>.netlify.app` identifica una compilación específica, mientras `https://<nombre>.netlify.app` suele ser la URL de producción del sitio.

## Conexión automática, sin exponer credenciales

El archivo `netlify.toml`, en la raíz del repositorio, configura:

```toml
[build]
base = "frontend"
command = "npm run build"
publish = "dist"

[[redirects]]
from = "/api/*"
to = "https://terra360-api.onrender.com/api/:splat"
status = 200
force = true

[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

React en modo producción usa rutas relativas como `/api/arie/catalog`, que Netlify redirige de forma transparente al servidor Render. **No configures `VITE_API_URL` en Netlify para este esquema**; si lo añadiste, elimínalo y ejecuta un nuevo deploy para evitar que el navegador intente acceder directamente a Render.

Se puede publicar la interfaz sin claves; `EARTHDATA_TOKEN` se configura solo en Render como variable privada. El Blueprint desactiva las descargas GPM de gran tamaño (`GPM_DOWNLOADS_ENABLED=false`) para proteger el hosting gratuito, mientras NASA POWER y Planetary Computer siguen siendo públicos.

## Comprobación de acceso público (bloqueo detectado)

GitHub Actions recibió **HTTP 401** al abrir el sitio Netlify, aunque Render contestó correctamente. Si la web se abre mientras tienes sesión en Netlify, eso no prueba que los jueces puedan entrar. Ve a Netlify → **Project configuration → General → Visitor access → Edit visibility → Production visibility → Public** y guarda. Comprueba la URL en ventana privada sin iniciar sesión. No es un error que pueda resolverse cambiando GitHub.

## Comprobación después del deploy

1. Abre la dirección de producción de Netlify.
2. Comprueba `https://<nombre-real>.netlify.app/api/health`: debe devolver un JSON con `status: ok` desde FastAPI, **no HTML**. Si devuelve HTML, Netlify no aplicó la regla del proxy.
3. Comprueba `https://<nombre-real>.netlify.app/api/arie/catalog`: debe devolver JSON del catálogo.
4. Ingresa a la web y selecciona un punto del mundo. Comprueba que NASA POWER responda y se pueda evaluar la rotación.
5. Si Render está inactivo (plan gratuito), la primera solicitud puede tardar y a veces es necesario reintentar después de que la instancia arranque.

## Problemas frecuentes

- **JSON sustituido por HTML:** confirma que Netlify desplegó el commit con la regla `/api/*` antes del fallback `/*`.
- **La web consulta Render directamente:** elimina `VITE_API_URL` en Netlify y vuelve a desplegar.
- **`503` para GPM:** desactivado intencionalmente para evitar gastos y abuso. No equivale a un token incorrecto.
- **`502` o `504`:** revisa el estado y logs de Render; la primera activación del plan Free puede ser lenta.
- **Token NASA:** no lo compartas por chat, no lo pongas en Netlify, y no lo confirmes copiando su valor.

## Seguridad y honestidad científica

- Datos NASA de cuadrícula no son mediciones directas dentro de la parcela.
- ARIE ofrece comparaciones estructurales y advertencias: no certifica rendimientos ni ahorro cuantitativo de agua.
- Se debe verificar el sitio real en navegador y consultar la API antes de describir la demo como plenamente operativa.

Fuentes: https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/ ; https://docs.netlify.com/build/configure-builds/file-based-configuration/
