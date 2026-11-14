# Mapa de aptitud agrícola regional

Implementado en la rama `plan/ml-dl-agricultural-decisions`. En el mapa: **Aptitud agrícola → cultivo → escenario de agua y manejo → Mostrar aptitud**. Se abre una ventana de 64 celdas alrededor de Calca; **Vista actual del mapa** permite consultar otras zonas de la cobertura preparada. El análisis usa el rectángulo de la vista, no los polígonos de parcela dibujados en otras herramientas.

## Base científica y alcance

Se reutiliza el modelo agroecológico publicado **FAO/IIASA GAEZ v5**, en lugar de entrenar un clasificador sin etiquetas locales. La capa integrada RES05-SIX combina evaluación agroclimática y edáfica: temperatura y lluvia históricas AgERA5, balance hídrico del cultivo, capacidad de almacenamiento de agua y profundidad del suelo, propiedades HWSD v2 y restricciones del terreno/pendiente. [Integración de módulos, FAO](https://github.com/un-fao/gaezv5/wiki/07.-Module-V-(Integration-of-climatic-and-edaphic-evaluation)), [evaluación de suelo y terreno](https://github.com/un-fao/gaezv5/wiki/06.-Module-IV-(Agro%E2%80%90edaphic-suitability)).

**No es humedad del suelo medida hoy.** La disponibilidad hídrica está modelada dentro de GAEZ; esta capa no contiene una lectura actual de humedad ni una explicación individual por factor en cada celda. Tampoco se mezclan humedad relativa NASA POWER y humedad del suelo.

- Periodo: **2001–2020**, histórico, HP0120/AGERA5/HIST. Publicación del conjunto FAO: 2025.
- Resolución original: **5 minutos de arco**, 1/12°, aproximadamente 9 km en Cusco; EPSG:4326. No se interpola ni se presenta precisión de parcela.
- Variable: **clases del índice de aptitud de toda la superficie de la celda**, no máscara de cultivos actuales, rendimiento, porcentaje cultivable o probabilidad de éxito.
- Cobertura preparada: rectángulo **[-74, -15, -70, -11]**, en orden oeste/sur/este/norte. Es una ventana de estudio en torno a Cusco, no un límite departamental ni cobertura nacional.
- Cultivos curados: **MZE**, maíz para grano (*Zea mays*); **WPO**, papa (*Solanum tuberosum*); **BRL**, cebada (*Hordeum vulgare*). Haba (*Vicia faba*) no tiene correspondencia verificada en este inventario; no se sustituye por Phaseolus. Maíz no implica validación de la variedad Blanco Gigante.
- Escenarios: **LRLM**, secano/insumos bajos; **HRLM**, secano/insumos altos; **LILM**, riego/insumos bajos; **HILM**, riego/insumos altos. El usuario debe elegir uno; no se infiere el régimen de la parcela. Los escenarios de riego no demuestran que exista agua o infraestructura.

Las dimensiones y códigos están documentados en el [inventario RES05 de FAO](https://data.apps.fao.org/catalog/dataset/514c92d5-9e01-4c70-814a-80ea1ca9fe6a/resource/768b08ad-be9c-427a-84be-3a3d6dd7835a/download/_readme_res05.xlsx) y la [guía GAEZ v5](https://github.com/un-fao/gaezv5/wiki/21.-GAEZ-v5-Platform-User-Guide).

## Clases, faltantes y superficies

El [catálogo específico RES05-SIX](https://data.apps.fao.org/catalog/dataset/514c92d5-9e01-4c70-814a-80ea1ca9fe6a) publica la leyenda de clases y licencia CC BY 4.0, y enlaza los originales del bucket público FAO. La evidencia de metadatos consultada el 14/11/2026 está en `backend/app/data/suitability/source-evidence.json`; es un extracto de campos de la respuesta CKAN, con hash del snapshot descargado. No se extrapola la licencia desde otra capa del catálogo.

| Clase original | Significado FAO | Grupo mostrado por TERRA360 |
| --- | --- | --- |
| 1 | SI > 85, muy alta | Apta |
| 2 | SI > 70, alta | Apta |
| 3 | SI > 55, buena | Apta |
| 4 | SI > 40, media | Moderada |
| 5 | SI > 25, moderada | Moderada |
| 6 | SI > 10, marginal | Poco apta |
| 7 | SI > 0, muy marginal | Poco apta |
| 8 | No apta | Poco apta |
| 0 | Sin datos | Sin datos, gris |
| 9 | Agua | Agua, azul |

Las tres agrupaciones son una simplificación **de TERRA360**, no tres clases oficiales nuevas de FAO. El índice SI resume la composición de aptitudes de la celda; no mide una tasa de acierto. Se conservan el código, etiqueta y fila/columna originales en cada polígono y su popup. Datos faltantes y agua nunca se convierten en aptitud baja ni alta.

Se dibujan **celdas nativas completas** que intersectan el rectángulo consultado. El contorno discontinuo identifica ese rectángulo. Los km² del resumen corresponden solo a las intersecciones con él, calculadas sobre una esfera de radio 6.371,0088 km y redondeadas; no son hectáreas aptas para cultivar. La cobertura porcentual representa la fracción del área consultada con clases terrestres 1–8, incluyendo en su denominador agua y faltantes. **No representa éxito del cultivo.**

## Resultado real del piloto

Ventana de 8 × 8 celdas alrededor de Calca, 2001–2020, escenario **LRLM**:

| Cultivo | Aptas | Moderadas | Poco aptas | Sin datos/agua |
| --- | ---: | ---: | ---: | ---: |
| Maíz | 0 | 0 | 64 | 0 |
| Papa | 0 | 3 | 61 | 0 |
| Cebada | 2 | 2 | 60 | 0 |

Son conteos de celdas regionales mixtas, no resultados de campo. En un valle estrecho pueden existir parcelas cultivadas dentro de celdas con índice bajo para toda su superficie. Por ello no se deduce que el agricultor deba abandonar una parcela ni se estiman rendimiento o rotación. La interfaz empieza con cebada para explorar las tres categorías presentes, pero exige seleccionar el escenario.

## API y reproducción

- `GET /api/agro/suitability/catalog`: cobertura, cultivos, escenarios, cinco factores documentados, limitaciones y fuentes.
- `POST /api/agro/suitability/map`: `crop_id`, `management` y `bbox` obligatorios. Responde GeoJSON, resumen, clase original y hashes de procedencia.
- Estados: `available`, `no_land_data`, `unsupported_crop`, `outside_coverage`; errores de entrada/extensión, HTTP 422; artefactos ausentes o corruptos, HTTP 503, sin mapa.
- Máximo **1.024 celdas** por solicitud; no se aceptan cajas invertidas, infinitos, NaN o cruces del antimeridiano. Se debe acercar el mapa para ampliar la consulta a otra zona.
- La API no descarga rasters, pesos ni utiliza Torch. Sirve doce extractos pequeños empaquetados con la aplicación; al primer acceso verifica SHA-256, ventana y clases, y mantiene una caché acotada.
- Los endpoints antiguos de código bruto de yuca continúan separados; no heredan una interpretación agronómica para parcelas.

Desde la raíz, con los requisitos normales del backend:

```bash
backend/.venv/bin/python scripts/prepare_suitability.py --download
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s tests -p 'test_suitability.py' -q
```

El preparador verifica doce GeoTIFF públicos contra hashes fijados, CRS, transformación, dimensiones, tipo, no-data y códigos. Extrae sin remuestreo la ventana nativa `[col=1272, row=1212, width=48, height=48]`. Los originales se guardan en `backend/data/gaez-v5/` excluido de Git; los extractos y manifiesto quedan en `backend/app/data/suitability/`. Sin `--download` se reproducen desde originales locales. Un cambio de hash requiere revisión explícita de la fuente, nunca actualización silenciosa. La atribución identifica a FAO/IIASA y la extracción/agrupación modificada por TERRA360.

Se comprobaron geografía, límites de celdas, clases originales, cobertura incompleta, agua, integridad de los doce extractos, rechazo de extensiones grandes y cambios de controles en navegador. Estas pruebas verifican software y datos, **no precisión agronómica**. Faltan observaciones independientes de suelo, variedades, manejo y rendimiento para validar la utilidad local y decidir una expansión.

Comprobación de la entrega: **201 pruebas de backend, 3 suites de frontend y 20 pruebas de navegador aprobadas**, compilación de producción correcta. Revisión adicional en Chromium con la API local y las capas reales: 64 celdas del piloto, encuadre completo y sin desbordamiento en escritorio y móvil. Sin despliegue externo.
