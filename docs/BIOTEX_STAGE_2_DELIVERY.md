# BIOTEX — Entrega de la etapa 2 (copia de ChatGPT)

**Fecha:** 2026-11-15 (zona horaria America/Lima).
**Base recibida:** archivo `BIOTEX-etapas-0-1.zip`, 319 archivos versionados; commit fuente reportado por Codex `c2023c330ca44a658e24d36511d2bf172dd7a3b9`.
**Alcance:** arquitectura visual definitiva, navegación existente de cuatro pasos, selección y edición de terreno, subparcelas y tutorial BIO.

## Implementación

- Nuevo `frontend/src/agricultural-dark.css` es la capa de diseño única para pantallas y la referencia canónica de los tokens `--bg-primary`, `--bg-surface`, `--bg-interactive`, `--text-primary`, `--text-secondary`, `--accent-primary`, `--accent-warning`, `--border-subtle`, radios y controles táctiles.
- La UI conserva la única aplicación `main.tsx → BiotexFarmerApp`, el flujo de cuatro pasos y la separación Costa/Mantaro; no se han recreado páginas antiguas ni alterado cálculos científicos.
- Inicio del mapa en la referencia regional de Chalhuas/Junín **sin parcela preseleccionada**. Los ejemplos previos Barranca/Chalhuas siguen siendo acciones explícitas y claramente etiquetadas.
- Búsqueda por nombre ya existente y nueva navegación por coordenadas. Dibujo, deshacer, cancelar, validación, GeoJSON y área aproximada preexistentes se conservan.
- Edición de vértices de parcela mediante selección de esquina, clic en mapa o coordenadas numéricas, con guardar/cancelar; la confirmación invalida análisis dependientes del contorno anterior.
- Subparcelas opcionales creadas por el agricultor, con prueba geométrica de contención, solapamiento, superficie y IDs. Se pueden borrar; se guardan y recuperan localmente con la parcela y se entregan al módulo regional andino existente.
- BIO conserva su mascota original (solo guía introductoria, nunca chatbot), agrega un recorrido sobre los cuatro pasos y respeta omitir, atrás, repetir, Escape y reducción de movimiento.
- Móvil: barra inferior de cuatro etapas, botones y campos ≥48 px, espacio inferior para evitar que la barra cubra el contenido. Tipografía, contraste y controles compartidos.
- NASA GIBS, capas satelitales y mapas no se recolorean con el tema. CSS oscuro limitado a `@media screen`; la impresión existente mantiene A4, tema claro y 18 mm.

## Evidencias y límites de validación

- **31 pruebas unitarias del frontend APROBADAS** con `node --experimental-strip-types --test frontend/tests/*.test.mjs`. Incluyen nueva geometría de subparcelas y regresión de tokens/contraste.
- Análisis sintáctico de tres archivos TS/TSX con TypeScript 5.8.3 global: **sin errores de parser**. No sustituye el typecheck completo.
- `tinycss2` analizó `agricultural-dark.css` y `biotex-farmer.css`: sin errores de parser de hoja.
- Se prepararon pruebas Playwright `frontend/e2e/stage2-field.spec.ts`, **no ejecutadas** en este entorno.
- `npm ci`: intentado, pero no finalizó; el entorno no resuelve `registry.npmjs.org`. **Build Vite y E2E no verificados** aquí, y deben ejecutarse antes de considerar esta etapa validada para release.
- Suite Python: 112 tests pudieron cargarse; 19 módulos de prueba no se importaron por dependencias científicas ausentes, principalmente `earthaccess`, `planetary_computer` y `s3fs`. No se modificó el backend ni se afirma aprobación de la suite aquí. La entrega original de Codex informa 257 pruebas Python aprobadas en su entorno configurado.
- Sin Git `.git` en el ZIP de origen: esta entrega es una instantánea de código editado, **no un commit**. El commit fuente de Codex no se modifica. Se entrega además `BIOTEX-etapa-2.patch` para aplicar cambios en la rama local original, si procede.
- Ninguna conexión externa, push o despliegue realizado. No se han alterado modelos, datasets ni métricas de IA.

## Verificación requerida en laptop con dependencias completas

Desde la carpeta raíz del repositorio actualizado:

```powershell
cd frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Luego, en el entorno Python configurado en la raíz:

```powershell
$env:PYTHONPATH='backend'
python -m unittest discover -s tests -p 'test_*.py'
```

Las nuevas pruebas E2E deben comprobarse visualmente en 360, 390, 768 y 1280 px y corregirse si detectan diferencias entre el navegador y la revisión estática. También deben revisarse contraste y controles de los paneles científicos perezosos a medida que cargan.

## Próxima etapa

**Etapa 3:** ingesta y visualización científica NASA/SENAMHI/INIA/ANA/MIDAGRI/FAO/ERA5-Land con contratos de fuente, periodo, unidad, resolución, QA y estado sin datos. Reutilizar `agricultural-dark.css` y los cuatro pasos sin rediseñarlos. No entrenar la IA durante esa etapa.
