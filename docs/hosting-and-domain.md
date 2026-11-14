# Dominio gratuito NASA Space Apps + GitHub Copilot + publicación de TERRA360

## Estado: preparado, no desplegado
Este repositorio no reclama el dominio ni activa cuentas de terceros. Debes canjear tú la oferta desde la página oficial **Global Offers → GoDaddy Registry / Free Domain and Website Hosting → Claim Offer**. El programa redirige a Porkbun. Comprueba que el dominio no sea premium y lee los costos de renovación antes de confirmar. No compartas contraseñas, tarjetas, credenciales ni token NASA en el chat.

## Arquitectura correcta: dos servicios
- **Dominio** registrado con el cupón de NASA Space Apps. Dos opciones para web React compilada: (A) hosting estático incluido en la oferta de Porkbun, sujeto a sus condiciones; (B) GitHub Pages (el workflow está incluido).
- **Backend FastAPI/Python** en un hosting Python o contenedores (Render, Fly.io, una VM, etc.) que soporte Python, memoria, HTTPS y tráfico saliente para NASA. **Porkbun Static Hosting por sí solo no ejecuta la API FastAPI**.
- Para la versión pública, usar `https://...` para frontend y backend, nunca `http://localhost:8000`.

## 1. Reclamar la oferta
1. Entra a tu cuenta NASA Space Apps y abre **Global Offers**.
2. Localiza **GoDaddy Registry — Free Domain and Website Hosting** y pulsa **Claim Offer**.
3. En la página de Porkbun, busca tu nombre de dominio y comprueba si es elegible para un año gratuito. No des por hecho que un nombre concreto está disponible.
4. Confirma la oferta únicamente tras revisar términos, renovación y hosting incluido.

## 2. Publicar la API Python
1. Crea un repositorio privado/público de GitHub, sube este código **sin `.env`**.
2. Despliega el Dockerfile de `backend/` en un proveedor compatible con Python. Incluí `render.yaml` como configuración opcional; comprueba precios y límite de recursos antes de dar de alta el servicio.
3. Configura `CORS_ORIGINS=https://TU-DOMINIO` (añade los subdominios exactos que uses).
4. En la demostración pública puedes dejar `GPM_DOWNLOADS_ENABLED=false` para evitar descargas costosas y repetidas de granulares NASA no protegidas. NASA POWER y el catálogo STAC seguirán disponibles.
5. Configura `EARTHDATA_TOKEN` como secreto **en la plataforma del backend solamente** cuando habilites GPM; nunca en un archivo frontend o acción de despliegue público.
6. Comprueba `https://DIRECCION-API/api/health`, `/docs`, `/api/environment/planetary-computer/scenes?latitude=-13.32175&longitude=-71.95605` (la localidad es solo un ejemplo de prueba; no se usa por defecto).

## 3A. Opción GitHub Pages con dominio propio (preparada)
1. En GitHub → repositorio → Settings → Pages, elige **GitHub Actions** como fuente.
2. En **Settings → Secrets and variables → Actions → Variables**, añade:
   - `PUBLIC_API_URL` = dirección **HTTPS** del backend, por ejemplo `https://api.ejemplo.com` (dato público, no secreto).
   - `PUBLIC_DOMAIN` = tu dominio realmente registrado, por ejemplo `terra360.ejemplo.com`, sin `https://`. Este flujo exige un dominio propio porque no está configurado el despliegue a subdirectorios de GitHub Pages.
3. En el proveedor DNS crea los registros que GitHub Pages indique para tu nombre exacto. No inventes direcciones IP; sigue la documentación actual.
4. Ejecuta el workflow `.github/workflows/pages.yml`. Hace `npm ci`, `npm run build`, publica `frontend/dist` y añade `CNAME` solo si existe `PUBLIC_DOMAIN`.
5. Comprueba HTTPS y la comunicación con tu API; si falla CORS, revisa `CORS_ORIGINS` del backend.

**Advertencia:** el frontend se genera para la raíz `/`; este workflow asume que se publicará en un dominio propio. Para usar el subdirectorio `usuario.github.io/repositorio` sin dominio, habría que ajustar `base` y favicon en Vite.

## 3B. Opción hosting estático de Porkbun
1. Tras canjear el dominio y el alojamiento **si realmente está incluido**, compila en Windows:
```powershell
cd frontend
$env:VITE_API_URL="https://TU-BACKEND-HTTPS"
npm.cmd ci
npm.cmd run build
```
2. Sube **el contenido** de `frontend/dist/` al directorio público del hosting, no el código `.tsx`, backend ni `.env`.
3. Comprueba rutas, favicon, HTTPS y CORS. Si el hosting no tiene rewrite de rutas, la aplicación actual usa un solo HTML y navegación interna, así que no necesita rutas servidor adicionales.

## 4. Usar GitHub Copilot desde Visual Studio Code
1. Abre VS Code, inicia sesión en GitHub e instala la extensión oficial GitHub Copilot si no está instalada.
2. Activa Copilot Free según las opciones ofrecidas en tu cuenta. El plan tiene límites: revisa el panel actual de Copilot para evitar gastos.
3. Abre la raíz del repositorio; Copilot recibe las reglas de `.github/copilot-instructions.md`.
4. Para revisar una modificación pide: «Revisa TERRA360 siguiendo `.github/copilot-instructions.md`, ejecuta primero las pruebas y no inventes indicadores agrícolas».
5. Puedes utilizar `.github/prompts/check-science.prompt.md` para auditoría de decisiones.
6. El plugin de GitHub en ChatGPT, si lo conectas, permite colaborar con información del repositorio; no equivale a activar ni ejecutar GitHub Copilot automáticamente.

## 5. Calidad y seguridad
- GitHub Actions `ci.yml` ejecuta tests Python, tests JS y build Vite en Linux; no requiere credenciales NASA.
- Ninguna credencial viene en el ZIP; revisa los archivos antes de cualquier push público.
- Al desplegar, añade control de abuso/rate-limiting, monitorización y cache antes de habilitar APIs costosas a usuarios anónimos.
- Para un demo de jueces: mostrar datos NASA y Satélite solo con operaciones explícitas, limitaciones científicas y capacidad de abstención de ARIE AI.

Referencias: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site ; https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages ; https://code.visualstudio.com/docs/setup/copilot ; https://planetarycomputer.microsoft.com/docs/
