# Publicación del proyecto BIOTEX en el repositorio ACTUAL

**Repositorio de prueba:** [`Wilder-reyes/TERRA360-AI`](https://github.com/Wilder-reyes/TERRA360-AI). **Identidad pública de producto:** NSPACE BIOTEX. **No crear otro repositorio en esta fase.** El nuevo proyecto de Vercel importará el repositorio actual después de publicar el paquete acumulado.

## Estado y límites antes de publicar

El paquete incluye las etapas 0 a 8 como **candidato de pruebas**. El modelo HLS validado corresponde solo a Barranca; Chalhuas no tiene un modelo local validado. La UI puede arrancar en Vercel estático, pero los análisis necesitan un backend FastAPI externo con CORS. No se certificó el build Vite, Playwright ni la suite Python completa en el entorno de creación del ZIP por dependencias npm/Python faltantes. **La publicación en GitHub no equivale a certificar el despliegue.**

## Cómo publicar el código en `main` conservando todo el historial

1. Descomprime el ZIP actualizado en `Descargas/BIOTEX-revision` o cualquier carpeta nueva. Requiere Git, Python y Node.js 22+ con `npm.cmd` y credenciales GitHub para `git push`.
2. Abre PowerShell en la carpeta descomprimida y ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish_current_repo.ps1 -Publish
```

El script clona `Wilder-reyes/TERRA360-AI` (o reutiliza un clon limpio) y **comprueba que `main` sigue en `28359f8`**, la versión más reciente revisada, que incorpora `backend/app/data/imerg_basin_seed.json` desde el PR #41. El script **preserva expresamente este nuevo archivo científico aunque no esté en el ZIP anterior**. Si avanzó, se detiene para no sobrescribir trabajo de terceros. Trae `main` sin reescribir su historia, elimina los archivos versionados obsoletos, copia los archivos del release, ejecuta el entrenamiento reproducible HLS y la clasificación, instala dependencias frontend, prueba y compila. **Si falla cualquiera de esas comprobaciones, se detiene ANTES de hacer commit/push.** Solo entonces crea un nuevo commit sobre `main` y hace push normal, **nunca force push**. La primera ejecución requiere conexión de red para npm y GitHub.

Pruebas científicas y navegador adicionales (recomendadas para certificar antes de producción):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish_current_repo.ps1 -Publish -RunBackendTests -RunBrowserTests
```

Nota: ejecutar ambos comandos reutiliza la misma carpeta Git temporal. El primer comando deja un checkout con el commit publicado; el segundo puede validar nuevamente aunque no haya diferencias.

## Limpieza de ramas, después de publicar y verificar CI

Hay 32 ramas al inicio de esta revisión. `main` no se borra, **`David`** se preserva y se protegen todas las ramas con PR abiertos. En la revisión del 15 de noviembre había dos: `feat/biotex-v026-trained-nasa-model-reproducible` (#33) y `plan/ml-dl-agricultural-decisions` (#20). El script vuelve a consultar el estado actual de GitHub; **si no puede consultarlo, se detiene**.

```powershell
# Requiere GitHub CLI y sesión: gh auth login
powershell -ExecutionPolicy Bypass -File .\scripts\prune_legacy_branches.ps1
# Revisar cuidadosamente el listado. Después:
powershell -ExecutionPolicy Bypass -File .\scripts\prune_legacy_branches.ps1 -Execute
```

Antes de borrar, crea y verifica un **git bundle** local con todas las referencias para recuperación. El backup se guarda en `Documents/BIOTEX-github-release/branch-backups`. Borra solo ramas que no sean `main`, `David`, parte de un PR abierto ni `release/*`; considera las demás ramas de proyectos históricos como candidatas obsoletas. La conservación de un backup evita pérdida irreversible del historial aunque se borren las refs remotas.

**No eliminar ramas antes de subir y comprobar la versión 0–8 en `main`.**

## Nuevo Vercel desde el mismo GitHub

1. En Vercel selecciona **Add New → Project**, importa **`Wilder-reyes/TERRA360-AI`** y crea un **proyecto nuevo**, no reconectes el anterior.
2. Framework **Vite**; Root Directory **`frontend`**; Install Command **`npm ci`**; Build Command **`npm run build`**; Output Directory **`dist`**.
3. **`VITE_API_URL`**: dominio HTTPS **real del backend FastAPI** sin `/api`, por ejemplo `https://<TU-BACKEND>`; no copies el dominio `.example` de la documentación. Si todavía no existe backend, el frontend puede visualizarse, pero las rutas `/api` no funcionarán en Vercel estático.
4. En el backend, configurar `CORS_ORIGINS` con el origen exacto del nuevo proyecto Vercel y credenciales NASA/S3 solo en secretos de servidor. No poner tokens en `VITE_*`.
5. Comprueba en GitHub Actions los workflows **NSPACE BIOTEX quality checks** y **farmer interface browser checks**. Si fallan, corrige antes de anunciar que está listo para producción.
6. Desde el navegador real, probar: dibujo y edición de parcelas, subparcelas, recuperación, BIO, capas NASA, comparación de rotaciones, IA solo para Barranca, croquis por campaña y PDF A4 18 mm.

Vercel permite elegir la carpeta raíz al importar un repositorio existente. El backend **no está** desplegado automáticamente por importar el frontend. El despliegue nuevo **no ha sido creado** en esta entrega.
