# BIOTEX — Arquitectura vigente desde la etapa 1

Una aplicación React/Vite y una API FastAPI independiente. No hay despliegue nuevo configurado ni servicio antiguo implícito. La rama local parte del commit de auditoría `ea75de7`; no se ha publicado.

## Recorrido único

`main.tsx → BiotexFarmerApp`: **Mi terreno → Mis cultivos → Mis prioridades → Mi plan agrícola**. Los antiguos parámetros `vista` y `pilot` no seleccionan aplicaciones. Se conserva `lang=en` como preferencia de idioma.

| Responsabilidad | Implementación conservada o consolidada |
|---|---|
| Estado de recorrido, parcela, idioma y selección | BiotexFarmerApp; un header, una navegación, un mapa de selección |
| Geometría, importación y fechas | geometry, rotationCalendar, manualRotation; dibujo o un único contorno GeoJSON sin descartar vértices/holes silenciosamente |
| Capas de referencia | Mapa común: foto aérea, relieve, GIBS vegetación/lluvia, fecha/opacidad, ahorro de datos; recuadro IMERG expresamente esquemático |
| Contexto y consultas científicas opcionales | FieldEvidence en Mi terreno: POWER, SRTM, ERA5-Land/ECOSTRESS dentro del ámbito andino; ParcelNDVI/SentinelSeries, GpmPolygon, SmapRegional, GaezRaw y SatelliteScenes |
| Historial, catálogo y foto | Historial confirmado por el agricultor; CropReference informa sin agregar automáticamente cultivos; CropPhotoGuide conserva solo una vista local, sin subir ni identificar fotografías |
| Comparación costera | Funciones existentes en BiotexFarmerApp, evidencia de FarmerAIEvidence/FarmDecisionEvidence y SatelliteEvidence; calendario relativo de 24 meses |
| Comparación Mantaro | AndesRotation, dentro de los mismos pasos y con la misma parcela/idioma; cuatro campañas exploratorias, subparcelas verificadas por API, guardado e impresión; catálogo/ejemplo separado en andesProfile |
| Tutorial | BioTour compartido; no es chatbot ni generador de consejos |

La selección del perfil usa las coordenadas del centro del contorno. Es una compuerta aproximada heredada del ámbito de estudio, **no valida aptitud agronómica**. El ámbito Mantaro no recibe el calendario costero ni el modelo de Barranca. Fuera de los ámbitos soportados se permite explorar la parcela y sus datos, sin habilitar recomendaciones locales inventadas. Las series HLS y el modelo siguen limitados por sus propios controles de calidad y coincidencia de parcela.

Se mantienen las claves de guardado `biotex-farm-v1` y `biotex-chalhuas-v1`. Los datos costeros conservan migración de fechas; los proyectos andinos pueden recuperar su contorno desde Mi terreno y sus campañas desde Mis cultivos. Las subparcelas recuperadas deben pasar la validación del backend; no se restauran como resultado científico calculado. No se borró localStorage del usuario.

## Seis responsabilidades científicas

```text
Obtención → Control de calidad → Geoespacial → Inferencia → Comparación → Presentación
                 datos faltantes y abstenciones se conservan en toda la cadena
```

| Capa | Módulos y límites |
|---|---|
| 1. Obtención | connectors/nasa_power, earthdata, gpm_imerg, planetary_computer y ecostress. El nuevo conector CMR solo obtiene metadatos. HLS/SMAP/ERA5 y archivos privados conservan sus adaptadores existentes en services para no alterar productos ni procedencia |
| 2. Calidad | quality/power normaliza fechas, variables ausentes, -999, no finitos y booleanos como desconocidos; quality/ecostress conserva metadatos sin generar temperaturas. SCL/Fmask y QA de productos siguen en las funciones específicas de sentinel_ndvi, hls_history y smap_* |
| 3. Geoespacial | geospatial/parcels: área geodésica, contención, solapamientos e IDs únicos; geospatial/terrain: muestreo/gradiente SRTM. Los lectores ráster existentes conservan recorte/reproyección y verificación de cobertura |
| 4. Inferencia | services/field_shift_ai: artefacto congelado, fingerprint y abstención fuera de la parcela exacta. ml/rain_model y entrenadores siguen experimentales. No se mezclan datos sintéticos con entrenamiento real |
| 5. Comparación | services/rotation_engine y andes_rotation mantienen reglas distintas. application/rotation compone comparación, inferencia y evidencia; no importa FastAPI ni realiza consultas HTTP. El router obtiene el contexto y traduce errores a HTTP |
| 6. Presentación | api/* y schemas/*: transporte/contratos; React muestra procedencia, incertidumbre y abstenciones. La UI no reimplementa cálculos científicos Python |

No se hizo una migración masiva de los adaptadores científicos existentes: sus funciones de lectura, máscaras y cómputo siguen agrupadas por producto cuando moverlas pondría en riesgo la reproducción. La separación física nueva cubre QA POWER/CMR, geometría y composición; el inventario identifica las funciones especializadas restantes y sus límites. Las pruebas de arquitectura impiden dependencias HTTP desde las nuevas capas puras.

## API, datos y operación

- Se conservan las 39 rutas distintas de OpenAPI y sus métodos, incluyendo ARIE y las rutas históricas que usan tests/scripts científicos. Retirar una página no demuestra que su endpoint esté sin dependencias. Inventario: `audit/stage-1-endpoints.json`.
- Se conservan íntegros los siete JSON HLS, el artefacto Barranca, catálogos FAO/cultivos, evidencia ANA y scripts de entrenamiento/reproducción. Los datos de entrenamiento no se vuelven a descargar ni se reetiquetan.
- `TERRA360_CACHE_DIR` permite ubicar el caché HLS; por defecto usa backend/.cache. `TERRA360_HISTORY_WAIT` controla la espera, por defecto 20 segundos. Ya no se altera el procesamiento Python por detectar VERCEL.
- Los cachés y descargas no se eliminan sin evidencia de dependencia/retención. `.cache`, backend/data, modelos experimentales y entornos locales siguen ignorados por Git. No son fuentes originales versionadas.
- `backend/Dockerfile` se conserva como forma opcional de ejecutar Python en un servicio independiente; no crea recursos ni identifica un proveedor. Python declarado 3.12; pruebas de esta laptop con 3.13.17. Docker Linux queda por comprobar si no está instalado.
- La configuración pública, CORS y los pasos manuales de integración están en [vercel-deployment.md](vercel-deployment.md).

## Depuración y compatibilidad

App, FarmerApp, RotationApp y ChalhuasPilotApp dejan de ser páginas. Sus capacidades y pruebas se trasladan según la tabla; GeoWorkspace/FarmerMap dejan de duplicar selección y navegación. El registro de cada archivo retirado y su SHA-256 previo está en `audit/stage-1-removed-files.json`. Git conserva el contenido anterior.

Los estilos costeros se fusionan respetando el orden de cascada; se retira CSS de páginas históricas. Los estilos andinos restantes se limitan a contenido regional. Se elimina la hoja global de las páginas antiguas y su descarga de fuentes remotas. El rediseño final Agricultural Dark Mode no se adelanta en esta etapa arquitectónica. Se conservan los avisos científicos y la impresión con márgenes A4 de 18 mm.

Las pruebas de las cuatro suites E2E se migran por capacidad: 12 del recorrido/evidencia costera, 7 andinas/tutorial/idioma/respuestas tardías, 8 de contexto/catálogo/impresión y 12 de herramientas/errores/fotos/configuración. Se añaden casos de geometría, URL pública, capas puras, idioma y respuesta tardía. Los tests de la antigua reescritura obligatoria se reemplazan por el contrato de una sola configuración y backend configurable; no se omite su cobertura.
