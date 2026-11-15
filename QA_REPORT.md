> Documento histórico: no configura ni publica la versión actual. Consulte `docs/BIOTEX_ARCHITECTURE.md` y `docs/vercel-deployment.md`.

# TERRA360 AI v0.7 — Informe de calidad reproducible

Fecha de trabajo: 2026-11-13. Entorno de comprobación: Linux, Python 3.13.5 y Node 22.16; el usuario usa Python 3.12 y Windows en su máquina.

## Pruebas ejecutadas realmente

- **Backend: 68/68 tests Python `unittest` aprobados**, incluyendo 9 nuevas pruebas de búsqueda STAC simulada, validación de coordenadas, manejo de ausencia de escenas, no inferencia de NDVI y desactivación de descargas GPM públicas. Comando: `PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py' -q`.
- **Frontend: 6/6 tests Node aprobados** mediante `node --experimental-strip-types --test tests/*.test.mjs`. Son pruebas unitarias/regresión; no validan toda la experiencia interactiva en un navegador.
- **TypeScript: `tsc -b` completó sin errores** con el compilador global TypeScript 5.8.3. El `typescript` del ZIP anterior tiene binarios únicamente Windows en `node_modules`; se requiere `npm ci` en el ordenador de destino para compilar con sus dependencias reales.
- **API STAC: probada con respuestas HTTP simuladas (`httpx.MockTransport`)**, sin una llamada de red real a Microsoft Planetary Computer.
- **GitHub Actions CI y Pages:** workflows escritos; no ejecutados en GitHub porque no existe un repositorio autorizado ni un dominio reclamado.
- **Docker/Render:** configuración preparada; no desplegada ni probada en contenedor.

## Pendientes antes de una demostración pública

1. En Windows ejecutar `npm.cmd ci`, `npm.cmd run test`, `npm.cmd run build`, `npm.cmd run dev` y verificar el recorrido completo de 3 pasos en pantalla y teléfono.
2. Probar consulta STAC en vivo desde FastAPI y comprobar que la región elegida produce escenas cuando existe cobertura.
3. Validar NASA POWER, GPM IMERG y los límites de tráfico/tiempo en el hosting real.
4. Reclamar manualmente el dominio con NASA Space Apps → GoDaddy Registry/Porkbun; configurar DNS y HTTPS.
5. Desplegar el backend Python en un servicio separado y configurar CORS. Probar la web publicada desde otro dispositivo.
6. Hacer pruebas de comprensión con agricultores y revisión agronómica independiente de las rotaciones.
7. Entrenar y validar en datos reales cualquier modelo predictivo antes de usarlo para inferir riesgos en nuevas áreas; actualmente no existe predictor entrenado que gobierne las decisiones.

## Restricciones científicas

- El nuevo conector devuelve **metadatos** de escenas Sentinel-2, no calcula NDVI, no descarga reflectancia, no detecta plagas ni estima salud del suelo.
- ARIE AI es búsqueda combinatoria con restricciones, no un clasificador de rendimiento agrícola entrenado. Las decisiones permanecen condicionales a datos locales.
- Los satélites representan cuadrículas/escenas; no equivalen a muestras medidas de parcela.
- El catálogo de 5 cultivos andinos no garantiza adecuación fuera de regiones con información científica y validación local.

## Seguridad de la entrega

- No se incorporan `.env` privados, tokens de NASA, directorios `.venv`, paquetes `node_modules` ni datos descargados.
- Se habilita `CORS_ORIGINS` para dominios conocidos y `GPM_DOWNLOADS_ENABLED=false` en el ejemplo de despliegue público.
- El dominio, cuentas y servicios en la nube requieren intervención y autorización del titular. El ZIP no implica que estén contratados o activos.
