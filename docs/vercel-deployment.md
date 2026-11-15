# Despliegue manual de BIOTEX — configuración vigente

No se ha publicado esta rama ni se ha configurado un backend nuevo. No utilizar los proyectos o dominios históricos como dependencia.

## Frontend nuevo en Vercel

1. Antes de vincular GitHub, revisar las integraciones antiguas indicadas abajo. Un futuro push podría activarlas aunque estos archivos se hayan eliminado.
2. Crear manualmente un proyecto NUEVO. **Root Directory = frontend**, framework Vite, instalación `npm ci`, build `npm run build`, salida `dist`.
3. La única configuración es `frontend/vercel.json`, con `frontend/.vercelignore` para excluir tests, caches y archivos locales. No hay configuración Vercel en la raíz del monorepositorio, funciones Python, blueprint Render ni publicación GitHub Pages.
4. Configurar `VITE_API_URL` con el origen HTTPS del backend NUEVO, sin `/api`, ruta, query, usuario ni contraseña. Ejemplo reservado: `https://api.biotex.example`; es documentación, no un servicio disponible.
5. Volver a construir tras cambiar la variable: Vite incorpora su valor en el JavaScript público. Nunca poner NASA Earthdata, claves R2/S3, contraseñas ni tokens en `VITE_*`. La configuración permite exponer únicamente VITE_API_URL y valida su formato durante el build.
6. Publicar solo cuando el usuario lo decida. Esta etapa no ejecuta estos pasos en ninguna cuenta externa.

La aplicación tiene una sola ruta de documento `/`, con cuatro pasos internos. No requiere una reescritura SPA a páginas adicionales. **No se incluye proxy `/api` ni reescritura hacia un proveedor anterior.** En producción se utiliza directamente `VITE_API_URL`; si está vacía, las peticiones son de mismo origen y necesitan un proxy que el operador configure expresamente. En un proyecto estático nuevo sin ese proxy, no hay API. No interpretar el HTML o un error 404 como respuesta de FastAPI.

Si en el futuro se elige un proxy, debe configurarse hacia el backend NUEVO, antes de cualquier fallback HTML, mantener métodos y códigos HTTP y probar `/api/health`. Esto no está configurado en el repositorio ni es requisito para el modo directo recomendado.

## Backend independiente

- Ejecutar Python/FastAPI fuera del frontend estático. Conservar `backend/Dockerfile` si el nuevo proveedor admite contenedores; no presupone una instancia contratada ni un dominio.
- Instalar `backend/requirements.txt`. Mantener las credenciales solo en variables privadas del backend o en `backend/.env` local ignorado. Para cargarlo completo al iniciar localmente, usar `uvicorn --env-file backend/.env` además de las opciones de app indicadas abajo. `backend/.env.example` contiene únicamente nombres/ejemplos vacíos.
- Definir `CORS_ORIGINS` con el origen exacto del frontend nuevo. Los orígenes locales por defecto no habilitan por sí solos al frontend de producción. No usar `*` para reemplazar la revisión de orígenes.
- Configurar almacenamiento/caché y Earthdata únicamente cuando sea necesario. No habilitar descargas públicas grandes sin límites. Las API con datos ausentes deben abstenerse, no rellenar valores.
- Inicio local, desde la raíz: `python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000` usando el entorno virtual.
- Frontend local: copiar `frontend/.env.example` a una configuración local ignorada y ejecutar `npm run dev` en frontend. Ejemplo productivo sin credenciales: `frontend/.env.production.example`.

## Conexiones externas que el propietario revisará manualmente

Borrar archivos Git **no revoca** instalaciones, autorizaciones ni integraciones externas. No se consultó ni modificó el estado de esas cuentas en esta etapa.

- En Vercel: proyectos anteriores vinculados al repositorio, rama de producción, despliegues automáticos/preview, Deploy Hooks, variables, dominios y autorización de GitHub App.
- En Netlify y Render: sitios/servicios anteriores vinculados, auto-deploy, webhooks, variables y acceso al repositorio. La existencia de esos recursos no está confirmada aquí.
- En GitHub: integraciones instaladas, webhooks, secretos, environments, Pages y workflows habilitados. Aquí se retiraron el workflow de Pages y el smoke a producción antigua; otros workflows científicos se conservaron y no se ejecutaron remotamente.
- DNS y dominios antiguos: revisar a qué proyecto apuntan antes de asignarlos. No se borraron proyectos externos ni se modificaron permisos o registros DNS.

## Verificación posterior, solo por decisión manual

Tras configurar realmente servicios nuevos, la comprobación ligera requiere ambas URL de forma explícita:

```sh
python scripts/smoke_configured_backend.py --site https://biotex.example --api https://api.biotex.example
```

El script hace GET a release.json y /api/health; no contiene dominios reales predeterminados, credenciales, entrenamiento ni descargas de imágenes. No se ejecutó contra servicios externos en la etapa 1. Las pruebas locales de UI usan respuestas de prueba y no certifican NASA, una integración de cuenta ni disponibilidad productiva.
